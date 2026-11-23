import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo } from '../estado.js';
import { cartaoTitulo, fecharMenus } from '../cartao.js';
import { casca, esqueleto, avisar, ROTULOS, COR_STATUS, normalizar, CATEGORIAS } from '../ui.js';
import { dropdown } from '../dropdown.js';
import { fundoAparencia } from '../aparencia.js';
import { CATEGORIAS_DEF, PLURAL_CATEGORIAS, ICONE_CATEGORIAS, TEXTO_CATEGORIAS } from '../categorias.js';

// O filtro escolhido fica guardado enquanto a pessoa navega entre telas.
const filtro = estado.filtro;
const NOME_CAT = { todos: 'Todos os títulos', ...PLURAL_CATEGORIAS };
// Imagens de fundo do hero: escolhidas no Admin > Aparência. Sem imagem, fica só o degradê.
const TIPOS_HERO = ['todos', ...CATEGORIAS_DEF.map((c) => c.id)];

export function telaCatalogo({ raiz, ativa }) {
  const filtrosEl = h('div', { class: 'filtros-grupo' });
  const legendaEl = h('div', { class: 'legenda' });
  const gradeEl = h('div', { class: 'grade' });
  const avisoEl = h('div', { class: 'estado-vazio', role: 'status' });
  const ordenar = dropdown({
    id: 'ordem', rotulo: 'Ordenar', valor: filtro.ordem, mini: true,
    opcoes: [['recentes', 'Mais recentes'], ['az', 'A a Z'], ['vistos', 'Mais vistos pela comunidade']],
    aoMudar: (e) => { filtro.ordem = e.target.value; desenharGrade(); }
  });

  const fundos = TIPOS_HERO.map((c) => fundoAparencia(h('div', { class: 'cat-fundo', 'data-c': c }), 'catalogo_' + c));
  const heroTitulo = h('h1');
  const heroTexto = h('p', { class: 'cat-desc' });
  const heroContagem = h('span', { class: 'cat-contagem' });
  const hero = h('section', { class: 'cat-hero', 'aria-label': 'Tipo de título' },
    h('div', { class: 'cat-fundos', 'aria-hidden': 'true' }, fundos), h('div', { class: 'cat-veu' }),
    h('div', { class: 'cat-hero-texto' }, h('span', { class: 'cat-sobre' }, 'Catálogo da comunidade'), heroTitulo, heroTexto, heroContagem),
    h('label', { class: 'seletor cat-ordem' }, h('span', { class: 'sr-only' }, 'Ordenar por'), ordenar));
  const tiposEl = h('nav', { class: 'cat-tipos', 'aria-label': 'Tipo de título' });

  const conteudo = h('div', { class: 'catalogo' }, hero, tiposEl, filtrosEl, legendaEl, avisoEl, gradeEl);
  montar(raiz, casca('catalogo', conteudo, { aoBuscar: desenharGrade }));

  function chip(texto, ligado, aoClicar) {
    return h('button', { type: 'button', class: 'chip' + (ligado ? ' ligado' : ''), 'aria-pressed': ligado ? 'true' : 'false', onclick: aoClicar }, texto);
  }

  function desenharFiltros() {
    const generos = [...new Set(estado.catalogo.titulos.flatMap((t) => t.generos))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const categorias = CATEGORIAS_DEF.map((c) => c.id).filter((c) => estado.catalogo.titulos.some((t) => t.categoria === c));
    if (filtro.categoria !== 'todos' && !categorias.includes(filtro.categoria)) filtro.categoria = 'todos';
    const mudar = (campo, valor) => () => { filtro[campo] = valor; desenharFiltros(); desenharGrade(); };
    const total = (c) => c === 'todos' ? estado.catalogo.titulos.length : estado.catalogo.titulos.filter((t) => t.categoria === c).length;
    montar(tiposEl, ['todos', ...categorias].map((c) => h('button', {
      type: 'button', class: 'cat-tipo' + (filtro.categoria === c ? ' ligado' : ''), 'aria-pressed': String(filtro.categoria === c),
      onclick: mudar('categoria', c)
    }, icone(ICONE_CATEGORIAS[c], 18), c === 'todos' ? 'Todos' : PLURAL_CATEGORIAS[c], h('span', { class: 'contador' }, String(total(c))))));
    fundos.forEach((f) => f.classList.toggle('ativo', f.dataset.c === filtro.categoria));
    heroTitulo.textContent = NOME_CAT[filtro.categoria];
    heroTexto.textContent = TEXTO_CATEGORIAS[filtro.categoria];
    heroContagem.textContent = `${total(filtro.categoria)} ${total(filtro.categoria) === 1 ? 'título' : 'títulos'}`;
    montar(filtrosEl,
      generos.length ? h('div', { class: 'filtro-linha', role: 'group', 'aria-label': 'Gênero' },
        h('span', { class: 'filtro-rotulo' }, 'Gênero'),
        h('div', { class: 'filtros generos-filtro' },
          generos.map((g) => chip(g, filtro.genero === g, mudar('genero', filtro.genero === g ? null : g))))) : null
    );
    montar(legendaEl,
      h('span', null, 'Seu status (fita no topo do card):'),
      ['visto', 'assistindo', 'quero_ver', 'abandonado'].map((s) =>
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
    montar(avisoEl, esqueleto('grade', 10));
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
