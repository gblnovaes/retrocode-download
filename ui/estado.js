/* Estado compartilhado das telas: progresso gravado, preferências e estatísticas calculadas. */
(function (root) {
  'use strict';

  const CHAVE_PREFS = 'asmcode8086:prefs:v1';
  const ACENTOS = ['#B4F35A', '#60A5FA', '#C084FC', '#F5F5F4'];

  // localStorage pode estar bloqueado ou vazio: sem ele o app funciona, só não grava
  function armazem() { try { return root.localStorage; } catch (e) { return null; } }

  function lerPrefs() {
    const base = { linguagem: '8086', acento: ACENTOS[0], periodo: '1M' };
    try { const bruto = armazem() && armazem().getItem(CHAVE_PREFS); return Object.assign(base, bruto ? JSON.parse(bruto) : {}); } catch (e) { return base; }
  }

  const prefs = lerPrefs();
  const progresso = root.Progresso.criarProgresso(armazem());
  // estado só da sessão (não é gravado): filtros, busca e abas
  const vol = { busca: '', filtroDesafios: 'todos', nivelTabela: 'todos', mostrarTodos: {}, abaEnunciado: 'enunciado' };

  function gravarPrefs() { try { if (armazem()) armazem().setItem(CHAVE_PREFS, JSON.stringify(prefs)); } catch (e) { /* segue sem gravar */ } }

  function definir(chave, valor) { prefs[chave] = valor; gravarPrefs(); }

  const desafios = () => root.DESAFIOS;
  const doIdioma = () => desafios().filter(d => d.linguagem === prefs.linguagem);
  const achar = (id) => desafios().find(d => d.id === id) || null;
  const estatisticas = (agora) => root.Estatisticas.calcular(progresso.dados(), desafios(), agora || Date.now(), prefs.linguagem);

  // desafio do dia da linguagem escolhida: sorteado uma vez por dia entre os que faltam e gravado
  function desafioDoDia() {
    const chave = root.Calendario.chaveDia(new Date()) + '|' + prefs.linguagem;
    const resolvidos = new Set(desafios().filter(d => progresso.resumo(d.id).resolvido).map(d => d.id));
    const id = progresso.desafioDoDia(chave, () => root.Diario.escolher(desafios(), prefs.linguagem, chave, resolvidos));
    const d = id && achar(id);
    return d ? { desafio: d, resgatado: !!progresso.dados().diario[chave].resgatado } : null;
  }

  const medalhas = (agora) => root.Medalhas.avaliar(progresso.dados(), desafios(), prefs.linguagem, estatisticas(agora));

  const api = { prefs, progresso, vol, definir, desafios, doIdioma, achar, estatisticas, medalhas, desafioDoDia, ACENTOS };
  root.Estado = api;
})(typeof self !== 'undefined' ? self : this);
