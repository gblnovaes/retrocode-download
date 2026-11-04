/*
 * Detecção de recursão no programa montado.
 * Monta o grafo de chamadas (quem faz CALL em quem) e procura um ciclo: um procedimento que,
 * direta ou indiretamente, acaba chamando a si mesmo. Não depende da execução, então um
 * caso de teste que nunca entra na recursão também é reconhecido.
 */
(function (root) {
  'use strict';

  const SAIDAS = new Set(['RET', 'RETN', 'RETF', 'IRET', 'HLT']);
  const SALTOS_CONDICIONAIS = new Set(['JA', 'JAE', 'JB', 'JBE', 'JC', 'JE', 'JG', 'JGE', 'JL', 'JLE', 'JNA', 'JNAE', 'JNB', 'JNBE', 'JNC', 'JNE', 'JNG', 'JNGE', 'JNL', 'JNLE', 'JNO', 'JNP', 'JNS', 'JNZ', 'JO', 'JP', 'JPE', 'JPO', 'JS', 'JZ', 'JCXZ', 'LOOP', 'LOOPE', 'LOOPZ', 'LOOPNE', 'LOOPNZ']);

  // Chamadas diretas feitas por um procedimento que começa em `inicio` (sem entrar nos chamados).
  function chamadasDe(inicio, instrs, porEndereco) {
    const vistos = new Set(), chamados = new Set(), pilha = [inicio];
    while (pilha.length) {
      const i = pilha.pop();
      if (i === undefined || i < 0 || i >= instrs.length || vistos.has(i)) continue;
      vistos.add(i);
      const ins = instrs[i], mn = ins.mn;
      if (mn === 'CALL') { if (ins.target !== undefined && porEndereco.has(ins.target)) chamados.add(porEndereco.get(ins.target)); pilha.push(i + 1); continue; }
      if (SAIDAS.has(mn)) continue;
      if (mn === 'JMP') { if (ins.target !== undefined && porEndereco.has(ins.target)) pilha.push(porEndereco.get(ins.target)); continue; }
      if (SALTOS_CONDICIONAIS.has(mn)) { if (ins.target !== undefined && porEndereco.has(ins.target)) pilha.push(porEndereco.get(ins.target)); pilha.push(i + 1); continue; }
      pilha.push(i + 1);
    }
    return chamados;
  }

  function temRecursao(prog) {
    if (!prog || !prog.instrs || !prog.instrs.length) return false;
    const instrs = prog.instrs;
    const porEndereco = new Map();
    instrs.forEach((ins, i) => porEndereco.set(ins.off, i));
    const grafo = new Map(); // início do procedimento -> procedimentos que ele chama
    const fila = [0];
    while (fila.length) {
      const p = fila.pop();
      if (grafo.has(p)) continue;
      const c = chamadasDe(p, instrs, porEndereco);
      grafo.set(p, c);
      c.forEach(x => fila.push(x));
    }
    // ciclo no grafo de chamadas (busca em profundidade)
    const estado = new Map(); // 1 = visitando, 2 = pronto
    const ciclo = (n) => {
      estado.set(n, 1);
      for (const m of grafo.get(n) || []) {
        if (estado.get(m) === 1) return true;
        if (!estado.has(m) && ciclo(m)) return true;
      }
      estado.set(n, 2);
      return false;
    };
    return ciclo(0);
  }

  const api = { temRecursao };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Recursao = api;
})(typeof self !== 'undefined' ? self : this);
