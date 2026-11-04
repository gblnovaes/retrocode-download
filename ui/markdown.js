/* Renderizador mínimo de Markdown para enunciados: títulos, listas, tabelas, código e ênfase. Escapa todo o HTML. */
(function (root) {
  'use strict';

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function inline(texto) {
    const codigos = [];
    let s = texto.replace(/`([^`]+)`/g, (_, c) => { codigos.push(c); return '\u0000' + (codigos.length - 1) + '\u0000'; });
    s = esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + esc(codigos[+i]) + '</code>');
  }

  const celulas = (linha) => linha.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

  function renderizar(md) {
    const linhas = String(md).replace(/\r\n/g, '\n').split('\n');
    let html = '', i = 0;
    while (i < linhas.length) {
      const l = linhas[i];
      if (!l.trim()) { i++; continue; }
      if (/^```/.test(l)) {
        const cod = [];
        i++;
        while (i < linhas.length && !/^```\s*$/.test(linhas[i])) cod.push(linhas[i++]);
        i++;
        html += '<pre><code>' + esc(cod.join('\n')) + '</code></pre>';
      } else if (/^#{2,3}\s/.test(l)) {
        html += '<h3>' + inline(l.replace(/^#{2,3}\s+/, '')) + '</h3>'; i++;
      } else if (/^\|/.test(l) && i + 1 < linhas.length && /^\|?\s*:?-{2,}/.test(linhas[i + 1])) {
        const cab = celulas(l); i += 2;
        let corpo = '';
        while (i < linhas.length && /^\|/.test(linhas[i])) { corpo += '<tr>' + celulas(linhas[i]).map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>'; i++; }
        html += '<table><thead><tr>' + cab.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' + corpo + '</tbody></table>';
      } else if (/^\s*([-*]|\d+\.)\s/.test(l)) {
        const ordenada = /^\s*\d+\./.test(l);
        let itens = '';
        while (i < linhas.length && /^\s*([-*]|\d+\.)\s/.test(linhas[i])) { itens += '<li>' + inline(linhas[i].replace(/^\s*([-*]|\d+\.)\s+/, '')) + '</li>'; i++; }
        html += (ordenada ? '<ol>' : '<ul>') + itens + (ordenada ? '</ol>' : '</ul>');
      } else {
        const par = [linhas[i++]]; // sempre consome a primeira linha, para nunca travar
        while (i < linhas.length && linhas[i].trim() && !/^(```|#{2,3}\s|\||\s*([-*]|\d+\.)\s)/.test(linhas[i])) par.push(linhas[i++]);
        html += '<p>' + inline(par.join(' ')) + '</p>';
      }
    }
    return html;
  }

  const api = { renderizar };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Markdown = api;
})(typeof self !== 'undefined' ? self : this);
