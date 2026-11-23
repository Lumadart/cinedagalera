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
  voo = chamar('eventos').then((d) => { cache = d; quando = Date.now(); guardarPrevia(d); return d; }).finally(() => { voo = null; });
  return voo;
}
/** Última lista conhecida (mesmo velha): deixa a página de Eventos abrir na hora enquanto a atual chega. */
export function previaEventos() {
  if (cache) return cache;
  try { return JSON.parse(sessionStorage.getItem('cine_previa_eventos') || 'null'); } catch (_) { return null; }
}
function guardarPrevia(d) { try { sessionStorage.setItem('cine_previa_eventos', JSON.stringify(d)); } catch (_) { /* tudo bem */ } }
export function limparEventos() { cache = null; quando = 0; try { sessionStorage.removeItem('cine_previa_eventos'); } catch (_) { /* tudo bem */ } }

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
    .sort((a, b) => (a.inicio && b.inicio ? a.inicio.localeCompare(b.inicio) : a.inicio ? -1 : b.inicio ? 1 : 0));
}

/** "sábado, 24 de maio" e "14:00" (só o dia ou só a hora, ao contrário de dataLonga/horaCurta que trazem os dois). */
export const diaLongo = (iso) => new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
export const hhmm = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

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

/** Última vez em que a comunidade exibiu o título num evento (horário passado ou evento já começado). null se nunca. */
export function exibicaoDe(eventos, tituloId) {
  let melhor = null;
  eventos.filter((x) => !x.cancelado && x.titulos.includes(tituloId)).forEach((x) => {
    const quando = (x.horarios || {})[tituloId] || x.inicio;
    if (quando && new Date(quando).getTime() <= Date.now() && (!melhor || melhor.quando < quando)) melhor = { quando, evento: x.nome, evento_id: x.id };
  });
  return melhor;
}

// ---------- fases do evento ----------
export const FASES = {
  confirmacao: ['Confirme presença', 'Quem confirma ajuda a definir quantas sugestões cada pessoa terá.'],
  sugestoes: ['Sugestões abertas', 'Sugira filmes e séries do catálogo para o evento.'],
  votacao: ['Votação aberta', 'Escolha o que vai passar entre os títulos sugeridos.'],
  empate: ['Empate', 'Deu empate na última vaga: os admins vão decidir.'],
  aguardando: ['Tudo definido', 'Os títulos já foram escolhidos. Falta só chegar o dia!'],
  sem_sugestoes: ['Sem sugestões', 'Ninguém sugeriu títulos; os admins vão montar a programação.'],
  programado: ['Programação definida', 'Os títulos e horários já estão decididos.'],
  ao_vivo: ['Rolando agora', 'O evento já começou. Bom filme!'],
  encerrado: ['Encerrado', 'Este evento já aconteceu.'],
  cancelado: ['Cancelado', ''],
  legado: ['', '']
};
export const faseRotulo = (e) => (FASES[e.fase] || FASES.legado)[0];

/** Linha do tempo das fases de um evento com votação (para o "passo a passo" da página). */
export function passosDoEvento(e) {
  if (e.modo !== 'votacao') return [];
  const ordem = ['confirmacao', 'sugestoes', 'votacao', 'aguardando', 'ao_vivo'];
  const nomes = { confirmacao: 'Confirmação', sugestoes: 'Sugestões', votacao: 'Votação', aguardando: 'Definido', ao_vivo: 'Evento' };
  const f = e.fase === 'empate' ? 'votacao' : e.fase === 'sem_sugestoes' ? 'aguardando' : e.fase === 'encerrado' ? 'ao_vivo' : e.fase;
  const atual = Math.max(0, ordem.indexOf(f));
  const datas = { confirmacao: '', sugestoes: e.sug_ini, votacao: e.sug_fim, aguardando: e.vot_fim, ao_vivo: e.inicio };
  return ordem.map((id, i) => ({ id, nome: nomes[id], data: datas[id], estado: i < atual || e.fase === 'encerrado' ? 'feito' : i === atual ? 'atual' : 'depois' }));
}

/** Programação por dia → lista de { data, inicio, itens:[{ t, de, ate, temp, pausa, inicio, fim }] }; vazia se o evento não tem. */
export function programaPorDia(e) {
  return e.programacao && Array.isArray(e.programacao.dias) ? e.programacao.dias : [];
}
export function textoEpisodios(x) {
  if (x.de === undefined) return '';
  return (x.temp ? `T${x.temp} · ` : '') + (x.de === x.ate ? `ep. ${x.de}` : `eps. ${x.de}–${x.ate}`);
}
