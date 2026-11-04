/*
 * Estatísticas do dashboard, calculadas a partir do progresso gravado.
 * Funções puras: recebem os dados, o catálogo, "agora" e a linguagem; não tocam no DOM nem no armazenamento.
 */
(function (root) {
  'use strict';
  const node = typeof require === 'function' && typeof module === 'object';
  const Xp = node ? require('./xp.js') : root.Xp;
  const Calendario = node ? require('./calendario.js') : root.Calendario;
  const { chaveDia, diaLocal, somarDias, doisDigitos } = Calendario;

  const SEMANAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const NIVEIS = ['facil', 'medio', 'dificil'];
  const MAX_DISQUETES = 2, DIAS_POR_DISQUETE = 7;

  const arredondar1 = (x) => Math.round(x * 10) / 10;

  function nivelDoMapa(n) { return n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4; }

  // pontos ganhos ao longo do tempo, refazendo a história de cada desafio (do envio mais antigo ao mais novo)
  function eventosDePontos(entrada, dificuldade, resumo) {
    const p = Xp.PONTOS[dificuldade];
    const eventos = [];
    let temBytes = false, temCiclos = false, resolveu = false;
    for (const e of entrada.envios.slice().reverse()) {
      if (e.status !== 'aceito' || !e.estrelas) continue;
      let pts = 0;
      if (!resolveu) { resolveu = true; pts += Xp.baseEfetiva(dificuldade, resumo) + Xp.primeiraEfetiva(dificuldade, resumo); }
      if (e.estrelas.bytes && !temBytes) { temBytes = true; pts += p.estrela; }
      if (e.estrelas.ciclos && !temCiclos) { temCiclos = true; pts += p.estrela; }
      if (pts) eventos.push({ quando: e.quando, pts });
    }
    return eventos;
  }

  function calcular(dados, catalogo, agora, linguagem) {
    const desafios = catalogo.filter(d => d.linguagem === linguagem);
    const porNivel = {};
    for (const n of NIVEIS) porNivel[n] = { resolvidos: 0, total: 0, acertos: 0, erros: 0, pontos: 0 };
    const todosEnvios = [];
    const eventos = [];
    const linhas = [];
    let pontos = 0, resolvidos = 0, estrelas = 0, deprimeira = 0;

    // bônus do desafio do dia (só dos desafios desta linguagem que já foram resgatados)
    const bonus = {}, porId = {};
    desafios.forEach(d => { porId[d.id] = d; });
    let resgatados = 0;
    for (const dia of Object.keys(dados.diario || {})) {
      const x = dados.diario[dia], d = x && porId[x.id];
      if (!d || !x.resgatado) continue;
      const pts = Xp.bonusDoDia(d.dificuldade);
      bonus[d.id] = (bonus[d.id] || 0) + pts;
      eventos.push({ quando: x.resgatado.quando, pts });
      resgatados++;
    }

    for (const d of desafios) {
      const nv = porNivel[d.dificuldade];
      nv.total++;
      const entrada = dados.desafios[d.id];
      if (!entrada || !entrada.envios) continue;
      const resumo = { resolvido: !!entrada.resolvido, aPrimeira: !!entrada.aPrimeira, dicasPenalidade: entrada.dicasPenalidade || 0, editorialAntes: !!entrada.editorialAntes, estrelas: Object.assign({ aceito: false, bytes: false, ciclos: false }, entrada.estrelas) };
      const pts = Xp.pontosDoDesafio(d.dificuldade, resumo) + (bonus[d.id] || 0);
      let acertos = 0, erros = 0;
      for (const e of entrada.envios) { (e.status === 'aceito' ? acertos++ : erros++); todosEnvios.push(e); }
      nv.acertos += acertos; nv.erros += erros; nv.pontos += pts;
      pontos += pts;
      if (resumo.resolvido) {
        resolvidos++; nv.resolvidos++;
        estrelas += (resumo.estrelas.aceito ? 1 : 0) + (resumo.estrelas.bytes ? 1 : 0) + (resumo.estrelas.ciclos ? 1 : 0);
        if (resumo.aPrimeira) deprimeira++;
      }
      eventos.push(...eventosDePontos(entrada, d.dificuldade, resumo));
      if (entrada.envios.length) {
        linhas.push({
          id: d.id, titulo: d.titulo, dificuldade: d.dificuldade, linguagem: d.linguagem,
          tentativas: entrada.tentativas || entrada.envios.length, acertos, erros,
          taxa: Math.round(acertos / (acertos + erros) * 100), pontos: pts,
          ultimoEnvio: entrada.envios[0].quando, status: resumo.resolvido ? 'Resolvido' : 'Em andamento'
        });
      }
    }
    linhas.sort((a, b) => b.ultimoEnvio - a.ultimoEnvio);

    const acertosTotal = todosEnvios.filter(e => e.status === 'aceito').length;
    const envios = {
      total: todosEnvios.length, acertos: acertosTotal, erros: todosEnvios.length - acertosTotal,
      taxa: todosEnvios.length ? arredondar1(acertosTotal / todosEnvios.length * 100) : 0
    };

    // dias com envio e dias com desafio aceito (chave local AAAA-MM-DD)
    const atividade = {}, diasAceitos = new Set();
    for (const e of todosEnvios) {
      const k = chaveDia(new Date(e.quando));
      atividade[k] = (atividade[k] || 0) + 1;
      if (e.status === 'aceito') diasAceitos.add(k);
    }
    const hoje = diaLocal(agora);

    // sequência: a cada 7 dias seguidos ganha-se um disquete (no máximo 2); um dia sem desafio gasta um e a sequência continua
    let atual = 0, recorde = 0, disquetes = 0;
    const congelados = [];
    const ordenados = Array.from(diasAceitos).sort();
    if (ordenados.length) {
      const [a, m, dd] = ordenados[0].split('-').map(Number);
      const hojeChave = chaveDia(hoje);
      for (let cursor = new Date(a, m - 1, dd, 12); chaveDia(cursor) <= hojeChave; cursor = somarDias(cursor, 1)) {
        const k = chaveDia(cursor);
        if (diasAceitos.has(k)) {
          atual++; recorde = Math.max(recorde, atual);
          if (atual % DIAS_POR_DISQUETE === 0) disquetes = Math.min(MAX_DISQUETES, disquetes + 1);
        } else if (k < hojeChave) { // hoje ainda pode ser resolvido: não conta como falta
          if (atual > 0 && disquetes > 0) { disquetes--; congelados.push(k); } else atual = 0;
        }
      }
    }
    const sequencia = {
      atual, recorde, diasAtivos: Object.keys(atividade).length, disquetes, congelados,
      faltamParaDisquete: disquetes >= MAX_DISQUETES ? null : DIAS_POR_DISQUETE - atual % DIAS_POR_DISQUETE
    };

    // mapa de atividade: 26 colunas (semanas, de domingo a sábado); a última é a semana de hoje
    const inicioUltima = somarDias(hoje, -hoje.getDay());
    const primeiro = somarDias(inicioUltima, -25 * 7);
    const celulas = [], meses = [];
    for (let i = 0; i < 182; i++) {
      const d = somarDias(primeiro, i), k = chaveDia(d);
      const futuro = d.getTime() > hoje.getTime();
      const n = futuro ? 0 : (atividade[k] || 0);
      celulas.push({ data: k, n, nivel: futuro ? -1 : nivelDoMapa(n) });
      if (i % 7 === 0 && (meses.length === 0 ? true : d.getMonth() !== meses[meses.length - 1].mes) && (i === 0 ? true : d.getDate() <= 7)) {
        meses.push({ label: MESES[d.getMonth()], coluna: i / 7, mes: d.getMonth() });
      }
    }
    // o rótulo da primeira coluna só aparece se houver espaço para o próximo mês
    if (meses.length > 1 && meses[1].coluna - meses[0].coluna < 3) meses.shift();

    const meiaNoite = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    // blocos de tempo de cada período: { ini, fim (exclusivo), label }
    function blocos(periodo) {
      if (periodo === '7D' || periodo === '1M') {
        const tam = periodo === '7D' ? 1 : 3, qtd = periodo === '7D' ? 7 : 10;
        return Array.from({ length: qtd }, (_, i) => {
          const ultimo = somarDias(hoje, -(qtd - 1 - i) * tam);
          return {
            ini: meiaNoite(somarDias(ultimo, -(tam - 1))), fim: meiaNoite(somarDias(ultimo, 1)),
            label: periodo === '7D' ? SEMANAS[ultimo.getDay()] : doisDigitos(ultimo.getDate()) + '/' + doisDigitos(ultimo.getMonth() + 1)
          };
        });
      }
      const h = new Date(agora);
      let qtd = 6;
      if (periodo === 'Tudo') {
        const pe = new Date(todosEnvios.length ? Math.min(...todosEnvios.map(e => e.quando)) : agora);
        qtd = Math.min(12, (h.getFullYear() - pe.getFullYear()) * 12 + h.getMonth() - pe.getMonth() + 1);
      }
      return Array.from({ length: qtd }, (_, i) => {
        const ini = new Date(h.getFullYear(), h.getMonth() - (qtd - 1 - i), 1);
        return { ini: ini.getTime(), fim: new Date(ini.getFullYear(), ini.getMonth() + 1, 1).getTime(), label: MESES[ini.getMonth()] };
      });
    }

    function evolucao(periodo) {
      const bs = blocos(periodo);
      const dentro = (ms, b) => ms >= b.ini && ms < b.fim;
      return {
        labels: bs.map(b => b.label),
        ok: bs.map(b => todosEnvios.filter(e => e.status === 'aceito' && dentro(e.quando, b)).length),
        err: bs.map(b => todosEnvios.filter(e => e.status !== 'aceito' && dentro(e.quando, b)).length),
        pts: bs.map(b => eventos.filter(e => dentro(e.quando, b)).reduce((t, e) => t + e.pts, 0))
      };
    }

    return {
      pontos, nivel: Xp.nivelPara(pontos), resolvidos, total: desafios.length, porNivel, envios, estrelas,
      aPrimeiraPct: resolvidos ? Math.round(deprimeira / resolvidos * 100) : 0,
      sequencia, diario: { resgatados }, mapa: { celulas, meses }, linhas, evolucao
    };
  }

  const api = { calcular, chaveDia };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Estatisticas = api;
})(typeof self !== 'undefined' ? self : this);
