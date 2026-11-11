import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo } from '../estado.js';
import { cartaoTitulo, fecharMenus } from '../cartao.js';
import {
  casca, avatar, capa, avisar, ROTULOS, COR_STATUS, ORDEM_STATUS, ICONE_STATUS, normalizar, tituloMeta, CATEGORIAS, rotuloCategoria
} from '../ui.js';

// O filtro escolhido fica guardado enquanto a pessoa navega entre telas.
const PLURAL = { filme: 'Filmes', serie: 'Séries', anime: 'Animes', dorama: 'Doramas', reality: 'Reality', documentario: 'Documentários' };
const filtro = { categoria: 'todos', genero: null, busca: '', ordem: 'recentes' };

export function telaCatalogo({ raiz, ativa }) {
  const campoBusca = h('input', {
    type: 'search', id: 'busca', 'aria-label': 'Buscar no catálogo', placeholder: 'Buscar no catálogo…',
    value: filtro.busca, autocomplete: 'off',
    oninput: (e) => { filtro.busca = e.target.value; desenharGrade(); }
  });
  const filtrosEl = h('div', { class: 'filtros' });
  const legendaEl = h('div', { class: 'legenda' });
  const gradeEl = h('div', { class: 'grade' });
  const avisoEl = h('div', { class: 'estado-vazio', role: 'status' });
  const ordenar = h('select', {
    id: 'ordem', 'aria-label': 'Ordenar',
    onchange: (e) => { filtro.ordem = e.target.value; desenharGrade(); }
  },
    h('option', { value: 'recentes' }, 'Mais recentes'),
    h('option', { value: 'az' }, 'A a Z'),
    h('option', { value: 'vistos' }, 'Mais vistos pela galera')
  );
  ordenar.value = filtro.ordem;

  const conteudo = h('div', { class: 'catalogo' },
    h('div', { class: 'titulo-linha' },
      h('div', null,
        h('h1', null, 'Catálogo do grupo'),
        h('p', { class: 'suave' }, 'Todos os títulos escolhidos pela galera, em um só lugar.')
      ),
      h('label', { class: 'seletor' }, h('span', { class: 'sr-only' }, 'Ordenar por'), ordenar)
    ),
    filtrosEl, legendaEl, avisoEl, gradeEl
  );
  montar(raiz, casca('catalogo', conteudo, { busca: campoBusca }));

  function chip(texto, ligado, aoClicar) {
    return h('button', { type: 'button', class: 'chip' + (ligado ? ' ligado' : ''), 'aria-pressed': ligado ? 'true' : 'false', onclick: aoClicar }, texto);
  }

  function desenharFiltros() {
    const generos = [...new Set(estado.catalogo.titulos.flatMap((t) => t.generos))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const categorias = Object.keys(CATEGORIAS).filter((c) => estado.catalogo.titulos.some((t) => t.categoria === c));
    if (filtro.categoria !== 'todos' && !categorias.includes(filtro.categoria)) filtro.categoria = 'todos';
    const mudar = (campo, valor) => () => { filtro[campo] = valor; desenharFiltros(); desenharGrade(); };
    montar(filtrosEl,
      chip('Todos', filtro.categoria === 'todos', mudar('categoria', 'todos')),
      categorias.map((c) => chip(PLURAL[c], filtro.categoria === c, mudar('categoria', c))),
      generos.length ? h('span', { class: 'divisor', 'aria-hidden': 'true' }) : null,
      generos.map((g) => chip(g, filtro.genero === g, mudar('genero', filtro.genero === g ? null : g)))
    );
    montar(legendaEl,
      h('span', null, 'Anel do avatar:'),
      ['visto', 'assistindo', 'quero_ver'].map((s) =>
        h('span', { class: 'legenda-item' }, h('span', { class: 'ponto', style: { background: COR_STATUS[s] } }), ROTULOS[s]))
    );
  }

  function listaFiltrada() {
    const busca = normalizar(filtro.busca.trim());
    let lista = estado.catalogo.titulos.filter((t) =>
      (filtro.categoria === 'todos' || t.categoria === filtro.categoria) &&
      (!filtro.genero || t.generos.includes(filtro.genero)) &&
      (!busca || normalizar(t.nome).includes(busca))
    );
    const vistos = (t) => estado.catalogo.status.filter((s) => s.titulo_id === t.id && s.status === 'visto').length;
    if (filtro.ordem === 'az') lista = lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    else if (filtro.ordem === 'vistos') lista = lista.sort((a, b) => vistos(b) - vistos(a) || a.nome.localeCompare(b.nome, 'pt-BR'));
    else lista = lista.sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    return lista;
  }

  function desenharGrade() {
    fecharMenus();
    const lista = listaFiltrada();

    if (!estado.catalogo.titulos.length) {
      montar(avisoEl, h('p', null, 'O catálogo ainda está vazio.'), h('a', { class: 'btn-primario', href: '#/adicionar' }, 'Adicionar o primeiro título'));
    } else if (!lista.length) {
      montar(avisoEl, h('p', null, 'Nenhum título encontrado com esses filtros.'));
    } else {
      montar(avisoEl);
    }
    montar(gradeEl, lista.map((t) => cartaoTitulo(t, { aoMudar: desenharGrade })));
  }

  if (estado.catalogo) {
    desenharFiltros(); desenharGrade();
  } else {
    montar(avisoEl, h('p', null, 'Carregando o catálogo…'));
  }
  carregarCatalogo()
    .then(() => { if (ativa()) { desenharFiltros(); desenharGrade(); } })
    .catch((e) => {
      if (!ativa()) return;
      if (estado.catalogo) { avisar(e.message, 'erro'); return; }
      montar(avisoEl, h('p', { class: 'erro' }, e.message),
        h('button', { type: 'button', class: 'btn-sec', onclick: () => telaCatalogo({ raiz, ativa }) }, 'Tentar de novo'));
    });
}
