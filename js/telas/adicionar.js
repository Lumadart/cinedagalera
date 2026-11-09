import { h, montar } from '../dom.js';
import { estado } from '../estado.js';
import { chamar } from '../api.js';
import { casca, capa, avisar, CATEGORIAS, CATEGORIAS_POR_TIPO, rotuloCategoria } from '../ui.js';

export function telaAdicionar({ raiz, ativa }) {
  const campo = h('input', {
    id: 'q', type: 'search', placeholder: 'Digite o nome do filme ou série…',
    autocomplete: 'off', 'aria-label': 'Nome do título'
  });
  const botao = h('button', { type: 'submit', class: 'btn-primario' }, 'Buscar');
  const saida = h('div', { class: 'resultados' });

  const form = h('form', {
    class: 'busca-form', novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      const q = campo.value.trim();
      if (q.length < 2) { montar(saida, h('p', { class: 'erro', role: 'alert' }, 'Digite pelo menos 2 letras.')); return; }
      botao.disabled = true; botao.textContent = 'Buscando…';
      montar(saida, h('p', { class: 'suave' }, 'Buscando…'));
      try {
        const d = await chamar('buscar_tmdb', { q });
        if (!ativa()) return;
        mostrar(d.resultados, q);
      } catch (err) {
        if (ativa()) montar(saida, h('p', { class: 'erro', role: 'alert' }, err.message));
      }
      botao.disabled = false; botao.textContent = 'Buscar';
    }
  }, campo, botao);

  function mostrar(resultados, q) {
    if (!resultados.length) {
      montar(saida, h('p', { class: 'suave' }, `Nada encontrado para “${q}”. Tente outro nome.`));
      return;
    }
    montar(saida,
      h('p', { class: 'suave pequeno' }, `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}`),
      resultados.map(item)
    );
  }

  function item(r) {
    const acao = h('div', { class: 'resultado-acao' });
    const cat = h('select', { 'aria-label': 'Categoria de ' + r.nome },
      CATEGORIAS_POR_TIPO[r.tipo].map((c) => h('option', { value: c }, CATEGORIAS[c])));
    cat.value = r.categoria;
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
        h('span', { class: 'suave pequeno' }, [rotuloCategoria(r), r.ano].filter(Boolean).join(' · ')),
        r.sinopse ? h('p', { class: 'sinopse-curta' }, r.sinopse) : null
      ),
      acao
    );
  }

  montar(raiz, casca('adicionar', h('div', { class: 'adicionar' },
    h('h1', null, 'Adicionar título'),
    h('p', { class: 'suave' }, 'Busque um filme ou série e coloque no catálogo da galera.'),
    form, saida
  )));
  campo.focus();
}
