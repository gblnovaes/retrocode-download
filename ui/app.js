/* Casca do app: barra lateral, rotas por hash e cabeçalhos. */
(function (root) {
  'use strict';
  const { h } = root.H;
  const { icone } = root.Icones;
  const E = root.Estado, R = root.Rotulos;
  const raiz = document.getElementById('app');
  let limpezas = [];

  function aviso(conteudo) {
    const t = h('div', { class: 'toast', role: 'status' }, conteudo);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 6000);
  }

  function exportarProgresso() {
    const nome = 'retrocode-progresso-' + root.Calendario.chaveDia(new Date()) + '.json';
    const url = URL.createObjectURL(new Blob([E.progresso.exportar()], { type: 'application/json' }));
    const a = h('a', { href: url, download: nome, style: { display: 'none' } });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    aviso(h('span', null, 'Progresso exportado em ', h('b', null, nome), '. Guarde o arquivo: ele leva tudo para outro navegador ou PC.'));
  }

  function importarProgresso(arquivo) {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onerror = () => aviso('Não foi possível ler o arquivo.');
    leitor.onload = () => {
      let futuro;
      try {
        const lido = JSON.parse(String(leitor.result));
        if (!lido || lido.versao !== 1 || !lido.desafios || typeof lido.desafios !== 'object') throw new Error();
        futuro = Object.keys(lido.desafios).filter(id => lido.desafios[id] && lido.desafios[id].resolvido).length;
      } catch (e) { aviso('Arquivo de progresso inválido. Nada foi alterado.'); return; }
      const atual = E.doIdioma().filter(d => E.progresso.resumo(d.id).resolvido).length;
      if (!confirm('Importar este arquivo substitui TODO o progresso atual.\n\nAgora: ' + atual + ' ' + R.plural(atual, 'desafio resolvido', 'desafios resolvidos') + ' (linguagem escolhida).\nNo arquivo: ' + futuro + ' ' + R.plural(futuro, 'desafio resolvido', 'desafios resolvidos') + '.\n\nDeseja continuar?')) return;
      try { E.progresso.importar(String(leitor.result)); } catch (e) { aviso(e.message); return; }
      aviso('Progresso importado: ' + futuro + ' ' + R.plural(futuro, 'desafio resolvido', 'desafios resolvidos') + '.');
      desenhar();
    };
    leitor.readAsText(arquivo);
  }

  function aplicarAcento() { document.documentElement.style.setProperty('--acento', E.prefs.acento); }

  function rota() {
    const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    if (partes[0] === 'desafios') return { nome: 'desafios' };
    if (partes[0] === 'historico') return { nome: 'historico' };
    if (partes[0] === 'desafio' && partes[1]) return { nome: 'resolver', id: partes[1], envio: partes[2] === 'envio' && /^\d+$/.test(partes[3] || '') ? +partes[3] : null };
    return { nome: 'dashboard' };
  }

  const ontem = () => root.Calendario.chaveDia(root.Calendario.somarDias(new Date(), -1));

  function lateral(atual) {
    const est = E.estatisticas();
    const link = (href, icon, texto, ativo) => h('a', { href, 'aria-current': ativo ? 'page' : null }, icone(icon), texto);
    return h('nav', { class: 'lateral', 'aria-label': 'Principal' },
      h('div', { class: 'marca' }, h('div', { class: 'marca-icone' }, icone('codigo', 20, 2.4)), h('div', null, h('b', null, 'RetroCode'), h('small', { class: 'slogan' }, '> desafios old school', h('span', { class: 'cursor' }, '_')))),
      h('div', { class: 'menu' },
        link('#/dashboard', 'painel', 'Dashboard', atual === 'dashboard'),
        link('#/desafios', 'codigo', 'Desafios por nível', atual === 'desafios' || atual === 'resolver'),
        link('#/historico', 'relogio', 'Histórico', atual === 'historico')),
      h('button', { type: 'button', class: 'btn pequeno mais', 'aria-expanded': 'false', onclick: (e) => { const nav = e.currentTarget.closest('.lateral'); const aberto = nav.classList.toggle('aberto'); e.currentTarget.setAttribute('aria-expanded', String(aberto)); e.currentTarget.textContent = aberto ? 'Menos' : 'Mais'; } }, 'Mais'),
      h('div', { class: 'secundario' },
      h('div', null, h('p', { class: 'rotulo' }, 'Linguagem'),
        h('div', { class: 'linguagens', role: 'group', 'aria-label': 'Linguagem' }, root.Linguagens.LINGUAGENS.map(l => h('button', {
          type: 'button', class: 'lg', 'aria-pressed': String(E.prefs.linguagem === l.id), disabled: !l.disponivel,
          onclick: () => { E.definir('linguagem', l.id); E.vol.mostrarTodos = {}; if (rota().nome === 'resolver') location.hash = '#/desafios'; else desenhar(); }
        }, l.nome, l.disponivel ? null : h('small', null, 'breve'))))),
      h('div', null, h('p', { class: 'rotulo' }, 'Cor de destaque'),
        h('div', { class: 'cores' }, E.ACENTOS.map(c => h('button', { type: 'button', class: 'cor', style: { background: c }, 'aria-label': 'Cor ' + c, 'aria-pressed': String(E.prefs.acento === c), onclick: () => { E.definir('acento', c); aplicarAcento(); desenhar(); } })))),
      h('div', { class: 'sequencia' },
        h('div', { class: 'tit' }, icone('chama'), 'Sequência'),
        h('div', { class: 'num' }, est.sequencia.atual, h('span', null, R.plural(est.sequencia.atual, 'dia seguido', 'dias seguidos'))),
        h('div', { class: 'disquetes', title: 'Um disquete salva a sequência quando você passa um dia sem desafio aceito. Você ganha um a cada 7 dias seguidos (máximo 2).' },
          icone('disquete', 16), h('span', null, 'Disquetes'),
          h('b', { class: 'mono' }, est.sequencia.disquetes + '/2')),
        est.sequencia.congelados.indexOf(ontem()) >= 0 ? h('small', { class: 'laranja' }, 'Um disquete salvou a sequência ontem.') : null,
        h('small', null, est.sequencia.faltamParaDisquete === null ? 'Disquetes no máximo.' : 'Mais ' + est.sequencia.faltamParaDisquete + ' ' + R.plural(est.sequencia.faltamParaDisquete, 'dia', 'dias') + ' seguidos para outro disquete.'),
        h('small', null, 'Recorde: ' + est.sequencia.recorde + ' ' + R.plural(est.sequencia.recorde, 'dia', 'dias') + ' · Ativo em ' + est.sequencia.diasAtivos + ' ' + R.plural(est.sequencia.diasAtivos, 'dia', 'dias'))),
      h('div', null, h('p', { class: 'rotulo' }, 'Seu progresso'),
        h('div', { class: 'backup' },
          h('button', { type: 'button', class: 'btn pequeno', id: 'exportar', onclick: exportarProgresso }, 'Exportar'),
          h('input', { type: 'file', id: 'importar', accept: '.json,application/json', class: 'so-leitor', 'aria-label': 'Importar progresso', onchange: (e) => { importarProgresso(e.target.files[0]); e.target.value = ''; } }),
          h('label', { class: 'btn pequeno', for: 'importar' }, 'Importar')),
        h('small', { class: 'dica', style: { display: 'block', marginTop: '6px' } }, 'Fica só neste navegador: exporte para ter um backup.'))));
  }

  function proximoDesafio() {
    const lista = E.doIdioma();
    const r = (d) => E.progresso.resumo(d.id);
    return lista.find(d => !r(d).resolvido && r(d).tentativas > 0) || lista.find(d => !r(d).resolvido) || null;
  }

  function cabecalhoDashboard() {
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const prox = proximoDesafio();
    return h('header', { class: 'topo' },
      h('div', null, h('span', { class: 'data' }, hoje.charAt(0).toUpperCase() + hoje.slice(1)), h('h1', null, 'Olá, Gabriel')),
      h('div', { class: 'acoes' },
        h('label', { class: 'busca' }, icone('busca', 16), h('span', { class: 'so-leitor' }, 'Buscar desafio'),
          h('input', { type: 'search', placeholder: 'Buscar desafio…', onkeydown: (e) => { if (e.key === 'Enter') { E.vol.busca = e.target.value; location.hash = '#/desafios'; } } })),
        prox ? h('a', { class: 'btn primario', href: '#/desafio/' + prox.id }, icone('play', 16, 2.6), E.progresso.resumo(prox.id).tentativas ? 'Continuar' : 'Começar') : null));
  }

  const ctx = {
    rerender(focoId) { desenhar(focoId, true); },
    aviso,
    atalho(fn) { document.addEventListener('keydown', fn); limpezas.push(() => document.removeEventListener('keydown', fn)); },
    atualizarLateral() { const nova = lateral(rota().nome); const antiga = raiz.querySelector('.lateral'); if (antiga) antiga.replaceWith(nova); }
  };

  function desenhar(focoId, mesmaTela) {
    limpezas.forEach(f => f()); limpezas = [];
    const topo = window.scrollY;
    const r = rota();
    let conteudo;
    if (r.nome === 'desafios') conteudo = root.ViewDesafios.render(ctx);
    else if (r.nome === 'historico') conteudo = root.ViewHistorico.render(ctx);
    else if (r.nome === 'resolver') conteudo = root.ViewResolver.render(ctx, r.id, r.envio);
    else conteudo = h('div', { style: { display: 'contents' } }, cabecalhoDashboard(), root.ViewDashboard.render(ctx));
    raiz.textContent = '';
    raiz.appendChild(lateral(r.nome));
    raiz.appendChild(h('main', { class: 'conteudo', id: 'conteudo', tabindex: '-1', style: { outline: 'none' } }, conteudo));
    const titulos = { dashboard: 'Dashboard', desafios: 'Desafios por nível', historico: 'Histórico', resolver: 'Resolver' };
    const d = r.nome === 'resolver' ? E.achar(r.id) : null;
    document.title = (d ? d.titulo : titulos[r.nome]) + ' · RetroCode';
    if (mesmaTela) window.scrollTo(0, topo); else { window.scrollTo(0, 0); document.getElementById('conteudo').focus({ preventScroll: true }); }
    if (focoId) { const el = document.getElementById(focoId); if (el) { el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) { /* tipo sem seleção */ } } }
  }

  aplicarAcento();
  window.addEventListener('hashchange', () => desenhar());
  desenhar();
})(typeof self !== 'undefined' ? self : this);
