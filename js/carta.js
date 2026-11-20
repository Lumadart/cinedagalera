import { h } from './dom.js';
import { capa } from './ui.js';

// Carta misteriosa do sorteio + confete da revelação.
const reduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chuva de confete dourado a partir do alto da área. */
export function confete(area) {
  if (reduzido()) return;
  const cores = ['#F5B942', '#FFD883', '#F8EAD8', '#B7869A', '#EE8E62'];
  const caixa = h('div', { class: 'confete', 'aria-hidden': 'true' });
  for (let i = 0; i < 46; i++) {
    const p = h('span', { class: 'confete-p' });
    p.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
    p.style.setProperty('--dx', (Math.random() * 160 - 80).toFixed(0) + 'px');
    p.style.setProperty('--dy', (260 + Math.random() * 260).toFixed(0) + 'px');
    p.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
    p.style.setProperty('--atraso', (Math.random() * 0.35).toFixed(2) + 's');
    p.style.background = cores[i % cores.length];
    caixa.append(p);
  }
  area.append(caixa);
  setTimeout(() => caixa.remove(), 2600);
}

/**
 * Carta misteriosa: mostra só uma carta virada que treme, brilha e vira revelando o sorteado.
 * Não mostra nenhum outro título: só o sorteado aparece, no fim.
 */
export function criarCarta() {
  const capaEl = h('div', { class: 'carta-face carta-capa' });
  const giro = h('div', { class: 'carta-giro' },
    h('div', { class: 'carta-face carta-verso' }, h('img', { src: 'img/carta-verso.svg', alt: '', draggable: 'false' })),
    capaEl);
  const carta = h('div', { class: 'carta ocioso' }, giro);
  const clarao = h('span', { class: 'carta-clarao' });
  const el = h('div', { class: 'cena-carta', 'aria-hidden': 'true' }, clarao, carta);

  function ocioso() {
    giro.getAnimations().forEach((a) => a.cancel());
    carta.classList.remove('tremendo', 'venceu');
    carta.classList.add('ocioso');
    clarao.classList.remove('estourou');
  }

  async function girar(lista, final) {
    if (reduzido()) return;
    giro.getAnimations().forEach((a) => a.cancel());
    clarao.classList.remove('estourou');
    carta.classList.remove('ocioso', 'venceu');
    const foto = capa(final, true);
    foto.querySelector('img')?.setAttribute('loading', 'eager');
    capaEl.replaceChildren(foto);
    void carta.offsetWidth;                       // reinicia a animação de tremer
    carta.classList.add('tremendo');
    await espera(1250);
    carta.classList.remove('tremendo');
    clarao.classList.add('estourou');
    const virar = giro.animate(
      [{ transform: 'rotateY(0deg) scale(1)' }, { transform: 'rotateY(90deg) scale(1.12)' }, { transform: 'rotateY(180deg) scale(1.1)' }],
      { duration: 1000, easing: 'cubic-bezier(.3,.6,.2,1)', fill: 'forwards' });
    await virar.finished.catch(() => {});
    carta.classList.add('venceu');
    await espera(900);
  }

  return { el, ocioso, girar };
}
