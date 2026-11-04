/*
 * Perfis: quem está jogando fica registrado (só neste navegador) e o app volta a reconhecê-lo.
 * Cada perfil tem o seu progresso, gravado em uma chave própria. O armazenamento é injetado
 * (qualquer objeto com getItem/setItem), então as regras são testáveis em Node.
 */
(function (root) {
  'use strict';

  const CHAVE_PERFIS = 'retrocode:perfis:v1';
  const CHAVE_LEGADO = 'asmcode8086:progresso:v1';
  const MAX_NOME = 30;

  const chaveProgresso = (id) => CHAVE_LEGADO + ':' + id;
  const limpar = (nome) => String(nome === undefined || nome === null ? '' : nome).trim().replace(/\s+/g, ' ');
  // chave de comparação: sem maiúsculas nem acentos
  const comparavel = (nome) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function criarPerfis(armazem, opcoes) {
    const agora = (opcoes && opcoes.agora) || (() => Date.now());
    const gerarId = (opcoes && opcoes.gerarId) || (() => 'p' + agora().toString(36) + Math.random().toString(36).slice(2, 8));
    let estado = { versao: 1, ativo: null, lista: [] };

    try {
      const bruto = armazem && armazem.getItem(CHAVE_PERFIS);
      if (bruto) {
        const lido = JSON.parse(bruto);
        if (lido && lido.versao === 1 && Array.isArray(lido.lista)) {
          const lista = lido.lista.filter(p => p && typeof p.id === 'string' && typeof p.nome === 'string');
          estado = { versao: 1, ativo: lista.some(p => p.id === lido.ativo) ? lido.ativo : null, lista };
        }
      }
    } catch (e) { /* dados corrompidos: começa sem registro */ }

    function gravar() {
      try { if (armazem) armazem.setItem(CHAVE_PERFIS, JSON.stringify(estado)); } catch (e) { /* cheio ou bloqueado: segue na memória */ }
    }

    function validarNome(nome, ignorarId, permitirRepetido) {
      const limpo = limpar(nome);
      if (!limpo) throw new Error('Escreva um nome.');
      if (limpo.length > MAX_NOME) throw new Error('O nome pode ter no máximo ' + MAX_NOME + ' caracteres.');
      if (!permitirRepetido && estado.lista.some(p => p.id !== ignorarId && comparavel(p.nome) === comparavel(limpo))) throw new Error('Nome inválido: já existe um perfil chamado "' + limpo + '".');
      return limpo;
    }

    const achar = (id) => estado.lista.find(p => p.id === id) || null;

    return {
      lista() { return estado.lista.map(p => Object.assign({}, p)); },
      ativo() { const p = achar(estado.ativo); return p ? Object.assign({}, p) : null; },
      // opcoes.permitirRepetido: contas diferentes podem ter o mesmo nome de exibição
      criar(nome, opcoes) {
        const limpo = validarNome(nome, undefined, !!(opcoes && opcoes.permitirRepetido));
        const perfil = { id: gerarId(), nome: limpo, criadoEm: agora() };
        // o primeiro perfil herda o progresso que já estava gravado antes dos perfis existirem
        if (estado.lista.length === 0 && armazem) {
          try { const antigo = armazem.getItem(CHAVE_LEGADO); if (antigo) armazem.setItem(chaveProgresso(perfil.id), antigo); } catch (e) { /* segue sem migrar */ }
        }
        estado.lista.push(perfil);
        estado.ativo = perfil.id;
        gravar();
        return Object.assign({}, perfil);
      },
      trocar(id) {
        if (!achar(id)) throw new Error('Esse perfil não existe.');
        estado.ativo = id; gravar();
      },
      renomear(id, nome) {
        const perfil = achar(id);
        if (!perfil) throw new Error('Esse perfil não existe.');
        perfil.nome = validarNome(nome, id); gravar();
      }
    };
  }

  const api = { criarPerfis, chaveProgresso, CHAVE_PERFIS, CHAVE_LEGADO, MAX_NOME };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Perfis = api;
})(typeof self !== 'undefined' ? self : this);
