/* Tela de acesso: entrar ou criar conta (design "Login e cadastro"). Fala só com o serviço de contas (root.Estado.contas). */
(function (root) {
  'use strict';
  const { h } = root.H;
  const { icone } = root.Icones;
  const E = root.Estado;

  const NIVEIS = [
    { id: 'basico', rotulo: 'Básico', cor: 'var(--facil)' },
    { id: 'medio', rotulo: 'Médio', cor: 'var(--medio)' },
    { id: 'avancado', rotulo: 'Avançado', cor: 'var(--dificil)' }
  ];

  function campo(o) {
    const input = h('input', { type: o.tipo || 'text', name: o.nome, class: 'acesso-campo' + (o.mono ? ' mono' : ''), placeholder: o.dica || '', autocomplete: o.auto || 'off', maxlength: o.max ? String(o.max) : null, required: o.obrigatorio === false ? null : true });
    return h('label', { class: 'acesso-rotulo' }, o.rotulo, input);
  }

  function marca() {
    return h('div', { class: 'acesso-marca' },
      h('div', { class: 'marca-icone' }, icone('codigo', 22, 2.4)),
      h('div', { class: 'acesso-marca-texto' }, h('b', null, 'RetroCode'), h('small', { class: 'slogan' }, '> desafios old school', h('span', { class: 'cursor' }, '_'))));
  }

  function painelRetro() {
    const roxo = (t) => h('span', { class: 'sx-roxo' }, t), amarelo = (t) => h('span', { class: 'sx-amarelo' }, t), mudo = (t) => h('span', { class: 'sx-mudo' }, t);
    return h('section', { class: 'acesso-painel', 'aria-label': 'Sobre o RetroCode' },
      marca(),
      h('div', { class: 'acesso-texto' },
        h('h1', null, 'Programe como nos anos 80. Evolua como hoje.'),
        h('p', null, 'Resolva desafios em níveis Básico, Médio e Avançado, acompanhe seus acertos e erros e veja sua pontuação subir.')),
      h('div', { class: 'acesso-codigo', 'aria-hidden': 'true' },
        h('div', { class: 'acesso-codigo-topo' }, h('i'), h('i'), h('i'), h('span', null, 'DESAFIO.ASM')),
        h('div', { class: 'acesso-codigo-corpo' },
          mudo('; desafio #001 · soma simples'),
          h('span', null, roxo('MOV'), ' AX, ', amarelo('5')),
          h('span', null, roxo('ADD'), ' AX, ', amarelo('3'), '   ', mudo('; AX = 8')),
          h('span', null, roxo('INT'), ' ', amarelo('21h')),
          h('span', { class: 'sx-ok' }, '> OK · 3/3 testes · +10 pts', h('span', { class: 'cursor' }, '_')))));
  }

  // aoConcluir(conta, ehNova) é chamado depois de entrar ou criar a conta
  function acesso(aoConcluir) {
    let modo = 'entrar', nivel = 'basico';
    const area = h('div', { class: 'acesso-area' });
    const abas = h('div', { class: 'acesso-abas', role: 'tablist', 'aria-label': 'Entrar ou criar conta' });

    function trocar(novo) { modo = novo; desenhar(); const f = area.querySelector('input,select'); if (f) f.focus(); }

    function desenharAbas() {
      abas.textContent = '';
      [['entrar', 'Entrar'], ['criar', 'Criar conta']].forEach(([id, texto]) =>
        abas.appendChild(h('button', { type: 'button', role: 'tab', class: 'acesso-aba', 'aria-selected': String(modo === id), onclick: () => trocar(id) }, texto)));
    }

    function formulario(titulo, subtitulo, filhos, enviar, textoBotao, rodape) {
      const erro = h('p', { class: 'acesso-erro', role: 'alert' });
      const aviso = h('p', { class: 'acesso-info', role: 'status' });
      const botao = h('button', { type: 'submit', class: 'btn primario acesso-enviar' }, textoBotao, icone('seta', 16, 2.6));
      const form = h('form', { class: 'acesso-form', novalidate: true, onsubmit: async (e) => {
        e.preventDefault();
        erro.textContent = ''; aviso.textContent = '';
        botao.disabled = true;
        try { await enviar(form, aviso); }
        catch (x) { erro.textContent = x.message; const f = x.campo && form.elements[x.campo]; if (f && f.focus) f.focus(); }
        finally { botao.disabled = false; }
      } },
        h('div', { class: 'acesso-cab' }, h('h2', null, titulo), h('p', null, subtitulo)),
        filhos, erro, aviso, botao, rodape);
      return form;
    }

    function formEntrar() {
      const esqueci = h('button', { type: 'button', class: 'acesso-link', onclick: () => { form.querySelector('.acesso-info').textContent = 'A conta fica só neste navegador por enquanto, então ainda não há recuperação de senha por e-mail. Ela chega junto com o servidor.'; } }, 'Esqueci minha senha');
      const lembrar = h('input', { type: 'checkbox', name: 'lembrar' });
      const form = formulario('Bem-vindo de volta', 'Entre para continuar seus desafios.', [
        campo({ rotulo: 'E-mail', tipo: 'email', nome: 'email', dica: 'voce@email.com', auto: 'email' }),
        campo({ rotulo: 'Senha', tipo: 'password', nome: 'senha', dica: '••••••••', auto: 'current-password' }),
        h('div', { class: 'acesso-linha' }, h('label', { class: 'acesso-check' }, lembrar, 'Lembrar de mim'), esqueci)
      ], async (f) => {
        const conta = await E.contas.entrar({ email: f.elements.email.value, senha: f.elements.senha.value, lembrar: lembrar.checked });
        aoConcluir(conta, false);
      }, 'Entrar',
        h('p', { class: 'acesso-troca' }, 'Ainda não tem conta? ', h('button', { type: 'button', class: 'acesso-link', onclick: () => trocar('criar') }, 'Criar conta')));
      return form;
    }

    function formCriar() {
      const livres = E.contas.perfisLivres();
      const botoesNivel = h('div', { class: 'acesso-niveis' });
      function desenharNiveis() {
        botoesNivel.textContent = '';
        NIVEIS.forEach(n => botoesNivel.appendChild(h('button', { type: 'button', class: 'acesso-nivel', 'aria-pressed': String(nivel === n.id), style: { '--cor': n.cor }, onclick: () => { nivel = n.id; desenharNiveis(); } }, h('i'), n.rotulo)));
      }
      desenharNiveis();
      const aceite = h('input', { type: 'checkbox', name: 'aceite' });
      const adotar = livres.length ? h('label', { class: 'acesso-rotulo' }, 'Trazer o progresso de um perfil anterior',
        h('select', { name: 'perfilExistenteId', class: 'acesso-campo' }, h('option', { value: '' }, 'Começar do zero'), livres.map(p => h('option', { value: p.id }, p.nome)))) : null;
      return formulario('Crie sua conta', 'Leva menos de um minuto. Seu primeiro desafio já está esperando.', [
        h('div', { class: 'acesso-duas' },
          campo({ rotulo: 'Nome', nome: 'nome', dica: 'Seu nome', auto: 'name', max: E.Contas.MAX_NOME }),
          campo({ rotulo: 'Usuário', nome: 'usuario', dica: '@usuario', auto: 'username', mono: true, max: 21 })),
        campo({ rotulo: 'E-mail', tipo: 'email', nome: 'email', dica: 'voce@email.com', auto: 'email' }),
        h('div', { class: 'acesso-duas' },
          campo({ rotulo: 'Senha', tipo: 'password', nome: 'senha', dica: 'Mín. 8 caracteres', auto: 'new-password' }),
          campo({ rotulo: 'Confirmar senha', tipo: 'password', nome: 'confirmacao', dica: 'Repita a senha', auto: 'new-password' })),
        h('fieldset', { class: 'acesso-nivel-grupo' }, h('legend', null, 'Por qual nível quer começar?'), botoesNivel),
        adotar,
        h('label', { class: 'acesso-check acesso-termos' }, aceite, h('span', null, 'Li e aceito os ', h('b', null, 'Termos de uso'), ' e a ', h('b', null, 'Política de privacidade'), '.'))
      ], async (f) => {
        const conta = await E.contas.cadastrar({
          nome: f.elements.nome.value, usuario: f.elements.usuario.value, email: f.elements.email.value,
          senha: f.elements.senha.value, confirmacao: f.elements.confirmacao.value, nivel, aceite: aceite.checked,
          perfilExistenteId: f.elements.perfilExistenteId ? f.elements.perfilExistenteId.value || undefined : undefined, lembrar: true
        });
        aoConcluir(conta, true);
      }, 'Criar conta',
        h('p', { class: 'acesso-troca' }, 'Já tem conta? ', h('button', { type: 'button', class: 'acesso-link', onclick: () => trocar('entrar') }, 'Entrar')));
    }

    function desenhar() {
      desenharAbas();
      area.textContent = '';
      area.appendChild(modo === 'entrar' ? formEntrar() : formCriar());
    }
    desenhar();

    return h('main', { class: 'acesso' }, painelRetro(),
      h('section', { class: 'acesso-lado', 'aria-label': 'Acesso' }, h('div', { class: 'acesso-caixa' }, abas, area)));
  }

  root.ViewAcesso = { acesso };
})(typeof self !== 'undefined' ? self : this);
