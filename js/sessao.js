// Guarda o "token" de login no navegador. Se o navegador bloquear o armazenamento
// (janela anônima, por exemplo), o login vale só até fechar a aba.
const CHAVE = 'cine-da-galera.token';
let naMemoria = null;

export function lerToken() {
  try {
    return localStorage.getItem(CHAVE) || naMemoria;
  } catch (_) {
    return naMemoria;
  }
}

export function guardarToken(token) {
  naMemoria = token;
  try { localStorage.setItem(CHAVE, token); } catch (_) { /* segue só na memória */ }
}

export function apagarToken() {
  naMemoria = null;
  try { localStorage.removeItem(CHAVE); } catch (_) { /* nada a fazer */ }
}
