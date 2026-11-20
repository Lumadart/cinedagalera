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
// Indicador de carregamento: barra dourada no topo + "Salvando…"/"Carregando…" quando a chamada passa de 300 ms.
const ESCRITA = /^(marcar_|remover_|salvar_|votar|evento_(presenca|sugerir|sugestao)|adicionar_|aceitar_|admin_(?!listar|convites$))/;
let pendentes = 0, escritas = 0, temporizador = null, caixa = null;
function atualizarIndicador() {
  if (!caixa) {
    caixa = document.createElement('div');
    caixa.className = 'carga'; caixa.hidden = true; caixa.setAttribute('aria-hidden', 'true');
    caixa.innerHTML = '<span class="carga-barra"></span><span class="carga-texto"></span>';
    document.body.append(caixa);
  }
  clearTimeout(temporizador);
  if (!pendentes) { caixa.hidden = true; return; }
  temporizador = setTimeout(() => {
    caixa.querySelector('.carga-texto').textContent = escritas ? 'Salvando…' : 'Carregando…';
    caixa.hidden = false;
  }, 300);
}

export async function chamar(acao, dados = {}) {
  const escrita = ESCRITA.test(acao);
  pendentes++; if (escrita) escritas++; atualizarIndicador();
  try { return await chamarSemIndicador(acao, dados); }
  finally { pendentes--; if (escrita) escritas--; atualizarIndicador(); }
}

/** Guarda, neste navegador, quanto cada ação demorou (para a aba Manutenção do admin mostrar onde está a lentidão). */
function registrarTempo(acao, total, t) {
  try {
    const todos = JSON.parse(localStorage.getItem('cine_tempos') || '{}');
    const x = todos[acao] || { n: 0, total: 0, servidor: 0, leituras: 0, leitura_ms: 0, max: 0 };
    x.n++; x.total += total; x.max = Math.max(x.max, total);
    if (t) { x.servidor += t.ms || 0; x.leituras += t.lei || 0; x.leitura_ms += t.lms || 0; }
    todos[acao] = x;
    localStorage.setItem('cine_tempos', JSON.stringify(todos));
  } catch (_) { /* sem armazenamento: tudo bem */ }
}

async function chamarSemIndicador(acao, dados) {
  const inicio = performance.now();
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

  registrarTempo(acao, Math.round(performance.now() - inicio), json._t);
  if (!json.ok) {
    if (json.codigo === 'sessao') {
      apagarToken();
      window.dispatchEvent(new CustomEvent('sessao-expirada'));
    }
    throw new ErroApi(json.codigo || 'erro', json.erro || 'Algo deu errado.');
  }
  return json.dados;
}
