/*
 * Medalhas: conquistas calculadas a partir do progresso gravado.
 * Função pura: recebe os dados, o catálogo, a linguagem e as estatísticas; não toca no DOM nem no armazenamento.
 */
(function (root) {
  'use strict';

  // valor(c) devolve o progresso atual; meta(c) devolve o que é preciso para conquistar
  const MEDALHAS = [
    { id: 'primeiro-passo', nome: 'Primeiro passo', simbolo: '1', descricao: 'Resolva o seu primeiro desafio.', valor: c => c.resolvidos, meta: () => 1 },
    { id: 'aquecimento', nome: 'Aquecimento', simbolo: '5', descricao: 'Resolva 5 desafios.', valor: c => c.resolvidos, meta: () => 5 },
    { id: 'no-ritmo', nome: 'No ritmo', simbolo: '15', descricao: 'Resolva 15 desafios.', valor: c => c.resolvidos, meta: () => 15 },
    { id: 'maratonista', nome: 'Maratonista', simbolo: '30', descricao: 'Resolva 30 desafios.', valor: c => c.resolvidos, meta: () => 30 },
    { id: 'completista', nome: 'Completista', simbolo: '∞', descricao: 'Resolva todos os desafios da linguagem.', valor: c => c.resolvidos, meta: c => Math.max(1, c.total) },
    { id: 'trilha-completa', nome: 'Trilha completa', simbolo: '▣', descricao: 'Resolva todos os desafios de uma trilha.', valor: c => c.trilhas, meta: () => 1 },
    { id: 'mira-certeira', nome: 'Mira certeira', simbolo: '◎', descricao: 'Seja aceito de primeira em 10 desafios.', valor: c => c.deprimeira, meta: () => 10 },
    { id: 'golfista', nome: 'Golfista', simbolo: 'B', descricao: 'Ganhe a estrela de bytes em 10 desafios.', valor: c => c.bytes, meta: () => 10 },
    { id: 'velocista', nome: 'Velocista', simbolo: 'C', descricao: 'Ganhe a estrela de ciclos em 10 desafios.', valor: c => c.ciclos, meta: () => 10 },
    { id: 'perfeccionista', nome: 'Perfeccionista', simbolo: '★', descricao: 'Ganhe as 3 estrelas em 5 desafios.', valor: c => c.tres, meta: () => 5 },
    { id: 'sem-ajuda', nome: 'Sem ajuda', simbolo: '✦', descricao: 'Resolva 10 desafios sem dicas e sem ver o editorial antes.', valor: c => c.semAjuda, meta: () => 10 },
    { id: 'persistente', nome: 'Persistente', simbolo: '↻', descricao: 'Resolva um desafio depois de 5 envios não aceitos nele.', valor: c => c.persistente, meta: () => 5 },
    { id: 'tres-dias', nome: 'Três dias seguidos', simbolo: '3d', descricao: 'Tenha um desafio aceito por 3 dias seguidos.', valor: c => c.recorde, meta: () => 3 },
    { id: 'semana-de-fogo', nome: 'Semana de fogo', simbolo: '7d', descricao: 'Tenha um desafio aceito por 7 dias seguidos.', valor: c => c.recorde, meta: () => 7 },
    { id: 'quinzena', nome: 'Quinzena', simbolo: '14d', descricao: 'Tenha um desafio aceito por 14 dias seguidos.', valor: c => c.recorde, meta: () => 14 },
    { id: 'de-olho-no-dia', nome: 'De olho no dia', simbolo: '☼', descricao: 'Resolva o desafio do dia, no próprio dia, 5 vezes.', valor: c => c.diario, meta: () => 5 },
    { id: 'nivel-5', nome: 'Domador da pilha', simbolo: 'N5', descricao: 'Chegue ao nível 5 (o progresso conta os níveis já vencidos).', valor: c => c.nivel - 1, meta: () => 4 }
  ];

  function contar(dados, catalogo, linguagem, est) {
    const desafios = catalogo.filter(d => d.linguagem === linguagem);
    const c = { total: desafios.length, resolvidos: 0, deprimeira: 0, bytes: 0, ciclos: 0, tres: 0, semAjuda: 0, trilhas: 0, persistente: 0, diario: est.diario.resgatados, recorde: est.sequencia.recorde, nivel: est.nivel.numero };
    const trilhas = {};
    for (const d of desafios) {
      const e = dados.desafios[d.id];
      const t = trilhas[d.trilha] || (trilhas[d.trilha] = { total: 0, resolvidos: 0 });
      t.total++;
      if (!e || !e.resolvido) continue;
      t.resolvidos++;
      c.resolvidos++;
      const st = e.estrelas || {};
      if (e.aPrimeira) c.deprimeira++;
      if (st.bytes) c.bytes++;
      if (st.ciclos) c.ciclos++;
      if (st.aceito && st.bytes && st.ciclos) c.tres++;
      if (!e.dicasPenalidade && !e.editorialAntes) c.semAjuda++;
      const erros = (e.envios || []).filter(x => x.status !== 'aceito').length;
      c.persistente = Math.max(c.persistente, erros);
    }
    c.trilhas = Object.keys(trilhas).filter(k => trilhas[k].total > 0 && trilhas[k].resolvidos === trilhas[k].total).length;
    return c;
  }

  function avaliar(dados, catalogo, linguagem, est) {
    const c = contar(dados, catalogo, linguagem, est);
    return MEDALHAS.map(m => {
      const meta = m.meta(c), atual = Math.min(m.valor(c), meta);
      return { id: m.id, nome: m.nome, descricao: m.descricao, simbolo: m.simbolo, atual, meta, pct: Math.round(atual / meta * 100), conquistada: atual >= meta };
    });
  }

  const api = { MEDALHAS, avaliar };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Medalhas = api;
})(typeof self !== 'undefined' ? self : this);
