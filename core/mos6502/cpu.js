/*
 * CPU MOS 6502 (instruções oficiais, modo decimal NMOS e ciclos).
 * Memória plana de 64 KB. O BRK encerra o programa e não conta ciclos (é só o marcador de fim).
 *
 * Campos: A, X, Y, SP, PC e os flags N, V, D, I, Z, C (cada um 0 ou 1); `ciclos` e `passos`.
 * passo() executa uma instrução e devolve 'ok', 'brk' ou 'invalido'.
 * executar(maximo) roda até o BRK ('brk'), um opcode inválido ('invalido') ou o limite ('limite').
 */
(function (root) {
  'use strict';

  // mnemônico -> modo -> [opcode, ciclos, +1 ao cruzar a página (1) ou não (0)]
  const DEFS = {
    ADC: { imm: [0x69, 2], zp: [0x65, 3], zpx: [0x75, 4], abs: [0x6D, 4], abx: [0x7D, 4, 1], aby: [0x79, 4, 1], izx: [0x61, 6], izy: [0x71, 5, 1] },
    AND: { imm: [0x29, 2], zp: [0x25, 3], zpx: [0x35, 4], abs: [0x2D, 4], abx: [0x3D, 4, 1], aby: [0x39, 4, 1], izx: [0x21, 6], izy: [0x31, 5, 1] },
    ASL: { acc: [0x0A, 2], zp: [0x06, 5], zpx: [0x16, 6], abs: [0x0E, 6], abx: [0x1E, 7] },
    BCC: { rel: [0x90, 2] }, BCS: { rel: [0xB0, 2] }, BEQ: { rel: [0xF0, 2] }, BMI: { rel: [0x30, 2] },
    BNE: { rel: [0xD0, 2] }, BPL: { rel: [0x10, 2] }, BVC: { rel: [0x50, 2] }, BVS: { rel: [0x70, 2] },
    BIT: { zp: [0x24, 3], abs: [0x2C, 4] },
    BRK: { imp: [0x00, 7] },
    CLC: { imp: [0x18, 2] }, CLD: { imp: [0xD8, 2] }, CLI: { imp: [0x58, 2] }, CLV: { imp: [0xB8, 2] },
    CMP: { imm: [0xC9, 2], zp: [0xC5, 3], zpx: [0xD5, 4], abs: [0xCD, 4], abx: [0xDD, 4, 1], aby: [0xD9, 4, 1], izx: [0xC1, 6], izy: [0xD1, 5, 1] },
    CPX: { imm: [0xE0, 2], zp: [0xE4, 3], abs: [0xEC, 4] },
    CPY: { imm: [0xC0, 2], zp: [0xC4, 3], abs: [0xCC, 4] },
    DEC: { zp: [0xC6, 5], zpx: [0xD6, 6], abs: [0xCE, 6], abx: [0xDE, 7] },
    DEX: { imp: [0xCA, 2] }, DEY: { imp: [0x88, 2] },
    EOR: { imm: [0x49, 2], zp: [0x45, 3], zpx: [0x55, 4], abs: [0x4D, 4], abx: [0x5D, 4, 1], aby: [0x59, 4, 1], izx: [0x41, 6], izy: [0x51, 5, 1] },
    INC: { zp: [0xE6, 5], zpx: [0xF6, 6], abs: [0xEE, 6], abx: [0xFE, 7] },
    INX: { imp: [0xE8, 2] }, INY: { imp: [0xC8, 2] },
    JMP: { abs: [0x4C, 3], ind: [0x6C, 5] },
    JSR: { abs: [0x20, 6] },
    LDA: { imm: [0xA9, 2], zp: [0xA5, 3], zpx: [0xB5, 4], abs: [0xAD, 4], abx: [0xBD, 4, 1], aby: [0xB9, 4, 1], izx: [0xA1, 6], izy: [0xB1, 5, 1] },
    LDX: { imm: [0xA2, 2], zp: [0xA6, 3], zpy: [0xB6, 4], abs: [0xAE, 4], aby: [0xBE, 4, 1] },
    LDY: { imm: [0xA0, 2], zp: [0xA4, 3], zpx: [0xB4, 4], abs: [0xAC, 4], abx: [0xBC, 4, 1] },
    LSR: { acc: [0x4A, 2], zp: [0x46, 5], zpx: [0x56, 6], abs: [0x4E, 6], abx: [0x5E, 7] },
    NOP: { imp: [0xEA, 2] },
    ORA: { imm: [0x09, 2], zp: [0x05, 3], zpx: [0x15, 4], abs: [0x0D, 4], abx: [0x1D, 4, 1], aby: [0x19, 4, 1], izx: [0x01, 6], izy: [0x11, 5, 1] },
    PHA: { imp: [0x48, 3] }, PHP: { imp: [0x08, 3] }, PLA: { imp: [0x68, 4] }, PLP: { imp: [0x28, 4] },
    ROL: { acc: [0x2A, 2], zp: [0x26, 5], zpx: [0x36, 6], abs: [0x2E, 6], abx: [0x3E, 7] },
    ROR: { acc: [0x6A, 2], zp: [0x66, 5], zpx: [0x76, 6], abs: [0x6E, 6], abx: [0x7E, 7] },
    RTI: { imp: [0x40, 6] }, RTS: { imp: [0x60, 6] },
    SBC: { imm: [0xE9, 2], zp: [0xE5, 3], zpx: [0xF5, 4], abs: [0xED, 4], abx: [0xFD, 4, 1], aby: [0xF9, 4, 1], izx: [0xE1, 6], izy: [0xF1, 5, 1] },
    SEC: { imp: [0x38, 2] }, SED: { imp: [0xF8, 2] }, SEI: { imp: [0x78, 2] },
    STA: { zp: [0x85, 3], zpx: [0x95, 4], abs: [0x8D, 4], abx: [0x9D, 5], aby: [0x99, 5], izx: [0x81, 6], izy: [0x91, 6] },
    STX: { zp: [0x86, 3], zpy: [0x96, 4], abs: [0x8E, 4] },
    STY: { zp: [0x84, 3], zpx: [0x94, 4], abs: [0x8C, 4] },
    TAX: { imp: [0xAA, 2] }, TAY: { imp: [0xA8, 2] }, TSX: { imp: [0xBA, 2] }, TXA: { imp: [0x8A, 2] }, TXS: { imp: [0x9A, 2] }, TYA: { imp: [0x98, 2] }
  };

  const TAMANHO = { imp: 1, acc: 1, imm: 2, zp: 2, zpx: 2, zpy: 2, izx: 2, izy: 2, rel: 2, abs: 3, abx: 3, aby: 3, ind: 3 };

  const OPCODES = new Array(256).fill(null);
  for (const mn of Object.keys(DEFS)) {
    for (const modo of Object.keys(DEFS[mn])) {
      const [op, ciclos, cruza] = DEFS[mn][modo];
      OPCODES[op] = { mn, modo, ciclos, cruza: !!cruza, tam: TAMANHO[modo] };
    }
  }

  const DESVIOS = { BCC: ['C', 0], BCS: ['C', 1], BEQ: ['Z', 1], BNE: ['Z', 0], BMI: ['N', 1], BPL: ['N', 0], BVS: ['V', 1], BVC: ['V', 0] };

  class Cpu6502 {
    constructor() {
      this.mem = new Uint8Array(65536);
      this.A = 0; this.X = 0; this.Y = 0; this.SP = 0xFF; this.PC = 0x0600;
      this.N = 0; this.V = 0; this.D = 0; this.I = 0; this.Z = 0; this.C = 0;
      this.ciclos = 0; this.passos = 0;
    }

    carregar(endereco, bytes) { bytes.forEach((b, i) => { this.mem[(endereco + i) & 0xFFFF] = b & 0xFF; }); }

    get P() { return (this.N << 7) | (this.V << 6) | 0x20 | (this.D << 3) | (this.I << 2) | (this.Z << 1) | this.C; }
    set P(v) { this.N = (v >> 7) & 1; this.V = (v >> 6) & 1; this.D = (v >> 3) & 1; this.I = (v >> 2) & 1; this.Z = (v >> 1) & 1; this.C = v & 1; }

    ler(a) { return this.mem[a & 0xFFFF]; }
    escrever(a, v) { this.mem[a & 0xFFFF] = v & 0xFF; }
    palavra(a) { return this.ler(a) | (this.ler(a + 1) << 8); }
    empilhar(v) { this.escrever(0x0100 + this.SP, v); this.SP = (this.SP - 1) & 0xFF; }
    desempilhar() { this.SP = (this.SP + 1) & 0xFF; return this.ler(0x0100 + this.SP); }
    nz(v) { this.N = (v >> 7) & 1; this.Z = (v & 0xFF) === 0 ? 1 : 0; return v & 0xFF; }

    // endereço efetivo do operando; `cruzou` diz se o índice atravessou uma página
    endereco(modo) {
      const pc = this.PC;
      const arg = this.ler(pc + 1);
      switch (modo) {
        case 'imm': return { a: pc + 1, cruzou: false };
        case 'zp': return { a: arg, cruzou: false };
        case 'zpx': return { a: (arg + this.X) & 0xFF, cruzou: false };
        case 'zpy': return { a: (arg + this.Y) & 0xFF, cruzou: false };
        case 'abs': return { a: this.palavra(pc + 1), cruzou: false };
        case 'abx': { const b = this.palavra(pc + 1), a = (b + this.X) & 0xFFFF; return { a, cruzou: (b & 0xFF00) !== (a & 0xFF00) }; }
        case 'aby': { const b = this.palavra(pc + 1), a = (b + this.Y) & 0xFFFF; return { a, cruzou: (b & 0xFF00) !== (a & 0xFF00) }; }
        case 'izx': { const p = (arg + this.X) & 0xFF; return { a: this.ler(p) | (this.ler((p + 1) & 0xFF) << 8), cruzou: false }; }
        case 'izy': { const b = this.ler(arg) | (this.ler((arg + 1) & 0xFF) << 8), a = (b + this.Y) & 0xFFFF; return { a, cruzou: (b & 0xFF00) !== (a & 0xFF00) }; }
        default: return { a: 0, cruzou: false };
      }
    }

    somar(v) {
      const A = this.A, c = this.C;
      const bin = A + v + c;
      if (this.D) {
        let al = (A & 0x0F) + (v & 0x0F) + c;
        if (al >= 0x0A) al = ((al + 0x06) & 0x0F) + 0x10;
        let a = (A & 0xF0) + (v & 0xF0) + al;
        const sinal = ((A & 0xF0) << 24 >> 24) + ((v & 0xF0) << 24 >> 24) + al;
        this.N = (a >> 7) & 1;
        this.V = (sinal < -128 || sinal > 127) ? 1 : 0;
        if (a >= 0xA0) a += 0x60;
        this.C = a >= 0x100 ? 1 : 0;
        this.Z = (bin & 0xFF) === 0 ? 1 : 0;
        this.A = a & 0xFF;
      } else {
        this.V = (~(A ^ v) & (A ^ bin) & 0x80) ? 1 : 0;
        this.C = bin > 0xFF ? 1 : 0;
        this.A = this.nz(bin);
      }
    }

    subtrair(v) {
      const A = this.A, c = this.C;
      const bin = A - v - (1 - c);
      const V = ((A ^ v) & (A ^ bin) & 0x80) ? 1 : 0;
      if (this.D) {
        let al = (A & 0x0F) - (v & 0x0F) + c - 1;
        if (al < 0) al = ((al - 0x06) & 0x0F) - 0x10;
        let a = (A & 0xF0) - (v & 0xF0) + al;
        if (a < 0) a -= 0x60;
        this.nz(bin); this.V = V; this.C = bin >= 0 ? 1 : 0;
        this.A = a & 0xFF;
      } else {
        this.V = V; this.C = bin >= 0 ? 1 : 0;
        this.A = this.nz(bin);
      }
    }

    comparar(reg, v) { const r = reg - v; this.C = r >= 0 ? 1 : 0; this.nz(r); }

    passo() {
      const op = this.ler(this.PC);
      const info = OPCODES[op];
      if (!info) return 'invalido';
      if (info.mn === 'BRK') return 'brk';
      const { mn, modo } = info;
      let ciclos = info.ciclos;
      const prox = (this.PC + info.tam) & 0xFFFF;
      let alvo = null;

      if (modo !== 'imp' && modo !== 'acc' && modo !== 'rel' && modo !== 'ind') {
        alvo = this.endereco(modo);
        if (alvo.cruzou && info.cruza) ciclos++;
      }
      const v = () => this.ler(alvo.a);
      const gravar = (valor) => { if (modo === 'acc') this.A = valor; else this.escrever(alvo.a, valor); };
      const entrada = () => (modo === 'acc' ? this.A : v());

      if (DESVIOS[mn]) {
        const [flag, quando] = DESVIOS[mn];
        const deslocamento = (this.ler(this.PC + 1) << 24) >> 24;
        this.PC = prox;
        if (this[flag] === quando) {
          const destino = (prox + deslocamento) & 0xFFFF;
          ciclos += 1 + (((prox ^ destino) & 0xFF00) ? 1 : 0);
          this.PC = destino;
        }
        this.ciclos += ciclos; this.passos++;
        return 'ok';
      }

      let pc = prox;
      switch (mn) {
        case 'LDA': this.A = this.nz(v()); break;
        case 'LDX': this.X = this.nz(v()); break;
        case 'LDY': this.Y = this.nz(v()); break;
        case 'STA': this.escrever(alvo.a, this.A); break;
        case 'STX': this.escrever(alvo.a, this.X); break;
        case 'STY': this.escrever(alvo.a, this.Y); break;
        case 'ADC': this.somar(v()); break;
        case 'SBC': this.subtrair(v()); break;
        case 'AND': this.A = this.nz(this.A & v()); break;
        case 'ORA': this.A = this.nz(this.A | v()); break;
        case 'EOR': this.A = this.nz(this.A ^ v()); break;
        case 'CMP': this.comparar(this.A, v()); break;
        case 'CPX': this.comparar(this.X, v()); break;
        case 'CPY': this.comparar(this.Y, v()); break;
        case 'BIT': { const m = v(); this.Z = (this.A & m) === 0 ? 1 : 0; this.N = (m >> 7) & 1; this.V = (m >> 6) & 1; break; }
        case 'ASL': { const e = entrada(); this.C = (e >> 7) & 1; gravar(this.nz(e << 1)); break; }
        case 'LSR': { const e = entrada(); this.C = e & 1; gravar(this.nz(e >> 1)); break; }
        case 'ROL': { const e = entrada(); const c = this.C; this.C = (e >> 7) & 1; gravar(this.nz((e << 1) | c)); break; }
        case 'ROR': { const e = entrada(); const c = this.C; this.C = e & 1; gravar(this.nz((e >> 1) | (c << 7))); break; }
        case 'INC': gravar(this.nz(v() + 1)); break;
        case 'DEC': gravar(this.nz(v() - 1)); break;
        case 'INX': this.X = this.nz(this.X + 1); break;
        case 'INY': this.Y = this.nz(this.Y + 1); break;
        case 'DEX': this.X = this.nz(this.X - 1); break;
        case 'DEY': this.Y = this.nz(this.Y - 1); break;
        case 'TAX': this.X = this.nz(this.A); break;
        case 'TAY': this.Y = this.nz(this.A); break;
        case 'TXA': this.A = this.nz(this.X); break;
        case 'TYA': this.A = this.nz(this.Y); break;
        case 'TSX': this.X = this.nz(this.SP); break;
        case 'TXS': this.SP = this.X; break;
        case 'PHA': this.empilhar(this.A); break;
        case 'PHP': this.empilhar(this.P | 0x10); break;
        case 'PLA': this.A = this.nz(this.desempilhar()); break;
        case 'PLP': this.P = this.desempilhar(); break;
        case 'CLC': this.C = 0; break;
        case 'SEC': this.C = 1; break;
        case 'CLD': this.D = 0; break;
        case 'SED': this.D = 1; break;
        case 'CLI': this.I = 0; break;
        case 'SEI': this.I = 1; break;
        case 'CLV': this.V = 0; break;
        case 'NOP': break;
        case 'JMP': {
          if (modo === 'abs') pc = this.palavra(this.PC + 1);
          else { // indireto: o 6502 não passa o byte alto para a página seguinte
            const p = this.palavra(this.PC + 1);
            pc = this.ler(p) | (this.ler((p & 0xFF00) | ((p + 1) & 0xFF)) << 8);
          }
          break;
        }
        case 'JSR': { const ret = (this.PC + 2) & 0xFFFF; this.empilhar(ret >> 8); this.empilhar(ret & 0xFF); pc = this.palavra(this.PC + 1); break; }
        case 'RTS': { const lo = this.desempilhar(), hi = this.desempilhar(); pc = (((hi << 8) | lo) + 1) & 0xFFFF; break; }
        case 'RTI': { this.P = this.desempilhar(); const lo = this.desempilhar(), hi = this.desempilhar(); pc = (hi << 8) | lo; break; }
        default: return 'invalido';
      }
      this.PC = pc & 0xFFFF;
      this.ciclos += ciclos; this.passos++;
      return 'ok';
    }

    executar(maximo) {
      const limite = maximo || 1000000;
      let n = 0;
      while (n++ < limite) {
        const s = this.passo();
        if (s !== 'ok') return s;
      }
      return 'limite';
    }
  }

  const api = { Cpu6502, DEFS, OPCODES, TAMANHO };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Mos6502 = Object.assign(root.Mos6502 || {}, { Cpu6502, DEFS, OPCODES, TAMANHO });
})(typeof self !== 'undefined' ? self : this);
