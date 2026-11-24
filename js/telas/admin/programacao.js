// Editor da programação de um evento, dia a dia: horário de início, títulos em ordem, intervalo entre eles e episódios das séries.
import { h, montar, icone } from '../../dom.js';
import { estado } from '../../estado.js';
import { capa } from '../../ui.js';
import { buscaTitulos } from '../../seletor.js';

export const INTERVALOS = [0, 10, 15, 20, 30, 45, 60];
const z = (n) => String(n).padStart(2, '0');
const hhmm = (ms) => { const d = new Date(ms); return `${z(d.getHours())}:${z(d.getMinutes())}`; };
const achar = (id) => estado.catalogo.titulos.find((t) => t.id === id);

/** Duração em minutos (mesma regra do servidor). */
export function minutosItem(x, t) {
  const d = Number(t && t.duracao_min) || 0;
  if (t && t.tipo === 'serie') return Math.max(1, (x.ate || 1) - (x.de || 1) + 1) * (d || 45);
  return d || 110;
}

/**
 * `inicial`: programação salva no evento ({dias:[{data,inicio,itens:[{t,de,ate,temp,pausa}]}]}) ou null.
 * `padrao`: função que devolve a data (aaaa-mm-dd) sugerida para um novo dia.
 */
export function editorProgramacao(inicial, { aoMudar = () => {}, dataPadrao = () => '' } = {}) {
  const dias = ((inicial && inicial.dias) || []).map((d) => ({ data: d.data, inicio: d.inicio, itens: d.itens.map((x) => ({ t: x.t, de: x.de, ate: x.ate, temp: x.temp, pausa: x.pausa ?? 15 })) }));
  let pausaPadrao = 15;
  const caixa = h('div', { class: 'prog-editor' });

  function pausaSelect(valor, aoTrocar) {
    const sel = h('select', { 'aria-label': 'Intervalo depois deste título', onchange: (ev) => aoTrocar(Number(ev.target.value)) },
      INTERVALOS.map((m) => h('option', { value: String(m), selected: m === valor }, m ? `${m} min` : 'sem intervalo')));
    if (!INTERVALOS.includes(valor)) sel.append(h('option', { value: String(valor), selected: true }, `${valor} min`));
    return sel;
  }

  function pintar() {
    montar(caixa,
      h('div', { class: 'pg-dia-topo' },
        h('label', null, 'Intervalo padrão entre títulos', pausaSelect(pausaPadrao, (v) => { pausaPadrao = v; })),
        h('button', { type: 'button', class: 'btn-sec', onclick: () => { dias.forEach((d) => d.itens.forEach((x) => { x.pausa = pausaPadrao; })); pintar(); aoMudar(); } }, 'Aplicar a todos')),
      dias.length ? dias.map(pintarDia) : h('p', { class: 'suave pequeno' }, 'Nenhum dia ainda. Adicione um dia, defina o horário de início e escolha os títulos.'),
      h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'btn-sec', onclick: () => {
        dias.push({ data: dataPadrao(), inicio: '14:00', itens: [] }); pintar(); aoMudar();
      } }, icone('mais', 16), 'Adicionar dia')));
  }

  function pintarDia(dia, di) {
    const itens = dia.itens;
    // horários estimados (o servidor refaz a conta ao salvar)
    let cursor = dia.data && /^\d{2}:\d{2}$/.test(dia.inicio) ? new Date(`${dia.data}T${dia.inicio}:00`).getTime() : NaN;
    const linhas = itens.map((x, i) => {
      const t = achar(x.t);
      const ini = cursor, dur = minutosItem(x, t);
      cursor += (dur + (i < itens.length - 1 ? x.pausa : 0)) * 60000;
      return { x, i, t, ini, fim: ini + dur * 60000 };
    });
    const busca = buscaTitulos({ placeholder: 'Adicionar título a este dia…', excluir: () => dias.flatMap((d) => d.itens.map((x) => x.t)),
      aoEscolher: (t) => { itens.push({ t: t.id, de: t.tipo === 'serie' ? 1 : undefined, ate: t.tipo === 'serie' ? 1 : undefined, temp: undefined, pausa: pausaPadrao }); pintar(); aoMudar(); } });
    const mover = (i, d) => { const j = i + d; if (j < 0 || j >= itens.length) return; [itens[i], itens[j]] = [itens[j], itens[i]]; pintar(); aoMudar(); };
    return h('section', { class: 'pg-dia' },
      h('div', { class: 'pg-dia-topo' },
        h('label', null, 'Dia', h('input', { type: 'date', value: dia.data, required: true, onchange: (ev) => { dia.data = ev.target.value; pintar(); aoMudar(); } })),
        h('label', null, 'Começa às', h('input', { type: 'time', value: dia.inicio, required: true, onchange: (ev) => { dia.inicio = ev.target.value; pintar(); aoMudar(); } })),
        h('button', { type: 'button', class: 'btn-sec perigo', onclick: () => { if (itens.length && !confirm('Remover este dia e os títulos dele da programação?')) return; dias.splice(di, 1); pintar(); aoMudar(); } }, 'Remover dia')),
      linhas.map(({ x, i, t, ini, fim }) => !t ? null : h('div', { class: 'pg-item' },
        h('div', { class: 'pg-nome' }, h('span', { class: 'pg-hora' }, isNaN(ini) ? '--:--' : hhmm(ini)), h('span', { class: 'mini-capa p' }, capa(t)), h('strong', null, t.nome),
          h('small', { class: 'suave' }, isNaN(fim) ? '' : 'até ' + hhmm(fim))),
        h('div', { class: 'pg-ctrl' },
          t.tipo === 'serie' ? [
            h('label', { class: 'pequeno' }, 'Temp.', h('input', { type: 'number', min: 1, max: 100, value: x.temp || '', placeholder: '—', onchange: (ev) => { x.temp = Number(ev.target.value) || undefined; aoMudar(); } })),
            h('label', { class: 'pequeno' }, 'Do ep.', h('input', { type: 'number', min: 1, max: 9999, value: x.de || 1, onchange: (ev) => { x.de = Number(ev.target.value) || 1; if (!(x.ate >= x.de)) x.ate = x.de; pintar(); aoMudar(); } })),
            h('label', { class: 'pequeno' }, 'Ao ep.', h('input', { type: 'number', min: 1, max: 9999, value: x.ate || x.de || 1, onchange: (ev) => { x.ate = Number(ev.target.value) || x.de; pintar(); aoMudar(); } }))
          ] : null,
          i < itens.length - 1 ? pausaSelect(x.pausa, (v) => { x.pausa = v; pintar(); aoMudar(); }) : null,
          h('button', { type: 'button', class: 'btn-icone', 'aria-label': 'Subir', disabled: i === 0, onclick: () => mover(i, -1) }, '↑'),
          h('button', { type: 'button', class: 'btn-icone', 'aria-label': 'Descer', disabled: i === itens.length - 1, onclick: () => mover(i, 1) }, '↓'),
          h('button', { type: 'button', class: 'btn-icone', 'aria-label': 'Remover ' + t.nome, onclick: () => { itens.splice(i, 1); pintar(); aoMudar(); } }, '×')))),
      busca.el,
      itens.length && !isNaN(cursor) ? h('p', { class: 'suave pg-resumo' }, `Termina por volta das ${hhmm(cursor)}.`) : null);
  }

  pintar();
  return {
    el: caixa,
    temItens: () => dias.some((d) => d.itens.length),
    /** Devolve o que o servidor espera; dias vazios são ignorados. */
    valor: () => ({ dias: dias.filter((d) => d.itens.length).map((d) => ({ data: d.data, inicio: d.inicio, itens: d.itens.map((x) => ({ t: x.t, temp: x.temp, de: x.de, ate: x.ate, pausa: x.pausa })) })) }),
    ids: () => dias.flatMap((d) => d.itens.map((x) => x.t))
  };
}
