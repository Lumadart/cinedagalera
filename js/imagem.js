import { h } from './dom.js';

// Abre a imagem escolhida e deixa a pessoa enquadrar (arrastar e dar zoom) antes de enviar.
// Devolve um JPEG já recortado e reduzido no tamanho final, ou null se ela cancelar.
export async function ajustarImagem(arquivo, largura, altura, { circulo = false, titulo = 'Ajustar imagem' } = {}) {
  if (!arquivo || !/^image\/(jpeg|png|webp)$/.test(arquivo.type)) throw new Error('Use uma imagem JPG, PNG ou WebP.');
  if (arquivo.size > 15 * 1024 * 1024) throw new Error('Essa imagem é grande demais. Escolha uma de até 15 MB.');
  let origem;
  try { origem = await createImageBitmap(arquivo); } catch (_) { throw new Error('Não foi possível abrir essa imagem.'); }
  const iw = origem.width, ih = origem.height;

  return new Promise((resolver) => {
    const dw = Math.min(circulo ? 320 : 720, window.innerWidth - 64);
    const dh = Math.round(dw * altura / largura);
    const base = Math.max(dw / iw, dh / ih);     // escala mínima: a imagem cobre o quadro
    let zoom = 1, cx = iw / 2, cy = ih / 2;       // cx, cy = ponto da imagem no centro do quadro

    const canvas = h('canvas', { width: dw, height: dh, class: 'ajuste-canvas' });
    const ctx = canvas.getContext('2d');
    const limitar = () => {
      const sc = base * zoom;
      cx = Math.min(iw - dw / 2 / sc, Math.max(dw / 2 / sc, cx));
      cy = Math.min(ih - dh / 2 / sc, Math.max(dh / 2 / sc, cy));
    };
    const pintar = () => {
      limitar();
      const sc = base * zoom;
      ctx.fillStyle = '#231b20'; ctx.fillRect(0, 0, dw, dh);
      ctx.drawImage(origem, dw / 2 - cx * sc, dh / 2 - cy * sc, iw * sc, ih * sc);
    };

    const quadro = h('div', { class: 'ajuste-quadro' + (circulo ? ' redondo' : ''), tabindex: '0', role: 'img',
      'aria-label': 'Prévia. Arraste para mover ou use as setas do teclado.', style: { width: dw + 'px', height: dh + 'px' } }, canvas);
    let arrasto = null;
    quadro.addEventListener('pointerdown', (e) => { arrasto = { x: e.clientX, y: e.clientY }; quadro.setPointerCapture(e.pointerId); quadro.classList.add('pegando'); });
    quadro.addEventListener('pointermove', (e) => {
      if (!arrasto) return;
      const sc = base * zoom;
      cx -= (e.clientX - arrasto.x) / sc; cy -= (e.clientY - arrasto.y) / sc;
      arrasto = { x: e.clientX, y: e.clientY }; pintar();
    });
    const soltar = () => { arrasto = null; quadro.classList.remove('pegando'); };
    quadro.addEventListener('pointerup', soltar); quadro.addEventListener('pointercancel', soltar);
    quadro.addEventListener('keydown', (e) => {
      const passo = 12 / (base * zoom);
      const mov = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[e.key];
      if (mov) { e.preventDefault(); cx += mov[0]; cy += mov[1]; pintar(); }
    });

    const controle = h('input', { type: 'range', min: '1', max: '4', step: '0.01', value: '1', id: 'ajuste-zoom', 'aria-label': 'Zoom',
      oninput: (e) => { zoom = Number(e.target.value); pintar(); } });

    const anterior = document.activeElement;
    const fundo = h('div', { class: 'modal-fundo' });
    const fechar = (resultado) => {
      document.removeEventListener('keydown', teclas);
      fundo.remove(); if (anterior && anterior.focus) anterior.focus();
      if (origem.close) origem.close();
      resolver(resultado);
    };
    const confirmar = () => {
      const saida = document.createElement('canvas');
      saida.width = largura; saida.height = altura;
      const k = largura / dw, sc = base * zoom * k;
      const c = saida.getContext('2d');
      c.fillStyle = '#231b20'; c.fillRect(0, 0, largura, altura);
      c.drawImage(origem, largura / 2 - cx * sc, altura / 2 - cy * sc, iw * sc, ih * sc);
      fechar(saida.toDataURL('image/jpeg', 0.88));
    };
    const teclas = (e) => { if (e.key === 'Escape') fechar(null); };
    document.addEventListener('keydown', teclas);

    fundo.append(h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
      h('h2', null, titulo),
      h('p', { class: 'suave pequeno' }, 'Arraste a imagem para enquadrar e use o zoom para aproximar. O resultado final terá ' + largura + ' × ' + altura + ' px.'),
      quadro,
      h('label', { for: 'ajuste-zoom' }, 'Zoom', controle),
      h('div', { class: 'linha-botoes fim' },
        h('button', { type: 'button', class: 'btn-sec', onclick: () => fechar(null) }, 'Cancelar'),
        h('button', { type: 'button', class: 'btn-primario', onclick: confirmar }, 'Usar esta imagem'))));
    document.body.append(fundo);
    pintar();
    quadro.focus();
  });
}
