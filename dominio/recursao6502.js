/*
 * Detecção de recursão no programa 6502 montado.
 * Monta o grafo de chamadas (JSR) a partir do ponto de entrada e procura um ciclo: um procedimento
 * que, direta ou indiretamente, acaba chamando a si mesmo. Não depende da execução.
 */
(function (root) {
  'use strict';

  const DESVIOS = new Set(['BCC', 'BCS', 'BEQ', 'BMI', 'BNE', 'BPL', 'BVC', 'BVS']);
  const SAIDAS = new Set(['RTS', 'RTI', 'BRK']);

  // chamadas diretas de um procedimento que começa em `inicio` (sem entrar nos chamados)
  function chamadasDe(inicio, instrs, porEndereco) {
    const vistos = new Set(), chamados = new Set(), pilha = [inicio];
    while (pilha.length) {
      const i = pilha.pop();
      if (i === undefined || i < 0 || i >= instrs.length || vistos.has(i)) continue;
      vistos.add(i);
      const ins = instrs[i];
      const alvo = ins.alvo !== undefined && porEndereco.has(ins.alvo) ? porEndereco.get(ins.alvo) : undefined;
      if (ins.mn === 'JSR') { if (alvo !== undefined) chamados.add(ins.alvo); pilha.push(i + 1); continue; }
      if (SAIDAS.has(ins.mn)) continue;
      if (ins.mn === 'JMP') { if (ins.modo === 'abs' && alvo !== undefined) pilha.push(alvo); continue; }
      if (DESVIOS.has(ins.mn)) { if (alvo !== undefined) pilha.push(alvo); pilha.push(i + 1); continue; }
      pilha.push(i + 1);
    }
    return chamados;
  }

  function temRecursao(prog) {
    if (!prog || !prog.instrucoes || !prog.instrucoes.length) return false;
    const instrs = prog.instrucoes.slice().sort((a, b) => a.endereco - b.endereco);
    const porEndereco = new Map();
    instrs.forEach((ins, i) => porEndereco.set(ins.endereco, i));
    const grafo = new Map();      // início do procedimento -> procedimentos que ele chama
    const fila = [prog.entrada];
    while (fila.length) {
      const p = fila.pop();
      if (grafo.has(p)) continue;
      const c = chamadasDe(porEndereco.get(p), instrs, porEndereco);
      grafo.set(p, c);
      c.forEach(x => fila.push(x));
    }
    const estado = new Map();     // 1 = visitando, 2 = pronto
    const ciclo = (n) => {
      estado.set(n, 1);
      for (const m of grafo.get(n) || []) {
        if (estado.get(m) === 1) return true;
        if (!estado.has(m) && ciclo(m)) return true;
      }
      estado.set(n, 2);
      return false;
    };
    return ciclo(prog.entrada);
  }

  const api = { temRecursao };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Recursao6502 = api;
})(typeof self !== 'undefined' ? self : this);
