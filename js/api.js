import { API_URL } from './config.js';
import { lerToken, apagarToken } from './sessao.js';

export class ErroApi extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

/**
 * Chama o backend. Envia como texto simples (text/plain) de propósito: assim o
 * navegador não faz a checagem prévia (CORS preflight), que o Apps Script não responde.
 */
export async function chamar(acao, dados = {}) {
  const corpo = JSON.stringify({ acao, token: lerToken(), ...dados });

  let resposta;
  try {
    resposta = await fetch(API_URL, { method: 'POST', body: corpo, redirect: 'follow' });
  } catch (_) {
    throw new ErroApi('rede', 'Sem conexão com o servidor. Verifique a internet e tente de novo.');
  }

  let json;
  try {
    json = await resposta.json();
  } catch (_) {
    throw new ErroApi('resposta', 'O servidor respondeu algo inesperado. Tente de novo em instantes.');
  }

  if (!json.ok) {
    if (json.codigo === 'sessao') {
      apagarToken();
      window.dispatchEvent(new CustomEvent('sessao-expirada'));
    }
    throw new ErroApi(json.codigo || 'erro', json.erro || 'Algo deu errado.');
  }
  return json.dados;
}
