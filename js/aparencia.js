import { chamar } from './api.js';

// Imagens de fundo das páginas, escolhidas no Admin (aba Aparência).
// Funciona assim: o que foi visto na última visita vem do navegador na hora (a página já abre com a imagem)
// e, em segundo plano, o site confere se algo mudou e atualiza sozinho.
const CHAVE = 'cine_aparencia';
const CHAVE_QUANDO = 'cine_aparencia_em';
const VALIDADE_MS = 10 * 60 * 1000; // dentro desse prazo não pergunta de novo ao servidor
let mapa = {};
try { mapa = JSON.parse(localStorage.getItem(CHAVE) || '{}') || {}; } catch (_) { mapa = {}; }
const ouvintes = new Set();
let busca = null;

/** Endereço da imagem daquele lugar ('' se o admin ainda não escolheu). */
export function imagemDe(lugar) { return mapa[lugar] || ''; }

/** Confere no servidor (no máximo uma vez a cada abertura do site) e avisa quem estiver esperando. */
export function carregarAparencia({ forcar = false } = {}) {
  if (busca && !forcar) return busca;
  try {
    const quando = Number(localStorage.getItem(CHAVE_QUANDO) || 0);
    if (!forcar && Object.keys(mapa).length && Date.now() - quando < VALIDADE_MS) return Promise.resolve();
  } catch (_) { /* segue e consulta */ }
  busca = chamar('aparencia').then((d) => {
    try { localStorage.setItem(CHAVE_QUANDO, String(Date.now())); } catch (_) { /* tudo bem */ }
    const novo = (d && d.imagens) || {};
    if (JSON.stringify(novo) !== JSON.stringify(mapa)) {
      mapa = novo;
      try { localStorage.setItem(CHAVE, JSON.stringify(mapa)); } catch (_) { /* sem armazenamento: tudo bem */ }
      ouvintes.forEach((f) => f());
    }
  }).catch(() => { busca = null; }); // sem rede: fica com o que já tinha
  return busca;
}

/**
 * Põe a imagem de fundo do lugar no elemento (variável CSS --img) e a atualiza se o admin trocar.
 * O CSS decide como ela aparece; sem imagem, fica só o degradê.
 */
export function fundoAparencia(el, lugar) {
  const aplicar = () => {
    const url = imagemDe(lugar);
    if (url) el.style.setProperty('--img', `url("${url}")`);
    else el.style.removeProperty('--img');
    el.classList.toggle('com-imagem', !!url);
  };
  aplicar();
  ouvintes.add(aplicar);
  // some da lista quando o elemento sai da página (evita acumular)
  const olho = new MutationObserver(() => { if (!el.isConnected) { ouvintes.delete(aplicar); olho.disconnect(); } });
  requestAnimationFrame(() => { if (el.isConnected) olho.observe(document.body, { childList: true, subtree: true }); else ouvintes.delete(aplicar); });
  return el;
}
