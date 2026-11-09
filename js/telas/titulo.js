import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo, achaTitulo, statusDe, aplicarStatusLocal, removerStatusLocal } from '../estado.js';
import { chamar } from '../api.js';
import {
  casca, avatar, capa, avisar, ROTULOS, COR_STATUS, ORDEM_STATUS, tituloMeta, formatarNota, CATEGORIAS, CATEGORIAS_POR_TIPO, rotuloCategoria
} from '../ui.js';

export function telaTitulo({ raiz, ativa, params }) {
  if (estado.catalogo) {
    desenhar();
  } else {
    montar(raiz, casca('catalogo', h('p', { class: 'suave' }, 'Carregando…')));
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
    const linhas = estado.catalogo.status.filter((s) => s.titulo_id === t.id);
    const meu = statusDe(estado.membro.id, t.id);
    const notas = linhas.filter((s) => s.status === 'visto' && s.nota !== null).map((s) => s.nota);
    const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;

    const detalhes = [];
    if (t.tipo === 'filme' && t.duracao_min) detalhes.push(`${Math.floor(t.duracao_min / 60)}h${String(t.duracao_min % 60).padStart(2, '0')}min`);
    if (t.tipo === 'serie' && t.temporadas) detalhes.push(`${t.temporadas} ${t.temporadas === 1 ? 'temporada' : 'temporadas'}`);
    if (t.tipo === 'serie' && t.episodios) detalhes.push(`${t.episodios} episódios`);

    const conteudo = h('div', { class: 'pagina-titulo' },
      h('a', { class: 'voltar', href: '#/catalogo' }, icone('voltar', 18), 'Voltar ao catálogo'),
      h('section', { class: 'ficha' },
        h('div', { class: 'ficha-capa' }, capa(t)),
        h('div', { class: 'ficha-info' },
          h('div', { class: 'linha-pills' },
            h('span', { class: 'pill-tipo' }, rotuloCategoria(t)),
            h('span', { class: 'suave' }, [t.ano, ...detalhes].filter(Boolean).join(' · '))
          ),
          h('h1', null, t.nome),
          h('div', { class: 'notas-titulo' },
            t.nota_tmdb !== null ? h('span', { class: 'nota-bloco' }, h('small', null, 'TMDB'), h('strong', null, '★ ' + formatarNota(t.nota_tmdb))) : null,
            media !== null ? h('span', { class: 'nota-bloco' }, h('small', null, 'Galera'), h('strong', null, '★ ' + formatarNota(media))) : h('span', { class: 'suave pequeno' }, 'A galera ainda não avaliou')
          ),
          indicacao(t),
          t.generos.length ? h('div', { class: 'generos' }, t.generos.map((g) => h('span', { class: 'genero' }, g))) : null,
          h('div', { class: 'sinopse' }, h('h2', { class: 'mini' }, 'Sinopse'), h('p', null, t.sinopse || 'Sem sinopse disponível.'))
        )
      ),
      h('section', { class: 'duas-colunas' }, painelGrupo(t, linhas, membros, media), painelMeu(t, meu))
    );
    montar(raiz, casca('catalogo', conteudo));
  }

  function indicacao(t) {
    const quem = estado.catalogo.membros.find((m) => m.id === t.adicionado_por);
    const pode = t.adicionado_por === estado.membro.id || estado.membro.admin;
    return h('div', { class: 'indicacao' },
      quem ? h('p', null, 'Indicado por ', h('strong', null, quem.nome), t.recado ? ': ' : '', t.recado ? h('em', null, '“' + t.recado + '”') : '') : null,
      pode ? h('button', { type: 'button', class: 'link-discreto', onclick: (e) => editarTitulo(e.currentTarget.parentElement, t) }, 'Editar categoria e recado') : null
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

  function painelGrupo(t, linhas, membros, media) {
    const porMembro = Object.fromEntries(linhas.map((s) => [s.membro_id, s]));
    const ordenados = membros.slice().sort((a, b) => {
      const sa = porMembro[a.id], sb = porMembro[b.id];
      const oa = sa ? ORDEM_STATUS[sa.status] : 9, ob = sb ? ORDEM_STATUS[sb.status] : 9;
      return oa - ob || a.nome.localeCompare(b.nome, 'pt-BR');
    });
    return h('div', { class: 'card grupo' },
      h('div', { class: 'titulo-linha pequeno' },
        h('h2', null, 'Status do grupo'),
        media !== null ? h('p', { class: 'media' }, 'Média do grupo: ', h('strong', null, '★ ' + formatarNota(media))) : null
      ),
      h('ul', { class: 'lista-membros' }, ordenados.map((m) => {
        const s = porMembro[m.id];
        const cor = s ? COR_STATUS[s.status] : 'var(--borda2)';
        const prog = s && t.tipo === 'serie' && s.temporada_atual && s.episodio_atual ? `T${s.temporada_atual} · E${s.episodio_atual}` : '';
        return h('li', { class: 'membro-linha' + (s ? '' : ' sem-status') },
          avatar(m, { tamanho: 40, cor }),
          h('div', { class: 'membro-info' },
            h('div', { class: 'membro-topo' },
              h('strong', null, m.nome + (m.id === estado.membro.id ? ' (você)' : '')),
              s ? h('span', { class: 'pill-status', style: { color: cor, borderColor: cor } }, ROTULOS[s.status]) : h('span', { class: 'suave' }, 'Ainda não marcou'),
              prog ? h('span', { class: 'suave' }, prog) : null
            ),
            s && s.comentario ? h('p', { class: 'comentario' }, s.comentario) : null
          ),
          s && s.nota !== null ? h('span', { class: 'nota' }, '★ ' + formatarNota(s.nota)) : null
        );
      }))
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
    }

    const grupoStatus = h('div', { class: 'grupo-chips' }, ['quero_ver', 'assistindo', 'visto'].map((st) => {
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
      class: 'card painel', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        erro.textContent = '';
        if (!escolhido) { erro.textContent = 'Escolha um status: quero ver, assistindo ou visto.'; return; }
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
      h('h2', null, 'Meu painel'),
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
      h('div', { class: 'bloco' }, h('label', { for: 'nota', class: 'rotulo' }, 'Minha nota (0 a 10)'), nota),
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
