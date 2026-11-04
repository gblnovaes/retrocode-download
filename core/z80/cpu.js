/*
 * CPU Zilog Z80 (conjunto oficial: principal, CB, ED, DD/FD e DDCB), flags e ciclos em T-states.
 * Memória plana de 64 KB. O HALT encerra o programa e não conta ciclos (é só o marcador de fim).
 *
 * Registradores: A, B, C, D, E, H, L e F (8 bits); BC, DE, HL, AF (16 bits, leitura e escrita);
 * linha alternativa (A2, F2, B2, C2, D2, E2, H2, L2); IX, IY, SP, PC, I, R.
 * Flags no registrador F: S=$80, Z=$40, Y=$20, H=$10, X=$08, PV=$04, N=$02, C=$01.
 * Entrada e saída: `portas` (256 bytes) faz o papel dos 256 endereços de porta.
 *
 * passo() executa uma instrução e devolve 'ok', 'halt' ou 'invalido'.
 * executar(maximo) roda até o HALT ('halt'), um opcode inválido ('invalido') ou o limite ('limite').
 * Não há interrupções: EI/DI só mexem em IFF1/IFF2.
 */
(function (root) {
  'use strict';

  const S = 0x80, Z = 0x40, H = 0x10, PV = 0x04, N = 0x02, CF = 0x01;
  const FLAGS = { S, Z, H, PV, N, C: CF };

  const PARIDADE = new Uint8Array(256);
  for (let i = 0; i < 256; i++) { let b = i, n = 0; while (b) { n += b & 1; b >>= 1; } PARIDADE[i] = n % 2 === 0 ? PV : 0; }

  class CpuZ80 {
    constructor() {
      this.mem = new Uint8Array(65536);
      this.portas = new Uint8Array(256);
      this.R8 = new Uint8Array(8);      // B C D E H L (livre) A
      this.F = 0;
      this.alt = new Uint8Array(8);     // linha alternativa na mesma ordem; F2 separado
      this.F2 = 0;
      this.IX = 0; this.IY = 0; this.SP = 0; this.PC = 0; this.I = 0; this.R = 0;
      this.IFF1 = 0; this.IFF2 = 0; this.IM = 0;
      this.ciclos = 0; this.passos = 0;
      this.pre = 0; this.EA = null; this.tx = 0;
    }

    carregar(endereco, bytes) { bytes.forEach((b, i) => { this.mem[(endereco + i) & 0xFFFF] = b & 0xFF; }); }

    // ---------------------------------------------------------------- registradores
    get B() { return this.R8[0]; } set B(v) { this.R8[0] = v; }
    get C() { return this.R8[1]; } set C(v) { this.R8[1] = v; }
    get D() { return this.R8[2]; } set D(v) { this.R8[2] = v; }
    get E() { return this.R8[3]; } set E(v) { this.R8[3] = v; }
    get H() { return this.R8[4]; } set H(v) { this.R8[4] = v; }
    get L() { return this.R8[5]; } set L(v) { this.R8[5] = v; }
    get A() { return this.R8[7]; } set A(v) { this.R8[7] = v; }
    get BC() { return (this.R8[0] << 8) | this.R8[1]; } set BC(v) { this.R8[0] = (v >> 8) & 0xFF; this.R8[1] = v & 0xFF; }
    get DE() { return (this.R8[2] << 8) | this.R8[3]; } set DE(v) { this.R8[2] = (v >> 8) & 0xFF; this.R8[3] = v & 0xFF; }
    get HL() { return (this.R8[4] << 8) | this.R8[5]; } set HL(v) { this.R8[4] = (v >> 8) & 0xFF; this.R8[5] = v & 0xFF; }
    get AF() { return (this.R8[7] << 8) | this.F; } set AF(v) { this.R8[7] = (v >> 8) & 0xFF; this.F = v & 0xFF; }
    get A2() { return this.alt[7]; } set A2(v) { this.alt[7] = v; }
    get B2() { return this.alt[0]; } set B2(v) { this.alt[0] = v; }
    get C2() { return this.alt[1]; } set C2(v) { this.alt[1] = v; }
    get D2() { return this.alt[2]; } set D2(v) { this.alt[2] = v; }
    get E2() { return this.alt[3]; } set E2(v) { this.alt[3] = v; }
    get H2() { return this.alt[4]; } set H2(v) { this.alt[4] = v; }
    get L2() { return this.alt[5]; } set L2(v) { this.alt[5] = v; }

    // ---------------------------------------------------------------- memória e busca
    rb(a) { return this.mem[a & 0xFFFF]; }
    wb(a, v) { this.mem[a & 0xFFFF] = v & 0xFF; }
    rw(a) { return this.mem[a & 0xFFFF] | (this.mem[(a + 1) & 0xFFFF] << 8); }
    ww(a, v) { this.mem[a & 0xFFFF] = v & 0xFF; this.mem[(a + 1) & 0xFFFF] = (v >> 8) & 0xFF; }
    fetch() { const v = this.mem[this.PC]; this.PC = (this.PC + 1) & 0xFFFF; return v; }
    fetch16() { const lo = this.fetch(); return lo | (this.fetch() << 8); }
    incR() { this.R = (this.R & 0x80) | ((this.R + 1) & 0x7F); }
    push(v) { this.SP = (this.SP - 1) & 0xFFFF; this.mem[this.SP] = (v >> 8) & 0xFF; this.SP = (this.SP - 1) & 0xFFFF; this.mem[this.SP] = v & 0xFF; }
    pop() { const v = this.mem[this.SP] | (this.mem[(this.SP + 1) & 0xFFFF] << 8); this.SP = (this.SP + 2) & 0xFFFF; return v; }

    // HL, ou IX/IY quando há prefixo
    hl() { return this.pre === 0xDD ? this.IX : this.pre === 0xFD ? this.IY : this.HL; }
    setHl(v) { v &= 0xFFFF; if (this.pre === 0xDD) this.IX = v; else if (this.pre === 0xFD) this.IY = v; else this.HL = v; }

    // endereço do operando (HL) ou (IX+d); busca o deslocamento uma única vez
    ea() {
      if (this.EA !== null) return this.EA;
      let a;
      if (this.pre) {
        const d = this.fetch(); const s = d > 127 ? d - 256 : d;
        a = ((this.pre === 0xDD ? this.IX : this.IY) + s) & 0xFFFF; this.tx += 8;
      } else a = this.HL;
      this.EA = a; return a;
    }

    // registrador pelo índice 0..7 (6 = memória); com prefixo, H e L viram as metades de IX/IY
    rd(i, plano) {
      if (i === 6) return this.mem[this.ea()];
      if (this.pre && !plano && (i === 4 || i === 5)) { const x = this.pre === 0xDD ? this.IX : this.IY; return i === 4 ? x >> 8 : x & 0xFF; }
      return this.R8[i];
    }
    wr(i, v, plano) {
      v &= 0xFF;
      if (i === 6) { this.mem[this.ea()] = v; return; }
      if (this.pre && !plano && (i === 4 || i === 5)) {
        const x = this.pre === 0xDD ? this.IX : this.IY; const n = i === 4 ? (v << 8) | (x & 0xFF) : (x & 0xFF00) | v;
        if (this.pre === 0xDD) this.IX = n; else this.IY = n; return;
      }
      this.R8[i] = v;
    }
    getRP(p) { return p === 0 ? this.BC : p === 1 ? this.DE : p === 2 ? this.hl() : this.SP; }
    setRP(p, v) { v &= 0xFFFF; if (p === 0) this.BC = v; else if (p === 1) this.DE = v; else if (p === 2) this.setHl(v); else this.SP = v; }
    getRP2(p) { return p === 0 ? this.BC : p === 1 ? this.DE : p === 2 ? this.hl() : this.AF; }
    setRP2(p, v) { v &= 0xFFFF; if (p === 0) this.BC = v; else if (p === 1) this.DE = v; else if (p === 2) this.setHl(v); else this.AF = v; }

    cond(y) {
      const f = this.F;
      switch (y) {
        case 0: return !(f & Z); case 1: return !!(f & Z);
        case 2: return !(f & CF); case 3: return !!(f & CF);
        case 4: return !(f & PV); case 5: return !!(f & PV);
        case 6: return !(f & S); default: return !!(f & S);
      }
    }

    // ---------------------------------------------------------------- aritmética de 8 bits
    add(v, c) {
      const a = this.A, r = a + v + c, res = r & 0xFF;
      this.F = (res & 0xA8) | (res === 0 ? Z : 0) | (((a & 15) + (v & 15) + c) > 15 ? H : 0) | (((a ^ res) & (v ^ res) & 0x80) ? PV : 0) | (r > 255 ? CF : 0);
      this.A = res;
    }
    sub(v, c, guardar) {
      const a = this.A, r = a - v - c, res = r & 0xFF;
      this.F = (guardar ? (res & 0xA8) : (v & 0x28) | (res & 0x80)) | (res === 0 ? Z : 0) | N | (((a & 15) - (v & 15) - c) < 0 ? H : 0) | (((a ^ v) & (a ^ res) & 0x80) ? PV : 0) | (r < 0 ? CF : 0);
      if (guardar) this.A = res;
    }
    logica(y, v) {
      let r;
      if (y === 4) r = this.A & v; else if (y === 5) r = this.A ^ v; else r = this.A | v;
      this.A = r;
      this.F = (r & 0xA8) | (r === 0 ? Z : 0) | PARIDADE[r] | (y === 4 ? H : 0);
    }
    alu(y, v) {
      switch (y) {
        case 0: this.add(v, 0); break;
        case 1: this.add(v, this.F & CF); break;
        case 2: this.sub(v, 0, true); break;
        case 3: this.sub(v, this.F & CF, true); break;
        case 7: this.sub(v, 0, false); break;
        default: this.logica(y, v);
      }
    }
    inc8(v) {
      const r = (v + 1) & 0xFF;
      this.F = (this.F & CF) | (r & 0xA8) | (r === 0 ? Z : 0) | ((v & 15) === 15 ? H : 0) | (v === 0x7F ? PV : 0);
      return r;
    }
    dec8(v) {
      const r = (v - 1) & 0xFF;
      this.F = (this.F & CF) | (r & 0xA8) | (r === 0 ? Z : 0) | N | ((v & 15) === 0 ? H : 0) | (v === 0x80 ? PV : 0);
      return r;
    }
    // rotações e deslocamentos do prefixo CB
    rot(y, v) {
      const cv = this.F & CF; let r, c;
      switch (y) {
        case 0: c = v >> 7; r = ((v << 1) | c) & 0xFF; break;
        case 1: c = v & 1; r = (v >> 1) | (c << 7); break;
        case 2: c = v >> 7; r = ((v << 1) | cv) & 0xFF; break;
        case 3: c = v & 1; r = (v >> 1) | (cv << 7); break;
        case 4: c = v >> 7; r = (v << 1) & 0xFF; break;
        case 5: c = v & 1; r = (v >> 1) | (v & 0x80); break;
        case 6: c = v >> 7; r = ((v << 1) | 1) & 0xFF; break;
        default: c = v & 1; r = v >> 1;
      }
      this.F = (r & 0xA8) | (r === 0 ? Z : 0) | PARIDADE[r] | c;
      return r;
    }
    daa() {
      let a = this.A, corr = 0, c = this.F & CF;
      if ((this.F & H) || (a & 15) > 9) corr |= 6;
      if (c || a > 0x99) { corr |= 0x60; c = CF; }
      const sub = this.F & N, antes = a;
      a = sub ? (a - corr) & 0xFF : (a + corr) & 0xFF;
      const h = sub ? (((this.F & H) && (antes & 15) < 6) ? H : 0) : ((antes & 15) > 9 ? H : 0);
      this.F = (a & 0xA8) | (a === 0 ? Z : 0) | h | PARIDADE[a] | sub | c;
      this.A = a;
    }
    // ---------------------------------------------------------------- aritmética de 16 bits
    add16(a, b) {
      const r = a + b;
      this.F = (this.F & (S | Z | PV)) | ((r >> 8) & 0x28) | (((a & 0xFFF) + (b & 0xFFF)) > 0xFFF ? H : 0) | (r > 0xFFFF ? CF : 0);
      return r & 0xFFFF;
    }
    adc16(b) {
      const a = this.HL, c = this.F & CF, r = a + b + c, res = r & 0xFFFF;
      this.F = ((res >> 8) & 0xA8) | (res === 0 ? Z : 0) | (((a & 0xFFF) + (b & 0xFFF) + c) > 0xFFF ? H : 0) | (((a ^ res) & (b ^ res) & 0x8000) ? PV : 0) | (r > 0xFFFF ? CF : 0);
      this.HL = res;
    }
    sbc16(b) {
      const a = this.HL, c = this.F & CF, r = a - b - c, res = r & 0xFFFF;
      this.F = ((res >> 8) & 0xA8) | (res === 0 ? Z : 0) | N | (((a & 0xFFF) - (b & 0xFFF) - c) < 0 ? H : 0) | (((a ^ b) & (a ^ res) & 0x8000) ? PV : 0) | (r < 0 ? CF : 0);
      this.HL = res;
    }

    // ---------------------------------------------------------------- execução
    passo() {
      const pc0 = this.PC;
      this.pre = 0; this.EA = null; this.tx = 0;
      let op = this.fetch(); this.incR();
      let t = 0;
      if (op === 0xDD || op === 0xFD) {
        this.pre = op; op = this.fetch(); this.incR(); t += 4;
        if (op === 0xDD || op === 0xFD || op === 0xED) { this.PC = pc0; return 'invalido'; }
      }
      if (op === 0x76 && !this.pre) return 'halt';
      const c = this.executar1(op);
      if (c < 0) { this.PC = pc0; return 'invalido'; }
      this.ciclos += t + c + this.tx; this.passos++;
      return 'ok';
    }

    executar(maximo) {
      for (let i = 0; i < maximo; i++) {
        const r = this.passo();
        if (r !== 'ok') return r;
      }
      return 'limite';
    }

    // devolve os ciclos da instrução (sem o prefixo DD/FD e sem o deslocamento), ou -1 se inválida
    executar1(op) {
      const x = op >> 6, y = (op >> 3) & 7, z = op & 7, p = y >> 1, q = y & 1;
      if (x === 0) return this.x0(y, z, p, q);
      if (x === 1) {
        if (y === 6 || z === 6) {            // LD com (HL)/(IX+d): o outro operando é o registrador de verdade
          if (y === 6) { this.wr(6, this.rd(z, true)); return 7; }
          this.wr(y, this.rd(6), true); return 7;
        }
        this.wr(y, this.rd(z)); return 4;
      }
      if (x === 2) { this.alu(y, this.rd(z)); return z === 6 ? 7 : 4; }
      return this.x3(op, y, z, p, q);
    }

    x0(y, z, p, q) {
      switch (z) {
        case 0:
          if (y === 0) return 4;
          if (y === 1) { const a = this.A, f = this.F; this.A = this.A2; this.F = this.F2; this.A2 = a; this.F2 = f; return 4; }
          if (y === 2) { const d = this.fetch(); this.B = (this.B - 1) & 0xFF; if (this.B) { this.PC = (this.PC + (d > 127 ? d - 256 : d)) & 0xFFFF; return 13; } return 8; }
          if (y === 3) { const d = this.fetch(); this.PC = (this.PC + (d > 127 ? d - 256 : d)) & 0xFFFF; return 12; }
          { const d = this.fetch(); if (this.cond(y - 4)) { this.PC = (this.PC + (d > 127 ? d - 256 : d)) & 0xFFFF; return 12; } return 7; }
        case 1:
          if (q === 0) { this.setRP(p, this.fetch16()); return 10; }
          this.setHl(this.add16(this.hl(), this.getRP(p))); return 11;
        case 2: {
          if (p === 0) { if (q === 0) this.wb(this.BC, this.A); else this.A = this.rb(this.BC); return 7; }
          if (p === 1) { if (q === 0) this.wb(this.DE, this.A); else this.A = this.rb(this.DE); return 7; }
          const nn = this.fetch16();
          if (p === 2) { if (q === 0) this.ww(nn, this.hl()); else this.setHl(this.rw(nn)); return 16; }
          if (q === 0) this.wb(nn, this.A); else this.A = this.rb(nn);
          return 13;
        }
        case 3: this.setRP(p, this.getRP(p) + (q === 0 ? 1 : -1)); return 6;
        case 4: { const m = y === 6; const a = m ? this.ea() : 0; const v = this.inc8(m ? this.mem[a] : this.rd(y)); if (m) this.mem[a] = v; else this.wr(y, v); return m ? 11 : 4; }
        case 5: { const m = y === 6; const a = m ? this.ea() : 0; const v = this.dec8(m ? this.mem[a] : this.rd(y)); if (m) this.mem[a] = v; else this.wr(y, v); return m ? 11 : 4; }
        case 6:
          if (y === 6) { const a = this.ea(); this.mem[a] = this.fetch(); if (this.pre) this.tx -= 3; return 10; }
          this.wr(y, this.fetch()); return 7;
        default: return this.x0z7(y);
      }
    }

    x0z7(y) {
      const a = this.A;
      switch (y) {
        case 0: { const c = a >> 7; this.A = ((a << 1) | c) & 0xFF; this.F = (this.F & (S | Z | PV)) | (this.A & 0x28) | c; return 4; }
        case 1: { const c = a & 1; this.A = (a >> 1) | (c << 7); this.F = (this.F & (S | Z | PV)) | (this.A & 0x28) | c; return 4; }
        case 2: { const c = a >> 7; this.A = ((a << 1) | (this.F & CF)) & 0xFF; this.F = (this.F & (S | Z | PV)) | (this.A & 0x28) | c; return 4; }
        case 3: { const c = a & 1; this.A = (a >> 1) | ((this.F & CF) << 7); this.F = (this.F & (S | Z | PV)) | (this.A & 0x28) | c; return 4; }
        case 4: this.daa(); return 4;
        case 5: this.A = a ^ 0xFF; this.F = (this.F & (S | Z | PV | CF)) | (this.A & 0x28) | H | N; return 4;
        case 6: this.F = (this.F & (S | Z | PV)) | (a & 0x28) | CF; return 4;
        default: this.F = (this.F & (S | Z | PV)) | (a & 0x28) | ((this.F & CF) ? H : 0) | ((this.F & CF) ? 0 : CF); return 4;
      }
    }

    x3(op, y, z, p, q) {
      switch (z) {
        case 0: if (this.cond(y)) { this.PC = this.pop(); return 11; } return 5;
        case 1:
          if (q === 0) { this.setRP2(p, this.pop()); return 10; }
          if (p === 0) { this.PC = this.pop(); return 10; }
          if (p === 1) { for (let i = 0; i < 6; i++) { const a = this.R8[i], b = this.alt[i]; this.R8[i] = b; this.alt[i] = a; } return 4; }
          if (p === 2) { this.PC = this.hl(); return 4; }
          this.SP = this.hl(); return 6;
        case 2: { const nn = this.fetch16(); if (this.cond(y)) this.PC = nn; return 10; }
        case 3:
          switch (y) {
            case 0: this.PC = this.fetch16(); return 10;
            case 1: { const c = this.cb(); return this.pre ? c : c + 4; }
            case 2: { const n = this.fetch(); this.portas[n] = this.A; return 11; }
            case 3: { const n = this.fetch(); this.A = this.portas[n]; return 11; }
            case 4: { const v = this.rw(this.SP); this.ww(this.SP, this.hl()); this.setHl(v); return 19; }
            case 5: { const d = this.DE; this.DE = this.HL; this.HL = d; return 4; }
            case 6: this.IFF1 = 0; this.IFF2 = 0; return 4;
            default: this.IFF1 = 1; this.IFF2 = 1; return 4;
          }
        case 4: { const nn = this.fetch16(); if (this.cond(y)) { this.push(this.PC); this.PC = nn; return 17; } return 10; }
        case 5:
          if (q === 0) { this.push(this.getRP2(p)); return 11; }
          if (p === 0) { const nn = this.fetch16(); this.push(this.PC); this.PC = nn; return 17; }
          if (p === 2) { const c = this.ed(); return c < 0 ? c : c + 4; }
          return -1;
        case 6: this.alu(y, this.fetch()); return 7;
        default: this.push(this.PC); this.PC = y * 8; return 11;
      }
    }

    cb() {
      if (this.pre) {                       // DD CB d op: opera em (IX+d)
        const a = this.ea(); const op = this.fetch(); this.incR();
        const x = op >> 6, y = (op >> 3) & 7, z = op & 7, v = this.mem[a];
        this.tx = 0;
        if (x === 1) { this.bit(y, v, a >> 8); return 16; }
        const r = x === 0 ? this.rot(y, v) : x === 2 ? v & ~(1 << y) : v | (1 << y);
        this.mem[a] = r; if (z !== 6) this.R8[z] = r;
        return 19;
      }
      const op = this.fetch(); this.incR();
      const x = op >> 6, y = (op >> 3) & 7, z = op & 7;
      const v = this.rd(z);
      if (x === 1) { this.bit(y, v, v); return z === 6 ? 8 : 4; }
      const r = x === 0 ? this.rot(y, v) : x === 2 ? v & ~(1 << y) : v | (1 << y);
      this.wr(z, r); return z === 6 ? 11 : 4;
    }
    bit(y, v, yx) {
      const b = v & (1 << y);
      this.F = (this.F & CF) | H | (b ? 0 : (Z | PV)) | (y === 7 && b ? S : 0) | (yx & 0x28);
    }

    ed() {
      const op = this.fetch(); this.incR();
      const x = op >> 6, y = (op >> 3) & 7, z = op & 7, p = y >> 1, q = y & 1;
      if (x === 1) {
        switch (z) {
          case 0: { const v = this.portas[this.C]; if (y !== 6) this.R8[y] = v; this.F = (this.F & CF) | (v & 0xA8) | (v === 0 ? Z : 0) | PARIDADE[v]; return 8; }
          case 1: this.portas[this.C] = y === 6 ? 0 : this.R8[y]; return 8;
          case 2: if (q === 0) this.sbc16(this.getRP(p)); else this.adc16(this.getRP(p)); return 11;
          case 3: { const nn = this.fetch16(); if (q === 0) this.ww(nn, this.getRP(p)); else this.setRP(p, this.rw(nn)); return 16; }
          case 4: { const a = this.A; this.A = 0; this.sub(a, 0, true); return 4; }
          case 5: this.PC = this.pop(); this.IFF1 = this.IFF2; return 10;
          case 6: this.IM = [0, 0, 1, 2, 0, 0, 1, 2][y]; return 4;
          default:
            switch (y) {
              case 0: this.I = this.A; return 5;
              case 1: this.R = this.A; return 5;
              case 2: case 3: { const v = y === 2 ? this.I : this.R; this.A = v; this.F = (this.F & CF) | (v & 0xA8) | (v === 0 ? Z : 0) | (this.IFF2 ? PV : 0); return 5; }
              case 4: { const m = this.rb(this.HL), a = this.A; this.wb(this.HL, ((a & 15) << 4) | (m >> 4)); this.A = (a & 0xF0) | (m & 15); this.F = (this.F & CF) | (this.A & 0xA8) | (this.A === 0 ? Z : 0) | PARIDADE[this.A]; return 14; }
              case 5: { const m = this.rb(this.HL), a = this.A; this.wb(this.HL, (m << 4) | (a & 15)); this.A = (a & 0xF0) | (m >> 4); this.F = (this.F & CF) | (this.A & 0xA8) | (this.A === 0 ? Z : 0) | PARIDADE[this.A]; return 14; }
              default: return 4;
            }
        }
      }
      if (x === 2 && y >= 4 && z <= 1) return this.bloco(y, z);
      return -1;
    }

    // LDI, LDD, LDIR, LDDR (z = 0) e CPI, CPD, CPIR, CPDR (z = 1)
    bloco(y, z) {
      const dir = (y & 1) ? -1 : 1, repete = y >= 6;
      if (z === 0) {
        const v = this.rb(this.HL), n = (v + this.A) & 0xFF;
        this.wb(this.DE, v);
        this.HL = this.HL + dir; this.DE = this.DE + dir; this.BC = this.BC - 1;
        this.F = (this.F & (S | Z | CF)) | (this.BC ? PV : 0) | ((n & 2) << 4) | (n & 8);
        if (repete && this.BC) { this.PC = (this.PC - 2) & 0xFFFF; return 17; }
        return 12;
      }
      const v = this.rb(this.HL), a = this.A, res = (a - v) & 0xFF;
      this.HL = this.HL + dir; this.BC = this.BC - 1;
      this.F = (this.F & CF) | (res & 0x80) | (res === 0 ? Z : 0) | N | (((a & 15) - (v & 15)) < 0 ? H : 0) | (this.BC ? PV : 0);
      if (repete && this.BC && res !== 0) { this.PC = (this.PC - 2) & 0xFFFF; return 17; }
      return 12;
    }
  }

  const api = { CpuZ80, FLAGS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Z80 = Object.assign(root.Z80 || {}, api);
})(typeof self !== 'undefined' ? self : this);
