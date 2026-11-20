import { h, icone } from './dom.js';
import { chamar } from './api.js';

// Extras do TMDB na página do título: só o trailer. O link para o TMDB é montado sem consultar nada.
const guardados = new Map();

function trailer(v) {
  const caixa = h('div', { class: 'extra-trailer' });
  const botao = h('button', { type: 'button', class: 'trailer-capa', 'aria-label': 'Assistir ao trailer: ' + v.nome },
    h('img', { src: `https://i.ytimg.com/vi/${v.chave}/hqdefault.jpg`, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }),
    h('span', { class: 'trailer-play' }, icone('play', 30)));
  // só carrega o player do YouTube quando a pessoa pede (mais leve e mais privado)
  botao.onclick = () => caixa.replaceChildren(h('iframe', {
    src: `https://www.youtube-nocookie.com/embed/${v.chave}?autoplay=1&rel=0`, title: 'Trailer: ' + v.nome,
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin'
  }));
  caixa.append(botao);
  return h('div', { class: 'extra extra-video' }, h('h2', null, 'Trailer'), caixa);
}

/** Link para a página do título no TMDB (elenco, onde assistir, fotos e mais). */
export function linkTmdb(titulo) {
  if (!titulo.tmdb_id) return null;
  return h('a', { class: 'link-tmdb', href: `https://www.themoviedb.org/${titulo.tipo === 'filme' ? 'movie' : 'tv'}/${titulo.tmdb_id}?language=pt-BR`,
    target: '_blank', rel: 'noopener noreferrer' }, 'Ver mais informações no TMDB ↗');
}

/** Seção que aparece sozinha quando o trailer chega (e some se não houver ou se falhar). */
export function extrasDoTitulo(titulo, ativa) {
  const secao = h('section', { class: 'tit-extras', hidden: true });
  const pronto = guardados.has(titulo.id) ? Promise.resolve(guardados.get(titulo.id))
    : chamar('detalhes_tmdb', { titulo_id: titulo.id }).then((d) => { guardados.set(titulo.id, d); return d; });
  pronto.then((d) => {
    if (!ativa() || !d.trailer) return;
    secao.append(trailer(d.trailer));
    secao.hidden = false;
  }).catch(() => {});   // o trailer é um bônus: se falhar, a página segue sem ele
  return secao;
}
