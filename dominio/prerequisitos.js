/* Pré-requisitos recomendados: quais dos desafios indicados ainda não foram resolvidos. */
(function (root) {
  'use strict';

  // Devolve [{id, titulo}] dos pré-requisitos de `desafio` que existem no catálogo e ainda não foram resolvidos.
  function pendentes(desafio, catalogo, resolvido) {
    const porId = new Map(catalogo.map(d => [d.id, d]));
    return (desafio.prerequisitos || [])
      .filter(id => porId.has(id) && !resolvido(id))
      .map(id => ({ id, titulo: porId.get(id).titulo }));
  }

  const api = { pendentes };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Prerequisitos = api;
})(typeof self !== 'undefined' ? self : this);
