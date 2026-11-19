import { h, icone } from './dom.js';
import { chamar } from './api.js';
import { seguro } from './ui.js';

// Extras do TMDB na página do título: trailer, onde assistir, direção e elenco.
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

function ondeAssistir(s) {
  const grupo = (rotulo, lista) => lista.length ? h('div', { class: 'streaming-grupo' }, h('small', null, rotulo),
    h('ul', null, lista.map((p) => h('li', { title: p.nome },
      seguro(p.logo) ? h('img', { src: seguro(p.logo), alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : null, h('span', null, p.nome))))) : null;
  return h('div', { class: 'extra extra-onde' }, h('h2', null, 'Onde assistir'),
    grupo('Assinatura', s.assinatura), grupo('Alugar', s.aluguel), grupo('Comprar', s.compra),
    h('p', { class: 'suave pequeno' }, 'Disponibilidade no Brasil · dados de ',
      s.link ? h('a', { href: s.link, target: '_blank', rel: 'noopener noreferrer' }, 'JustWatch (via TMDB)') : 'JustWatch (via TMDB)'));
}

function elenco(d) {
  return h('div', { class: 'extra extra-elenco' },
    h('h2', null, 'Elenco'),
    d.direcao.length ? h('p', { class: 'direcao' }, h('span', null, d.direcao_rotulo), d.direcao.join(', ')) : null,
    h('ul', { class: 'elenco-lista' }, d.elenco.map((a) => h('li', { class: 'ator' },
      seguro(a.foto) ? h('img', { src: seguro(a.foto), alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' })
        : h('span', { class: 'ator-sem-foto', 'aria-hidden': 'true' }, a.nome.slice(0, 1)),
      h('strong', null, a.nome), a.personagem ? h('small', null, a.personagem) : null))));
}

/** Seção que aparece sozinha quando os dados chegam (e some se o TMDB não tiver nada ou falhar). */
export function extrasDoTitulo(titulo, ativa) {
  const secao = h('section', { class: 'tit-extras', hidden: true });
  const pronto = guardados.has(titulo.id) ? Promise.resolve(guardados.get(titulo.id))
    : chamar('detalhes_tmdb', { titulo_id: titulo.id }).then((d) => { guardados.set(titulo.id, d); return d; });
  pronto.then((d) => {
    if (!ativa()) return;
    const partes = [d.trailer ? trailer(d.trailer) : null, d.streaming ? ondeAssistir(d.streaming) : null,
      d.elenco.length || d.direcao.length ? elenco(d) : null].filter(Boolean);
    if (!partes.length) return;
    secao.append(...partes);
    secao.hidden = false;
  }).catch(() => {});   // extras são um bônus: se falhar, a página segue sem eles
  return secao;
}
