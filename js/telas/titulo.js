import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo, achaTitulo, statusDe, aplicarStatusLocal, removerStatusLocal } from '../estado.js';
import { chamar } from '../api.js';
import {
  casca, esqueleto, avatar, capa, fundoImg, avisar, ROTULOS, COR_STATUS, ORDEM_STATUS, tituloMeta, formatarNota, CATEGORIAS, CATEGORIAS_POR_TIPO, rotuloCategoria
} from '../ui.js';

export function telaTitulo({ raiz, ativa, params }) {
  if (estado.catalogo) {
    desenhar();
  } else {
    montar(raiz, casca('catalogo', esqueleto('lista', 4)));
    carregarCatalogo()
      .then(() => { if (ativa()) desenhar(); })
      .catch((e) => {
        if (!ativa()) return;
        montar(raiz, casca('catalogo', h('div', { class: 'estado-vazio' },
          h('p', { class: 'erro' }, e.message), h('a', { class: 'btn-sec', href: '#/catalogo' }, 'Voltar ao catálogo'))));
      });
  }

  function desenhar() {
    const t = achaTitulo(params.id);
    if (!t) {
      montar(raiz, casca('catalogo', h('div', { class: 'estado-vazio' },
        h('p', null, 'Não encontramos este título.'), h('a', { class: 'btn-sec', href: '#/catalogo' }, 'Voltar ao catálogo'))));
      return;
    }
    document.title = t.nome + ' · Cine Arkham';

    const membros = estado.catalogo.membros;
    const ativos = new Set(membros.map((m) => m.id));
    const linhas = estado.catalogo.status.filter((s) => s.titulo_id === t.id && ativos.has(s.membro_id));
    const meu = statusDe(estado.membro.id, t.id);
    const notas = linhas.filter((s) => s.status !== 'quero_ver' && s.nota !== null).map((s) => s.nota);
    const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;

    const detalhes = [];
    if (t.tipo === 'filme' && t.duracao_min) detalhes.push(`${Math.floor(t.duracao_min / 60)}h${String(t.duracao_min % 60).padStart(2, '0')}min`);
    if (t.tipo === 'serie' && t.temporadas) detalhes.push(`${t.temporadas} ${t.temporadas === 1 ? 'temporada' : 'temporadas'}`);
    if (t.tipo === 'serie' && t.episodios) detalhes.push(`${t.episodios} episódios`);

    const contagem = { visto: 0, assistindo: 0, quero_ver: 0, abandonado: 0 };
    linhas.forEach((s) => { contagem[s.status] += 1; });

    const conteudo = h('div', { class: 'pagina-titulo' },
      h('a', { class: 'voltar', href: '#/catalogo' }, icone('voltar', 18), 'Voltar ao catálogo'),
      h('section', { class: 'tit-hero' },
        fundoImg(t, 'tit-fundo'),
        h('div', { class: 'tit-topo' },
          h('div', { class: 'tit-capa' }, capa(t)),
          h('div', { class: 'tit-info' },
            h('div', { class: 'linha-pills' },
              h('span', { class: 'pill-tipo' }, rotuloCategoria(t)),
              [t.ano, ...detalhes].filter(Boolean).map((x) => h('span', { class: 'meta-chip' }, x))
            ),
            h('h1', null, t.nome),
            nomesExtras(t),
            t.generos.length ? h('div', { class: 'generos' }, t.generos.map((g) => h('span', { class: 'genero' }, g))) : null,
            sinopse(t)
          )
        ),
        h('div', { class: 'tit-stats' },
          h('div', { class: 'tile' }, h('small', null, 'Nota TMDB'),
            t.nota_tmdb !== null ? h('strong', { class: 'grande' }, '★ ' + formatarNota(t.nota_tmdb)) : h('span', { class: 'suave' }, '—')),
          h('div', { class: 'tile' }, h('small', null, 'Média da galera'),
            media !== null ? h('strong', { class: 'grande' }, '★ ' + formatarNota(media)) : h('span', { class: 'suave' }, 'sem notas ainda'),
            media !== null ? h('span', { class: 'suave pequeno' }, `${notas.length} ${notas.length === 1 ? 'nota' : 'notas'}`) : null),
          h('div', { class: 'tile tile-contagem' }, h('small', null, 'Na galera'),
            h('div', { class: 'contagem-linha' }, ['visto', 'assistindo', 'quero_ver', 'abandonado'].filter((k) => contagem[k]).map((k) =>
              h('span', { class: 'cont' }, h('i', { class: 'ponto', style: { background: COR_STATUS[k] } }), h('b', null, String(contagem[k])), ' ' + ROTULOS[k].toLowerCase())),
              linhas.length ? null : h('span', { class: 'suave' }, 'Ninguém marcou ainda'))),
          h('div', { class: 'tile tile-indicacao' }, indicacao(t))
        )
      ),
      h('section', { class: 'tit-corpo' }, painelGrupo(t, linhas, membros, contagem), painelMeu(t, meu))
    );
    montar(raiz, casca('catalogo', conteudo));
  }

  function sinopse(t) {
    const texto = t.sinopse || 'Sem sinopse disponível.';
    const longa = texto.length > 330;
    const p = h('p', { class: 'sinopse-texto' + (longa ? ' recortada' : '') }, texto);
    return h('div', { class: 'sinopse' }, p,
      longa ? h('button', { type: 'button', class: 'link-discreto', onclick: (e) => {
        const aberta = p.classList.toggle('recortada') === false;
        e.currentTarget.textContent = aberta ? 'Mostrar menos' : 'Ler mais';
      } }, 'Ler mais') : null);
  }

  function nomesExtras(t) {
    const itens = [];
    if (t.titulo_original) itens.push(['Título original', t.titulo_original]);
    const outros = t.outros_titulos || [];
    if (outros.length) {
      const resto = outros.slice(2);
      const caixa = h('p', { class: 'nome-extra' }, h('span', null, 'Também chamado de'), outros.slice(0, 2).join(' · '));
      if (resto.length) {
        const mais = h('span', { class: 'mais-nomes', hidden: true }, ' · ' + resto.join(' · '));
        caixa.append(mais, h('button', { type: 'button', class: 'link-discreto', onclick: (e) => {
          mais.hidden = !mais.hidden; e.currentTarget.textContent = mais.hidden ? `+${resto.length}` : 'menos';
        } }, `+${resto.length}`));
      }
      itens.push(caixa);
    }
    return h('div', { class: 'nomes' }, itens.map((x) => Array.isArray(x) ? h('p', { class: 'nome-extra' }, h('span', null, x[0]), x[1]) : x));
  }

  function indicacao(t) {
    const quem = estado.catalogo.membros.find((m) => m.id === t.adicionado_por);
    const pode = t.adicionado_por === estado.membro.id || estado.membro.admin;
    return h('div', { class: 'indicacao' },
      h('small', null, 'Indicado por'),
      h('div', { class: 'indicador' },
        quem ? avatar(quem, { tamanho: 36 }) : null,
        h('div', { class: 'indicador-texto' },
          h('strong', null, quem ? quem.nome : '—'),
          t.recado ? h('em', null, '“' + t.recado + '”') : null),
        pode ? h('button', { type: 'button', class: 'btn-mini', title: 'Editar categoria e recado', 'aria-label': 'Editar categoria e recado',
          onclick: (e) => { const tile = e.currentTarget.closest('.tile'); if (tile) tile.classList.add('editando'); editarTitulo(e.currentTarget.closest('.indicacao'), t); } }, icone('editar', 14)) : null
      )
    );
  }

  function editarTitulo(caixa, t) {
    const cat = h('select', { id: 'edit-cat', 'aria-label': 'Categoria' },
      CATEGORIAS_POR_TIPO[t.tipo].map((c) => h('option', { value: c }, CATEGORIAS[c])));
    cat.value = t.categoria;
    const rec = h('input', { id: 'edit-recado', maxlength: '200', value: t.recado, placeholder: 'Recado (opcional)' });
    const erro = h('p', { class: 'erro', role: 'alert' });
    montar(caixa, h('form', {
      class: 'edita', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          const d = await chamar('atualizar_titulo', { titulo_id: t.id, categoria: cat.value, recado: rec.value.trim() });
          Object.assign(achaTitulo(t.id), d.titulo);
          avisar('Título atualizado.'); desenhar();
        } catch (err) { erro.textContent = err.message; }
      }
    }, h('label', { for: 'edit-cat' }, 'Categoria', cat), h('label', { for: 'edit-recado' }, 'Recado', rec), erro,
      h('div', { class: 'linha-botoes' }, h('button', { type: 'submit', class: 'btn-primario' }, 'Salvar'),
        h('button', { type: 'button', class: 'btn-sec', onclick: desenhar }, 'Cancelar'))));
  }

  function painelGrupo(t, linhas, membros, contagem) {
    const porMembro = Object.fromEntries(linhas.map((s) => [s.membro_id, s]));
    const marcaram = membros.filter((m) => porMembro[m.id]).sort((a, b) =>
      ORDEM_STATUS[porMembro[a.id].status] - ORDEM_STATUS[porMembro[b.id].status] || a.nome.localeCompare(b.nome, 'pt-BR'));
    const faltam = membros.filter((m) => !porMembro[m.id]).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const barra = linhas.length ? h('div', { class: 'barra-grupo', role: 'img', 'aria-label': 'Distribuição dos status do grupo' },
      ['visto', 'assistindo', 'quero_ver', 'abandonado'].filter((k) => contagem[k]).map((k) =>
        h('span', { style: { flex: String(contagem[k]), background: COR_STATUS[k] }, title: `${contagem[k]} ${ROTULOS[k].toLowerCase()}` })),
      faltam.length ? h('span', { class: 'resto', style: { flex: String(faltam.length) }, title: faltam.length + ' sem marcar' }) : null) : null;

    const cartaoMembro = (m) => {
      const s = porMembro[m.id];
      const cor = COR_STATUS[s.status];
      const prog = t.tipo === 'serie' && s.temporada_atual && s.episodio_atual ? `Temporada ${s.temporada_atual} · episódio ${s.episodio_atual}` : '';
      const comentario = s.comentario ? [
        h('blockquote', { class: 'comentario' }, s.comentario),
        estado.membro.admin && m.id !== estado.membro.id ? h('button', { type: 'button', class: 'link-discreto', onclick: async (e) => {
          if (!confirm('Apagar este comentário? A nota é mantida.')) return;
          try {
            await chamar('admin_limpar_comentario', { titulo_id: t.id, membro_id: m.id });
            s.comentario = ''; const q = e.target.previousElementSibling; if (q) q.remove(); e.target.remove(); avisar('Comentário apagado.');
          } catch (err) { avisar(err.message, 'erro'); }
        } }, 'Apagar comentário (moderação)') : null] : [];
      return h('li', { class: 'mb-card', style: { '--cor': cor } },
        h('div', { class: 'mb-topo' },
          avatar(m, { tamanho: 44, cor }),
          h('div', { class: 'mb-quem' },
            h('strong', null, m.nome + (m.id === estado.membro.id ? ' (você)' : '')),
            h('span', { class: 'pill-status', style: { color: cor, borderColor: cor } }, ROTULOS[s.status])),
          s.nota !== null ? h('span', { class: 'mb-nota' }, h('small', null, 'nota'), '★ ' + formatarNota(s.nota)) : null),
        prog ? h('p', { class: 'mb-prog' }, prog) : null,
        ...comentario);
    };

    return h('div', { class: 'grupo-painel' },
      h('div', { class: 'grupo-topo' },
        h('h2', null, h('span', { class: 'ico-ouro' }, icone('amigos', 20)), 'A galera'),
        linhas.length ? h('span', { class: 'suave' }, `${linhas.length} de ${membros.length} já marcaram`) : null),
      barra,
      marcaram.length ? h('ul', { class: 'mb-grade' }, marcaram.map(cartaoMembro)) : h('p', { class: 'suave' }, 'Ninguém marcou este título ainda. Seja a primeira pessoa!'),
      faltam.length && marcaram.length ? h('div', { class: 'faltam' }, h('small', null, 'Ainda não marcaram'),
        h('div', { class: 'faltam-avatares' }, faltam.map((m) => h('span', { class: 'faltam-item', title: m.nome }, avatar(m, { tamanho: 30 }), h('span', null, m.nome))))) : null
    );
  }

  function painelMeu(t, meu) {
    let escolhido = meu ? meu.status : null;
    const botoes = {};
    const erro = h('p', { class: 'erro', role: 'alert' });
    const serie = t.tipo === 'serie';

    const campo = (id, valor, props = {}) => h('input', { id, type: 'number', inputmode: 'numeric', value: valor === null || valor === undefined ? '' : valor, ...props });
    const temporada = serie ? campo('temporada', meu && meu.temporada_atual, { min: '1', max: '100', step: '1' }) : null;
    const episodio = serie ? campo('episodio', meu && meu.episodio_atual, { min: '1', max: '5000', step: '1' }) : null;
    const nota = campo('nota', meu && meu.nota, { min: '0', max: '10', step: '0.5', inputmode: 'decimal' });
    const avisoNota = h('p', { class: 'suave pequeno', hidden: true }, 'A nota fica disponível depois que você começar a assistir.');
    const comentario = h('textarea', { id: 'comentario', rows: '4', maxlength: '1000', placeholder: 'O que você achou?' }, meu ? meu.comentario : '');

    function marcar(status) {
      escolhido = status;
      Object.entries(botoes).forEach(([k, b]) => {
        const ligado = k === status;
        b.setAttribute('aria-pressed', ligado ? 'true' : 'false');
        b.classList.toggle('ligado', ligado);
        b.style.borderColor = ligado ? COR_STATUS[k] : '';
        b.style.background = ligado ? COR_STATUS[k] : '';
      });
      const pode = status === 'assistindo' || status === 'visto' || status === 'abandonado';
      nota.disabled = !pode;
      if (!pode) nota.value = '';
      avisoNota.hidden = pode;
    }

    const grupoStatus = h('div', { class: 'grupo-chips' }, ['quero_ver', 'assistindo', 'visto', 'abandonado'].map((st) => {
      botoes[st] = h('button', { type: 'button', class: 'chip-status', 'aria-pressed': 'false', onclick: () => marcar(st) }, ROTULOS[st]);
      return botoes[st];
    }));

    const proximo = serie ? h('button', {
      type: 'button', class: 'btn-sec',
      onclick: () => {
        const tp = parseInt(temporada.value, 10), ep = parseInt(episodio.value, 10);
        if (!tp || !ep) { temporada.value = 1; episodio.value = 1; } else { episodio.value = ep + 1; }
        if (escolhido !== 'visto') marcar('assistindo');
      }
    }, '+ Próximo episódio') : null;

    const salvar = h('button', { type: 'submit', class: 'btn-primario cheio' }, 'Salvar');

    const form = h('form', {
      class: 'painel painel-discreto', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        erro.textContent = '';
        if (!escolhido) { erro.textContent = 'Escolha um status: quero ver, assistindo, visto ou abandonado.'; return; }
        const n = nota.value.trim() === '' ? '' : Number(String(nota.value).replace(',', '.'));
        if (n !== '' && (!isFinite(n) || n < 0 || n > 10)) { erro.textContent = 'A nota vai de 0 a 10.'; return; }
        const dados = { titulo_id: t.id, status: escolhido, nota: n, comentario: comentario.value.trim() };
        if (serie) {
          dados.temporada_atual = temporada.value.trim() === '' ? '' : Number(temporada.value);
          dados.episodio_atual = episodio.value.trim() === '' ? '' : Number(episodio.value);
        }
        salvar.disabled = true; salvar.textContent = 'Salvando…';
        try {
          await chamar('marcar_status', dados);
          aplicarStatusLocal(estado.membro.id, t.id, {
            status: escolhido, nota: n === '' ? null : n, comentario: dados.comentario,
            temporada_atual: serie && dados.temporada_atual !== '' ? dados.temporada_atual : null,
            episodio_atual: serie && dados.episodio_atual !== '' ? dados.episodio_atual : null,
            visto_em: escolhido === 'visto' ? ((meu && meu.visto_em) || new Date().toISOString()) : ''
          });
          avisar('Salvo!');
          desenhar();
        } catch (err) {
          erro.textContent = err.message;
          salvar.disabled = false; salvar.textContent = 'Salvar';
        }
      }
    },
      h('h2', { class: 'mini' }, 'Meu painel'),
      h('div', { class: 'bloco' }, h('p', { class: 'rotulo' }, 'Meu status'), grupoStatus),
      serie ? h('div', { class: 'bloco' },
        h('p', { class: 'rotulo' }, 'Andamento'),
        h('div', { class: 'linha-campos' },
          h('label', { for: 'temporada' }, 'Temporada', temporada),
          h('label', { for: 'episodio' }, 'Episódio', episodio)
        ),
        proximo,
        h('p', { class: 'suave pequeno' }, 'Terminou a temporada? Aumente a temporada e volte o episódio para 1.')
      ) : null,
      h('div', { class: 'bloco' }, h('label', { for: 'nota', class: 'rotulo' }, 'Minha nota (0 a 10)'), nota, avisoNota),
      h('div', { class: 'bloco' }, h('label', { for: 'comentario', class: 'rotulo' }, 'Meu comentário'), comentario),
      erro, salvar,
      meu ? h('button', {
        type: 'button', class: 'link-discreto centro',
        onclick: async () => {
          try {
            await chamar('remover_status', { titulo_id: t.id });
            removerStatusLocal(estado.membro.id, t.id);
            avisar('Título removido da sua lista.');
            desenhar();
          } catch (err) { avisar(err.message, 'erro'); }
        }
      }, 'Tirar da minha lista') : null
    );
    marcar(escolhido);
    return form;
  }
}
