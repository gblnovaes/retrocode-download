/*
 * Montador 6502 (sintaxe MOS: `LDA #$05`, `STA $0200,X`, `LDA ($10),Y`).
 * Aceita rótulos (`nome:`), constantes (`nome = valor` ou `nome .equ valor`), diretivas
 * `.org` / `*=`, `.byte`/`.db`, `.word`/`.dw` e `.res`, e expressões com + - * / & | ^ << >>, < e >.
 * Sem .org o programa começa em $0600. Em dois passos: o primeiro mede e coleta símbolos,
 * o segundo gera os bytes (o modo zero page ou absoluto fica o mesmo nos dois).
 *
 * montar(fonte) -> { ok, erros:[{linha,msg}], segmentos:[{origem,bytes}], simbolos, entrada, tamanho, instrucoes }
 */
(function (root) {
  'use strict';
  const node = typeof require === 'function' && typeof module === 'object';
  const { DEFS, TAMANHO } = node ? require('./cpu.js') : root.Mos6502;

  const ORIGEM_PADRAO = 0x0600;
  const DESVIOS = new Set(['BCC', 'BCS', 'BEQ', 'BMI', 'BNE', 'BPL', 'BVC', 'BVS']);
  const ACUMULADOR = new Set(['ASL', 'LSR', 'ROL', 'ROR']);

  class ErroMontagem extends Error {}
  const falha = (msg) => { throw new ErroMontagem(msg); };

  // ---------------------------------------------------------------- expressões
  function avaliar(texto, ctx) {
    const s = texto.trim();
    let i = 0;
    let desconhecido = false;
    const espaco = () => { while (i < s.length && /\s/.test(s[i])) i++; };
    const resto = () => s.slice(i);

    function numero() {
      let m;
      if ((m = /^\$([0-9A-Fa-f]+)/.exec(resto()))) { i += m[0].length; return parseInt(m[1], 16); }
      if ((m = /^0[xX]([0-9A-Fa-f]+)/.exec(resto()))) { i += m[0].length; return parseInt(m[1], 16); }
      if ((m = /^%([01]+)/.exec(resto()))) { i += m[0].length; return parseInt(m[1], 2); }
      if ((m = /^\d+/.exec(resto()))) { i += m[0].length; return parseInt(m[0], 10); }
      if ((m = /^'(.)'/.exec(resto()))) { i += m[0].length; return m[1].charCodeAt(0) & 0xFF; }
      if ((m = /^[$%]\S*/.exec(resto()))) falha("Número inválido '" + m[0] + "'.");
      return null;
    }

    function primario() {
      espaco();
      const c = s[i];
      if (c === undefined) falha('Expressão incompleta.');
      if (c === '(') {
        i++; const v = ou(); espaco();
        if (s[i] !== ')') falha("Falta fechar o parêntese em '" + s + "'.");
        i++; return v;
      }
      if (c === '*') { i++; return ctx.pc; }
      const n = numero();
      if (n !== null) return n;
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(resto());
      if (m) {
        i += m[0].length;
        const v = ctx.simbolos[m[0].toUpperCase()];
        if (v === undefined) {
          if (ctx.tolerante) { desconhecido = true; return 0; }
          falha("O rótulo ou constante '" + m[0] + "' não foi definido.");
        }
        return v;
      }
      return falha("Expressão inválida em '" + s + "'.");
    }
    function unario() {
      espaco();
      const c = s[i];
      if (c === '-') { i++; return -unario(); }
      if (c === '+') { i++; return unario(); }
      if (c === '~') { i++; return (~unario()) & 0xFFFF; }
      if (c === '<') { i++; return unario() & 0xFF; }
      if (c === '>') { i++; return (unario() >> 8) & 0xFF; }
      return primario();
    }
    function mul() {
      let v = unario();
      for (;;) {
        espaco();
        if (s[i] === '*') { i++; v = v * unario(); }
        else if (s[i] === '/') { i++; const d = unario(); if (d === 0 && !desconhecido) falha('Divisão por zero.'); v = d === 0 ? 0 : Math.trunc(v / d); }
        else return v;
      }
    }
    function soma() {
      let v = mul();
      for (;;) {
        espaco();
        if (s[i] === '+') { i++; v += mul(); }
        else if (s[i] === '-') { i++; v -= mul(); }
        else return v;
      }
    }
    function desloc() {
      let v = soma();
      for (;;) {
        espaco();
        if (s.startsWith('<<', i)) { i += 2; v = v << soma(); }
        else if (s.startsWith('>>', i)) { i += 2; v = v >> soma(); }
        else return v;
      }
    }
    function e() { let v = desloc(); for (;;) { espaco(); if (s[i] === '&') { i++; v &= desloc(); } else return v; } }
    function xou() { let v = e(); for (;;) { espaco(); if (s[i] === '^') { i++; v ^= e(); } else return v; } }
    function ou() { let v = xou(); for (;;) { espaco(); if (s[i] === '|') { i++; v |= xou(); } else return v; } }

    const valor = ou();
    espaco();
    if (i < s.length) falha("Sobrou texto na expressão: '" + s.slice(i) + "'.");
    return { valor, desconhecido };
  }

  // ---------------------------------------------------------------- linhas
  function tirarComentario(linha) {
    let aspas = false, chr = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"' && !chr) aspas = !aspas;
      else if (c === "'" && !aspas && linha[i + 2] === "'") { i += 2; }
      else if (c === ';' && !aspas) return linha.slice(0, i);
    }
    return linha;
  }

  function dividirArgumentos(texto) {
    const partes = []; let atual = '', aspas = false;
    for (const c of texto) {
      if (c === '"') { aspas = !aspas; atual += c; }
      else if (c === ',' && !aspas) { partes.push(atual.trim()); atual = ''; }
      else atual += c;
    }
    if (atual.trim() !== '' || partes.length) partes.push(atual.trim());
    return partes;
  }

  // classifica o operando: devolve { modo, expr }. Modos "zp" e "abs" são escolhidos depois.
  function classificar(mn, operando) {
    const op = operando.trim();
    if (op === '') return { modo: ACUMULADOR.has(mn) && DEFS[mn].acc ? 'acc' : 'imp', expr: null };
    // `A` é o acumulador só nas instruções que têm esse modo (ASL, LSR, ROL, ROR); nas demais é um nome comum
    if (/^A$/i.test(op) && DEFS[mn].acc) return { modo: 'acc', expr: null };
    if (op[0] === '#') return { modo: 'imm', expr: op.slice(1) };
    let m;
    if ((m = /^\((.*),\s*X\s*\)$/i.exec(op))) return { modo: 'izx', expr: m[1] };
    if ((m = /^\((.*)\)\s*,\s*Y$/i.exec(op))) return { modo: 'izy', expr: m[1] };
    if (/^\(.*\)$/.test(op) && mn === 'JMP') return { modo: 'ind', expr: op.slice(1, -1) };
    if ((m = /^(.*?)\s*,\s*X$/i.exec(op))) return { modo: 'x', expr: m[1] };
    if ((m = /^(.*?)\s*,\s*Y$/i.exec(op))) return { modo: 'y', expr: m[1] };
    return { modo: DESVIOS.has(mn) ? 'rel' : 'mem', expr: op };
  }

  // erros de expressão de uma instrução citam o mnemônico ("LDA: ...")
  function avaliarEm(mn, expr, ctx) {
    try { return avaliar(expr, ctx); } catch (e) { if (e instanceof ErroMontagem) throw new ErroMontagem(mn + ': ' + e.message); throw e; }
  }

  function montar(fonte) {
    const erros = [];
    const linhasTexto = String(fonte).replace(/\r\n?/g, '\n').split('\n');
    const itens = [];

    // ------------ análise das linhas (sem avaliar valores)
    linhasTexto.forEach((bruta, idx) => {
      const linha = idx + 1;
      let texto = tirarComentario(bruta).trim();
      if (!texto) return;
      try {
        let m;
        if ((m = /^\*\s*=\s*(.+)$/.exec(texto))) { itens.push({ linha, tipo: 'org', expr: m[1] }); return; }
        if ((m = /^([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|\.equ\b|\bequ\b)\s*(.+)$/i.exec(texto)) && !/^(?:LDA|LDX|LDY|STA|STX|STY|ADC|SBC|AND|ORA|EOR|CMP|CPX|CPY)$/i.test(m[1])) {
          itens.push({ linha, tipo: 'equ', nome: m[1], expr: m[2] }); return;
        }
        while ((m = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(texto))) {
          itens.push({ linha, tipo: 'rotulo', nome: m[1] });
          texto = m[2].trim();
        }
        if (!texto) return;
        if ((m = /^\.([A-Za-z]+)\s*(.*)$/.exec(texto))) {
          const d = m[1].toLowerCase();
          if (d === 'org') itens.push({ linha, tipo: 'org', expr: m[2] });
          else if (d === 'byte' || d === 'db') itens.push({ linha, tipo: 'bytes', args: dividirArgumentos(m[2]) });
          else if (d === 'word' || d === 'dw') itens.push({ linha, tipo: 'palavras', args: dividirArgumentos(m[2]) });
          else if (d === 'res' || d === 'ds') itens.push({ linha, tipo: 'res', expr: m[2] });
          else if (d === 'equ') falha('Use `nome = valor` ou `nome .equ valor`.');
          else falha("Diretiva desconhecida '." + m[1] + "'.");
          return;
        }
        m = /^([A-Za-z]{3})(?:\s+(.*))?$/.exec(texto);
        if (!m) falha("Não entendi a linha '" + texto + "'.");
        const mn = m[1].toUpperCase();
        if (!DEFS[mn]) falha("Instrução desconhecida '" + m[1] + "'.");
        itens.push({ linha, tipo: 'instrucao', mn, operando: (m[2] || '').trim() });
      } catch (e) {
        if (!(e instanceof ErroMontagem)) throw e;
        erros.push({ linha, msg: e.message });
      }
    });

    const simbolos = {};
    const linhaDoSimbolo = {};
    const modos = new Map();            // item -> modo escolhido no passo 1
    const segmentos = [];
    const instrucoes = [];

    // constantes que não dependem de rótulos valem desde o início (podem ser usadas antes de definidas)
    for (let volta = 0; volta < 5; volta++) {
      for (const it of itens) {
        if (it.tipo !== 'equ' || simbolos[it.nome.toUpperCase()] !== undefined) continue;
        try { const r = avaliar(it.expr, { simbolos, pc: 0, tolerante: true }); if (!r.desconhecido) simbolos[it.nome.toUpperCase()] = r.valor; } catch (e) { /* o passo 1 reporta */ }
      }
    }
    const equPre = new Set(Object.keys(simbolos));

    function definir(nome, valor, linha) {
      const chave = nome.toUpperCase();
      if (linhaDoSimbolo[chave] !== undefined) falha("O rótulo '" + nome + "' já foi definido na linha " + linhaDoSimbolo[chave] + '.');
      simbolos[chave] = valor; linhaDoSimbolo[chave] = linha;
    }

    function escolher(it, cls, ctx) {
      const tabela = DEFS[it.mn];
      const { modo } = cls;
      const tem = (x) => tabela[x] !== undefined;
      if (modo === 'imp' || modo === 'acc' || modo === 'imm' || modo === 'izx' || modo === 'izy' || modo === 'ind' || modo === 'rel') {
        if (!tem(modo)) {
          if (modo === 'imp' && cls.expr === null && !it.operando) falha(it.mn + ' precisa de um operando.');
          falha('Modo de endereçamento inválido para ' + it.mn + '.');
        }
        return modo;
      }
      const sufixo = modo === 'x' ? 'x' : modo === 'y' ? 'y' : '';
      const zp = 'zp' + sufixo, ab = (modo === 'mem' ? 'abs' : 'ab' + sufixo);
      if (!tem(zp) && !tem(ab)) falha('Modo de endereçamento inválido para ' + it.mn + '.');
      const r = avaliarEm(it.mn, cls.expr, ctx);
      if (tem(zp) && (!tem(ab) || (!r.desconhecido && r.valor >= 0 && r.valor <= 0xFF))) return zp;
      return ab;
    }

    // ------------ passo 1: tamanhos e símbolos
    let pc = ORIGEM_PADRAO;
    for (const it of itens) {
      try {
        const ctx = { simbolos, pc, tolerante: true };
        if (it.tipo === 'org') { const r = avaliar(it.expr, { simbolos, pc, tolerante: false }); pc = r.valor & 0xFFFF; }
        else if (it.tipo === 'rotulo') definir(it.nome, pc, it.linha);
        else if (it.tipo === 'equ') {
          const r = avaliar(it.expr, ctx);
          if (!equPre.has(it.nome.toUpperCase())) definir(it.nome, r.valor, it.linha);
          else { if (linhaDoSimbolo[it.nome.toUpperCase()] !== undefined) falha("O rótulo '" + it.nome + "' já foi definido na linha " + linhaDoSimbolo[it.nome.toUpperCase()] + '.'); linhaDoSimbolo[it.nome.toUpperCase()] = it.linha; }
        }
        else if (it.tipo === 'bytes') pc += it.args.reduce((n, a) => n + (/^".*"$/.test(a) ? a.length - 2 : 1), 0);
        else if (it.tipo === 'palavras') pc += 2 * it.args.length;
        else if (it.tipo === 'res') { const r = avaliar(it.expr, { simbolos, pc, tolerante: false }); pc += r.valor; }
        else if (it.tipo === 'instrucao') {
          const cls = classificar(it.mn, it.operando);
          if (cls.expr === null && cls.modo === 'imp' && !it.operando && !DEFS[it.mn].imp) falha(it.mn + ' precisa de um operando.');
          if (cls.expr !== null && cls.modo !== 'imp' && cls.modo !== 'acc' && it.operando === '') falha(it.mn + ' precisa de um operando.');
          if (it.operando !== '' && (cls.modo === 'imp' || cls.modo === 'acc') && cls.modo !== 'acc') falha(it.mn + ' não aceita operando.');
          if (it.operando !== '' && DEFS[it.mn].imp && Object.keys(DEFS[it.mn]).length === 1) falha(it.mn + ' não aceita operando.');
          const modo = escolher(it, cls, ctx);
          modos.set(it, modo);
          pc += TAMANHO[modo];
        }
      } catch (e) {
        if (!(e instanceof ErroMontagem)) throw e;
        erros.push({ linha: it.linha, msg: e.message });
      }
    }
    if (erros.length) return { ok: false, erros: erros.sort((a, b) => a.linha - b.linha), segmentos: [], simbolos, entrada: ORIGEM_PADRAO, tamanho: 0, instrucoes: [] };

    // ------------ passo 2: bytes
    pc = ORIGEM_PADRAO;
    let seg = { origem: pc, bytes: [] };
    segmentos.push(seg);
    const emitir = (bs) => { seg.bytes.push(...bs); pc += bs.length; };
    const novoSegmento = (origem) => {
      if (seg.bytes.length === 0) seg.origem = origem;
      else { seg = { origem, bytes: [] }; segmentos.push(seg); }
      pc = origem;
    };
    // constantes que dependem de rótulos são reavaliadas agora que todos os rótulos existem
    for (const it of itens) if (it.tipo === 'equ') { try { simbolos[it.nome.toUpperCase()] = avaliar(it.expr, { simbolos, pc: 0, tolerante: false }).valor; } catch (e) { /* já reportado */ } }

    // aceita 0..255 e também -128..-1 (complemento de dois)
    const byte = (v, ctxMsg) => {
      if (v < -128 || v > 0xFF) falha('O valor ' + v + ' não cabe em um byte' + ctxMsg + '.');
      return v & 0xFF;
    };

    for (const it of itens) {
      try {
        const ctx = { simbolos, pc, tolerante: false };
        if (it.tipo === 'org') novoSegmento(avaliar(it.expr, ctx).valor & 0xFFFF);
        else if (it.tipo === 'bytes') {
          for (const a of it.args) {
            if (/^".*"$/.test(a)) emitir(Array.from(a.slice(1, -1), c => c.charCodeAt(0) & 0xFF));
            else emitir([byte(avaliar(a, ctx).valor, ' em .byte')]);
          }
        } else if (it.tipo === 'palavras') {
          for (const a of it.args) { const v = avaliar(a, ctx).valor; if (v < -32768 || v > 0xFFFF) falha('O valor ' + v + ' não cabe em uma palavra de 16 bits.'); emitir([v & 0xFF, (v >> 8) & 0xFF]); }
        } else if (it.tipo === 'res') emitir(new Array(avaliar(it.expr, ctx).valor).fill(0));
        else if (it.tipo === 'instrucao') {
          const modo = modos.get(it);
          const cls = classificar(it.mn, it.operando);
          const [opcode] = DEFS[it.mn][modo];
          const inicio = pc;
          let corpo = [opcode];
          if (cls.expr !== null) {
            const v = avaliarEm(it.mn, cls.expr, ctx).valor;
            if (modo === 'imm') corpo.push(byte(v, ' em ' + it.mn + ' #' + cls.expr.trim()));
            else if (modo === 'rel') {
              const d = v - (pc + 2);
              if (d < -128 || d > 127) falha('O desvio de ' + it.mn + ' é longe demais (' + d + ' bytes; o máximo é de -128 a 127). Use um JMP.');
              corpo.push(d & 0xFF);
            } else if (TAMANHO[modo] === 2) {
              if (v < 0 || v > 0xFF) falha('O endereço ' + v + ' não cabe na zero page (0 a 255) em ' + it.mn + '.');
              corpo.push(v);
            } else {
              if (v < 0 || v > 0xFFFF) falha('O endereço ' + v + ' não cabe em 16 bits em ' + it.mn + '.');
              corpo.push(v & 0xFF, (v >> 8) & 0xFF);
            }
          }
          emitir(corpo);
          instrucoes.push({ linha: it.linha, endereco: inicio, tam: corpo.length, mn: it.mn, modo });
        }
      } catch (e) {
        if (!(e instanceof ErroMontagem)) throw e;
        erros.push({ linha: it.linha, msg: e.message });
      }
    }

    const finais = segmentos.filter(s => s.bytes.length);
    const entrada = simbolos.INICIO !== undefined ? simbolos.INICIO : simbolos.START !== undefined ? simbolos.START : (finais.length ? finais[0].origem : ORIGEM_PADRAO);
    return {
      ok: erros.length === 0, erros: erros.sort((a, b) => a.linha - b.linha), segmentos: finais.length ? finais : (erros.length ? [] : segmentos),
      simbolos, entrada, tamanho: finais.reduce((n, s) => n + s.bytes.length, 0), instrucoes
    };
  }

  const api = { montar, avaliar };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Mos6502 = Object.assign(root.Mos6502 || {}, { montar, avaliar });
})(typeof self !== 'undefined' ? self : this);
