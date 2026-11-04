/* Tela Dashboard: pontuação, resolvidos, acertos x erros, evolução, atividade e desafios feitos. */
(function (root) {
  'use strict';
  const { h, html } = root.H;
  const { icone } = root.Icones;
  const R = root.Rotulos;
  const COR_MAPA = ['#1F2126', '#14532D', '#15803D', '#22C55E', '#86EFAC'];

  const trilho = (pct, cor, fino) => h('div', { class: 'trilho' + (fino ? ' fino' : '') }, h('div', { style: { width: pct + '%', background: cor } }));

  function cartaoPontos(est) {
    const sem = est.evolucao('7D').pts.reduce((a, b) => a + b, 0);
    const n = est.nivel;
    return h('article', { class: 'card' },
      h('div', { class: 'linha' }, h('h2', null, 'Pontuação total'), h('span', { class: 'chip' }, 'Nível ' + n.numero)),
      h('div', { class: 'base' },
        h('span', { class: 'grande-num' }, R.numero(est.pontos)), h('span', { class: 'suave' }, 'pts'),
        sem ? h('span', { class: 'verde', style: { fontSize: '13px', fontWeight: 600 } }, '+' + R.numero(sem) + ' esta semana') : null),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        h('div', { class: 'linha', style: { fontSize: '13px' } },
          h('b', null, 'Nível ' + n.numero + ' · ' + n.titulo),
          h('span', { class: 'mudo' }, n.faltam === null ? 'nível máximo' : R.numero(n.faltam) + ' pts para o nível ' + (n.numero + 1))),
        trilho(n.pct, 'var(--acento)')),
      h('div', { class: 'tres' }, R.NIVEIS.map(k => h('div', { class: 'tile' }, h('span', null, R.NIVEL[k].label), h('b', { style: { color: R.NIVEL[k].cor } }, R.numero(est.porNivel[k].pontos))))));
  }

  function cartaoDoDia() {
    const dia = root.Estado.desafioDoDia();
    if (!dia) return null;
    const d = dia.desafio, nv = R.NIVEL[d.dificuldade], bonus = root.Xp.bonusDoDia(d.dificuldade);
    return h('section', { class: 'card faixa-dia', 'aria-label': 'Desafio do dia' },
      h('div', { class: 'dia-texto' },
        h('div', { class: 'linha', style: { justifyContent: 'flex-start', gap: '10px' } }, h('span', { class: 'rotulo', style: { margin: 0 } }, 'Desafio do dia'), h('span', { class: 'chip' }, '+' + bonus + ' pts de bônus')),
        h('a', { class: 'titulo-dia', href: '#/desafio/' + d.id }, d.titulo),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' } },
          h('span', { class: 'selo', style: { color: nv.cor, background: nv.bg } }, nv.label),
          h('span', { class: 'chip' }, R.trilha(d.trilha)),
          h('span', { class: 'dica' }, dia.resgatado ? 'Bônus resgatado hoje. Volte amanhã para um novo desafio.' : 'Envie uma solução aceita hoje para ganhar o bônus. O desafio muda à meia-noite.'))),
      dia.resgatado ? h('span', { class: 'verde', style: { fontWeight: 600, display: 'flex', gap: '6px', alignItems: 'center' } }, icone('ok', 16, 3), 'Concluído hoje')
        : h('a', { class: 'btn primario', href: '#/desafio/' + d.id }, icone('play', 16, 2.6), 'Resolver agora'));
  }

  function anel(est) {
    const C = 2 * Math.PI * 52;
    let inicio = 0, circulos = '';
    if (est.total) for (const k of R.NIVEIS) {
      const len = est.porNivel[k].resolvidos / est.total * C;
      if (len > 0) circulos += '<circle cx="60" cy="60" r="52" fill="none" stroke="' + R.NIVEL[k].cor + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + Math.max(len - 4, 1).toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-inicio).toFixed(2) + '" transform="rotate(-90 60 60)"></circle>';
      inicio += len;
    }
    const svg = html('span', null, '<svg role="img" aria-label="' + est.resolvidos + ' de ' + est.total + ' desafios resolvidos" width="132" height="132" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="#26282E" stroke-width="8"></circle>' + circulos + '</svg>');
    return h('div', { class: 'anel' }, svg.firstChild, h('div', { class: 'centro' }, h('b', null, est.resolvidos), h('span', { class: 'mudo', style: { fontSize: '12px' } }, 'de ' + est.total)));
  }

  function cartaoResolvidos(est) {
    return h('article', { class: 'card' },
      h('h2', null, 'Desafios resolvidos'),
      h('div', { class: 'linha', style: { justifyContent: 'flex-start', gap: '22px' } }, anel(est),
        h('div', { class: 'niveis' }, R.NIVEIS.map(k => {
          const p = est.porNivel[k];
          return h('div', null,
            h('div', { class: 'nivel-linha' }, h('b', { style: { color: R.NIVEL[k].cor } }, R.NIVEL[k].label), h('span', { class: 'mono', style: { color: 'var(--texto2)' } }, p.resolvidos, h('span', { class: 'mudo' }, '/' + p.total))),
            trilho(p.total ? Math.round(p.resolvidos / p.total * 100) : 0, R.NIVEL[k].cor, true));
        }))));
  }

  function cartaoAcertos(est) {
    const e = est.envios;
    return h('article', { class: 'card' },
      h('div', { class: 'linha' }, h('h2', null, 'Acertos x erros'), h('span', { class: 'mudo', style: { fontSize: '12px' } }, e.total + ' ' + R.plural(e.total, 'envio', 'envios'))),
      h('div', { class: 'base' }, h('span', { class: 'med-num' }, String(e.taxa).replace('.', ',') + '%'), h('span', { class: 'suave', style: { fontSize: '13px' } }, 'taxa de acerto')),
      h('div', { class: 'dupla' }, h('div', { style: { width: e.taxa + '%', background: 'var(--ok)', minWidth: e.acertos ? '8px' : 0 } }), h('div', { style: { flex: 1, background: e.total ? 'var(--erro)' : 'var(--borda)' } })),
      h('div', { style: { display: 'flex', gap: '20px', fontSize: '13px' } },
        h('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, h('span', { class: 'verde' }, icone('ok', 14, 3)), h('b', { class: 'mono' }, e.acertos), R.plural(e.acertos, 'acerto', 'acertos')),
        h('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, h('span', { class: 'laranja' }, icone('x', 14, 3)), h('b', { class: 'mono' }, e.erros), R.plural(e.erros, 'erro', 'erros'))),
      h('div', { class: 'separado', style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, R.NIVEIS.map(k => {
        const p = est.porNivel[k], t = p.acertos + p.erros;
        return h('div', { class: 'ae-linha' }, h('b', { style: { color: R.NIVEL[k].cor } }, R.NIVEL[k].label),
          h('div', { class: 'dupla fina' }, h('div', { style: { width: (t ? p.acertos / t * 100 : 0) + '%', background: 'var(--ok)' } }), h('div', { style: { flex: 1, background: t ? 'var(--erro)' : 'var(--borda)' } })),
          h('span', { class: 'mono dir', style: { color: 'var(--texto2)' } }, p.acertos + ' / ' + p.erros));
      })));
  }

  function cartaoEvolucao(est, ctx) {
    const periodo = root.Estado.prefs.periodo;
    const s = est.evolucao(periodo);
    const n = s.labels.length;
    const max = Math.max(1, ...s.ok.map((v, i) => v + s.err[i]));
    const soma = s.pts.reduce((a, b) => a + b, 0);
    let acc = 0;
    const pontos = s.pts.map((p, i) => { acc += p; return ((i + 0.5) / n * 100).toFixed(2) + ',' + (soma ? (96 - acc / soma * 90) : 96).toFixed(2); }).join(' ');
    const barras = s.labels.map((_, i) => h('div', { class: 'col' },
      h('div', { style: { height: (s.err[i] / max * 78).toFixed(1) + '%', background: 'var(--erro)', borderRadius: '4px 4px 2px 2px' } }),
      h('div', { style: { height: (s.ok[i] / max * 78).toFixed(1) + '%', background: 'var(--ok)', borderRadius: '2px' } })));
    const linha = soma ? html('span', null, '<svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="' + pontos + '" fill="none" stroke="var(--acento)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline></svg>').firstChild : null;
    return h('article', { class: 'card' },
      h('div', { class: 'linha', style: { alignItems: 'flex-start' } },
        h('div', null, h('h2', null, 'Evolução'), h('div', { class: 'base', style: { gap: '8px' } }, h('span', { class: 'mono', style: { fontSize: '26px', fontWeight: 700 } }, '+' + R.numero(soma) + ' pts'), h('span', { class: 'mudo', style: { fontSize: '13px' } }, 'no período'))),
        h('div', { class: 'grupo', role: 'group', 'aria-label': 'Período' }, ['7D', '1M', '6M', 'Tudo'].map(p => h('button', { type: 'button', 'aria-pressed': String(p === periodo), onclick: () => { root.Estado.definir('periodo', p); ctx.rerender(); } }, p)))),
      h('div', { class: 'legenda' },
        h('span', null, h('i', { style: { background: 'var(--ok)' } }), 'Acertos'), h('span', null, h('i', { style: { background: 'var(--erro)' } }), 'Erros'),
        h('span', null, h('i', { style: { background: 'var(--acento)', width: '14px', height: '3px' } }), 'Pontos acumulados')),
      h('div', { class: 'grafico', role: 'img', 'aria-label': 'Evolução no período: ' + s.ok.reduce((a, b) => a + b, 0) + ' acertos, ' + s.err.reduce((a, b) => a + b, 0) + ' erros, +' + soma + ' pontos' }, h('div', { class: 'barras' }, barras), linha),
      h('div', { class: 'eixo' }, s.labels.map(l => h('span', null, l))));
  }

  function cartaoAtividade(est) {
    const m = est.mapa, seq = est.sequencia;
    return h('article', { class: 'card' },
      h('div', { class: 'linha' },
        h('h2', null, h('span', { class: 'mono', style: { color: 'var(--texto)', fontSize: '18px' } }, est.envios.total), ' ' + R.plural(est.envios.total, 'envio', 'envios') + ' nos últimos 6 meses'),
        h('span', { class: 'mudo', style: { fontSize: '12px' } }, 'Dias ativos: ' + seq.diasAtivos + ' · Máx. sequência: ' + seq.recorde)),
      h('div', { class: 'mapa-rolagem' },
        h('div', { class: 'mapa', role: 'img', 'aria-label': 'Mapa de atividade: ' + est.envios.total + ' envios em ' + seq.diasAtivos + ' dias ativos' },
          m.celulas.map(c => h('div', { title: c.nivel < 0 ? null : c.data.split('-').reverse().join('/') + ': ' + c.n + ' ' + R.plural(c.n, 'envio', 'envios'), style: { background: c.nivel < 0 ? 'transparent' : COR_MAPA[c.nivel] } }))),
        h('div', { class: 'mapa-meses', style: { width: (26 * 18) + 'px' } }, m.meses.map(x => h('span', { style: { left: (x.coluna * 18) + 'px' } }, x.label)))),
      h('div', { class: 'escala' }, h('span', null, 'Menos'), COR_MAPA.map(c => h('i', { style: { background: c } })), h('span', null, 'Mais')),
      h('div', { class: 'tres separado' },
        h('div', { class: 'tile', style: { background: 'none', padding: 0 } }, h('span', null, 'Estrelas'), h('b', null, '★ ' + est.estrelas)),
        h('div', { class: 'tile', style: { background: 'none', padding: 0 } }, h('span', null, 'De primeira'), h('b', null, est.aPrimeiraPct + '%')),
        h('div', { class: 'tile', style: { background: 'none', padding: 0 } }, h('span', null, 'Linguagem'), h('b', null, root.Linguagens.porId(root.Estado.prefs.linguagem).curto))));
  }

  function cartaoMedalhas() {
    const lista = root.Estado.medalhas();
    const ganhas = lista.filter(m => m.conquistada).length;
    return h('section', { class: 'card', 'aria-label': 'Medalhas' },
      h('div', { class: 'linha' }, h('h2', { class: 'grande' }, 'Medalhas'), h('span', { class: 'chip' }, ganhas + ' de ' + lista.length)),
      h('ul', { class: 'medalhas' }, lista.map(m => h('li', { class: 'medalha' + (m.conquistada ? ' ganha' : ''), title: m.descricao },
        h('span', { class: 'selo-medalha', 'aria-hidden': 'true' }, m.simbolo),
        h('div', null,
          h('b', null, m.nome),
          h('small', null, m.descricao),
          m.conquistada ? h('span', { class: 'verde', style: { fontSize: '12px', fontWeight: 600 } }, 'Conquistada') : h('div', { class: 'medalha-prog' }, trilho(m.pct, 'var(--acento)', true), h('span', { class: 'mono' }, m.atual + '/' + m.meta)))))));
  }

  function tabelaFeitos(est, ctx) {
    const vol = root.Estado.vol, atual = vol.nivelTabela;
    const abas = [{ id: 'todos', label: 'Todos', cor: 'var(--texto)' }].concat(R.NIVEIS.map(k => ({ id: k, label: R.NIVEL[k].label, cor: R.NIVEL[k].cor })));
    const linhas = est.linhas.filter(l => atual === 'todos' || l.dificuldade === atual);
    const corpo = linhas.map(l => {
      const nv = R.NIVEL[l.dificuldade], cor = l.status === 'Resolvido' ? 'var(--ok)' : 'var(--suave)';
      return h('tr', null,
        h('td', null, h('a', { class: 'titulo', href: '#/desafio/' + l.id }, l.titulo), h('span', { class: 'sub' }, R.data(l.ultimoEnvio))),
        h('td', null, h('span', { class: 'selo', style: { color: nv.cor, background: nv.bg } }, nv.label)),
        h('td', { class: 'mono', style: { fontSize: '13px', color: 'var(--texto2)' } }, root.Linguagens.porId(l.linguagem).curto),
        h('td', { class: 'mono dir' }, l.tentativas),
        h('td', { class: 'mono dir verde' }, l.acertos),
        h('td', { class: 'mono dir laranja' }, l.erros),
        h('td', null, h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, h('div', { class: 'trilho fino', style: { width: '64px' } }, h('div', { style: { width: l.taxa + '%', background: 'var(--ok)' } })), h('span', { class: 'mono', style: { fontSize: '12px', color: 'var(--texto2)' } }, l.taxa + '%'))),
        h('td', { class: 'mono dir', style: { fontWeight: 700 } }, l.pontos ? '+' + l.pontos : '0'),
        h('td', null, h('span', { class: 'status', style: { color: cor } }, h('i', { style: { background: cor } }), l.status)));
    });
    const th = (t, dir) => h('th', { scope: 'col', class: dir ? 'dir' : null }, t);
    return h('section', { class: 'card', 'aria-label': 'Desafios feitos' },
      h('div', { class: 'linha' }, h('h2', { class: 'grande' }, 'Desafios feitos'),
        h('div', { class: 'abas', role: 'group', 'aria-label': 'Filtrar por nível' }, abas.map(a => h('button', { type: 'button', class: 'aba', 'aria-pressed': String(a.id === atual), onclick: () => { vol.nivelTabela = a.id; ctx.rerender(); } },
          h('i', { style: { background: a.cor } }), a.label, h('span', null, est.linhas.filter(l => a.id === 'todos' || l.dificuldade === a.id).length))))),
      linhas.length
        ? h('div', { class: 'rolagem' }, h('table', null, h('thead', null, h('tr', null, th('Desafio'), th('Nível'), th('Linguagem'), th('Tentativas', 1), th('Acertos', 1), th('Erros', 1), th('Taxa'), th('Pontos', 1), th('Status'))), h('tbody', null, corpo)))
        : h('div', { class: 'vazio' }, est.linhas.length ? 'Nenhum envio neste nível ainda.' : 'Você ainda não enviou nenhum desafio. Escolha um em "Desafios por nível" e use Enviar para gravar o resultado.'));
  }

  function render(ctx) {
    const est = root.Estado.estatisticas();
    return h('div', { style: { display: 'contents' } },
      cartaoDoDia(),
      h('section', { class: 'grade', 'aria-label': 'Resumo' }, cartaoPontos(est), cartaoResolvidos(est), cartaoAcertos(est)),
      h('section', { class: 'grade larga', 'aria-label': 'Evolução' }, cartaoEvolucao(est, ctx), cartaoAtividade(est)),
      cartaoMedalhas(),
      tabelaFeitos(est, ctx));
  }

  root.ViewDashboard = { render };
})(typeof self !== 'undefined' ? self : this);
