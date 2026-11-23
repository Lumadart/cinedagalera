import { h, montar, icone } from '../../dom.js';
import { chamar } from '../../api.js';
import { avisar } from '../../ui.js';
import { ajustarImagem } from '../../imagem.js';
import { carregarAparencia } from '../../aparencia.js';

/** Aba "Aparência": troca as imagens de fundo das páginas sem mexer no GitHub. */
export async function abaAparencia({ painel, ativa }) {
  montar(painel, h('p', { class: 'suave' }, 'Carregando…'));
  let lugares;
  try { lugares = (await chamar('admin_aparencia')).lugares; } catch (e) { if (ativa()) montar(painel, h('p', { class: 'erro' }, e.message)); return; }
  if (!ativa()) return;

  const grade = h('div', { class: 'apar-grupos' });

  async function aplicar(pedido, mensagem) {
    try {
      lugares = (await chamar('admin_aparencia_salvar', pedido)).lugares;
      carregarAparencia({ forcar: true });
      avisar(mensagem);
      pintar();
    } catch (e) { avisar(e.message, 'erro'); }
  }

  async function trocar(l, arquivo) {
    const [w, a] = l.dica.split('×').map(Number);
    let imagem;
    try { imagem = await ajustarImagem(arquivo, w, a, { titulo: l.rotulo, qualidade: 0.82 }); }
    catch (e) { avisar(e.message, 'erro'); return; }
    if (!imagem) return;
    await aplicar({ lugar: l.chave, imagem }, 'Imagem atualizada.');
  }

  function cartao(l) {
    const entrada = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr-only', tabindex: '-1',
      onchange: (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) trocar(l, f); } });
    const [w, a] = l.dica.split('×').map(Number);
    return h('article', { class: 'apar-cartao' },
      h('div', { class: 'apar-previa', style: { aspectRatio: `${w} / ${a}` } },
        l.url ? h('img', { src: l.url, alt: 'Imagem atual: ' + l.rotulo, loading: 'lazy', decoding: 'async' })
              : h('span', { class: 'suave pequeno' }, 'Sem imagem · mostra só o degradê')),
      h('div', { class: 'apar-info' },
        h('strong', null, l.rotulo), h('span', { class: 'suave pequeno' }, 'Tamanho ideal ' + l.dica.replace('×', ' × ') + ' px'),
        h('div', { class: 'acoes' },
          h('button', { type: 'button', class: 'btn-sec', onclick: () => entrada.click() }, icone('novo', 16), l.url ? 'Trocar imagem' : 'Escolher imagem'),
          l.url ? h('button', { type: 'button', class: 'btn-sec perigo', onclick: () => {
            if (confirm(`Remover a imagem de “${l.rotulo}”? A página volta a mostrar só o degradê.`)) aplicar({ lugar: l.chave, remover: true }, 'Imagem removida.');
          } }, 'Remover') : null,
          entrada)));
  }

  function pintar() {
    const grupos = [...new Set(lugares.map((l) => l.grupo))];
    montar(grade, grupos.map((g) => h('section', { class: 'apar-grupo' },
      h('h3', null, g),
      h('div', { class: 'apar-lista' }, lugares.filter((l) => l.grupo === g).map(cartao)))));
  }

  montar(painel,
    h('p', { class: 'suave' }, 'Escolha as imagens de fundo das páginas. Você enquadra a imagem antes de salvar e ela aparece para todo mundo na hora. A imagem do Entrar é pública (aparece antes do login), então use só arte decorativa.'),
    grade);
  pintar();
}
