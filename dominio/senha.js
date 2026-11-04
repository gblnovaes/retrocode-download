/*
 * Hash de senha para as contas locais: SHA-256 em JavaScript puro (síncrono, igual no navegador, no Electron e no Node),
 * com sal por conta e várias voltas. Serve para a senha nunca ficar legível no armazenamento do navegador.
 * Atenção: enquanto não houver servidor, quem tem acesso ao navegador tem acesso aos dados. Com o backend, a verificação passa a ser feita lá.
 */
(function (root) {
  'use strict';

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const rotd = (x, n) => (x >>> n) | (x << (32 - n));

  function utf8(texto) {
    if (typeof TextEncoder === 'function') return Array.from(new TextEncoder().encode(texto));
    const bin = unescape(encodeURIComponent(texto)), r = [];
    for (let i = 0; i < bin.length; i++) r.push(bin.charCodeAt(i));
    return r;
  }

  function sha256(texto) {
    const bytes = utf8(String(texto));
    const bits = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const alto = Math.floor(bits / 0x100000000), baixo = bits >>> 0;
    for (let i = 3; i >= 0; i--) bytes.push((alto >>> (8 * i)) & 255);
    for (let i = 3; i >= 0; i--) bytes.push((baixo >>> (8 * i)) & 255);
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Array(64);
    for (let bloco = 0; bloco < bytes.length; bloco += 64) {
      for (let i = 0; i < 16; i++) { const p = bloco + i * 4; w[i] = ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) | 0; }
      for (let i = 16; i < 64; i++) {
        const s0 = rotd(w[i - 15], 7) ^ rotd(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotd(w[i - 2], 17) ^ rotd(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotd(e, 6) ^ rotd(e, 11) ^ rotd(e, 25);
        const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const S0 = rotd(a, 2) ^ rotd(a, 13) ^ rotd(a, 22);
        const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => ('00000000' + (x >>> 0).toString(16)).slice(-8)).join('');
  }

  const VOLTAS = 2000;
  function derivar(senha, sal, voltas) {
    let h = sha256(sal + ':' + senha);
    for (let i = 1; i < (voltas || VOLTAS); i++) h = sha256(h + sal + senha);
    return h;
  }

  function gerarSal() {
    const bytes = new Array(16);
    const c = root.crypto;
    if (c && typeof c.getRandomValues === 'function') { const u = new Uint8Array(16); c.getRandomValues(u); for (let i = 0; i < 16; i++) bytes[i] = u[i]; }
    else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    return bytes.map(b => ('0' + b.toString(16)).slice(-2)).join('');
  }

  function iguais(a, b) {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  const api = { sha256, derivar, gerarSal, iguais };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Senha = api;
})(typeof self !== 'undefined' ? self : this);
