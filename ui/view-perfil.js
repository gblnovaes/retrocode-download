/* Painel da conta na barra lateral: quem está jogando e o botão Sair. */
(function (root) {
  'use strict';
  const { h } = root.H;
  const { icone } = root.Icones;
  const E = root.Estado;

  const slug = (nome) => String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'jogador';
  const inicial = (nome) => Array.from(nome)[0].toUpperCase();

  function painel() {
    const conta = E.conta;
    if (!conta) return null;
    return h('div', { class: 'perfil' },
      h('div', { class: 'perfil-conta' },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, inicial(conta.nome)),
        h('span', { class: 'perfil-dados' }, h('span', { class: 'perfil-nome' }, conta.nome), h('small', { class: 'perfil-usuario mono' }, '@' + conta.usuario))),
      h('button', { type: 'button', class: 'btn pequeno', onclick: async () => { await E.contas.sair(); location.hash = '#/dashboard'; location.reload(); } }, icone('sair', 16), 'Sair'));
  }

  root.ViewPerfil = { painel, slug };
})(typeof self !== 'undefined' ? self : this);
