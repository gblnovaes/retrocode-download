/* Pontos (XP) por desafio e níveis, conforme a tabela do plano. */
(function (root) {
  'use strict';

  // base: desafio aceito; estrela: bytes ou ciclos dentro da meta (cada); primeira: aceito no primeiro envio
  const PONTOS = {
    facil: { base: 10, estrela: 5, primeira: 3 },
    medio: { base: 25, estrela: 10, primeira: 5 },
    dificil: { base: 60, estrela: 20, primeira: 10 }
  };

  const NIVEIS = [
    { xp: 0, titulo: 'Estagiário do DEBUG' },
    { xp: 50, titulo: 'Digitador de .COM' },
    { xp: 120, titulo: 'Programador de INT 21h' },
    { xp: 220, titulo: 'Caçador de flags' },
    { xp: 360, titulo: 'Domador da pilha' },
    { xp: 580, titulo: 'Mestre dos segmentos' },
    { xp: 900, titulo: 'Escovador de bits' },
    { xp: 1450, titulo: 'Hacker de TSR' },
    { xp: 2200, titulo: 'Feiticeiro do modo real' },
    { xp: 3500, titulo: 'Lenda do 8086' }
  ];

  // cada dica revelada antes de resolver custa esta fração dos pontos base
  const PENALIDADE_DICA = 0.2;

  const custoDica = (dificuldade) => Math.round(PONTOS[dificuldade].base * PENALIDADE_DICA);

  // resolver o desafio do dia no próprio dia vale o mesmo que uma estrela do nível
  const bonusDoDia = (dificuldade) => PONTOS[dificuldade].estrela;

  // pontos base e bônus de primeira, já descontadas as dicas e o editorial vistos antes de resolver
  function baseEfetiva(dificuldade, resumo) {
    if (resumo.editorialAntes) return 0;
    return Math.max(0, PONTOS[dificuldade].base - (resumo.dicasPenalidade || 0) * custoDica(dificuldade));
  }

  function primeiraEfetiva(dificuldade, resumo) {
    return resumo.aPrimeira && !resumo.editorialAntes && !resumo.dicasPenalidade ? PONTOS[dificuldade].primeira : 0;
  }

  function pontosDoDesafio(dificuldade, resumo) {
    if (!resumo.resolvido) return 0;
    const p = PONTOS[dificuldade];
    return baseEfetiva(dificuldade, resumo) + (resumo.estrelas.bytes ? p.estrela : 0) + (resumo.estrelas.ciclos ? p.estrela : 0) + primeiraEfetiva(dificuldade, resumo);
  }

  function nivelPara(xp) {
    let i = 0;
    while (i + 1 < NIVEIS.length && xp >= NIVEIS[i + 1].xp) i++;
    const atual = NIVEIS[i], prox = NIVEIS[i + 1] || null;
    if (!prox) return { numero: i + 1, titulo: atual.titulo, xpInicio: atual.xp, xpProximo: null, faltam: null, pct: 100 };
    return {
      numero: i + 1, titulo: atual.titulo, xpInicio: atual.xp, xpProximo: prox.xp, faltam: prox.xp - xp,
      pct: Math.round((xp - atual.xp) / (prox.xp - atual.xp) * 100)
    };
  }

  const api = { PONTOS, NIVEIS, PENALIDADE_DICA, custoDica, bonusDoDia, baseEfetiva, primeiraEfetiva, pontosDoDesafio, nivelPara };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Xp = api;
})(typeof self !== 'undefined' ? self : this);
