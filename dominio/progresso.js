/*
 * Progresso do aluno: rascunhos, histórico de envios e melhores estrelas por desafio.
 * O armazenamento é injetado (qualquer objeto com getItem/setItem, como o localStorage),
 * então as regras não dependem do navegador e são testáveis em Node.
 */
(function (root) {
  'use strict';
  const node = typeof require === 'function' && typeof module === 'object';
  const Calendario = node ? require('./calendario.js') : root.Calendario;

  const CHAVE = 'asmcode8086:progresso:v1';
  const MAX_ENVIOS = 20;
  const MAX_DICAS = 3;
  const SEM_ESTRELAS = () => ({ aceito: false, bytes: false, ciclos: false });

  function vazio() { return { versao: 1, desafios: {}, diario: {} }; }

  function valido(estado) {
    return estado && typeof estado === 'object' && estado.versao === 1 && estado.desafios && typeof estado.desafios === 'object';
  }

  // completa o que um arquivo antigo ou editado à mão possa não ter, para as telas não quebrarem
  function normalizar(lido) {
    if (!lido.diario || typeof lido.diario !== 'object') lido.diario = {};
    for (const id of Object.keys(lido.desafios)) {
      const d = lido.desafios[id];
      if (!d || typeof d !== 'object') { delete lido.desafios[id]; continue; }
      if (!Array.isArray(d.envios)) d.envios = [];
      if (!d.estrelas || typeof d.estrelas !== 'object') d.estrelas = SEM_ESTRELAS();
      d.resolvido = !!d.resolvido;
    }
    return lido;
  }

  // `chave` escolhe onde gravar (um progresso por perfil); sem ela vale a chave original
  function criarProgresso(armazem, chave) {
    const CHAVE_USADA = chave || CHAVE;
    let estado = vazio();
    try {
      const bruto = armazem && armazem.getItem(CHAVE_USADA);
      if (bruto) { const lido = JSON.parse(bruto); if (valido(lido)) estado = normalizar(lido); }
    } catch (e) { /* dados corrompidos: começa vazio */ }

    function gravar() {
      try { if (armazem) armazem.setItem(CHAVE_USADA, JSON.stringify(estado)); } catch (e) { /* cheio ou bloqueado: segue na memória */ }
    }

    function entrada(id) {
      if (!estado.desafios[id]) estado.desafios[id] = { rascunho: null, envios: [], estrelas: SEM_ESTRELAS(), resolvido: false, aPrimeira: false, tentativas: 0, dicas: 0, dicasPenalidade: 0, editorialVisto: false, editorialAntes: false };
      return estado.desafios[id];
    }

    return {
      salvarRascunho(id, codigo) { entrada(id).rascunho = codigo; gravar(); },

      rascunho(id) {
        const d = estado.desafios[id];
        return d && typeof d.rascunho === 'string' ? d.rascunho : null;
      },

      registrarEnvio(id, resultado, codigo, agora) {
        const d = entrada(id);
        if (!d.tentativas && resultado.status === 'aceito' && resultado.estrelas) d.aPrimeira = true;
        d.envios.unshift({
          quando: agora, status: resultado.status, bytes: resultado.bytes, ciclos: resultado.ciclosPior,
          estrelas: resultado.estrelas || SEM_ESTRELAS(), codigo
        });
        d.envios.length = Math.min(d.envios.length, MAX_ENVIOS);
        if (resultado.status === 'aceito' && resultado.estrelas) {
          d.resolvido = true;
          for (const k of Object.keys(d.estrelas)) d.estrelas[k] = d.estrelas[k] || !!resultado.estrelas[k];
        }
        d.tentativas = (d.tentativas || 0) + 1;
        // aceito no mesmo dia em que era o desafio do dia: bônus, uma vez só
        if (resultado.status === 'aceito' && resultado.estrelas) {
          const hoje = Calendario.chaveDia(new Date(agora));
          for (const chave of Object.keys(estado.diario || {})) {
            const dia = estado.diario[chave];
            if (chave.slice(0, 10) === hoje && dia.id === id && !dia.resgatado) dia.resgatado = { quando: agora };
          }
        }
        gravar();
      },

      // o desafio do dia é escolhido na primeira vez em que o dia é consultado e fica gravado
      // (a chave é AAAA-MM-DD, opcionalmente seguida de |linguagem)
      desafioDoDia(chave, escolher) {
        if (!estado.diario) estado.diario = {};
        if (!estado.diario[chave]) {
          const id = escolher();
          if (!id) return null;
          estado.diario[chave] = { id }; gravar();
        }
        return estado.diario[chave].id;
      },

      // dica vista antes de resolver custa pontos; depois de resolver é de graça
      revelarDica(id) {
        const d = entrada(id);
        if ((d.dicas || 0) < MAX_DICAS) {
          d.dicas = (d.dicas || 0) + 1;
          if (!d.resolvido) d.dicasPenalidade = (d.dicasPenalidade || 0) + 1;
          gravar();
        }
      },

      revelarEditorial(id) {
        const d = entrada(id);
        d.editorialVisto = true;
        if (!d.resolvido) d.editorialAntes = true;
        gravar();
      },

      historico(id) { return estado.desafios[id] ? estado.desafios[id].envios.slice() : []; },

      resumo(id) {
        const d = estado.desafios[id];
        const sem = { dicas: 0, dicasPenalidade: 0, editorialVisto: false, editorialAntes: false };
        if (!d) return Object.assign({ tentativas: 0, resolvido: false, aPrimeira: false, estrelas: SEM_ESTRELAS() }, sem);
        return {
          tentativas: d.tentativas || 0, resolvido: d.resolvido, aPrimeira: !!d.aPrimeira, estrelas: Object.assign(SEM_ESTRELAS(), d.estrelas),
          dicas: d.dicas || 0, dicasPenalidade: d.dicasPenalidade || 0, editorialVisto: !!d.editorialVisto, editorialAntes: !!d.editorialAntes
        };
      },

      dados() { return JSON.parse(JSON.stringify(estado)); },

      exportar() { return JSON.stringify(estado, null, 2); },

      importar(json) {
        let lido;
        try { lido = JSON.parse(json); } catch (e) { throw new Error('Arquivo de progresso inválido.'); }
        if (!valido(lido)) throw new Error('Arquivo de progresso inválido.');
        estado = normalizar(lido);
        gravar();
      }
    };
  }

  const api = { criarProgresso, CHAVE, MAX_ENVIOS, MAX_DICAS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Progresso = api;
})(typeof self !== 'undefined' ? self : this);
