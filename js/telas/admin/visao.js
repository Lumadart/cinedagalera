// Visão geral da administração: números do grupo, categorias e próximos eventos (tudo vindo do que o site já carregou).
import { h, montar, icone } from '../../dom.js';
import { estado, carregarCatalogo } from '../../estado.js';
import { carregarEventos, faseRotulo, hhmm } from '../../eventos.js';
import { CATEGORIAS_DEF } from '../../categorias.js';
import { dataCurta } from '../../datas.js';

export async function abaVisao({ painel, ativa }) {
  let cat = estado.catalogo;
  try { cat = cat || await carregarCatalogo(); } catch (e) { montar(painel, h('p', { class: 'erro' }, e.message)); return; }
  if (!ativa()) return;
  const titulos = cat.titulos || [], membros = (cat.membros || []).filter((m) => m.ativo !== false), marcas = cat.status || [];
  const cartao = (rotulo, valor, nota, ic) => h('div', { class: 'vg-cartao' }, h('span', { class: 'vg-ic' }, icone(ic, 20)), h('div', null, h('strong', null, String(valor)), h('span', null, rotulo), nota ? h('small', null, nota) : null));
  const visto = marcas.filter((s) => s.status === 'visto').length;
  const porCat = CATEGORIAS_DEF.map((c) => [c.plural, titulos.filter((t) => t.categoria === c.id).length]).filter((x) => x[1]);
  const topo = Math.max(1, ...porCat.map((x) => x[1]));
  const eventos = h('div', { class: 'vg-lista' }, h('p', { class: 'suave pequeno' }, 'Carregando…'));
  montar(painel,
    h('div', { class: 'vg-cartoes' },
      cartao('membros ativos', membros.length, null, 'amigos'),
      cartao('títulos no catálogo', titulos.length, null, 'play'),
      cartao('marcações de status', marcas.length, `${visto} como visto`, 'check'),
      cartao('categorias em uso', porCat.length, `de ${CATEGORIAS_DEF.length}`, 'grade')),
    h('div', { class: 'vg-grade' },
      h('section', { class: 'adm-cartao' }, h('h2', null, 'Catálogo por categoria'),
        porCat.length ? h('ul', { class: 'vg-barras' }, porCat.map(([nome, n]) => h('li', null, h('span', null, nome), h('span', { class: 'barra-fina' }, h('span', { style: { width: (n / topo * 100) + '%' } })), h('b', null, String(n)))))
          : h('p', { class: 'suave' }, 'Ainda não há títulos.')),
      h('section', { class: 'adm-cartao' }, h('h2', null, 'Próximos eventos'), eventos)));
  carregarEventos().then((d) => {
    if (!ativa()) return;
    const agora = Date.now();
    const prox = d.eventos.filter((e) => !e.cancelado && new Date(e.fim || e.inicio).getTime() >= agora).sort((a, b) => new Date(a.inicio) - new Date(b.inicio)).slice(0, 5);
    montar(eventos, prox.length ? prox.map((e) => h('a', { class: 'vg-evento', href: '#/evento/' + e.id },
      h('strong', null, e.nome), h('span', { class: 'suave' }, `${dataCurta(e.inicio)} às ${hhmm(e.inicio)}`), faseRotulo(e) ? h('span', { class: 'ev-fase-pill f-' + e.fase }, faseRotulo(e)) : null))
      : h('p', { class: 'suave' }, 'Nenhum evento marcado.'));
  }).catch(() => montar(eventos, h('p', { class: 'suave' }, 'Não foi possível carregar os eventos.')));
}
