/* Leitor de desafios: transforma o Markdown de um desafio num objeto validado. */
(function (root) {
  'use strict';
  const Linguagens = typeof require === 'function' && typeof module === 'object' ? require('./linguagens.js') : root.Linguagens;

  const DIFICULDADES = ['facil', 'medio', 'dificil'];
  const OBRIGATORIOS = ['id', 'linguagem', 'titulo', 'dificuldade', 'trilha'];
  const SECOES = {
    'enunciado': 'enunciado', 'contrato': 'contrato', 'código inicial': 'codigoInicial',
    'solução oficial': 'solucao', 'testes': 'testes', 'metas': 'metas', 'dicas': 'dicas',
    'editorial': 'editorial', 'referências': 'referencias'
  };

  function lerCabecalho(texto) {
    const fm = {};
    for (const linha of texto.split('\n')) {
      const m = /^([a-zA-Z]+):\s*(.*)$/.exec(linha.trim());
      if (!m) continue;
      const v = m[2].trim();
      fm[m[1]] = /^\[.*\]$/.test(v) ? v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean) : v;
    }
    return fm;
  }

  function bloco(texto, lang) {
    const m = new RegExp('```' + lang + '\\s*\\n([\\s\\S]*?)\\n```').exec(texto);
    return m ? m[1] : null;
  }

  function lista(texto) {
    return texto.split('\n').map(l => l.trim()).filter(l => /^(\d+\.|-)\s/.test(l)).map(l => l.replace(/^(\d+\.|-)\s+/, ''));
  }

  function lerDesafio(md) {
    const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(md.replace(/\r\n/g, '\n'));
    if (!m) throw new Error('Desafio sem cabeçalho (--- ... ---).');
    const fm = lerCabecalho(m[1]);
    for (const c of OBRIGATORIOS) if (!fm[c]) throw new Error('Cabeçalho sem o campo "' + c + '".');
    const id = fm.id;
    if (!Linguagens.porId(fm.linguagem)) throw new Error(id + ': linguagem "' + fm.linguagem + '" não existe no registro (dominio/linguagens.js).');
    if (!DIFICULDADES.includes(fm.dificuldade)) throw new Error(id + ': dificuldade deve ser ' + DIFICULDADES.join(', ') + '.');

    const secoes = {};
    for (const parte of ('\n' + m[2]).split(/\n# (?=[^\n]+\n)/).slice(1)) {
      const quebra = parte.indexOf('\n');
      const chave = SECOES[parte.slice(0, quebra).trim().toLowerCase()];
      if (chave) secoes[chave] = parte.slice(quebra + 1).trim();
    }
    for (const c of Object.values(SECOES)) if (!secoes[c]) throw new Error(id + ': falta a seção "' + c + '".');

    const d = {
      id, linguagem: fm.linguagem, titulo: fm.titulo, dificuldade: fm.dificuldade, trilha: fm.trilha,
      tags: fm.tags || [], prerequisitos: fm.prerequisitos || [], aula: fm.aula ? +fm.aula : null,
      enunciado: secoes.enunciado, contrato: secoes.contrato, editorial: secoes.editorial,
      codigoInicial: bloco(secoes.codigoInicial, 'asm'), solucao: bloco(secoes.solucao, 'asm'),
      dicas: lista(secoes.dicas), referencias: lista(secoes.referencias)
    };
    if (d.codigoInicial === null) throw new Error(id + ': "Código inicial" sem bloco asm.');
    if (d.solucao === null) throw new Error(id + ': "Solução oficial" sem bloco asm.');
    try { d.testes = JSON.parse(bloco(secoes.testes, 'json')); } catch (e) { throw new Error(id + ': testes com JSON inválido (' + e.message + ').'); }
    try { d.metas = JSON.parse(bloco(secoes.metas, 'json')); } catch (e) { throw new Error(id + ': metas com JSON inválido (' + e.message + ').'); }

    const visiveis = d.testes.filter(t => t.visivel).length, ocultos = d.testes.length - visiveis;
    if (visiveis < 2) throw new Error(id + ': precisa de pelo menos 2 testes visíveis (tem ' + visiveis + ').');
    if (ocultos < 6) throw new Error(id + ': precisa de pelo menos 6 testes ocultos (tem ' + ocultos + ').');
    if (d.dicas.length !== 3) throw new Error(id + ': precisa de exatamente 3 dicas (tem ' + d.dicas.length + ').');
    if (!d.referencias.length) throw new Error(id + ': precisa de referências.');
    return d;
  }

  const api = { lerDesafio, DIFICULDADES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Desafio = api;
})(typeof self !== 'undefined' ? self : this);
