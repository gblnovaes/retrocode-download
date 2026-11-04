/* Mini construtor de DOM: h('div', { class: 'x', onclick: fn }, filhos...). Texto vai sempre como texto, nunca como HTML. */
(function (root) {
  'use strict';

  function aplicar(el, chave, valor) {
    if (valor === null || valor === undefined || valor === false) return;
    if (chave === 'class') el.className = valor;
    else if (chave === 'style' && typeof valor === 'object') Object.assign(el.style, valor);
    else if (chave.slice(0, 2) === 'on' && typeof valor === 'function') el.addEventListener(chave.slice(2), valor);
    else if (chave === 'value') el.value = valor;
    else el.setAttribute(chave, valor === true ? '' : valor);
  }

  function juntar(el, filho) {
    if (filho === null || filho === undefined || filho === false) return;
    if (Array.isArray(filho)) filho.forEach(f => juntar(el, f));
    else el.appendChild(typeof filho === 'object' ? filho : document.createTextNode(String(filho)));
  }

  function h(tag, attrs) {
    const el = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) aplicar(el, k, attrs[k]);
    for (let i = 2; i < arguments.length; i++) juntar(el, arguments[i]);
    return el;
  }

  // HTML confiável (constantes do próprio app ou saída do renderizador de markdown, que escapa tudo)
  function html(tag, attrs, texto) {
    const el = h(tag, attrs);
    el.innerHTML = texto;
    return el;
  }

  function limpar(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  const api = { h, html, limpar };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.H = api;
})(typeof self !== 'undefined' ? self : this);
