import { h, icone } from './dom.js';
import { chamar } from './api.js';

// Ficha em texto + trailer do TMDB para a página do título. Tudo chega depois da página já desenhada
// (uma consulta só; se falhar, a página segue sem esses dados).
const guardados = new Map();

export function detalhesTmdb(titulo) {
  if (!guardados.has(titulo.id)) guardados.set(titulo.id, chamar('detalhes_tmdb', { titulo_id: titulo.id }).catch((e) => { guardados.delete(titulo.id); throw e; }));
  return guardados.get(titulo.id);
}

/** Link para a página do título no TMDB. */
export function linkTmdb(titulo) {
  if (!titulo.tmdb_id) return null;
  return h('a', { class: 'link-tmdb', href: `https://www.themoviedb.org/${titulo.tipo === 'filme' ? 'movie' : 'tv'}/${titulo.tmdb_id}?language=pt-BR`,
    target: '_blank', rel: 'noopener noreferrer' }, 'Ver mais informações no TMDB ↗');
}

/** Janela com o trailer; o player do YouTube só é carregado quando a janela abre. */
export function abrirTrailer(v) {
  const fechar = () => { fundo.remove(); document.removeEventListener('keydown', tecla); anterior && anterior.focus && anterior.focus(); };
  const tecla = (e) => { if (e.key === 'Escape') fechar(); };
  const anterior = document.activeElement;
  const fundo = h('div', { class: 'modal-trailer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Trailer: ' + v.nome, onclick: (e) => { if (e.target === fundo) fechar(); } },
    h('div', { class: 'modal-trailer-caixa' },
      h('button', { type: 'button', class: 'modal-trailer-fechar', 'aria-label': 'Fechar', onclick: fechar }, icone('fechar', 22)),
      h('iframe', { src: `https://www.youtube-nocookie.com/embed/${v.chave}?autoplay=1&rel=0`, title: 'Trailer: ' + v.nome,
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin' })));
  document.body.append(fundo);
  document.addEventListener('keydown', tecla);
  fundo.querySelector('button').focus();
}

const DATA = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const IDIOMA = (() => { try { return new Intl.DisplayNames(['pt-BR'], { type: 'language' }); } catch { return null; } })();

/** Linhas "Direção: …", "Elenco: …" etc. a partir dos detalhes. */
export function linhasDaFicha(d, titulo) {
  const filme = titulo.tipo === 'filme';
  const linhas = [];
  const add = (rotulo, valor) => { if (valor) linhas.push(h('div', { class: 'ficha-linha' }, h('dt', null, rotulo), h('dd', null, valor))); };
  add(filme ? 'Direção' : 'Criação', d.direcao && d.direcao.join(', '));
  add('Roteiro', d.roteiro && d.roteiro.join(', '));
  add('Elenco', d.elenco && d.elenco.join(', '));
  add('Classificação', d.classificacao ? h('span', null, h('b', { class: 'classif', 'data-c': d.classificacao }, d.classificacao === 'L' ? 'L' : d.classificacao), d.classificacao === 'L' ? ' livre' : ' anos') : '');
  add('Lançamento', d.lancamento && /^\d{4}-\d{2}-\d{2}$/.test(d.lancamento) ? DATA.format(new Date(d.lancamento + 'T00:00:00Z')) : '');
  const idioma = d.idioma && IDIOMA ? IDIOMA.of(d.idioma) : '';
  add('Origem', [(d.pais || []).join(', '), idioma ? 'idioma original: ' + idioma : ''].filter(Boolean).join(' · '));
  add('Produção', d.produtoras && d.produtoras.join(', '));
  return linhas;
}
