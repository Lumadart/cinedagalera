import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo, aplicarStatusLocal, removerStatusLocal } from '../estado.js';
import { chamar } from '../api.js';
import {
  casca, avatar, capa, avisar, ROTULOS, COR_STATUS, ORDEM_STATUS, ICONE_STATUS, normalizar, tituloMeta, CATEGORIAS, rotuloCategoria
} from '../ui.js';

// O filtro escolhido fica guardado enquanto a pessoa navega entre telas.
const PLURAL = { filme: 'Filmes', serie: 'Séries', anime: 'Animes', dorama: 'Doramas', reality: 'Reality', documentario: 'Documentários' };
const filtro = { categoria: 'todos', genero: null, busca: '', ordem: 'recentes' };

function fecharMenus() {
  document.querySelectorAll('.menu-status').forEach((m) => {
    const botao = m.parentElement && m.parentElement.querySelector('.btn-status');
    if (botao) { botao.setAttribute('aria-expanded', 'false'); }
    m.remove();
  });
}
document.addEventListener('click', fecharMenus);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenus(); });

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
    const membros = Object.fromEntries(estado.catalogo.membros.map((m) => [m.id, m]));
    const porTitulo = {};
    estado.catalogo.status.forEach((s) => { (porTitulo[s.titulo_id] = porTitulo[s.titulo_id] || []).push(s); });

    if (!estado.catalogo.titulos.length) {
      montar(avisoEl, h('p', null, 'O catálogo ainda está vazio.'), h('a', { class: 'btn-primario', href: '#/adicionar' }, 'Adicionar o primeiro título'));
    } else if (!lista.length) {
      montar(avisoEl, h('p', null, 'Nenhum título encontrado com esses filtros.'));
    } else {
      montar(avisoEl);
    }
    montar(gradeEl, lista.map((t) => cartao(t, porTitulo[t.id] || [], membros)));
  }

  function cartao(t, linhas, membros) {
    const meu = linhas.find((s) => s.membro_id === estado.membro.id);
    const cont = { visto: 0, assistindo: 0, quero_ver: 0 };
    linhas.forEach((s) => { cont[s.status] += 1; });
    const partes = [];
    if (cont.visto) partes.push(cont.visto + (cont.visto === 1 ? ' viu' : ' viram'));
    if (cont.assistindo) partes.push(cont.assistindo + ' assistindo');
    if (cont.quero_ver) partes.push(cont.quero_ver + (cont.quero_ver === 1 ? ' quer ver' : ' querem ver'));

    const ordenadas = linhas.filter((s) => membros[s.membro_id]).sort((a, b) => ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status]);
    const mostrados = ordenadas.slice(0, 6);
    const extra = ordenadas.length - mostrados.length;

    const capaBox = h('div', { class: 'cartao-capa' });
    const botao = h('button', {
      type: 'button', class: 'btn-status' + (meu ? ' tem' : ''),
      'aria-haspopup': 'menu', 'aria-expanded': 'false',
      'aria-label': meu ? `Meu status em ${t.nome}: ${ROTULOS[meu.status]}. Alterar` : `Marcar ${t.nome} na minha lista`,
      style: meu ? { borderColor: COR_STATUS[meu.status], color: COR_STATUS[meu.status] } : null,
      onclick: (e) => { e.stopPropagation(); abrirMenu(botao, capaBox, t, meu); }
    }, icone(meu ? ICONE_STATUS[meu.status] : 'mais', 22));

    capaBox.append(
      h('a', { class: 'link-capa', href: '#/titulo/' + t.id, 'aria-label': 'Abrir ' + t.nome }, capa(t)),
      h('span', { class: 'pill-tipo' }, rotuloCategoria(t)),
      botao
    );

    return h('article', { class: 'cartao' },
      capaBox,
      h('a', { class: 'cartao-titulo', href: '#/titulo/' + t.id }, h('strong', null, t.nome), h('small', null, tituloMeta(t))),
      mostrados.length ? h('div', { class: 'aneis' },
        mostrados.map((s) => avatar(membros[s.membro_id], { tamanho: 28, cor: COR_STATUS[s.status], dica: `${membros[s.membro_id].nome}: ${ROTULOS[s.status].toLowerCase()}` })),
        extra > 0 ? h('span', { class: 'mais-gente' }, '+' + extra) : null
      ) : null,
      h('p', { class: 'resumo' }, partes.length ? partes.join(' · ') : 'Ninguém marcou ainda')
    );
  }

  function abrirMenu(botao, pai, t, meu) {
    const jaAberto = pai.querySelector('.menu-status');
    fecharMenus();
    if (jaAberto) return;
    const op = (status) => h('button', {
      type: 'button', role: 'menuitem', class: 'op' + (meu && meu.status === status ? ' atual' : ''),
      onclick: (e) => { e.stopPropagation(); definir(t, status); }
    }, h('span', { class: 'ponto', style: { background: COR_STATUS[status] } }), ROTULOS[status]);
    const menu = h('div', { class: 'menu-status', role: 'menu', onclick: (e) => e.stopPropagation() },
      op('quero_ver'), op('assistindo'), op('visto'),
      meu ? h('button', { type: 'button', role: 'menuitem', class: 'op remover', onclick: (e) => { e.stopPropagation(); remover(t); } }, 'Tirar da minha lista') : null
    );
    pai.append(menu);
    botao.setAttribute('aria-expanded', 'true');
    menu.querySelector('button').focus();
  }

  async function definir(t, status) {
    fecharMenus();
    try {
      await chamar('marcar_status', { titulo_id: t.id, status });
      aplicarStatusLocal(estado.membro.id, t.id, { status, visto_em: status === 'visto' ? new Date().toISOString() : '' });
      avisar(`“${t.nome}” marcado como ${ROTULOS[status].toLowerCase()}.`);
      desenharGrade();
    } catch (e) { avisar(e.message, 'erro'); }
  }

  async function remover(t) {
    fecharMenus();
    try {
      await chamar('remover_status', { titulo_id: t.id });
      removerStatusLocal(estado.membro.id, t.id);
      avisar(`“${t.nome}” saiu da sua lista.`);
      desenharGrade();
    } catch (e) { avisar(e.message, 'erro'); }
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
