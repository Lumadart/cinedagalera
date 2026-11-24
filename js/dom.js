// Monta elementos da página sem usar innerHTML. Tudo que vem do servidor (nomes,
// comentários, sinopses) entra como TEXTO, então não existe risco de código injetado.
export function h(tag, atributos, ...filhos) {
  const el = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos || {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (nome === 'class') el.className = valor;
    else if (nome === 'style') { for (const k in valor) { if (k.startsWith('--')) el.style.setProperty(k, valor[k]); else el.style[k] = valor[k]; } }
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
  seta: { d: 'M6 9l6 6 6-6' },
  voltar: { d: 'M15 5l-7 7 7 7' },
  inicio: { d: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
  grade: { d: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  amigos: { d: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3 3 0 010 5.6M18 14.2c2 .6 3.5 2.6 3.5 5.8' },
  calendario: { d: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4' },
  escudo: { d: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z' },
  sair: { d: 'M9 4H5v16h4M16 8l4 4-4 4M20 12H9' },
  editar: { d: 'M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16zM13.5 6.5l4 4' },
  fechar: { d: 'M6 6l12 12M18 6L6 18' },
  novo: { d: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z' },
  coracao: { d: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.6 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z' },
  dado: { d: 'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01' },
  musical: { d: 'M9 18V6l11-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z' },
  animacao: { d: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8.3 14.2c.9 1.3 2.1 2 3.7 2s2.8-.7 3.7-2M9 9.5h.01M15 9.5h.01' },
  standup: { d: 'M12 3a3 3 0 013 3v5a3 3 0 11-6 0V6a3 3 0 013-3zM6 11a6 6 0 0012 0M12 17v4M9 21h6' },
  miniserie: { d: 'M12 3l9 5-9 5-9-5 9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5' },
  relogio: { d: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3.2 2' },
  raio: { d: 'M13 3L5 13.5h6L10 21l8-10.5h-6z' },
  usuario: { d: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6' },
  cadeado: { d: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3' },
  olho: { d: 'M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z' },
  email: { d: 'M3.5 6h17v12h-17zM3.5 7l8.5 6.5L20.5 7' },
  chave: { d: 'M14 10a4 4 0 11-1.2-2.8L21 15v3h-3v-2h-2v-2h-2z' },
  estrela: { d: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.9z' }
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
