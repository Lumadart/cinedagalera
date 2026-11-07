// Monta elementos da página sem usar innerHTML. Tudo que vem do servidor (nomes,
// comentários, sinopses) entra como TEXTO, então não existe risco de código injetado.
export function h(tag, atributos, ...filhos) {
  const el = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos || {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (nome === 'class') el.className = valor;
    else if (nome === 'style') Object.assign(el.style, valor);
    else if (nome.startsWith('on') && typeof valor === 'function') el.addEventListener(nome.slice(2), valor);
    else if (valor === true) el.setAttribute(nome, '');
    else el.setAttribute(nome, String(valor));
  }
  adicionar(el, filhos);
  return el;
}

function adicionar(el, filhos) {
  for (const f of filhos.flat(Infinity)) {
    if (f === null || f === undefined || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
}

export function montar(el, ...filhos) {
  el.replaceChildren();
  adicionar(el, filhos);
}

const SVG = 'http://www.w3.org/2000/svg';
const ICONES = {
  mais: { d: 'M12 5v14M5 12h14' },
  check: { d: 'M5 12.5l4.5 4.5L19 7.5' },
  play: { d: 'M8 5.5l11 6.5-11 6.5z', cheio: true },
  marcador: { d: 'M7 4h10v16l-5-4-5 4z' },
  busca: { d: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4' },
  voltar: { d: 'M15 5l-7 7 7 7' },
  fechar: { d: 'M6 6l12 12M18 6L6 18' }
};

export function icone(nome, tamanho = 20) {
  const def = ICONES[nome];
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', tamanho);
  svg.setAttribute('height', tamanho);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', def.cheio ? 'currentColor' : 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', def.d);
  svg.append(path);
  return svg;
}
