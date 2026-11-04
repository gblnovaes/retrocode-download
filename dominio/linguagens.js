/*
 * Registro das linguagens do RetroCode.
 * Para abrir uma linguagem nova: (1) marque `disponivel: true` aqui, (2) registre o juiz dela
 * em julgador.js e (3) escreva os desafios em desafios/<id>/. Veja desafios/LEIA-ME.md.
 */
(function (root) {
  'use strict';

  const LINGUAGENS = [
    { id: '8086', nome: 'Assembly 8086', curto: '8086', familia: 'Assembly', extensao: '.asm', disponivel: true },
    { id: 'z80', nome: 'Assembly Z80', curto: 'Z80', familia: 'Assembly', extensao: '.asm', disponivel: false },
    { id: '6502', nome: 'Assembly 6502', curto: '6502', familia: 'Assembly', extensao: '.asm', disponivel: false },
    { id: 'c', nome: 'C', curto: 'C', familia: 'C', extensao: '.c', disponivel: false },
    { id: '68000', nome: 'Assembly 68000', curto: '68000', familia: 'Assembly', extensao: '.asm', disponivel: false }
  ];

  const porId = (id) => LINGUAGENS.find(l => l.id === id) || null;
  const disponiveis = () => LINGUAGENS.filter(l => l.disponivel);

  const api = { LINGUAGENS, porId, disponiveis };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Linguagens = api;
})(typeof self !== 'undefined' ? self : this);
