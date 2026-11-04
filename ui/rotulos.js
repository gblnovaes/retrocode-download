/* Nomes, cores e formatos usados por todas as telas. */
(function (root) {
  'use strict';
  const NIVEL = {
    facil: { label: 'Básico', cor: 'var(--facil)', bg: 'var(--facil-bg)' },
    medio: { label: 'Médio', cor: 'var(--medio)', bg: 'var(--medio-bg)' },
    dificil: { label: 'Avançado', cor: 'var(--dificil)', bg: 'var(--dificil-bg)' }
  };
  const NIVEIS = ['facil', 'medio', 'dificil'];
  const TRILHAS = { registradores: 'Registradores', bits: 'Bits e flags', decisoes: 'Decisões e saltos', vetores: 'Vetores e laços', strings: 'Strings', aritmetica: 'Aritmética', pilha: 'Pilha', procedimentos: 'Procedimentos', enderecamento: 'Endereçamento', numeros: 'Números e texto', dos: 'DOS e interrupções', otimizacao: 'Otimização' };
  const trilha = (slug) => TRILHAS[slug] || slug;
  const numero = (n) => Number(n).toLocaleString('pt-BR');
  const data = (ms) => new Date(ms).toLocaleDateString('pt-BR');
  const dataHora = (ms) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const plural = (n, um, varios) => n === 1 ? um : varios;

  // ★★☆ como elementos, para o leitor de tela ler "2 de 3 estrelas" uma vez só
  function estrelas(e) {
    const total = (e.aceito ? 1 : 0) + (e.bytes ? 1 : 0) + (e.ciclos ? 1 : 0);
    const span = document.createElement('span');
    span.className = 'estrelas';
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', total + ' de 3 estrelas');
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.textContent = i < total ? '★' : '☆';
      if (i >= total) s.className = 'apagada';
      s.setAttribute('aria-hidden', 'true');
      span.appendChild(s);
    }
    return span;
  }

  root.Rotulos = { NIVEL, NIVEIS, trilha, numero, data, dataHora, plural, estrelas };
})(typeof self !== 'undefined' ? self : this);
