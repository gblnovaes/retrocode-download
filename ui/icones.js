/* Ícones de traço (24x24), constantes do app. */
(function (root) {
  'use strict';
  const P = {
    codigo: '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>',
    painel: '<rect x="3" y="3" width="7" height="9" rx="1.5"></rect><rect x="14" y="3" width="7" height="5" rx="1.5"></rect><rect x="14" y="12" width="7" height="9" rx="1.5"></rect><rect x="3" y="16" width="7" height="5" rx="1.5"></rect>',
    relogio: '<path d="M12 8v4l3 2"></path><circle cx="12" cy="12" r="9"></circle>',
    chama: '<path d="M12 22c4 0 7-3 7-7 0-3-2-6-4-8 0 3-2 4-3 4 0-3-1-6-4-9 0 4-3 6-3 11 0 5 3 9 7 9z"></path>',
    busca: '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>',
    play: '<polygon points="6 4 20 12 6 20 6 4"></polygon>',
    seta: '<path d="M5 12h14M13 6l6 6-6 6"></path>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>',
    ok: '<polyline points="20 6 9 17 4 12"></polyline>',
    x: '<path d="M18 6 6 18M6 6l12 12"></path>',
    circulo: '<circle cx="12" cy="12" r="4"></circle>',
    voltar: '<path d="M15 18l-6-6 6-6"></path>',
    reiniciar: '<path d="M3 12a9 9 0 1 0 3-6.7"></path><polyline points="3 4 3 9 8 9"></polyline>',
    disquete: '<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"></path><path d="M8 3v5h7V3"></path><rect x="7" y="13" width="10" height="8" rx="1"></rect>',
    livro: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>'
  };

  // devolve um elemento <svg> pronto
  function icone(nome, tamanho, espessura) {
    const t = document.createElement('template');
    t.innerHTML = '<svg aria-hidden="true" width="' + (tamanho || 18) + '" height="' + (tamanho || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (espessura || 2) + '" stroke-linecap="round" stroke-linejoin="round">' + P[nome] + '</svg>';
    return t.content.firstChild;
  }

  const api = { icone };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Icones = api;
})(typeof self !== 'undefined' ? self : this);
