/* Despachante: escolhe o juiz certo para a linguagem do desafio. */
(function (root) {
  'use strict';
  const node = typeof require === 'function' && typeof module === 'object';
  const Linguagens = node ? require('./linguagens.js') : root.Linguagens;
  const Juiz8086 = node ? require('./juiz.js') : root.Juiz;
  const Juiz6502 = node ? require('./juiz6502.js') : root.Juiz6502;

  // linguagem -> função julgar(desafio, codigo, modo). Linguagens novas entram aqui.
  const JUIZES = { '8086': Juiz8086.julgar, '6502': Juiz6502.julgar };

  function julgar(desafio, codigo, modo) {
    const juiz = JUIZES[desafio.linguagem];
    if (juiz) return juiz(desafio, codigo, modo);
    const l = Linguagens.porId(desafio.linguagem);
    return {
      status: 'indisponivel', problemas: [], regras: [], testes: [], bytes: 0, ciclosPior: 0, ciclosMedia: 0, estrelas: null,
      mensagem: (l ? l.nome : 'Esta linguagem') + ' ainda não tem juiz neste app.'
    };
  }

  const api = { julgar, JUIZES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Julgador = api;
})(typeof self !== 'undefined' ? self : this);
