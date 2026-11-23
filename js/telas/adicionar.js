import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo } from '../estado.js';
import { chamar } from '../api.js';
import { casca, capa, avisar, CATEGORIAS, CATEGORIAS_POR_TIPO, rotuloCategoria, formatarNota } from '../ui.js';
import { dropdown } from '../dropdown.js';
import { fundoAparencia } from '../aparencia.js';

export function telaAdicionar({ raiz, ativa }) {
  const campo = h('input', {
    id: 'q', type: 'search', placeholder: 'Digite o nome do filme ou série…',
    autocomplete: 'off', 'aria-label': 'Nome do título'
  });
  const botao = h('button', { type: 'submit', class: 'btn-primario' }, 'Buscar');
  const saida = h('div', { class: 'resultados add-resultados' });
  const ocioso = h('div', { class: 'add-ocioso' });
  let tipoFiltro = 'todos', ultima = null;   // ultima = { resultados, q }
  const chipsEl = h('div', { class: 'add-tipos', role: 'group', 'aria-label': 'Filtrar resultados' });

  let numero = 0;      // só a busca mais recente pode mexer na tela
  let espera = null;
  const lembrados = new Map(); // buscas já feitas nesta tela
  async function buscar(q) {
    const meu = ++numero;
    if (lembrados.has(q)) { mostrar(lembrados.get(q), q); return; }
    ocioso.hidden = true;
    montar(saida, h('p', { class: 'suave add-msg', role: 'status' }, 'Buscando…'));
    try {
      const d = await chamar('buscar_tmdb', { q });
      if (!ativa() || meu !== numero) return;
      lembrados.set(q, d.resultados);
      mostrar(d.resultados, q);
    } catch (err) {
      if (ativa() && meu === numero) montar(saida, h('p', { class: 'erro', role: 'alert' }, err.message));
    }
  }
  campo.addEventListener('input', () => {
    clearTimeout(espera);
    const q = campo.value.trim();
    if (q.length < 2) { numero++; ultima = null; montar(saida); ocioso.hidden = false; return; }
    espera = setTimeout(() => buscar(q), 350); // espera a pessoa parar de digitar
  });

  const form = h('form', {
    class: 'busca-form add-form', novalidate: true,
    onsubmit: (e) => {
      e.preventDefault();
      clearTimeout(espera);
      const q = campo.value.trim();
      if (q.length < 2) { montar(saida, h('p', { class: 'erro', role: 'alert' }, 'Digite pelo menos 2 letras.')); return; }
      buscar(q);
    }
  }, campo, botao);

  function mostrar(resultados, q) {
    ultima = { resultados, q }; ocioso.hidden = true;
    desenharChips();
    const lista = tipoFiltro === 'todos' ? resultados : resultados.filter((r) => r.tipo === tipoFiltro);
    if (!lista.length) {
      montar(saida, h('p', { class: 'suave add-msg' }, resultados.length ? 'Nada deste tipo nos resultados. Troque o filtro acima.' : `Nada encontrado para “${q}”. Tente outro nome.`));
      return;
    }
    montar(saida, h('p', { class: 'suave pequeno add-msg' }, `${lista.length} ${lista.length === 1 ? 'resultado' : 'resultados'} para “${q}”`), lista.map(item));
  }

  function desenharChips() {
    const opcoes = [['todos', 'Tudo'], ['filme', 'Filmes'], ['serie', 'Séries e animes']];
    montar(chipsEl, opcoes.map(([id, texto]) => h('button', {
      type: 'button', class: 'chip' + (tipoFiltro === id ? ' ligado' : ''), 'aria-pressed': String(tipoFiltro === id),
      onclick: () => { tipoFiltro = id; if (ultima) mostrar(ultima.resultados, ultima.q); else desenharChips(); }
    }, texto)));
  }

  function item(r) {
    const acao = h('div', { class: 'resultado-acao' });
    const cat = dropdown({ rotulo: 'Categoria de ' + r.nome, mini: true, valor: r.categoria, opcoes: CATEGORIAS_POR_TIPO[r.tipo].map((c) => [c, CATEGORIAS[c]]) });
    const rec = h('input', { maxlength: '200', placeholder: 'Recado (opcional)', 'aria-label': 'Recado sobre ' + r.nome });
    if (r.ja_no_catalogo) {
      acao.append(h('span', { class: 'suave pequeno' }, 'Já está no catálogo'),
        h('a', { class: 'btn-sec', href: '#/titulo/' + r.titulo_id }, 'Abrir'));
    } else {
      acao.append(cat, rec);
      const b = h('button', {
        type: 'button', class: 'btn-sec',
        'aria-label': 'Adicionar ' + r.nome + ' ao catálogo',
        onclick: async () => {
          b.disabled = true; b.textContent = 'Adicionando…';
          try {
            const d = await chamar('adicionar_titulo', { tmdb_id: r.tmdb_id, tipo: r.tipo, categoria: cat.value, recado: rec.value.trim() });
            if (estado.catalogo && !estado.catalogo.titulos.some((t) => t.id === d.titulo.id)) {
              estado.catalogo.titulos.unshift(d.titulo);
            }
            avisar(`“${d.titulo.nome}” entrou no catálogo.`);
            location.hash = '#/titulo/' + d.titulo.id;
          } catch (err) {
            avisar(err.message, 'erro');
            b.disabled = false; b.textContent = 'Adicionar';
          }
        }
      }, 'Adicionar');
      acao.append(b);
    }
    return h('article', { class: 'resultado' },
      h('div', { class: 'resultado-capa' }, capa(r)),
      h('div', { class: 'resultado-info' },
        h('strong', null, r.nome),
        h('span', { class: 'suave pequeno' }, [rotuloCategoria(r), r.ano].filter(Boolean).join(' · '), r.nota_tmdb ? h('span', { class: 'add-nota' }, ' ★ ' + formatarNota(r.nota_tmdb)) : null),
        r.sinopse ? h('p', { class: 'sinopse-curta' }, r.sinopse) : null
      ),
      acao
    );
  }

  desenharChips();
  montar(raiz, casca('adicionar', h('div', { class: 'adicionar' },
    fundoAparencia(h('header', { class: 'add-hero' },
      h('div', { class: 'add-hero-texto' },
        h('span', { class: 'add-sobre' }, icone('novo', 16), 'Novo no catálogo'),
        h('h1', null, 'Adicionar título'),
        h('p', null, 'Busque um filme, série, anime ou dorama e coloque no catálogo da comunidade.'),
        h('div', { class: 'add-busca' }, icone('busca', 22), form),
        chipsEl)), 'adicionar'),
    saida, ocioso)));
  desenharOcioso();
  campo.focus();

  /** Antes da busca: como funciona + o que a comunidade adicionou por último. */
  function desenharOcioso() {
    const passos = [['1', 'Busque', 'Digite o nome. A busca usa o TMDB, então tem de tudo.'], ['2', 'Escolha a categoria', 'Anime, animação, dorama, musical, reality… você decide onde ele fica.'], ['3', 'Adicione', 'Pronto! Vira ficha no catálogo e todo mundo pode marcar.']];
    const recentes = h('div', { class: 'add-recentes' });
    montar(ocioso,
      h('section', { class: 'add-passos' }, passos.map(([n, t, d]) => h('div', { class: 'add-passo' }, h('span', { class: 'add-num' }, n), h('strong', null, t), h('p', { class: 'suave' }, d)))),
      h('section', { class: 'bloco-home' },
        h('div', { class: 'titulo-secao' }, h('h2', null, h('span', { class: 'ico-ouro' }, icone('novo', 20)), 'Adicionados por último')),
        recentes));
    const pintar = () => {
      if (!ativa() || !estado.catalogo) return;
      const quem = Object.fromEntries(estado.catalogo.membros.map((m) => [m.id, m]));
      const ultimos = estado.catalogo.titulos.slice().sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))).slice(0, 6);
      montar(recentes, ultimos.length ? ultimos.map((t) => h('a', { class: 'add-rec', href: '#/titulo/' + t.id },
        h('span', { class: 'add-rec-capa' }, capa(t)), h('strong', null, t.nome),
        h('small', { class: 'suave' }, quem[t.adicionado_por] ? 'por ' + quem[t.adicionado_por].nome.split(' ')[0] : ''))) : h('p', { class: 'suave' }, 'Ainda não há títulos. Seja a primeira pessoa a indicar!'));
    };
    if (estado.catalogo) pintar(); else carregarCatalogo().then(pintar).catch(() => {});
  }
}
