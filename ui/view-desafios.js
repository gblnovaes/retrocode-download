/* Tela "Desafios por nível": três colunas (Básico, Médio, Avançado) com progresso e lista. */
(function (root) {
  'use strict';
  const { h } = root.H;
  const { icone } = root.Icones;
  const R = root.Rotulos;
  const LIMITE = 6;

  const normalizar = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function combina(d, busca) {
    if (!busca) return true;
    const q = normalizar(busca);
    return [d.titulo, d.trilha, R.trilha(d.trilha), d.id].concat(d.tags).some(t => normalizar(t).includes(q));
  }

  function itemDesafio(d, linha, resumo) {
    const feito = resumo.resolvido, tentado = !feito && resumo.tentativas > 0;
    const estado = feito ? 'Resolvido' : tentado ? 'Com erros' : 'Não iniciado';
    const antes = feito ? [] : root.Prerequisitos.pendentes(d, root.Estado.doIdioma(), (id) => root.Estado.progresso.resumo(id).resolvido);
    return h('li', null, h('a', { class: 'item', href: '#/desafio/' + d.id },
      h('span', { class: 'ic', style: { background: feito ? 'rgba(74,222,128,.14)' : tentado ? 'rgba(251,146,60,.14)' : 'var(--borda)', color: feito ? 'var(--ok)' : tentado ? 'var(--erro)' : 'var(--mudo)' } },
        icone(feito ? 'ok' : tentado ? 'x' : 'circulo', 14, 3)),
      h('span', { class: 'tx' }, h('b', null, d.titulo), h('small', null, R.trilha(d.trilha) + ' · ' + estado + (antes.length ? ' · Recomendado depois de: ' + antes.map(a => a.titulo).join(', ') : ''))),
      h('span', { class: 'oe' }, h('span', { class: 'verde' }, '✓ ' + (linha ? linha.acertos : 0)), h('span', { class: 'laranja' }, '✕ ' + (linha ? linha.erros : 0)))));
  }

  function coluna(nivel, est, ctx) {
    const vol = root.Estado.vol, nv = R.NIVEL[nivel], p = est.porNivel[nivel];
    const pts = root.Xp.PONTOS[nivel].base;
    const todos = root.Estado.doIdioma().filter(d => d.dificuldade === nivel);
    const mostrar = todos.filter(d => combina(d, vol.busca)).filter(d => {
      const r = root.Estado.progresso.resumo(d.id);
      return vol.filtroDesafios === 'todos' || (vol.filtroDesafios === 'feitos' && r.resolvido) || (vol.filtroDesafios === 'pendentes' && !r.resolvido);
    });
    const aberto = vol.mostrarTodos[nivel];
    const visiveis = aberto ? mostrar : mostrar.slice(0, LIMITE);
    const porId = {}; est.linhas.forEach(l => { porId[l.id] = l; });
    return h('section', { class: 'card', 'aria-label': nv.label },
      h('div', { class: 'col-cab' },
        h('div', { class: 'linha' },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, h('span', { class: 'ponto', style: { background: nv.cor } }), h('h2', { class: 'grande' }, nv.label)),
          h('span', { class: 'chip', style: { color: nv.cor, background: nv.bg } }, pts + ' pts / desafio')),
        h('div', { class: 'base', style: { gap: '6px' } }, h('span', { class: 'mono', style: { fontSize: '30px', fontWeight: 700 } }, p.resolvidos), h('span', { class: 'mudo' }, '/ ' + p.total + ' ' + R.plural(p.resolvidos, 'resolvido', 'resolvidos'))),
        h('div', { class: 'trilho fino' }, h('div', { style: { width: (p.total ? p.resolvidos / p.total * 100 : 0) + '%', background: nv.cor } })),
        h('div', { class: 'tres', style: { gap: '8px' } },
          h('div', { class: 'tile' }, h('span', null, 'Acertos'), h('b', { class: 'verde' }, p.acertos)),
          h('div', { class: 'tile' }, h('span', null, 'Erros'), h('b', { class: 'laranja' }, p.erros)),
          h('div', { class: 'tile' }, h('span', null, 'Pontos'), h('b', null, p.pontos)))),
      visiveis.length
        ? h('ul', { class: 'lista' }, visiveis.map(d => itemDesafio(d, porId[d.id], root.Estado.progresso.resumo(d.id))))
        : h('div', { class: 'vazio' }, todos.length ? 'Nenhum desafio com esse filtro.' : 'Ainda não há desafios neste nível. Eles chegam nas próximas fases do plano.'),
      mostrar.length > LIMITE
        ? h('button', { type: 'button', class: 'btn', onclick: () => { vol.mostrarTodos[nivel] = !aberto; ctx.rerender(); } }, aberto ? 'Mostrar menos' : 'Ver todos os ' + mostrar.length + ' desafios')
        : null);
  }

  function render(ctx) {
    const vol = root.Estado.vol, est = root.Estado.estatisticas();
    const lg = root.Linguagens.porId(root.Estado.prefs.linguagem);
    const P = root.Xp.PONTOS;
    const filtros = [['todos', 'Todos'], ['feitos', 'Feitos'], ['pendentes', 'Pendentes']];
    return h('div', { style: { display: 'contents' } },
      h('header', { class: 'topo' },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          h('h1', null, 'Desafios por nível'),
          h('p', { class: 'suave', style: { margin: 0, maxWidth: '640px' } }, lg.nome + ': Básico vale ' + P.facil.base + ' pts, Médio ' + P.medio.base + ' e Avançado ' + P.dificil.base + '. Estrelas de bytes e de ciclos dão pontos extras. Cada envio conta como acerto ou erro.')),
        h('div', { class: 'acoes' },
          h('label', { class: 'busca' }, icone('busca', 16), h('span', { class: 'so-leitor' }, 'Buscar desafio'),
            h('input', { type: 'search', placeholder: 'Buscar desafio…', value: vol.busca, id: 'busca-desafios', oninput: (e) => { vol.busca = e.target.value; ctx.rerender('busca-desafios'); } })),
          h('div', { class: 'grupo', role: 'group', 'aria-label': 'Filtrar por status' }, filtros.map(f => h('button', { type: 'button', 'aria-pressed': String(vol.filtroDesafios === f[0]), onclick: () => { vol.filtroDesafios = f[0]; ctx.rerender(); } }, f[1]))))),
      h('div', { class: 'colunas' }, R.NIVEIS.map(n => coluna(n, est, ctx))));
  }

  root.ViewDesafios = { render };
})(typeof self !== 'undefined' ? self : this);
