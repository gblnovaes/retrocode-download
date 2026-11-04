/* Auxiliares de calendário em data local, usados pelas estatísticas e pelo progresso. */
(function (root) {
  'use strict';

  const doisDigitos = (n) => String(n).padStart(2, '0');
  const chaveDia = (d) => d.getFullYear() + '-' + doisDigitos(d.getMonth() + 1) + '-' + doisDigitos(d.getDate());
  // meio-dia local evita que a mudança de horário de verão pule ou repita um dia ao somar 24h
  const diaLocal = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); };
  const somarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);

  const api = { chaveDia, diaLocal, somarDias, doisDigitos };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Calendario = api;
})(typeof self !== 'undefined' ? self : this);
