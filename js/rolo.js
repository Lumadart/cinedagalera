import { h, icone } from './dom.js';
import { capa } from './ui.js';

// Roleta horizontal de capas (estilo "abertura de caixa"): as capas correm,
// desaceleram e a escolhida para sob o marcador dourado.
const LARGURA = 112, FOLGA = 12, PASSO = LARGURA + FOLGA;
const TOTAL = 44, POSICAO_FINAL = 38;

const reduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sequência de `n` itens passando por todos antes de repetir (embaralha a cada volta), para a mesma capa não aparecer perto dela mesma. */
function sequencia(fonte, n) {
  const saida = [];
  let volta = [];
  while (saida.length < n) {
    if (!volta.length) {
      volta = [...fonte];
      for (let i = volta.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [volta[i], volta[j]] = [volta[j], volta[i]]; }
      if (saida.length && volta.length > 1 && volta[volta.length - 1] === saida[saida.length - 1]) volta.reverse();
    }
    saida.push(volta.pop());
  }
  return saida;
}

function ladrilho(item) {
  const el = h('div', { class: 'rolo-item' }, item ? capa(item) : h('div', { class: 'capa sem-imagem' }, icone('dado', 28)));
  el.querySelector('img')?.setAttribute('loading', 'eager');   // fora da tela, "lazy" deixaria buracos durante a corrida
  return el;
}

export function criarRolo() {
  const trilho = h('div', { class: 'rolo-trilho' });
  const janela = h('div', { class: 'rolo-janela' }, trilho);
  const el = h('div', { class: 'rolo', 'aria-hidden': 'true' }, janela, h('span', { class: 'rolo-marca' }));

  /** Capas passando devagar enquanto ninguém sorteou. Sem lista, mostra cartas em branco. */
  function ocioso(lista) {
    trilho.getAnimations().forEach((a) => a.cancel());
    trilho.style.transform = '';
    const base = lista && lista.length ? sequencia(lista, Math.min(14, Math.max(12, lista.length))) : Array.from({ length: 12 }, () => null);
    trilho.replaceChildren(...base.map(ladrilho), ...base.map(ladrilho));   // duas voltas: o laço fica contínuo
    trilho.classList.add('ocioso');
  }

  /** Gira e para em `final`. Resolve quando termina (ou na hora, se a pessoa evita animações). */
  async function girar(lista, final, duracao = 5200) {
    if (reduzido()) return;
    trilho.classList.remove('ocioso');
    trilho.getAnimations().forEach((a) => a.cancel());
    const outros = lista.filter((t) => t !== final && (t.id || t.tmdb_id) !== (final.id || final.tmdb_id));
    const fonte = outros.length ? outros : [final];
    const seq = sequencia(fonte, TOTAL);
    seq[POSICAO_FINAL] = final;
    const itens = seq.map(ladrilho);
    trilho.replaceChildren(...itens);
    const largura = janela.clientWidth || 600;
    const alvo = POSICAO_FINAL * PASSO + LARGURA / 2 - largura / 2 + (Math.random() * 60 - 30);
    const anim = trilho.animate(
      [{ transform: 'translateX(0)' }, { transform: `translateX(${-alvo}px)` }],
      { duration: duracao, easing: 'cubic-bezier(.08,.55,.12,1)', fill: 'forwards' });
    await anim.finished.catch(() => {});
    itens[POSICAO_FINAL].classList.add('venceu');
    await espera(750);
  }

  return { el, ocioso, girar };
}

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
