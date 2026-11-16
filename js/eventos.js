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

export function dataLonga(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
}

/** "em 3 dias", "amanhã", "hoje às 20:00", "já começou". */
export function contagem(iso) {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const ms = t - Date.now();
  if (ms <= 0) return 'já começou';
  const min = Math.round(ms / 60000);
  if (min < 60) return `começa em ${min} min`;
  const hh = Math.round(min / 60);
  if (hh < 24) return `começa em ${hh} h`;
  const dias = Math.round(hh / 24);
  return dias === 1 ? 'começa amanhã' : `começa em ${dias} dias`;
}

export const jaComecou = (e) => new Date(e.inicio).getTime() <= Date.now();

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

/** "sex., 20:00" */
export function horaCurta(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace('.', '');
}

export { chamar };
