// Busca no catálogo para escolher títulos (usada no admin e nas sugestões de eventos).
import { h, montar } from './dom.js';
import { estado } from './estado.js';
import { avisar, capa, normalizar } from './ui.js';

/** Caixa de busca com sugestões. `aoEscolher(titulo)` roda ao clicar; `excluir()` devolve ids a esconder. */
export function buscaTitulos({ aoEscolher, excluir = () => [], placeholder = 'Buscar no catálogo…' }) {
  const campo = h('input', { type: 'search', placeholder, 'aria-label': placeholder, autocomplete: 'off' });
  const lista = h('ul', { class: 'sugestoes' });
  const pintar = () => {
    const q = normalizar(campo.value.trim());
    const fora = new Set(excluir());
    const achados = q ? estado.catalogo.titulos.filter((t) => !fora.has(t.id) && normalizar(t.nome).includes(q)).slice(0, 5) : [];
    montar(lista, achados.map((t) => h('li', null, h('button', { type: 'button', onclick: () => { campo.value = ''; pintar(); aoEscolher(t); } },
      h('span', { class: 'mini-capa p' }, capa(t)), t.nome, h('small', { class: 'suave' }, ' ' + (t.ano || ''))))));
  };
  campo.addEventListener('input', pintar);
  return { el: h('div', { class: 'seletor' }, campo, lista), limpar: () => { campo.value = ''; pintar(); } };
}

/** Escolhe vários títulos (até `max`): busca + chips dos escolhidos. */
export function seletorTitulos(inicial, max, aoMudar = null) {
  const escolhidos = new Set(inicial);
  const chips = h('div', { class: 'ev-titulos' });
  const por = (id) => estado.catalogo.titulos.find((t) => t.id === id);
  const mudou = () => { pintar(); if (aoMudar) aoMudar(); };
  const pintar = () => montar(chips, [...escolhidos].map(por).filter(Boolean).map((t) => h('span', { class: 'chip-titulo' }, t.nome,
    h('button', { type: 'button', 'aria-label': 'Tirar ' + t.nome, onclick: () => { escolhidos.delete(t.id); mudou(); } }, '×'))));
  const busca = buscaTitulos({
    placeholder: 'Buscar no catálogo para adicionar…', excluir: () => [...escolhidos],
    aoEscolher: (t) => {
      if (escolhidos.size >= max) { avisar(`Máximo de ${max} títulos.`, 'erro'); return; }
      escolhidos.add(t.id); mudou();
    }
  });
  pintar();
  return { el: h('div', { class: 'seletor' }, busca.el, chips), valor: () => [...escolhidos] };
}
