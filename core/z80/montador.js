/*
 * Montador Z80 (sintaxe Zilog: `LD A,5`, `LD (HL),B`, `LD A,(IX+3)`, `JP NZ,loop`).
 * Aceita rótulos (`nome:`), constantes (`nome EQU valor`, `nome = valor` ou `nome .equ valor`),
 * diretivas ORG, DB/DEFB/.byte, DW/DEFW/.word e DS/DEFS, e expressões com + - * / & | ^ << >>, < e >.
 * Números: `$FF`, `0FFh`, `0xFF`, `%1010`, `1010b`, decimal e `'A'`; `$` sozinho é o endereço da linha.
 * Sem ORG o programa começa em $0000. Nomes de registradores e condições não servem de rótulo.
 *
 * montar(fonte) -> { ok, erros:[{linha,msg}], segmentos:[{origem,bytes}], simbolos, entrada, tamanho, instrucoes }
 * Cada instrução: { linha, endereco, tam, mn, alvo, cond } (alvo = destino de JP/JR/DJNZ/CALL com endereço fixo).
 */
(function (root) {
  'use strict';

  const ORIGEM_PADRAO = 0x0000;
  class ErroMontagem extends Error {}
  const falha = (msg) => { throw new ErroMontagem(msg); };

  const R8 = { B: 0, C: 1, D: 2, E: 3, H: 4, L: 5, A: 7 };
  const RP = new Set(['BC', 'DE', 'HL', 'SP', 'AF', 'IX', 'IY']);
  const CC = { NZ: 0, Z: 1, NC: 2, C: 3, PO: 4, PE: 5, P: 6, M: 7 };
  const RESERVADOS = new Set([...Object.keys(R8), 'I', 'R', ...RP, ...Object.keys(CC)]);
  const ALU = { ADD: 0, ADC: 1, SUB: 2, SBC: 3, AND: 4, XOR: 5, OR: 6, CP: 7 };
  const ROT = { RLC: 0, RRC: 1, RL: 2, RR: 3, SLA: 4, SRA: 5, SRL: 7 };
  const SEM_OPERANDO = {
    NOP: [0x00], HALT: [0x76], DAA: [0x27], CPL: [0x2F], CCF: [0x3F], SCF: [0x37], DI: [0xF3], EI: [0xFB], EXX: [0xD9],
    RLCA: [0x07], RRCA: [0x0F], RLA: [0x17], RRA: [0x1F], NEG: [0xED, 0x44], RETI: [0xED, 0x4D], RETN: [0xED, 0x45],
    RLD: [0xED, 0x6F], RRD: [0xED, 0x67], LDI: [0xED, 0xA0], LDD: [0xED, 0xA8], LDIR: [0xED, 0xB0], LDDR: [0xED, 0xB8],
    CPI: [0xED, 0xA1], CPD: [0xED, 0xA9], CPIR: [0xED, 0xB1], CPDR: [0xED, 0xB9]
  };
  const COM_OPERANDO = new Set(['LD', 'PUSH', 'POP', 'EX', 'ADD', 'ADC', 'SUB', 'SBC', 'AND', 'XOR', 'OR', 'CP', 'INC', 'DEC', 'IM',
    'RLC', 'RRC', 'RL', 'RR', 'SLA', 'SRA', 'SRL', 'BIT', 'RES', 'SET', 'JP', 'JR', 'DJNZ', 'CALL', 'RET', 'RST', 'IN', 'OUT']);
  const DESVIOS = new Set(['JP', 'JR', 'DJNZ', 'CALL']);

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
      if ((m = /^([0-9][0-9A-Fa-f]*)[hH](?![A-Za-z0-9_])/.exec(resto()))) { i += m[0].length; return parseInt(m[1], 16); }
      if ((m = /^([01]+)[bB](?![A-Za-z0-9_])/.exec(resto()))) { i += m[0].length; return parseInt(m[1], 2); }
      if ((m = /^\d+(?![A-Za-z0-9_])/.exec(resto()))) { i += m[0].length; return parseInt(m[0], 10); }
      if ((m = /^'(.)'/.exec(resto()))) { i += m[0].length; return m[1].charCodeAt(0) & 0xFF; }
      if ((m = /^[0-9$%][A-Za-z0-9_]*/.exec(resto()))) falha("Número inválido '" + m[0] + "'.");
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
      if (c === '$' && !/^\$[0-9A-Fa-f]/.test(resto())) { i++; return ctx.pc; }
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
    let aspas = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') aspas = !aspas;
      else if (c === "'" && !aspas && linha[i + 2] === "'") { i += 2; }
      else if (c === ';' && !aspas) return linha.slice(0, i);
    }
    return linha;
  }

  function dividirArgumentos(texto) {
    const partes = []; let atual = '', aspas = false, nivel = 0;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (c === '"') { aspas = !aspas; atual += c; }
      else if (c === "'" && !aspas && texto[i + 2] === "'") { atual += texto.slice(i, i + 3); i += 2; }
      else if (c === '(' && !aspas) { nivel++; atual += c; }
      else if (c === ')' && !aspas) { nivel--; atual += c; }
      else if (c === ',' && !aspas && nivel === 0) { partes.push(atual.trim()); atual = ''; }
      else atual += c;
    }
    if (atual.trim() !== '' || partes.length) partes.push(atual.trim());
    return partes;
  }

  // ---------------------------------------------------------------- operandos
  // devolve { k, ... }: r (registrador de 8 bits), hlm ((HL)), idx ((IX+d)), rp (par), ind ((BC), (DE), (SP), (C)),
  // mem ((nn)), cc (condição), ir (I ou R), imm (expressão)
  function operando(txt, aceitaCC) {
    const t = txt.trim();
    if (t === '') falha('Falta um operando.');
    const U = t.toUpperCase();
    if (aceitaCC && CC[U] !== undefined) return { k: 'cc', n: CC[U], nome: U };
    if (R8[U] !== undefined) return { k: 'r', n: R8[U], nome: U };
    if (U === 'I' || U === 'R') return { k: 'ir', nome: U };
    if (RP.has(U)) return { k: 'rp', nome: U };
    if (U === "AF'") return { k: 'rp', nome: "AF'" };
    let m;
    if (t[0] === '(' && t[t.length - 1] === ')') {
      const dentro = t.slice(1, -1).trim(), D = dentro.toUpperCase();
      if (D === 'HL') return { k: 'hlm' };
      if (D === 'BC' || D === 'DE' || D === 'SP' || D === 'C') return { k: 'ind', nome: D };
      if ((m = /^(IX|IY)\s*(.*)$/i.exec(dentro))) {
        const desl = m[2].trim();
        if (desl !== '' && desl[0] !== '+' && desl[0] !== '-') falha("Use (" + m[1].toUpperCase() + "+d) ou (" + m[1].toUpperCase() + "-d).");
        return { k: 'idx', reg: m[1].toUpperCase(), e: desl === '' ? '0' : desl };
      }
      return { k: 'mem', e: dentro };
    }
    return { k: 'imm', e: t };
  }

  const ehR8 = (o) => o.k === 'r' || o.k === 'hlm';
  const cod8 = (o) => (o.k === 'hlm' ? 6 : o.n);
  const PREFIXO = { IX: 0xDD, IY: 0xFD };

  // ---------------------------------------------------------------- codificação
  function codificar(mn, ops, pc, ctx) {
    const val = (o) => avaliar(o.e, ctx).valor;
    const n8 = (o) => { const v = val(o); if (v < -128 || v > 0xFF) falha('O valor ' + v + ' não cabe em um byte (use de -128 a 255).'); return v & 0xFF; };
    const n16 = (o) => { const v = val(o); if (v < -32768 || v > 0xFFFF) falha('O valor ' + v + ' não cabe em 16 bits.'); return v & 0xFFFF; };
    const w = (v) => [v & 0xFF, (v >> 8) & 0xFF];
    const desl = (o) => { const v = val(o); if (v < -128 || v > 127) falha('O deslocamento ' + v + ' de (' + o.reg + '+d) deve ficar entre -128 e 127.'); return v & 0xFF; };
    const rel = (o) => {
      const alvo = val(o), d = alvo - (pc + 2);
      if (!ctx.tolerante && (d < -128 || d > 127)) falha('O desvio de ' + mn + ' é longe demais (' + d + ' bytes; o máximo é de -128 a 127). Use JP.');
      return { b: d & 0xFF, alvo };
    };
    const exige = (n) => { if (ops.length !== n) falha(mn + ' precisa de ' + n + ' operando' + (n === 1 ? '' : 's') + '.'); };
    const invalido = () => falha('Operandos inválidos para ' + mn + '.');
    const saida = (bytes, alvo, cond) => ({ bytes, alvo, cond: !!cond });

    if (SEM_OPERANDO[mn]) { if (ops.length) falha(mn + ' não aceita operando.'); return saida(SEM_OPERANDO[mn].slice()); }
    const [a, b] = ops;

    switch (mn) {
      case 'LD': {
        exige(2);
        if (ehR8(a) && ehR8(b)) { if (a.k === 'hlm' && b.k === 'hlm') invalido(); return saida([0x40 | (cod8(a) << 3) | cod8(b)]); }
        if (ehR8(a) && b.k === 'imm') return saida([0x06 | (cod8(a) << 3), n8(b)]);
        if (a.k === 'r' && b.k === 'idx') return saida([PREFIXO[b.reg], 0x46 | (a.n << 3), desl(b)]);
        if (a.k === 'idx' && b.k === 'r') return saida([PREFIXO[a.reg], 0x70 | b.n, desl(a)]);
        if (a.k === 'idx' && b.k === 'imm') return saida([PREFIXO[a.reg], 0x36, desl(a), n8(b)]);
        if (a.k === 'r' && a.nome === 'A') {
          if (b.k === 'ind' && b.nome === 'BC') return saida([0x0A]);
          if (b.k === 'ind' && b.nome === 'DE') return saida([0x1A]);
          if (b.k === 'mem') return saida([0x3A, ...w(n16({ e: b.e }))]);
          if (b.k === 'ir') return saida([0xED, b.nome === 'I' ? 0x57 : 0x5F]);
        }
        if (b.k === 'r' && b.nome === 'A') {
          if (a.k === 'ind' && a.nome === 'BC') return saida([0x02]);
          if (a.k === 'ind' && a.nome === 'DE') return saida([0x12]);
          if (a.k === 'mem') return saida([0x32, ...w(n16({ e: a.e }))]);
          if (a.k === 'ir') return saida([0xED, a.nome === 'I' ? 0x47 : 0x4F]);
        }
        if (a.k === 'rp' && a.nome === 'SP' && b.k === 'rp') {
          if (b.nome === 'HL') return saida([0xF9]);
          if (b.nome === 'IX' || b.nome === 'IY') return saida([PREFIXO[b.nome], 0xF9]);
        }
        if (a.k === 'rp' && b.k === 'imm') {
          const p = { BC: 0, DE: 1, HL: 2, SP: 3 }[a.nome];
          if (p !== undefined) return saida([0x01 | (p << 4), ...w(n16(b))]);
          if (a.nome === 'IX' || a.nome === 'IY') return saida([PREFIXO[a.nome], 0x21, ...w(n16(b))]);
        }
        if (a.k === 'rp' && b.k === 'mem') {
          const v = w(n16({ e: b.e }));
          if (a.nome === 'HL') return saida([0x2A, ...v]);
          if (a.nome === 'IX' || a.nome === 'IY') return saida([PREFIXO[a.nome], 0x2A, ...v]);
          const p = { BC: 0, DE: 1, SP: 3 }[a.nome];
          if (p !== undefined) return saida([0xED, 0x4B | (p << 4), ...v]);
        }
        if (a.k === 'mem' && b.k === 'rp') {
          const v = w(n16({ e: a.e }));
          if (b.nome === 'HL') return saida([0x22, ...v]);
          if (b.nome === 'IX' || b.nome === 'IY') return saida([PREFIXO[b.nome], 0x22, ...v]);
          const p = { BC: 0, DE: 1, SP: 3 }[b.nome];
          if (p !== undefined) return saida([0xED, 0x43 | (p << 4), ...v]);
        }
        return invalido();
      }
      case 'PUSH': case 'POP': {
        exige(1);
        const base = mn === 'PUSH' ? 0xC5 : 0xC1;
        if (a.k !== 'rp') invalido();
        const p = { BC: 0, DE: 1, HL: 2, AF: 3 }[a.nome];
        if (p !== undefined) return saida([base | (p << 4)]);
        if (a.nome === 'IX' || a.nome === 'IY') return saida([PREFIXO[a.nome], base | 0x20]);
        return invalido();
      }
      case 'EX': {
        exige(2);
        if (a.k === 'rp' && a.nome === 'DE' && b.k === 'rp' && b.nome === 'HL') return saida([0xEB]);
        if (a.k === 'rp' && a.nome === 'AF' && b.k === 'rp' && b.nome === "AF'") return saida([0x08]);
        if (a.k === 'ind' && a.nome === 'SP' && b.k === 'rp') {
          if (b.nome === 'HL') return saida([0xE3]);
          if (b.nome === 'IX' || b.nome === 'IY') return saida([PREFIXO[b.nome], 0xE3]);
        }
        return invalido();
      }
      case 'ADD': case 'ADC': case 'SUB': case 'SBC': case 'AND': case 'XOR': case 'OR': case 'CP': {
        const y = ALU[mn];
        // 16 bits: ADD HL/IX/IY,rp ; ADC/SBC HL,rp
        if (ops.length === 2 && a.k === 'rp') {
          if (b.k !== 'rp') invalido();
          if (mn === 'ADD') {
            if (a.nome === 'HL') { const p = { BC: 0, DE: 1, HL: 2, SP: 3 }[b.nome]; if (p === undefined) invalido(); return saida([0x09 | (p << 4)]); }
            if (a.nome === 'IX' || a.nome === 'IY') {
              const p = { BC: 0, DE: 1, SP: 3 }[b.nome];
              if (b.nome === a.nome) return saida([PREFIXO[a.nome], 0x29]);
              if (p === undefined) invalido();
              return saida([PREFIXO[a.nome], 0x09 | (p << 4)]);
            }
          }
          if ((mn === 'ADC' || mn === 'SBC') && a.nome === 'HL') {
            const p = { BC: 0, DE: 1, HL: 2, SP: 3 }[b.nome]; if (p === undefined) invalido();
            return saida([0xED, (mn === 'ADC' ? 0x4A : 0x42) | (p << 4)]);
          }
          return invalido();
        }
        let x;
        if (ops.length === 2) {
          if (!(a.k === 'r' && a.nome === 'A')) invalido();
          x = b;
        } else if (ops.length === 1 && y >= 2 && y !== 3) x = a;
        else if (ops.length === 1) falha(mn + ' precisa de dois operandos (por exemplo, ' + mn + ' A,B).');
        else return exige(2);
        if (ehR8(x)) return saida([0x80 | (y << 3) | cod8(x)]);
        if (x.k === 'idx') return saida([PREFIXO[x.reg], 0x80 | (y << 3) | 6, desl(x)]);
        if (x.k === 'imm') return saida([0xC6 | (y << 3), n8(x)]);
        return invalido();
      }
      case 'INC': case 'DEC': {
        exige(1);
        const inc = mn === 'INC';
        if (ehR8(a)) return saida([(inc ? 0x04 : 0x05) | (cod8(a) << 3)]);
        if (a.k === 'idx') return saida([PREFIXO[a.reg], inc ? 0x34 : 0x35, desl(a)]);
        if (a.k === 'rp') {
          const p = { BC: 0, DE: 1, HL: 2, SP: 3 }[a.nome];
          if (p !== undefined) return saida([(inc ? 0x03 : 0x0B) | (p << 4)]);
          if (a.nome === 'IX' || a.nome === 'IY') return saida([PREFIXO[a.nome], inc ? 0x23 : 0x2B]);
        }
        return invalido();
      }
      case 'IM': {
        exige(1);
        const v = a.k === 'imm' ? val(a) : -1;
        if (v !== 0 && v !== 1 && v !== 2) falha('IM aceita 0, 1 ou 2.');
        return saida([0xED, [0x46, 0x56, 0x5E][v]]);
      }
      case 'RLC': case 'RRC': case 'RL': case 'RR': case 'SLA': case 'SRA': case 'SRL': {
        exige(1);
        const y = ROT[mn];
        if (ehR8(a)) return saida([0xCB, (y << 3) | cod8(a)]);
        if (a.k === 'idx') return saida([PREFIXO[a.reg], 0xCB, desl(a), (y << 3) | 6]);
        return invalido();
      }
      case 'BIT': case 'RES': case 'SET': {
        exige(2);
        if (a.k !== 'imm') invalido();
        const bit = val(a);
        if (bit < 0 || bit > 7) falha('O número do bit em ' + mn + ' vai de 0 a 7.');
        const base = mn === 'BIT' ? 0x40 : mn === 'RES' ? 0x80 : 0xC0;
        if (ehR8(b)) return saida([0xCB, base | (bit << 3) | cod8(b)]);
        if (b.k === 'idx') return saida([PREFIXO[b.reg], 0xCB, desl(b), base | (bit << 3) | 6]);
        return invalido();
      }
      case 'JP': {
        if (ops.length === 1) {
          if (a.k === 'hlm') return saida([0xE9]);
          if (a.k === 'idx' && a.e === '0') return saida([PREFIXO[a.reg], 0xE9]);
          if (a.k === 'mem' && /^(HL|IX|IY)$/i.test(a.e)) return invalido();
          if (a.k === 'imm') { const v = n16(a); return saida([0xC3, ...w(v)], v); }
          return invalido();
        }
        exige(2);
        if (a.k !== 'cc' || b.k !== 'imm') invalido();
        const v = n16(b);
        return saida([0xC2 | (a.n << 3), ...w(v)], v, true);
      }
      case 'CALL': {
        if (ops.length === 1) { if (a.k !== 'imm') invalido(); const v = n16(a); return saida([0xCD, ...w(v)], v); }
        exige(2);
        if (a.k !== 'cc' || b.k !== 'imm') invalido();
        const v = n16(b);
        return saida([0xC4 | (a.n << 3), ...w(v)], v, true);
      }
      case 'JR': {
        if (ops.length === 1) { if (a.k !== 'imm') invalido(); const r = rel(a); return saida([0x18, r.b], r.alvo); }
        exige(2);
        if (a.k !== 'cc' || a.n > 3 || b.k !== 'imm') falha('JR só aceita as condições NZ, Z, NC e C.');
        const r = rel(b);
        return saida([0x20 | (a.n << 3), r.b], r.alvo, true);
      }
      case 'DJNZ': {
        exige(1);
        if (a.k !== 'imm') invalido();
        const r = rel(a);
        return saida([0x10, r.b], r.alvo, true);
      }
      case 'RET': {
        if (ops.length === 0) return saida([0xC9]);
        exige(1);
        if (a.k !== 'cc') invalido();
        return saida([0xC0 | (a.n << 3)], undefined, true);
      }
      case 'RST': {
        exige(1);
        if (a.k !== 'imm') invalido();
        const v = val(a);
        if (v < 0 || v > 0x38 || v % 8 !== 0) falha('RST aceita 0, 8, 16, 24, 32, 40, 48 ou 56 ($00 a $38).');
        return saida([0xC7 | v], v);
      }
      case 'IN': {
        exige(2);
        if (a.k === 'r' && a.nome === 'A' && b.k === 'mem') return saida([0xDB, n8({ e: b.e })]);
        if (a.k === 'r' && b.k === 'ind' && b.nome === 'C') return saida([0xED, 0x40 | (a.n << 3)]);
        return invalido();
      }
      case 'OUT': {
        exige(2);
        if (b.k === 'r' && b.nome === 'A' && a.k === 'mem') return saida([0xD3, n8({ e: a.e })]);
        if (a.k === 'ind' && a.nome === 'C' && b.k === 'r') return saida([0xED, 0x41 | (b.n << 3)]);
        return invalido();
      }
      default: return falha("Instrução desconhecida '" + mn + "'.");
    }
  }

  function montar(fonte) {
    const erros = [];
    const linhasTexto = String(fonte).replace(/\r\n?/g, '\n').split('\n');
    const itens = [];
    const marcar = (linha, msg) => { if (!erros.some(e => e.linha === linha)) erros.push({ linha, msg }); };

    // ------------ análise das linhas (sem avaliar valores)
    linhasTexto.forEach((bruta, idx) => {
      const linha = idx + 1;
      let texto = tirarComentario(bruta).trim();
      if (!texto) return;
      try {
        let m;
        if ((m = /^([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|\.?equ\b)\s*(.+)$/i.exec(texto)) ) {
          itens.push({ linha, tipo: 'equ', nome: m[1], expr: m[2] }); return;
        }
        while ((m = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(texto))) {
          itens.push({ linha, tipo: 'rotulo', nome: m[1] });
          texto = m[2].trim();
        }
        if (!texto) return;
        m = /^\.?([A-Za-z]+)(?:\s+(.*))?$/.exec(texto);
        if (!m) falha("Não entendi a linha '" + texto + "'.");
        const mn = m[1].toUpperCase(), resto = (m[2] || '').trim();
        if (mn === 'ORG') itens.push({ linha, tipo: 'org', expr: resto });
        else if (mn === 'DB' || mn === 'DEFB' || mn === 'BYTE') itens.push({ linha, tipo: 'bytes', args: dividirArgumentos(resto) });
        else if (mn === 'DW' || mn === 'DEFW' || mn === 'WORD') itens.push({ linha, tipo: 'palavras', args: dividirArgumentos(resto) });
        else if (mn === 'DS' || mn === 'DEFS') itens.push({ linha, tipo: 'res', expr: resto });
        else if (mn === 'END') { /* ignorado */ }
        else if (SEM_OPERANDO[mn] || COM_OPERANDO.has(mn)) itens.push({ linha, tipo: 'instrucao', mn, args: resto === '' ? [] : dividirArgumentos(resto) });
        else falha("Instrução desconhecida '" + m[1] + "'.");
      } catch (e) {
        if (!(e instanceof ErroMontagem)) throw e;
        marcar(linha, e.message);
      }
    });

    const simbolos = {};
    const linhaDoSimbolo = {};
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
      if (RESERVADOS.has(chave)) falha("'" + nome + "' é nome de registrador ou condição e não pode ser rótulo nem constante.");
      if (linhaDoSimbolo[chave] !== undefined) falha("O rótulo '" + nome + "' já foi definido na linha " + linhaDoSimbolo[chave] + '.');
      simbolos[chave] = valor; linhaDoSimbolo[chave] = linha;
    }

    function gerar(it, pc, ctx) {
      const ops = it.args.map((t, i) => operando(t, DESVIOS.has(it.mn) || it.mn === 'RET' ? (i === 0 && (it.args.length === 2 || it.mn === 'RET')) : false));
      return codificar(it.mn, ops, pc, ctx);
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
          else {
            const ch = it.nome.toUpperCase();
            if (RESERVADOS.has(ch)) falha("'" + it.nome + "' é nome de registrador ou condição e não pode ser rótulo nem constante.");
            if (linhaDoSimbolo[ch] !== undefined) falha("O rótulo '" + it.nome + "' já foi definido na linha " + linhaDoSimbolo[ch] + '.');
            linhaDoSimbolo[ch] = it.linha;
          }
        }
        else if (it.tipo === 'bytes') pc += it.args.reduce((n, a) => n + (/^".*"$/.test(a) ? a.length - 2 : 1), 0);
        else if (it.tipo === 'palavras') pc += 2 * it.args.length;
        else if (it.tipo === 'res') { const r = avaliar(it.expr, { simbolos, pc, tolerante: false }); pc += r.valor; }
        else if (it.tipo === 'instrucao') pc += gerar(it, pc, ctx).bytes.length;
      } catch (e) {
        if (!(e instanceof ErroMontagem)) throw e;
        marcar(it.linha, e.message);
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

    const byte = (v) => { if (v < -128 || v > 0xFF) falha('O valor ' + v + ' não cabe em um byte (DB).'); return v & 0xFF; };

    for (const it of itens) {
      try {
        const ctx = { simbolos, pc, tolerante: false };
        if (it.tipo === 'org') novoSegmento(avaliar(it.expr, ctx).valor & 0xFFFF);
        else if (it.tipo === 'bytes') {
          for (const a of it.args) {
            if (/^".*"$/.test(a)) emitir(Array.from(a.slice(1, -1), c => c.charCodeAt(0) & 0xFF));
            else emitir([byte(avaliar(a, ctx).valor)]);
          }
        } else if (it.tipo === 'palavras') {
          for (const a of it.args) { const v = avaliar(a, ctx).valor; if (v < -32768 || v > 0xFFFF) falha('O valor ' + v + ' não cabe em uma palavra de 16 bits.'); emitir([v & 0xFF, (v >> 8) & 0xFF]); }
        } else if (it.tipo === 'res') emitir(new Array(avaliar(it.expr, ctx).valor).fill(0));
        else if (it.tipo === 'instrucao') {
          const inicio = pc;
          const r = gerar(it, pc, ctx);
          emitir(r.bytes);
          instrucoes.push({ linha: it.linha, endereco: inicio, tam: r.bytes.length, mn: it.mn, alvo: r.alvo, cond: r.cond, args: it.args });
        }
      } catch (e) {
        if (!(e instanceof ErroMontagem)) throw e;
        marcar(it.linha, e.message);
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
  else root.Z80 = Object.assign(root.Z80 || {}, { montar, avaliar });
})(typeof self !== 'undefined' ? self : this);
