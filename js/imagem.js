// Prepara uma foto escolhida pela pessoa: recorta no centro, reduz e converte para JPEG.
// Assim o envio fica leve (dezenas de KB) mesmo com fotos grandes de celular.
export async function prepararImagem(arquivo, largura, altura) {
  if (!arquivo || !/^image\/(jpeg|png|webp)$/.test(arquivo.type)) throw new Error('Use uma imagem JPG, PNG ou WebP.');
  if (arquivo.size > 15 * 1024 * 1024) throw new Error('Essa imagem é grande demais. Escolha uma de até 15 MB.');
  let origem;
  try { origem = await createImageBitmap(arquivo); } catch (_) { throw new Error('Não foi possível abrir essa imagem.'); }
  const canvas = document.createElement('canvas');
  canvas.width = largura; canvas.height = altura;
  const ctx = canvas.getContext('2d');
  const escala = Math.max(largura / origem.width, altura / origem.height);
  const w = origem.width * escala, hh = origem.height * escala;
  ctx.fillStyle = '#241624'; ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(origem, (largura - w) / 2, (altura - hh) / 2, w, hh);
  if (origem.close) origem.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
