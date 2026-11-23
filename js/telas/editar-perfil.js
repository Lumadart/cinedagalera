import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo } from '../estado.js';
import { chamar } from '../api.js';
import { ajustarImagem } from '../imagem.js';
import { casca, esqueleto, avatar, banner, avisar, capa, normalizar, sair } from '../ui.js';

export function telaEditarPerfil({ raiz, ativa }) {
  const area = h('div', { class: 'editar' }, esqueleto('lista', 3));
  montar(raiz, casca('perfil', area));
  if (estado.catalogo) desenhar();
  carregarCatalogo().then(() => { if (ativa()) desenhar(); }).catch((e) => {
    if (ativa() && !estado.catalogo) montar(area, h('p', { class: 'erro' }, e.message));
  });

  // Guarda o que mudou no perfil, aqui e no catálogo em memória.
  function aplicar(membro) {
    Object.assign(estado.membro, membro);
    const x = estado.catalogo.membros.find((m) => m.id === membro.id);
    if (x) Object.assign(x, { nome: membro.nome, frase: membro.frase, avatar_url: membro.avatar_url, banner_url: membro.banner_url, banner_preset: membro.banner_preset });
  }

  function desenhar() {
    const eu = estado.membro;
    const previa = h('div', { class: 'previa' });
    const pintarPrevia = () => montar(previa,
      h('label', { class: 'editavel editavel-banner', for: 'foto-banner', title: 'Trocar banner' }, banner(eu), h('span', { class: 'editavel-dica' }, icone('editar', 18), 'Trocar banner')),
      h('label', { class: 'editavel editavel-avatar', for: 'foto-avatar', title: 'Trocar foto do perfil' }, avatar(eu, { tamanho: 92, cor: 'var(--ouro)' }), h('span', { class: 'editavel-dica' }, icone('editar', 18))));
    pintarPrevia();

    // ---- fotos
    const erroFoto = h('p', { class: 'erro', role: 'alert' });
    const enviar = (tipo, largura, altura) => async (e) => {
      const arquivo = e.target.files[0]; e.target.value = '';
      if (!arquivo) return;
      erroFoto.textContent = '';
      try {
        const dataUrl = await ajustarImagem(arquivo, largura, altura, { circulo: tipo === 'avatar', titulo: tipo === 'avatar' ? 'Ajustar foto do perfil' : 'Ajustar banner' });
        if (!dataUrl) return;
        avisar('Enviando a imagem…');
        const d = await chamar('enviar_foto', { tipo, base64: dataUrl });
        aplicar(d.membro); pintarPrevia(); avisar('Imagem atualizada!');
      } catch (err) { erroFoto.textContent = err.message; }
    };
    const arquivoAvatar = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr-only', id: 'foto-avatar', onchange: enviar('avatar', 400, 400) });
    const arquivoBanner = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr-only', id: 'foto-banner', onchange: enviar('banner', 1600, 400) });

    // ---- dados
    const nome = h('input', { id: 'nome', maxlength: '40', value: eu.nome });
    const frase = h('input', { id: 'frase', maxlength: '120', value: eu.frase || '', placeholder: 'Uma frase para o seu perfil' });
    const erroDados = h('p', { class: 'erro', role: 'alert' });
    const salvar = h('button', { type: 'submit', class: 'btn-primario' }, 'Salvar dados');
    const formDados = h('form', {
      class: 'card form-edicao', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault(); erroDados.textContent = '';
        salvar.disabled = true; salvar.textContent = 'Salvando…';
        try {
          const d = await chamar('atualizar_perfil', { nome: nome.value.trim(), frase: frase.value.trim() });
          aplicar(d.membro); pintarPrevia(); avisar('Perfil salvo!');
        } catch (err) { erroDados.textContent = err.message; }
        salvar.disabled = false; salvar.textContent = 'Salvar dados';
      }
    },
      h('h2', null, 'Dados do perfil'),
      h('label', { for: 'nome' }, 'Nome', nome),
      h('label', { for: 'frase' }, 'Frase', frase),
      erroDados, salvar);

    // ---- favoritos
    let escolhidos = estado.catalogo.favoritos.filter((f) => f.membro_id === eu.id).sort((a, b) => a.posicao - b.posicao).map((f) => f.titulo_id)
      .filter((id) => estado.catalogo.titulos.some((t) => t.id === id));
    const busca = h('input', { type: 'search', id: 'busca-fav', placeholder: 'Buscar no catálogo…', 'aria-label': 'Buscar título para favoritar', autocomplete: 'off', oninput: pintarFav });
    const selecionados = h('ol', { class: 'fav-escolhidos' });
    const opcoes = h('div', { class: 'fav-opcoes' });
    const erroFav = h('p', { class: 'erro', role: 'alert' });
    const salvarFav = h('button', { type: 'button', class: 'btn-primario', onclick: async () => {
      erroFav.textContent = '';
      salvarFav.disabled = true; salvarFav.textContent = 'Salvando…';
      try {
        await chamar('salvar_favoritos', { titulo_ids: escolhidos });
        estado.catalogo.favoritos = estado.catalogo.favoritos.filter((f) => f.membro_id !== eu.id)
          .concat(escolhidos.map((id, i) => ({ membro_id: eu.id, titulo_id: id, posicao: i + 1 })));
        avisar('Favoritos salvos!');
      } catch (err) { erroFav.textContent = err.message; }
      salvarFav.disabled = false; salvarFav.textContent = 'Salvar favoritos';
    } }, 'Salvar favoritos');
    const contador = h('p', { class: 'suave pequeno', role: 'status' });

    function mover(i, d) { const j = i + d; if (j < 0 || j >= escolhidos.length) return; [escolhidos[i], escolhidos[j]] = [escolhidos[j], escolhidos[i]]; pintarFav(); }
    // arrastar com o cursor (ponteiro: funciona com mouse e toque)
    function arrastar(e, i, cartao) {
      if (e.button !== undefined && e.button > 0) return;
      const itens = [...selecionados.children];
      const caixas = itens.map((el) => el.getBoundingClientRect());
      const ini = { x: e.clientX, y: e.clientY };
      let alvo = i, movendo = false;
      cartao.setPointerCapture(e.pointerId);
      const mexer = (ev) => {
        const dx = ev.clientX - ini.x, dy = ev.clientY - ini.y;
        if (!movendo && Math.hypot(dx, dy) < 6) return;
        movendo = true; cartao.classList.add('arrastando');
        cartao.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;
        const idx = caixas.findIndex((c) => ev.clientX >= c.left && ev.clientX <= c.right && ev.clientY >= c.top && ev.clientY <= c.bottom);
        alvo = idx >= 0 ? idx : alvo;
        itens.forEach((el, k) => el.classList.toggle('alvo', movendo && k === alvo && k !== i));
      };
      const soltar = () => {
        cartao.removeEventListener('pointermove', mexer);
        cartao.removeEventListener('pointerup', soltar);
        cartao.removeEventListener('pointercancel', soltar);
        if (movendo && alvo !== i) { const [x] = escolhidos.splice(i, 1); escolhidos.splice(alvo, 0, x); }
        pintarFav();
      };
      cartao.addEventListener('pointermove', mexer);
      cartao.addEventListener('pointerup', soltar);
      cartao.addEventListener('pointercancel', soltar);
    }
    function pintarFav() {
      const porId = Object.fromEntries(estado.catalogo.titulos.map((t) => [t.id, t]));
      contador.textContent = `${escolhidos.length} de 5 escolhidos` + (escolhidos.length < 3 ? ' (mínimo 3)' : '') + (escolhidos.length > 1 ? ' · arraste para reordenar' : '');
      salvarFav.disabled = escolhidos.length < 3 || escolhidos.length > 5;
      montar(selecionados, escolhidos.map((id, i) => {
        const cartao = h('li', { class: 'fav-card', tabindex: '0', 'aria-label': `${i + 1}º favorito: ${porId[id].nome}. Setas para a esquerda e direita reordenam.`,
          onpointerdown: (e) => { if (e.target.closest('button')) return; arrastar(e, i, cartao); },
          onkeydown: (e) => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); mover(i, -1); selecionados.children[Math.max(0, i - 1)].focus(); }
            if (e.key === 'ArrowRight') { e.preventDefault(); mover(i, 1); selecionados.children[Math.min(escolhidos.length - 1, i + 1)].focus(); }
          } },
          h('span', { class: 'posicao-fav' }, String(i + 1)),
          capa(porId[id]),
          h('span', { class: 'fav-nome' }, porId[id].nome),
          h('button', { type: 'button', class: 'fav-x', 'aria-label': 'Remover ' + porId[id].nome, onclick: () => { escolhidos = escolhidos.filter((x) => x !== id); pintarFav(); } }, '×'));
        return cartao;
      }));
      const q = normalizar(busca.value.trim());
      const lista = estado.catalogo.titulos.filter((t) => !escolhidos.includes(t.id) && (!q || normalizar(t.nome).includes(q))).slice(0, 24);
      montar(opcoes, lista.length ? lista.map((t) => h('button', { type: 'button', class: 'fav-opcao', disabled: escolhidos.length >= 5, 'aria-label': 'Adicionar ' + t.nome + ' aos favoritos',
        onclick: () => { escolhidos.push(t.id); pintarFav(); } }, capa(t), h('span', null, t.nome))) : h('p', { class: 'suave' }, 'Nenhum título encontrado.'));
    }
    pintarFav();

    const cartaoFotos = h('section', { class: 'card' },
      h('h2', null, 'Fotos'),
      previa, arquivoAvatar, arquivoBanner,
      h('p', { class: 'dica-fina' }, 'Passe o mouse sobre a imagem e clique para trocar. Foto: 400×400 · Banner: 1600×400 · JPG, PNG ou WebP. Você enquadra antes de enviar.'),
      erroFoto);
    const cartaoFavs = h('section', { class: 'card form-edicao' },
      h('h2', null, 'Títulos favoritos'),
      h('p', { class: 'suave' }, 'Escolha de 3 a 5 títulos do catálogo. A ordem aparece no seu perfil.'),
      estado.catalogo.titulos.length < 3 ? h('p', { class: 'suave' }, 'O catálogo ainda tem menos de 3 títulos. Adicione mais para escolher seus favoritos.') : null,
      selecionados, contador, busca, opcoes, erroFav, salvarFav);
    const cartaoSessao = h('section', { class: 'card sessao' },
      h('div', null, h('h2', null, 'Sessão'), h('p', { class: 'suave pequeno' }, 'Sair deste aparelho. Para entrar de novo você usa o e-mail e o PIN.')),
      h('button', { type: 'button', class: 'btn-sec', onclick: sair }, icone('sair', 18), 'Sair da conta'));

    montar(area,
      h('a', { class: 'voltar', href: '#/perfil' }, 'Voltar ao perfil'),
      h('h1', null, 'Editar perfil'),
      h('div', { class: 'editar-grade' },
        h('div', { class: 'coluna' }, cartaoFotos, formDados, cartaoSessao),
        h('div', { class: 'coluna' }, cartaoFavs)));
  }
}
