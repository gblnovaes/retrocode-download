/* Tela Resolver: enunciado, editor, Executar/Enviar, resultado e envios gravados do desafio. */
(function (root) {
  'use strict';
  const { h, html, limpar } = root.H;
  const { icone } = root.Icones;
  const R = root.Rotulos;

  function render(ctx, id, indiceEnvio) {
    const E = root.Estado, d = E.achar(id);
    if (!d) return h('section', { class: 'card' }, h('h2', { class: 'grande' }, 'Desafio não encontrado'), h('p', { class: 'suave' }, 'O desafio "' + id + '" não existe neste catálogo.'), h('a', { class: 'btn', href: '#/desafios' }, 'Ver desafios'));

    const lg = root.Linguagens.porId(d.linguagem), nv = R.NIVEL[d.dificuldade];
    const nomeArquivo = lg.familia === 'Assembly' ? 'SOLUCAO' + lg.extensao.toUpperCase() : 'solucao' + lg.extensao;
    const historicoSalvo = E.progresso.historico(d.id);
    let codigoInicial = E.progresso.rascunho(d.id);
    if (indiceEnvio !== null && historicoSalvo[indiceEnvio]) codigoInicial = historicoSalvo[indiceEnvio].codigo;
    if (codigoInicial === null) codigoInicial = d.codigoInicial;

    // ----- editor com números de linha
    const linhas = h('pre', { class: 'linhas', 'aria-hidden': 'true' });
    const area = h('textarea', { id: 'codigo', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Código ' + lg.nome, value: codigoInicial });
    const atualizarLinhas = () => { const n = area.value.split('\n').length; linhas.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); };
    area.addEventListener('input', () => { atualizarLinhas(); E.progresso.salvarRascunho(d.id, area.value); });
    area.addEventListener('scroll', () => { linhas.scrollTop = area.scrollTop; });
    area.addEventListener('keydown', (e) => {
      // Tab insere 4 espaços; Esc e depois Tab sai do editor (não prende o teclado)
      if (e.key === 'Escape') { area.dataset.livre = '1'; return; }
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && area.dataset.livre !== '1') {
        e.preventDefault();
        const a = area.selectionStart, b = area.selectionEnd;
        area.setRangeText('    ', a, b, 'end');
        area.dispatchEvent(new Event('input'));
      } else if (e.key !== 'Tab') delete area.dataset.livre;
    });
    atualizarLinhas();

    // ----- resultado
    const painel = h('div', { class: 'testes', 'aria-live': 'polite' }, h('div', { class: 'faixa info' }, 'Use Executar para testar nos exemplos visíveis ou Enviar para valer. Envios ficam gravados.'));
    const lista = h('div', { class: 'testes' });

    function mostrarEnvios() {
      limpar(lista);
      const envios = E.progresso.historico(d.id);
      if (!envios.length) { lista.appendChild(h('div', { class: 'vazio' }, 'Nenhum envio ainda.')); return; }
      envios.forEach((x, i) => lista.appendChild(h('div', { class: 'teste', style: { alignItems: 'center', justifyContent: 'space-between' } },
        h('span', null, h('b', null, x.status === 'aceito' ? 'Aceito' : x.status === 'erro-montagem' ? 'Erro de montagem' : 'Não aceito'), ' ', x.status === 'aceito' ? R.estrelas(x.estrelas) : '', h('small', null, R.dataHora(x.quando) + ' · ' + (x.bytes || '—') + ' bytes · ' + (x.ciclos || '—') + ' ciclos')),
        h('button', { type: 'button', class: 'btn pequeno', onclick: () => { area.value = x.codigo; area.dispatchEvent(new Event('input')); area.focus(); } }, 'Ver código'))));
    }

    function mostrar(r, modo) {
      limpar(painel);
      if (r.status === 'indisponivel') { painel.appendChild(h('div', { class: 'faixa info' }, r.mensagem)); return; }
      if (r.status === 'erro-montagem') {
        painel.appendChild(h('div', { class: 'faixa erro' }, icone('x', 16, 3), 'Erro de montagem'));
        r.problemas.forEach(p => painel.appendChild(h('div', { class: 'teste' }, h('span', { class: 'laranja ic' }, icone('x', 14, 3)), h('span', null, 'Linha ' + p.linha, h('small', null, p.msg)))));
        return;
      }
      const aceito = r.status === 'aceito';
      const texto = aceito ? (modo === 'enviar' ? 'Aceito!' : 'Passou nos testes visíveis. Envie para valer.') : r.status === 'regra' ? 'Regra do desafio não cumprida.' : 'Ainda não está certo.';
      painel.appendChild(h('div', { class: 'faixa ' + (aceito ? 'ok' : 'erro') }, icone(aceito ? 'ok' : 'x', 16, 3), texto, aceito && r.estrelas ? R.estrelas(r.estrelas) : null));
      r.regras.forEach(x => painel.appendChild(h('div', { class: 'teste' }, h('span', { class: (x.ok ? 'verde' : 'laranja') + ' ic' }, icone(x.ok ? 'ok' : 'x', 14, 3)), h('span', null, x.msg))));
      r.testes.forEach(t => painel.appendChild(h('div', { class: 'teste' },
        h('span', { class: (t.ok ? 'verde' : 'laranja') + ' ic' }, icone(t.ok ? 'ok' : 'x', 14, 3)),
        h('span', null, t.nome + (t.visivel ? '' : ' (oculto)'), t.msgs.map(m => h('small', null, m))))));
      const m = d.metas;
      painel.appendChild(h('div', { class: 'tres' },
        h('div', { class: 'tile' }, h('span', null, 'Tamanho'), h('b', { class: r.bytes <= m.bytes ? 'verde' : '' }, r.bytes + ' bytes'), h('span', null, 'meta ' + m.bytes)),
        h('div', { class: 'tile' }, h('span', null, 'Ciclos (pior caso)'), h('b', { class: r.ciclosPior <= m.ciclos ? 'verde' : '' }, R.numero(r.ciclosPior)), h('span', null, 'meta ' + R.numero(m.ciclos))),
        h('div', { class: 'tile' }, h('span', null, 'Ciclos (média)'), h('b', null, R.numero(r.ciclosMedia)), h('span', null, modo === 'enviar' ? 'todos os testes' : 'só os visíveis'))));
    }

    function rodar(modo) {
      const antes = E.estatisticas();
      const medalhasAntes = new Set(E.medalhas().filter(m => m.conquistada).map(m => m.id));
      const r = root.Julgador.julgar(d, area.value, modo);
      E.progresso.salvarRascunho(d.id, area.value);
      if (modo === 'enviar' && r.status !== 'indisponivel') {
        E.progresso.registrarEnvio(d.id, r, area.value, Date.now());
        const depois = E.estatisticas();
        const ganhou = depois.pontos - antes.pontos;
        const novas = E.medalhas().filter(m => m.conquistada && !medalhasAntes.has(m.id));
        if (ganhou > 0 || novas.length) ctx.aviso(h('span', null, ganhou > 0 ? h('b', null, '+' + ganhou + ' pts') : null, depois.nivel.numero > antes.nivel.numero ? ' · Subiu para o nível ' + depois.nivel.numero + ': ' + depois.nivel.titulo + '!' : '', novas.map(m => h('div', null, 'Medalha: ', h('b', null, m.nome)))));
        mostrarEnvios();
        ctx.atualizarLateral();
      }
      E.vol.ultimo = { id: d.id, r, modo };
      mostrar(r, modo);
    }

    ctx.atalho((e) => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); rodar(e.shiftKey ? 'enviar' : 'executar'); } });
    mostrarEnvios();
    if (E.vol.ultimo && E.vol.ultimo.id === d.id) mostrar(E.vol.ultimo.r, E.vol.ultimo.modo);

    // ----- enunciado, dicas, editorial e referências
    const aba = E.vol.abaEnunciado;
    const meta = d.metas;
    const Xp = root.Xp;
    const resumo = E.progresso.resumo(d.id);
    const custo = Xp.custoDica(d.dificuldade);
    const md = (texto, classe) => html('div', { class: classe || 'prosa' }, root.Markdown.renderizar(texto));

    // pontos que ainda dá para ganhar (ou que já foram ganhos), conforme dicas e editorial usados
    const emJogo = resumo.resolvido
      ? Xp.pontosDoDesafio(d.dificuldade, resumo)
      : Xp.baseEfetiva(d.dificuldade, resumo) + 2 * Xp.PONTOS[d.dificuldade].estrela + (resumo.tentativas === 0 ? Xp.primeiraEfetiva(d.dificuldade, Object.assign({}, resumo, { aPrimeira: true })) : 0);

    function painelDicas() {
      const itens = d.dicas.map((texto, i) => {
        if (i < resumo.dicas) return h('div', { class: 'dica-card' }, h('b', null, 'Dica ' + (i + 1)), md(texto));
        if (i === resumo.dicas) return h('div', { class: 'dica-card fechada' },
          h('b', null, 'Dica ' + (i + 1)),
          h('button', { type: 'button', class: 'btn pequeno', id: 'revelar-dica', onclick: () => { E.progresso.revelarDica(d.id); ctx.rerender(); } }, resumo.resolvido ? 'Revelar dica ' + (i + 1) : 'Revelar dica ' + (i + 1) + ' (−' + custo + ' pts)'));
        return h('div', { class: 'dica-card fechada' }, h('b', null, 'Dica ' + (i + 1)), h('span', { class: 'mudo' }, 'Revele a dica anterior primeiro.'));
      });
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        h('div', { class: 'faixa info' }, resumo.resolvido ? 'Você já resolveu este desafio: as dicas não custam nada.' : 'Cada dica revelada custa ' + custo + ' pts (20% do valor base) e tira o bônus de "aceito de primeira".'),
        itens);
    }

    function painelEditorial() {
      if (resumo.resolvido || resumo.editorialVisto) return md(d.editorial);
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        h('div', { class: 'faixa erro', style: { alignItems: 'flex-start' } }, 'Ver o editorial antes de resolver zera os ' + Xp.PONTOS[d.dificuldade].base + ' pts base deste desafio e o bônus de primeira. As estrelas de bytes e ciclos continuam valendo.'),
        h('div', null, h('button', { type: 'button', class: 'btn', id: 'ver-editorial', onclick: () => { E.progresso.revelarEditorial(d.id); ctx.rerender(); } }, 'Ver o editorial mesmo assim')));
    }

    let conteudoAba;
    if (aba === 'referencias') conteudoAba = md(d.referencias.map(x => '- ' + x).join('\n'));
    else if (aba === 'dicas') conteudoAba = painelDicas();
    else if (aba === 'editorial') conteudoAba = painelEditorial();
    else conteudoAba = h('div', { class: 'prosa' },
      html('div', null, root.Markdown.renderizar(d.enunciado)),
      h('div', { class: 'contrato' }, h('b', null, 'Contrato'), html('div', { class: 'prosa' }, root.Markdown.renderizar(d.contrato))),
      h('p', { class: 'dica', style: { margin: '12px 0 0' } }, 'Metas de eficiência (estrelas extras): até ' + meta.bytes + ' bytes e até ' + R.numero(meta.ciclos) + ' ciclos no pior caso.'));

    const antes = root.Prerequisitos.pendentes(d, E.doIdioma(), (id) => E.progresso.resumo(id).resolvido);
    const abas = [['enunciado', 'Enunciado'], ['dicas', 'Dicas ' + resumo.dicas + '/' + d.dicas.length], ['editorial', 'Editorial'], ['referencias', 'Referências']];
    const esquerda = h('section', { class: 'card', 'aria-label': 'Enunciado' },
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        h('a', { class: 'volta', href: '#/desafios' }, icone('voltar', 16), 'Voltar aos desafios'),
        h('h1', { style: { margin: 0, fontSize: '24px', letterSpacing: '-.02em' } }, d.titulo),
        antes.length && !resumo.resolvido
          ? h('p', { class: 'suave', style: { margin: 0 } }, 'Recomendado antes: ', antes.map((a, i) => [i ? ', ' : '', h('a', { href: '#/desafio/' + a.id }, a.titulo)]))
          : null,
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
          h('span', { class: 'selo', style: { color: nv.cor, background: nv.bg } }, nv.label),
          h('span', { class: 'chip' }, R.trilha(d.trilha)),
          h('span', { class: 'chip mono' }, lg.curto),
          d.aula ? h('span', { class: 'chip' }, 'Aula ' + d.aula) : null,
          h('span', { class: 'chip' }, resumo.resolvido ? emJogo + ' pts ganhos' : 'até ' + emJogo + ' pts'))),
      h('div', { class: 'grupo', role: 'group', 'aria-label': 'Conteúdo' }, abas.map(a => h('button', { type: 'button', 'aria-pressed': String(aba === a[0]), onclick: () => { E.vol.abaEnunciado = a[0]; ctx.rerender(); } }, a[1]))),
      conteudoAba);

    const direita = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 } },
      h('section', { class: 'card', 'aria-label': 'Editor' },
        h('div', { class: 'editor-cab' }, h('span', { class: 'arquivo' }, nomeArquivo),
          h('div', { class: 'acoes', style: { gap: '8px' } },
            h('button', { type: 'button', class: 'btn pequeno', onclick: () => { area.value = d.codigoInicial; area.dispatchEvent(new Event('input')); } }, icone('reiniciar', 14), 'Restaurar'),
            h('button', { type: 'button', class: 'btn pequeno', id: 'executar', title: 'Ctrl+Enter', onclick: () => rodar('executar') }, icone('play', 14), 'Executar'),
            h('button', { type: 'button', class: 'btn pequeno primario', id: 'enviar', title: 'Ctrl+Shift+Enter', onclick: () => rodar('enviar') }, icone('ok', 14, 3), 'Enviar'))),
        h('div', { class: 'editor' }, linhas, area),
        h('p', { class: 'dica', style: { margin: 0 } }, 'Ctrl+Enter executa · Ctrl+Shift+Enter envia · Tab indenta; Esc e depois Tab sai do editor.')),
      h('section', { class: 'card', 'aria-label': 'Resultado' }, h('h2', null, 'Resultado'), painel),
      h('section', { class: 'card', 'aria-label': 'Envios gravados' }, h('h2', null, 'Envios gravados'), lista));

    return h('div', { class: 'resolver' }, esquerda, direita);
  }

  root.ViewResolver = { render };
})(typeof self !== 'undefined' ? self : this);
