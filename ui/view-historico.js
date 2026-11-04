/* Tela Histórico: todos os envios gravados, do mais recente ao mais antigo. */
(function (root) {
  'use strict';
  const { h } = root.H;
  const R = root.Rotulos;
  const TETO = 200;

  const ROTULO = {
    aceito: ['Aceito', 'var(--ok)'], errado: ['Resposta errada', 'var(--erro)'], 'erro-montagem': ['Erro de montagem', 'var(--erro)'],
    regra: ['Regra não cumprida', 'var(--erro)'], indisponivel: ['Sem juiz', 'var(--suave)']
  };

  function render() {
    const dados = root.Estado.progresso.dados();
    const todos = [];
    for (const d of root.Estado.doIdioma()) {
      const e = dados.desafios[d.id];
      if (e) e.envios.forEach((x, i) => todos.push({ d, envio: x, indice: i }));
    }
    todos.sort((a, b) => b.envio.quando - a.envio.quando);
    const linhas = todos.slice(0, TETO).map(({ d, envio, indice }) => {
      const r = ROTULO[envio.status] || [envio.status, 'var(--suave)'];
      const nv = R.NIVEL[d.dificuldade];
      return h('tr', null,
        h('td', null, h('a', { class: 'titulo', href: '#/desafio/' + d.id }, d.titulo), h('span', { class: 'sub' }, R.dataHora(envio.quando))),
        h('td', null, h('span', { class: 'selo', style: { color: nv.cor, background: nv.bg } }, nv.label)),
        h('td', null, h('span', { class: 'status', style: { color: r[1] } }, h('i', { style: { background: r[1] } }), r[0])),
        h('td', null, envio.status === 'aceito' ? R.estrelas(envio.estrelas) : '—'),
        h('td', { class: 'mono dir' }, envio.bytes || '—'),
        h('td', { class: 'mono dir' }, envio.ciclos || '—'),
        h('td', { class: 'dir' }, h('a', { class: 'btn pequeno', href: '#/desafio/' + d.id + '/envio/' + indice }, 'Abrir código')));
    });
    const th = (t, dir) => h('th', { scope: 'col', class: dir ? 'dir' : null }, t);
    return h('div', { style: { display: 'contents' } },
      h('header', { class: 'topo' }, h('div', null, h('h1', null, 'Histórico'), h('p', { class: 'suave', style: { margin: '4px 0 0' } }, 'Cada envio fica gravado com o código, os bytes e os ciclos. Guardamos os 20 mais recentes de cada desafio.'))),
      h('section', { class: 'card' }, linhas.length
        ? h('div', { class: 'rolagem' }, h('table', null, h('thead', null, h('tr', null, th('Desafio'), th('Nível'), th('Resultado'), th('Estrelas'), th('Bytes', 1), th('Ciclos', 1), th('', 1))), h('tbody', null, linhas)))
        : h('div', { class: 'vazio' }, 'Nenhum envio gravado ainda. Resolva um desafio e use Enviar.')));
  }

  root.ViewHistorico = { render };
})(typeof self !== 'undefined' ? self : this);
