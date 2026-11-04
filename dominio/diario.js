/*
 * Desafio do dia: escolha determinística (data + linguagem) entre os desafios que ainda faltam.
 * Se tudo já foi resolvido, vale qualquer um da linguagem.
 */
(function (root) {
  'use strict';

  // FNV-1a de 32 bits: espalha bem datas parecidas e dá o mesmo número em qualquer máquina
  function hash(texto) {
    let h = 0x811c9dc5;
    for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }

  function escolher(catalogo, linguagem, chave, resolvidos) {
    const todos = catalogo.filter(d => d.linguagem === linguagem).map(d => d.id).sort();
    if (!todos.length) return null;
    const faltam = todos.filter(id => !resolvidos.has(id));
    const lista = faltam.length ? faltam : todos;
    return lista[hash(chave + '|' + linguagem) % lista.length];
  }

  const api = { escolher };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Diario = api;
})(typeof self !== 'undefined' ? self : this);
