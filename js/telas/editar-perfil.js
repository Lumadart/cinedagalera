import { h, montar } from '../dom.js';
import { estado, carregarCatalogo } from '../estado.js';
import { chamar } from '../api.js';
import { prepararImagem } from '../imagem.js';
import { casca, avatar, banner, avisar, capa, normalizar, BANNERS, CORES_AVATAR } from '../ui.js';

export function telaEditarPerfil({ raiz, ativa }) {
  const area = h('div', { class: 'editar' }, h('p', { class: 'suave' }, 'Carregando…'));
  montar(raiz, casca('perfil', area));
  if (estado.catalogo) desenhar();
  carregarCatalogo().then(() => { if (ativa()) desenhar(); }).catch((e) => {
    if (ativa() && !estado.catalogo) montar(area, h('p', { class: 'erro' }, e.message));
  });

  // Guarda o que mudou no perfil, aqui e no catálogo em memória.
  function aplicar(membro) {
    Object.assign(estado.membro, membro);
    const x = estado.catalogo.membros.find((m) => m.id === membro.id);
    if (x) Object.assign(x, { nome: membro.nome, frase: membro.frase, avatar_cor: membro.avatar_cor, avatar_url: membro.avatar_url, banner_url: membro.banner_url, banner_preset: membro.banner_preset });
  }

  function desenhar() {
    const eu = estado.membro;
    const previa = h('div', { class: 'previa' });
    const pintarPrevia = () => montar(previa, banner(eu), h('div', { class: 'previa-avatar' }, avatar(eu, { tamanho: 84, cor: 'var(--ouro)' })));
    pintarPrevia();

    // ---- fotos
    const erroFoto = h('p', { class: 'erro', role: 'alert' });
    const enviar = (tipo, largura, altura) => async (e) => {
      const arquivo = e.target.files[0]; e.target.value = '';
      if (!arquivo) return;
      erroFoto.textContent = '';
      try {
        avisar('Enviando a imagem…');
        const dataUrl = await prepararImagem(arquivo, largura, altura);
        const d = await chamar('enviar_foto', { tipo, base64: dataUrl });
        aplicar(d.membro); pintarPrevia(); avisar('Imagem atualizada!');
      } catch (err) { erroFoto.textContent = err.message; }
    };
    const arquivoAvatar = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr-only', id: 'foto-avatar', onchange: enviar('avatar', 400, 400) });
    const arquivoBanner = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr-only', id: 'foto-banner', onchange: enviar('banner', 1200, 400) });

    // ---- dados
    const nome = h('input', { id: 'nome', maxlength: '40', value: eu.nome });
    const frase = h('input', { id: 'frase', maxlength: '120', value: eu.frase || '', placeholder: 'Uma frase para o seu perfil' });
    let cor = eu.avatar_cor;
    const botoesCor = CORES_AVATAR.map((c) => h('button', { type: 'button', class: 'amostra', style: { background: c }, 'aria-label': 'Cor ' + c, 'aria-pressed': String(c === cor), onclick: () => { cor = c; botoesCor.forEach((b) => b.setAttribute('aria-pressed', String(b === botaoDe(c)))); eu.avatar_cor = c; pintarPrevia(); } }));
    const botaoDe = (c) => botoesCor[CORES_AVATAR.indexOf(c)];
    let preset = eu.banner_preset;
    const botoesPreset = Object.entries(BANNERS).map(([k, g]) => h('button', { type: 'button', class: 'amostra larga', style: { background: g }, 'aria-label': 'Degradê ' + k, 'aria-pressed': String(!eu.banner_url && k === preset),
      onclick: async () => {
        try {
          const d = await chamar('atualizar_perfil', { banner_preset: k });
          aplicar(d.membro); preset = k; pintarPrevia();
          botoesPreset.forEach((b) => b.setAttribute('aria-pressed', String(b === botoesPreset[Object.keys(BANNERS).indexOf(k)])));
        } catch (err) { erroFoto.textContent = err.message; }
      } }));
    const erroDados = h('p', { class: 'erro', role: 'alert' });
    const salvar = h('button', { type: 'submit', class: 'btn-primario' }, 'Salvar dados');
    const formDados = h('form', {
      class: 'card form-edicao', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault(); erroDados.textContent = '';
        salvar.disabled = true; salvar.textContent = 'Salvando…';
        try {
          const d = await chamar('atualizar_perfil', { nome: nome.value.trim(), frase: frase.value.trim(), avatar_cor: cor });
          aplicar(d.membro); pintarPrevia(); avisar('Perfil salvo!');
        } catch (err) { erroDados.textContent = err.message; }
        salvar.disabled = false; salvar.textContent = 'Salvar dados';
      }
    },
      h('h2', null, 'Dados do perfil'),
      h('label', { for: 'nome' }, 'Nome', nome),
      h('label', { for: 'frase' }, 'Frase', frase),
      h('div', null, h('p', { class: 'rotulo' }, 'Cor do avatar (aparece quando você não tem foto)'), h('div', { class: 'amostras' }, botoesCor)),
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
    function pintarFav() {
      const porId = Object.fromEntries(estado.catalogo.titulos.map((t) => [t.id, t]));
      contador.textContent = `${escolhidos.length} de 5 escolhidos` + (escolhidos.length < 3 ? ' (mínimo 3)' : '');
      salvarFav.disabled = escolhidos.length < 3 || escolhidos.length > 5;
      montar(selecionados, escolhidos.map((id, i) => h('li', null,
        h('span', { class: 'posicao-fav' }, String(i + 1)), h('span', { class: 'fav-nome' }, porId[id].nome),
        h('button', { type: 'button', class: 'link-discreto', 'aria-label': 'Subir ' + porId[id].nome, onclick: () => mover(i, -1) }, '↑'),
        h('button', { type: 'button', class: 'link-discreto', 'aria-label': 'Descer ' + porId[id].nome, onclick: () => mover(i, 1) }, '↓'),
        h('button', { type: 'button', class: 'link-discreto', 'aria-label': 'Remover ' + porId[id].nome, onclick: () => { escolhidos = escolhidos.filter((x) => x !== id); pintarFav(); } }, 'remover'))));
      const q = normalizar(busca.value.trim());
      const lista = estado.catalogo.titulos.filter((t) => !escolhidos.includes(t.id) && (!q || normalizar(t.nome).includes(q))).slice(0, 24);
      montar(opcoes, lista.length ? lista.map((t) => h('button', { type: 'button', class: 'fav-opcao', disabled: escolhidos.length >= 5, 'aria-label': 'Adicionar ' + t.nome + ' aos favoritos',
        onclick: () => { escolhidos.push(t.id); pintarFav(); } }, capa(t), h('span', null, t.nome))) : h('p', { class: 'suave' }, 'Nenhum título encontrado.'));
    }
    pintarFav();

    montar(area,
      h('a', { class: 'voltar', href: '#/perfil' }, 'Voltar ao perfil'),
      h('h1', null, 'Editar perfil'),
      h('section', { class: 'card' },
        h('h2', null, 'Fotos'),
        previa,
        h('div', { class: 'linha-botoes' },
          h('label', { class: 'btn-sec', for: 'foto-avatar' }, 'Trocar foto do avatar'), arquivoAvatar,
          h('label', { class: 'btn-sec', for: 'foto-banner' }, 'Trocar banner'), arquivoBanner),
        h('div', null, h('p', { class: 'rotulo' }, 'Ou escolha um degradê para o banner'), h('div', { class: 'amostras' }, botoesPreset)),
        h('p', { class: 'suave pequeno' }, 'JPG, PNG ou WebP. A imagem é recortada e reduzida automaticamente.'), erroFoto),
      formDados,
      h('section', { class: 'card form-edicao' },
        h('h2', null, 'Títulos favoritos'),
        h('p', { class: 'suave' }, 'Escolha de 3 a 5 títulos do catálogo. A ordem aparece no seu perfil.'),
        estado.catalogo.titulos.length < 3 ? h('p', { class: 'suave' }, 'O catálogo ainda tem menos de 3 títulos. Adicione mais para escolher seus favoritos.') : null,
        selecionados, contador, busca, opcoes, erroFav, salvarFav)
    );
  }
}
