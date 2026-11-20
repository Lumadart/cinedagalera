// Dados e peças compartilhadas de eventos/votações (tela de eventos, admin e home).
import { h, icone } from './dom.js';
import { chamar } from './api.js';
import { capa, avatar, seguro, suave } from './ui.js';
import { achaTitulo } from './estado.js';

export const TIPOS_EVENTO = { maratona: 'Maratona', tematico: 'Temático', outro: 'Outro' };

let cache = null, quando = 0, voo = null;
/** Eventos e votações (guardados por 30 s para não pedir à planilha toda hora). */
export function carregarEventos({ forcar = false } = {}) {
  if (!forcar && cache && Date.now() - quando < 30000) return Promise.resolve(cache);
  if (voo) return voo;
  voo = chamar('eventos').then((d) => { cache = d; quando = Date.now(); return d; }).finally(() => { voo = null; });
  return voo;
}
export function limparEventos() { cache = null; quando = 0; }

/** "Ativo" = rolando agora ou começando nos próximos 7 dias (sem cancelados). */
export function eventoAtivo(e) {
  if (e.cancelado) return false;
  const ini = new Date(e.inicio).getTime();
  if (!ini) return false;
  const fim = e.fim ? new Date(e.fim).getTime() : ini + 6 * 3600000;
  return fim > Date.now() && ini - Date.now() <= 7 * 86400000;
}

/** Colagem de até 3 capas do evento. */
export function colagem(e) {
  const url = seguro(e.imagem_url);
  if (url) {
    const img = suave(h('img', { src: url, alt: '', referrerpolicy: 'no-referrer' }));
    img.addEventListener('error', () => img.remove());
    return h('div', { class: 'ev-colagem com-imagem' }, img);
  }
  const ts = (e.titulos || []).map(achaTitulo).filter(Boolean).slice(0, 3);
  return h('div', { class: 'ev-colagem' + (ts.length ? '' : ' vazia') },
    ts.length ? ts.map((t) => h('span', null, capa(t))) : icone('calendario', 34));
}

export function quemVai(e, membros, resposta, max = 8) {
  const ids = Object.keys(e.presencas || {}).filter((id) => e.presencas[id] === resposta);
  const ms = ids.map((id) => membros.find((m) => m.id === id)).filter(Boolean);
  return { total: ms.length, pilha: h('span', { class: 'pilha-avatares' }, ms.slice(0, max).map((m) => avatar(m, { tamanho: 28, dica: m.nome }))) };
}

/** Programação do evento: filmes ordenados por horário (sem horário vão para o fim). */
export function programacao(e) {
  return e.titulos.map((id) => ({ titulo_id: id, inicio: (e.horarios || {})[id] || '' }))
    .sort((a, b) => (a.inicio || '~').localeCompare(b.inicio || '~'));
}

/** Contagem regressiva ao vivo (dias, horas, minutos, segundos). Para sozinha quando a tela sai ou o evento começa. */
export function relogio(iso, ativa) {
  const alvo = new Date(iso).getTime();
  const z = (n) => String(n).padStart(2, '0');
  const unidade = (rotulo) => { const n = h('b', null, '00'); return { n, el: h('div', { class: 'rel-un' }, n, h('small', null, rotulo)) }; };
  const d = unidade('dias'), hh = unidade('horas'), m = unidade('min'), s = unidade('seg');
  const el = h('div', { class: 'relogio', role: 'timer', 'aria-label': 'Contagem regressiva para o evento' }, d.el, hh.el, m.el, s.el);
  let t = null;
  function tick() {
    if (!el.isConnected && t) { clearInterval(t); return; }
    if (!ativa()) { clearInterval(t); return; }
    const falta = Math.max(0, alvo - Date.now());
    if (falta === 0) { clearInterval(t); el.replaceChildren(h('span', { class: 'rel-agora' }, 'Já começou! 🎬')); return; }
    const seg = Math.floor(falta / 1000);
    d.n.textContent = z(Math.floor(seg / 86400)); hh.n.textContent = z(Math.floor(seg % 86400 / 3600));
    m.n.textContent = z(Math.floor(seg % 3600 / 60)); s.n.textContent = z(seg % 60);
  }
  tick();
  t = setInterval(tick, 1000);
  return el;
}

/** Selo de calendário: dia grande e mês abreviado. */
export function seloData(iso) {
  const dt = new Date(iso);
  return h('div', { class: 'ev-selo', 'aria-hidden': 'true' },
    h('b', null, String(dt.getDate()).padStart(2, '0')),
    h('small', null, dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')));
}
