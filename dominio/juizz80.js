/*
 * Juiz do RetroCode para o Assembly Z80.
 * Monta a solução, confere as regras estáticas (proibir/exigir), roda cada teste numa CPU nova
 * e mede bytes e ciclos (T-states). Mesma forma de resposta dos juízes do 8086 e do 6502.
 *
 * Teste: setup e espera aceitam
 *   A B C D E H L        registradores de 8 bits (número)
 *   BC DE HL IX IY SP    registradores de 16 bits (número)
 *   CY Z S PV HC N       flags (0 ou 1): carry, zero, sinal, paridade/overflow, meio-carry e subtração
 *   nome ou "$8000"      memória: número (1 byte), lista de bytes, texto ou { "w": número | lista } (palavras little-endian)
 *   espera.mem           { alvo: valor } conferido byte a byte depois do programa
 *   espera.pilhaEquilibrada   SP igual ao inicial no fim
 * O HALT encerra o programa e não conta ciclos. Nomes de memória vêm das constantes do código do aluno.
 */
(function (root) {
  'use strict';
  const node = typeof require === 'function' && typeof module === 'object';
  const Cpu = node ? require('../core/z80/cpu.js') : root.Z80;
  const Mont = node ? require('../core/z80/montador.js') : root.Z80;
  const Recursao = node ? require('./recursaoz80.js') : root.RecursaoZ80;

  const MAX_PASSOS = 200000;
  const REG8 = ['A', 'B', 'C', 'D', 'E', 'H', 'L'];
  const REG16 = ['BC', 'DE', 'HL', 'IX', 'IY', 'SP'];
  const FLAGS = { CY: 0x01, N: 0x02, PV: 0x04, HC: 0x10, Z: 0x40, S: 0x80 };

  const hex = (n, d) => '$' + (n >>> 0).toString(16).toUpperCase().padStart(d, '0');
  const dec = (n, d) => n + ' (' + hex(n, d) + ')';

  function bytesDe(valor) {
    if (typeof valor === 'number') return [valor & 0xFF];
    if (typeof valor === 'string') return Array.from(valor, c => c.charCodeAt(0) & 0xFF);
    if (Array.isArray(valor)) return valor.map(v => (typeof v === 'string' ? v.charCodeAt(0) : v) & 0xFF);
    if (valor && valor.w !== undefined) return [].concat(valor.w).flatMap(w => [w & 0xFF, (w >> 8) & 0xFF]);
    return [];
  }

  function enderecoDe(alvo, simbolos) {
    if (/^\$[0-9A-Fa-f]{1,4}$/.test(alvo)) return parseInt(alvo.slice(1), 16);
    const v = simbolos[alvo.toUpperCase()];
    if (v === undefined) throw new Error("O código precisa definir '" + alvo + "' (não renomeie nem apague as constantes do enunciado).");
    return v;
  }

  function montarCpu(prog, setup) {
    const cpu = new Cpu.CpuZ80();
    prog.segmentos.forEach(s => cpu.carregar(s.origem, s.bytes));
    cpu.PC = prog.entrada;
    for (const k of Object.keys(setup)) {
      if (REG8.includes(k)) cpu[k] = setup[k] & 0xFF;
      else if (REG16.includes(k)) cpu[k] = setup[k] & 0xFFFF;
      else if (FLAGS[k] !== undefined) cpu.F = setup[k] ? (cpu.F | FLAGS[k]) : (cpu.F & ~FLAGS[k]);
      else cpu.carregar(enderecoDe(k, prog.simbolos), bytesDe(setup[k]));
    }
    return cpu;
  }

  function conferir(cpu, teste, prog, spInicial) {
    const msgs = [];
    const espera = teste.espera || {};
    for (const k of Object.keys(espera)) {
      if (k === 'mem' || k === 'pilhaEquilibrada') continue;
      if (REG8.includes(k)) {
        if (cpu[k] !== (espera[k] & 0xFF)) msgs.push(k + ' deveria ser ' + dec(espera[k] & 0xFF, 2) + ', mas ficou ' + dec(cpu[k], 2) + '.');
      } else if (REG16.includes(k)) {
        if (cpu[k] !== (espera[k] & 0xFFFF)) msgs.push(k + ' deveria ser ' + dec(espera[k] & 0xFFFF, 4) + ', mas ficou ' + dec(cpu[k], 4) + '.');
      } else if (FLAGS[k] !== undefined) {
        const real = (cpu.F & FLAGS[k]) ? 1 : 0;
        if (real !== (espera[k] ? 1 : 0)) msgs.push('O flag ' + k + ' deveria ser ' + (espera[k] ? 1 : 0) + ', mas ficou ' + real + '.');
      }
    }
    for (const alvo of Object.keys(espera.mem || {})) {
      const base = enderecoDe(alvo, prog.simbolos);
      const esperados = bytesDe(espera.mem[alvo]);
      for (let i = 0; i < esperados.length; i++) {
        const real = cpu.mem[(base + i) & 0xFFFF];
        if (real !== esperados[i]) {
          const nome = esperados.length > 1 ? alvo + '[' + i + ']' : alvo;
          msgs.push(nome + ' deveria ser ' + dec(esperados[i], 2) + ', mas ficou ' + dec(real, 2) + '.');
          break;
        }
      }
    }
    if (espera.pilhaEquilibrada && cpu.SP !== spInicial) msgs.push('A pilha terminou desequilibrada (SP = ' + hex(cpu.SP, 4) + ', era ' + hex(spInicial, 4) + '): cada PUSH/CALL precisa do seu POP/RET.');
    return msgs;
  }

  function julgar(desafio, codigo, modo) {
    const enviar = modo === 'enviar';
    const metas = desafio.metas || {};
    const r = { status: 'errado', problemas: [], regras: [], testes: [], bytes: 0, ciclosPior: 0, ciclosMedia: 0, estrelas: null };

    const prog = Mont.montar(codigo);
    if (!prog.ok) { r.status = 'erro-montagem'; r.problemas = prog.erros.map(e => ({ linha: e.linha, msg: e.msg })); return r; }
    r.bytes = prog.tamanho;

    const usados = new Set(prog.instrucoes.map(i => i.mn));
    for (const p of metas.proibir || []) if (usados.has(p)) r.regras.push({ ok: false, msg: 'O exercício proíbe a instrução ' + p + '.' });
    for (const p of metas.exigir || []) r.regras.push(usados.has(p) ? { ok: true, msg: 'Usa ' + p + '.' } : { ok: false, msg: 'O exercício pede que você use ' + p + '.' });

    // meta "recursao": algum procedimento precisa chamar a si mesmo (direta ou indiretamente)
    if (metas.recursao && !Recursao.temRecursao(prog)) r.regras.push({ ok: false, msg: 'O exercício exige recursão: um procedimento precisa chamar a si mesmo com CALL.' });

    const alvo = desafio.testes.filter(t => enviar || t.visivel);
    for (const teste of alvo) {
      let msgs = [], ciclos = 0, passos = 0;
      try {
        const cpu = montarCpu(prog, teste.setup || {});
        const spInicial = cpu.SP;
        const fim = cpu.executar(MAX_PASSOS);
        ciclos = cpu.ciclos; passos = cpu.passos;
        if (fim === 'limite') msgs.push('O programa não terminou (laço infinito? termine sempre com HALT).');
        else if (fim === 'invalido') msgs.push('Opcode inválido em ' + hex(cpu.PC, 4) + ': a execução saiu do programa.');
        else msgs = conferir(cpu, teste, prog, spInicial);
      } catch (e) { msgs.push(e.message); }
      const ok = msgs.length === 0;
      r.testes.push({ nome: teste.nome, visivel: !!teste.visivel, ok, msgs: teste.visivel ? msgs : (ok ? [] : [teste.dica || 'falhou em um teste oculto']), ciclos, passos });
    }

    const ciclos = r.testes.map(x => x.ciclos);
    r.ciclosPior = ciclos.length ? Math.max(...ciclos) : 0;
    r.ciclosMedia = ciclos.length ? Math.round(ciclos.reduce((a, b) => a + b, 0) / ciclos.length) : 0;

    const regrasOk = r.regras.every(x => x.ok);
    const testesOk = r.testes.every(x => x.ok);
    r.status = !regrasOk ? 'regra' : testesOk ? 'aceito' : 'errado';
    if (enviar && r.status === 'aceito') {
      r.estrelas = { aceito: true, bytes: metas.bytes !== undefined && r.bytes <= metas.bytes, ciclos: metas.ciclos !== undefined && r.ciclosPior <= metas.ciclos };
    }
    return r;
  }

  const api = { julgar, MAX_PASSOS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JuizZ80 = api;
})(typeof self !== 'undefined' ? self : this);
