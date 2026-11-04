/*
 * Juiz do RetroCode (Assembly 8086).
 * Monta a solução, confere regras estáticas, roda cada teste numa máquina nova e
 * mede bytes e ciclos. Reaproveita o verificador do curso para conferir resultados.
 *
 * julgar(desafio, codigo, modo)
 *   modo 'executar': só os testes visíveis, sem estrelas
 *   modo 'enviar'  : todos os testes, com estrelas de bytes e ciclos
 */
(function (root) {
  'use strict';
  const node = typeof require === 'function' && typeof module === 'object';
  const Asm = node ? require('../core/asm.js') : root.Asm8086;
  const M = node ? require('../core/cpu.js') : root.Machine8086;
  const Recursao = node ? require('./recursao.js') : root.Recursao;
  const Verificador = node ? require('../core/verificador.js') : root.Verificador;

  const MAX_PASSOS = 200000; // pega laço infinito sem travar a tela

  function montar(codigo) {
    return M.montarPrograma ? M.montarPrograma(codigo) : Asm.assemble(codigo);
  }

  function tamanhoEmBytes(prog) {
    return prog.instrs.reduce((s, i) => s + i.size, 0);
  }

  function ciclosDoTeste(codigo, teste) {
    const run = M.runProgram(codigo, { setup: teste.setup, input: teste.entrada, maxSteps: MAX_PASSOS, arquivos: teste.arquivos });
    return { ciclos: run.machine.cycles, passos: run.machine.steps };
  }

  function julgar(desafio, codigo, modo) {
    const enviar = modo === 'enviar';
    const metas = desafio.metas || {};
    const r = { status: 'errado', problemas: [], regras: [], testes: [], bytes: 0, ciclosPior: 0, ciclosMedia: 0, estrelas: null };

    const prog = montar(codigo);
    if (!prog.ok) {
      r.status = 'erro-montagem';
      r.problemas = prog.errors.map(e => ({ linha: e.line, msg: e.msg }));
      return r;
    }
    r.bytes = tamanhoEmBytes(prog);

    const alvo = desafio.testes.filter(t => enviar || t.visivel);
    const ver = Verificador.verificar({ testes: alvo, proibir: metas.proibir, exigir: metas.exigir, maxPassos: MAX_PASSOS }, codigo);
    r.regras = ver.estatico.slice();
    // meta "recursao": o procedimento precisa chamar a si mesmo (direta ou indiretamente)
    if (metas.recursao && !Recursao.temRecursao(prog)) r.regras.push({ ok: false, msg: 'O exercício exige recursão: um procedimento precisa chamar a si mesmo com CALL.' });

    alvo.forEach((teste, i) => {
      const v = ver.testes[i];
      const medida = ciclosDoTeste(codigo, teste);
      const msgs = teste.visivel ? v.msgs : (v.ok ? [] : [teste.dica || 'falhou em um teste oculto']);
      r.testes.push({ nome: teste.nome || v.nome, visivel: !!teste.visivel, ok: v.ok, msgs, ciclos: medida.ciclos, passos: medida.passos });
    });

    const ciclos = r.testes.map(x => x.ciclos);
    r.ciclosPior = Math.max(...ciclos);
    r.ciclosMedia = Math.round(ciclos.reduce((a, b) => a + b, 0) / ciclos.length);

    const regrasOk = r.regras.every(x => x.ok);
    const testesOk = r.testes.every(x => x.ok);
    r.status = !regrasOk ? 'regra' : testesOk ? 'aceito' : 'errado';

    if (enviar && r.status === 'aceito') {
      r.estrelas = {
        aceito: true,
        bytes: metas.bytes !== undefined && r.bytes <= metas.bytes,
        ciclos: metas.ciclos !== undefined && r.ciclosPior <= metas.ciclos
      };
    }
    return r;
  }

  const api = { julgar, MAX_PASSOS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Juiz = api;
})(typeof self !== 'undefined' ? self : this);
