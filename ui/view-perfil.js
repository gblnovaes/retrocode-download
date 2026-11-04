/* Registro simples: tela de boas-vindas (sem perfil) e painel do perfil na barra lateral. */
(function (root) {
  'use strict';
  const { h } = root.H;
  const E = root.Estado;

  const slug = (nome) => String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'jogador';
  const inicial = (nome) => Array.from(nome)[0].toUpperCase();
  // trocar de perfil recarrega a página: o progresso é lido de novo da chave do perfil escolhido
  const recarregar = () => location.reload();

  function formNome({ rotulo, botao, valor, aoEnviar, id }) {
    const erro = h('p', { class: 'erro-perfil', role: 'alert' });
    const campo = h('input', { type: 'text', id, class: 'campo-perfil', maxlength: String(root.Perfis.MAX_NOME), autocomplete: 'off', value: valor || '', placeholder: 'Seu nome' });
    const form = h('form', { class: 'form-perfil', onsubmit: (e) => {
      e.preventDefault();
      try { aoEnviar(campo.value); } catch (x) { erro.textContent = x.message; campo.focus(); }
    } },
      h('label', { for: id }, rotulo), campo, h('button', { type: 'submit', class: 'btn primario pequeno' }, botao), erro);
    return form;
  }

  function boasVindas() {
    const existentes = E.perfis.lista();
    return h('main', { class: 'boas-vindas' },
      h('div', { class: 'cartao-boas-vindas' },
        h('h1', null, 'Bem-vindo ao RetroCode'),
        h('p', null, 'Escolha um nome para registrar o seu progresso. Tudo fica gravado só neste navegador, no seu nome, e o app reconhece você na próxima visita.'),
        formNome({ id: 'nome-perfil', rotulo: 'Como devemos te chamar?', botao: 'Começar', aoEnviar: (nome) => { E.perfis.criar(nome); recarregar(); } }),
        existentes.length ? h('div', { class: 'ja-registrados' }, h('p', { class: 'rotulo' }, 'Ou continue como'),
          existentes.map(p => h('button', { type: 'button', class: 'btn pequeno', onclick: () => { E.perfis.trocar(p.id); recarregar(); } }, p.nome))) : null));
  }

  function painel() {
    const ativo = E.perfil, todos = E.perfis.lista();
    if (!ativo) return null;
    const gaveta = h('div', { class: 'perfil-gaveta', hidden: true },
      todos.length > 1 ? h('div', { class: 'perfil-lista' }, todos.filter(p => p.id !== ativo.id).map(p =>
        h('button', { type: 'button', class: 'btn pequeno', onclick: () => { E.perfis.trocar(p.id); recarregar(); } }, 'Trocar para ' + p.nome))) : null,
      formNome({ id: 'renomear-perfil', rotulo: 'Renomear', botao: 'Salvar', valor: ativo.nome, aoEnviar: (nome) => { E.perfis.renomear(ativo.id, nome); recarregar(); } }),
      formNome({ id: 'novo-perfil', rotulo: 'Novo jogador', botao: 'Criar', aoEnviar: (nome) => { E.perfis.criar(nome); recarregar(); } }));
    const botao = h('button', { type: 'button', class: 'perfil-botao', 'aria-expanded': 'false', onclick: () => {
      gaveta.hidden = !gaveta.hidden; botao.setAttribute('aria-expanded', String(!gaveta.hidden));
    } },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, inicial(ativo.nome)),
      h('span', { class: 'perfil-nome' }, ativo.nome));
    return h('div', { class: 'perfil' }, botao, gaveta);
  }

  root.ViewPerfil = { boasVindas, painel, slug };
})(typeof self !== 'undefined' ? self : this);
