/*
 * Contas locais: cadastro e entrada por e-mail e senha, com sessão. Por enquanto tudo fica neste navegador;
 * o servidor virá depois. Por isso a interface é assíncrona (cadastrar, entrar e sair devolvem Promise): trocar
 * este módulo por um que fale com o backend não exige mudar as telas.
 * Cada conta aponta para um perfil (perfis.js), que guarda o progresso. As dependências são injetadas, então tudo roda em Node.
 */
(function (root) {
  'use strict';

  const Senha = (typeof module === 'object' && module.exports) ? require('./senha.js') : root.Senha;

  const CHAVE_CONTAS = 'retrocode:contas:v1';
  const CHAVE_SESSAO = 'retrocode:sessao:v1';
  const MAX_NOME = 30, MIN_SENHA = 8;
  const NIVEIS = ['basico', 'medio', 'avancado'];
  const DIFICULDADE = { basico: 'facil', medio: 'medio', avancado: 'dificil' };
  const dificuldadeDoNivel = (nivel) => DIFICULDADE[nivel];

  const limpar = (v) => String(v === undefined || v === null ? '' : v).trim().replace(/\s+/g, ' ');
  const normalizarUsuario = (v) => limpar(v).replace(/^@/, '').toLowerCase();
  const normalizarEmail = (v) => String(v === undefined || v === null ? '' : v).trim().toLowerCase();

  function falha(campo, mensagem) { const e = new Error(mensagem); e.campo = campo; return e; }
  const publica = (c) => ({ id: c.id, nome: c.nome, usuario: c.usuario, email: c.email, nivel: c.nivel, perfilId: c.perfilId, criadoEm: c.criadoEm });

  function criarContas(dep) {
    const armazem = dep.armazem || null, sessao = dep.armazemSessao || null, perfis = dep.perfis;
    const agora = dep.agora || (() => Date.now());
    const gerarId = dep.gerarId || (() => 'c' + agora().toString(36) + Math.random().toString(36).slice(2, 8));
    const gerarSal = dep.gerarSal || Senha.gerarSal;
    let lista = [];
    // sem armazenamento a sessão fica na memória
    let sessaoMemoria = null;

    try {
      const bruto = armazem && armazem.getItem(CHAVE_CONTAS);
      if (bruto) {
        const lido = JSON.parse(bruto);
        if (lido && lido.versao === 1 && Array.isArray(lido.lista)) lista = lido.lista.filter(c => c && typeof c.id === 'string' && typeof c.hash === 'string' && typeof c.sal === 'string');
      }
    } catch (e) { /* dados corrompidos: começa sem contas */ }

    function gravar() { try { if (armazem) armazem.setItem(CHAVE_CONTAS, JSON.stringify({ versao: 1, lista })); } catch (e) { /* cheio ou bloqueado: segue na memória */ } }

    function lerSessao() {
      for (const a of [sessao, armazem]) {
        try { const b = a && a.getItem(CHAVE_SESSAO); if (b) { const s = JSON.parse(b); if (s && typeof s.contaId === 'string') return s.contaId; } } catch (e) { /* ignora */ }
      }
      return sessaoMemoria;
    }

    function abrirSessao(conta, lembrar) {
      const texto = JSON.stringify({ contaId: conta.id });
      sessaoMemoria = conta.id;
      try { if (sessao) sessao.removeItem(CHAVE_SESSAO); } catch (e) { /* ignora */ }
      try { if (armazem) armazem.removeItem(CHAVE_SESSAO); } catch (e) { /* ignora */ }
      try { const destino = lembrar ? armazem : sessao; if (destino) destino.setItem(CHAVE_SESSAO, texto); } catch (e) { /* segue na memória */ }
      perfis.trocar(conta.perfilId);
    }

    const perfilExiste = (id) => perfis.lista().some(p => p.id === id);

    return {
      atual() {
        const id = lerSessao();
        const c = id && lista.find(x => x.id === id);
        return c && perfilExiste(c.perfilId) ? publica(c) : null;
      },
      // perfis antigos (criados só com um nome) que ainda não pertencem a nenhuma conta
      perfisLivres() { const usados = new Set(lista.map(c => c.perfilId)); return perfis.lista().filter(p => !usados.has(p.id)); },

      async cadastrar(d) {
        const nome = limpar(d.nome), usuario = normalizarUsuario(d.usuario), email = normalizarEmail(d.email);
        if (!nome) throw falha('nome', 'Escreva o seu nome.');
        if (nome.length > MAX_NOME) throw falha('nome', 'O nome pode ter no máximo ' + MAX_NOME + ' caracteres.');
        if (!/^[a-z0-9_.]{3,20}$/.test(usuario)) throw falha('usuario', 'O usuário precisa ter de 3 a 20 caracteres: letras, números, ponto ou sublinhado.');
        if (lista.some(c => c.usuario === usuario)) throw falha('usuario', 'O usuário @' + usuario + ' já está em uso.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw falha('email', 'Digite um e-mail válido.');
        if (lista.some(c => c.email === email)) throw falha('email', 'Esse e-mail já tem uma conta. Use "Entrar".');
        const senha = String(d.senha === undefined || d.senha === null ? '' : d.senha);
        if (senha.length < MIN_SENHA) throw falha('senha', 'A senha precisa ter pelo menos ' + MIN_SENHA + ' caracteres.');
        if (senha !== String(d.confirmacao === undefined || d.confirmacao === null ? '' : d.confirmacao)) throw falha('confirmacao', 'As senhas não conferem.');
        const nivel = d.nivel === undefined ? 'basico' : d.nivel;
        if (NIVEIS.indexOf(nivel) < 0) throw falha('nivel', 'Escolha um nível para começar.');
        if (d.aceite !== true) throw falha('aceite', 'Aceite os termos de uso para criar a conta.');
        let perfilId = d.perfilExistenteId;
        if (perfilId) {
          if (!perfilExiste(perfilId) || lista.some(c => c.perfilId === perfilId)) throw falha('perfilExistenteId', 'Esse perfil não está disponível.');
        } else perfilId = perfis.criar(nome, { permitirRepetido: true }).id;
        const sal = gerarSal();
        const conta = { id: gerarId(), nome, usuario, email, nivel, perfilId, criadoEm: agora(), sal, hash: Senha.derivar(senha, sal) };
        lista.push(conta);
        gravar();
        abrirSessao(conta, d.lembrar !== false);
        return publica(conta);
      },

      async entrar(d) {
        const email = normalizarEmail(d.email), senha = String(d.senha === undefined || d.senha === null ? '' : d.senha);
        const conta = lista.find(c => c.email === email);
        // com e-mail desconhecido gasta o mesmo tempo, para não revelar quem tem conta
        const hash = Senha.derivar(senha, conta ? conta.sal : 'sem-conta');
        if (!conta || !Senha.iguais(hash, conta.hash) || !perfilExiste(conta.perfilId)) throw falha('senha', 'E-mail ou senha incorretos.');
        abrirSessao(conta, !!d.lembrar);
        return publica(conta);
      },

      async sair() {
        sessaoMemoria = null;
        try { if (sessao) sessao.removeItem(CHAVE_SESSAO); } catch (e) { /* ignora */ }
        try { if (armazem) armazem.removeItem(CHAVE_SESSAO); } catch (e) { /* ignora */ }
      }
    };
  }

  const api = { criarContas, CHAVE_CONTAS, CHAVE_SESSAO, NIVEIS, MAX_NOME, MIN_SENHA, dificuldadeDoNivel };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Contas = api;
})(typeof self !== 'undefined' ? self : this);
