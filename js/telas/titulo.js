import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo, achaTitulo, statusDe, aplicarStatusLocal, removerStatusLocal } from '../estado.js';
import { chamar } from '../api.js';
import { casca, esqueleto, avatar, capa, fundoImg, avisar, ROTULOS, COR_STATUS, ORDEM_STATUS, formatarNota, CATEGORIAS, CATEGORIAS_POR_TIPO, duracaoTitulo } from '../ui.js';
import { dropdown } from '../dropdown.js';
import { carregarEventos, exibicaoDe } from '../eventos.js';
import { detalhesTmdb, abrirTrailer, linkTmdb, dadosDaFicha } from '../extras-titulo.js';

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

    const contagem = { visto: 0, assistindo: 0, quero_ver: 0, abandonado: 0 };
    linhas.forEach((s) => { contagem[s.status] += 1; });

    // ----- hero: tudo o que sabemos do título, escrito ali mesmo -----
    const linhaFicha = (rotulo, conteudoDd) => {
      const dd = h('dd', null, conteudoDd || '');
      const linha = h('div', { class: 'ficha-linha', hidden: !conteudoDd }, h('dt', null, rotulo + ':'), dd);
      return { linha, preencher: (texto) => { if (!texto) return; dd.textContent = texto; linha.hidden = false; } };
    };
    const fDirecao = linhaFicha(t.tipo === 'filme' ? 'Direção' : 'Criação');
    const fRoteiro = linhaFicha('Roteiro');
    const fElenco = linhaFicha('Elenco');
    const fProducao = linhaFicha('Distribuição');
    const generosLinha = t.generos.length ? h('div', { class: 'ficha-linha' }, h('dt', null, 'Gêneros:'),
      h('dd', { class: 'generos-links' }, t.generos.map((g, i) => [i ? ', ' : '', h('a', { href: '#/catalogo', onclick: () => { estado.filtro.categoria = 'todos'; estado.filtro.genero = g; estado.filtro.busca = ''; } }, g)]))) : null;
    const trailerSlot = h('span', { class: 'trailer-slot' });
    const classifSlot = h('div', { class: 'tit-classif', hidden: true });
    const votosTmdb = h('span', { class: 'suave pequeno' });
    const exibSlot = h('p', { class: 'tit-exibido', hidden: true });
    carregarEventos().then((d) => {
      if (!ativa()) return;
      const x = exibicaoDe(d.eventos, t.id);
      if (!x) return;
      const quando = new Date(x.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
      exibSlot.append(icone('check', 16), 'Exibido em: ', h('a', { href: '#/evento/' + x.evento_id, title: x.evento }, quando));
      exibSlot.hidden = false;
    }).catch(() => { /* informação extra */ });
    detalhesTmdb(t).then((d) => {
      if (!ativa()) return;
      const f = dadosDaFicha(d, t);
      fDirecao.preencher(f.direcao[1]); fRoteiro.preencher(f.roteiro[1]); fElenco.preencher(f.elenco[1]); fProducao.preencher(f.producao[1]);
      if (f.classificacao) {
        classifSlot.setAttribute('data-c', f.classificacao);
        classifSlot.title = f.classificacao === 'L' ? 'Classificação indicativa: livre' : `Classificação indicativa: ${f.classificacao} anos`;
        classifSlot.textContent = f.classificacao;
        classifSlot.hidden = false;
      }
      if (d.trailer) trailerSlot.append(h('button', { type: 'button', class: 'btn-primario', onclick: () => abrirTrailer(d.trailer) }, icone('play', 16), 'Trailer'));
      if (d.votos) votosTmdb.textContent = `(${d.votos.toLocaleString('pt-BR')} votos)`;
    }).catch(() => { /* a ficha é um bônus */ });

    // Marcação rápida de status (faixa de avaliação). Clicar de novo no status ligado tira a marcação.
    const rapido = (st) => h('button', { type: 'button', class: 'btn-status-rapido' + (meu && meu.status === st ? ' ligado' : ''), style: { '--cor': COR_STATUS[st] },
      'aria-pressed': String(!!meu && meu.status === st),
      onclick: async (e) => {
        const antes = meu ? { ...meu } : null;
        const remover = meu && meu.status === st;
        const rolagem = window.scrollY;
        e.currentTarget.classList.add('salvando'); e.currentTarget.disabled = true;
        try {
          if (remover) { await chamar('remover_status', { titulo_id: t.id }); removerStatusLocal(estado.membro.id, t.id); }
          else { await chamar('marcar_status', { titulo_id: t.id, status: st }); aplicarStatusLocal(estado.membro.id, t.id, { status: st, visto_em: st === 'visto' ? new Date().toISOString() : '' }); }
        } catch (err) { avisar(err.message, 'erro'); if (antes) aplicarStatusLocal(estado.membro.id, t.id, antes); }
        desenhar(); window.scrollTo(0, rolagem);
      } }, ROTULOS[st]);
    // "Assistindo" só faz sentido para o que tem episódios (série, anime, dorama...); filme já marcado continua podendo trocar.
    const statusDisponiveis = ['quero_ver', 'visto', 'abandonado', 'assistindo'].filter((st) => st !== 'assistindo' || t.tipo !== 'filme' || (meu && meu.status === 'assistindo'));
    const painelStatus = h('div', { class: 'resumo-status' }, h('small', null, 'Marque como você está'), h('div', { class: 'resumo-status-botoes' }, statusDisponiveis.map(rapido)));

    const conteudo = h('div', { class: 'pagina-titulo' },
      h('a', { class: 'voltar', href: '#/catalogo' }, icone('voltar', 18), 'Voltar ao catálogo'),
      h('section', { class: 'tit-hero' },
        fundoImg(t, 'tit-fundo'),
        classifSlot,
        h('div', { class: 'tit-topo' },
          h('div', { class: 'tit-capa' }, capa(t, true)),
          h('div', { class: 'tit-info' },
            h('h1', null, t.nome),
            [t.ano, duracaoTitulo(t)].filter(Boolean).length ? h('p', { class: 'tit-meta' }, [t.ano, duracaoTitulo(t)].filter(Boolean).join(' • ')) : null,
            nomesExtras(t),
            h('p', { class: 'tit-meta-tmdb' },
              t.nota_tmdb !== null ? ['Nota TMDB ★ ' + formatarNota(t.nota_tmdb), ' ', votosTmdb] : 'Sem nota no TMDB',
              t.tmdb_id ? [' • ', linkTmdb(t)] : null),
            h('div', { class: 'tit-acoes' }, trailerSlot),
            sinopse(t),
            h('dl', { class: 'tit-ficha' }, fDirecao.linha, fRoteiro.linha, fElenco.linha, generosLinha, fProducao.linha)
          )
        ),
        exibSlot
      ),
      resumoAvaliacao(t, linhas, notas, media, contagem, painelStatus),
      h('section', { class: 'tit-corpo' }, painelGrupo(t, linhas, membros, contagem), painelMeu(t, meu))
    );
    montar(raiz, casca('catalogo', conteudo));
  }

  /** Faixa de avaliação: média da galera + distribuição em estrelas, e quantos querem ver / assistiram. */
  function resumoAvaliacao(t, linhas, notas, media, contagem, painelStatus) {
    const balde = [0, 0, 0, 0, 0];   // 1★ … 5★ (notas de 0 a 10 → cada estrela vale 2 pontos)
    notas.forEach((n) => { balde[Math.min(5, Math.max(1, Math.ceil(n / 2))) - 1] += 1; });
    const topo = Math.max(1, ...balde);
    const numero = (n, rotulo, cor) => h('div', { class: 'resumo-num' }, h('strong', { style: cor ? { color: cor } : null }, String(n)), h('span', null, rotulo));
    return h('section', { class: 'aval-resumo', 'aria-label': 'Avaliação da galera' },
      h('div', { class: 'resumo-media' },
        h('small', null, 'Avaliação da galera'),
        media !== null ? [h('div', { class: 'resumo-grande' }, h('strong', null, formatarNota(media)), h('span', { class: 'estrelas' }, '★'.repeat(Math.round(media / 2)) + '☆'.repeat(5 - Math.round(media / 2)))),
          h('span', { class: 'suave pequeno' }, `${notas.length} ${notas.length === 1 ? 'avaliação' : 'avaliações'} · nota de 0 a 10`)]
          : h('span', { class: 'suave' }, 'Ninguém avaliou ainda. Seja a primeira pessoa!')),
      h('ul', { class: 'resumo-barras', 'aria-label': 'Distribuição das notas' }, [5, 4, 3, 2, 1].map((e) => h('li', null,
        h('span', null, e + ' ', h('span', { class: 'estrelas' }, '★')),
        h('span', { class: 'barra-fina' }, h('span', { style: { width: (balde[e - 1] / topo * 100) + '%' } })),
        h('b', null, notas.length ? Math.round(balde[e - 1] / notas.length * 100) + '%' : '—')))),
      h('div', { class: 'resumo-contagens' },
        numero(contagem.quero_ver, 'querem ver', COR_STATUS.quero_ver),
        numero(contagem.assistindo, 'assistindo', COR_STATUS.assistindo),
        numero(contagem.visto, 'assistiram', COR_STATUS.visto),
        numero(contagem.abandonado, 'abandonaram', COR_STATUS.abandonado)),
      painelStatus,
      indicacao(t));
  }

  function sinopse(t) {
    return h('div', { class: 'sinopse' }, h('p', { class: 'sinopse-texto' }, t.sinopse || 'Sem sinopse disponível.'));
  }

  function nomesExtras(t) {
    const outros = t.outros_titulos || [];
    if (!t.titulo_original && !outros.length) return null;
    return h('div', { class: 'nomes' },
      t.titulo_original ? h('p', { class: 'nome-extra' }, h('span', null, 'Título original:'), t.titulo_original) : null,
      outros.length ? h('p', { class: 'nome-extra' }, h('span', null, 'Também conhecido como:'), outros.join(' · ')) : null);
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
    const cat = dropdown({ id: 'edit-cat', rotulo: 'Categoria', valor: t.categoria, opcoes: CATEGORIAS_POR_TIPO[t.tipo].map((c) => [c, CATEGORIAS[c]]) });
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
        h('h2', null, h('span', { class: 'ico-ouro' }, icone('estrela', 20)), 'Avaliações da galera'),
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
      nota.dispatchEvent(new Event('input'));
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
        salvar.disabled = true; salvar.classList.add('salvando'); salvar.textContent = 'Salvando…';
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
          salvar.disabled = false; salvar.classList.remove('salvando'); salvar.textContent = 'Salvar';
        }
      }
    },
      h('h2', { class: 'mini' }, 'Sua avaliação'),
      h('div', { class: 'bloco' }, h('p', { class: 'rotulo' }, 'Status'), grupoStatus),
      serie ? h('div', { class: 'bloco' },
        h('p', { class: 'rotulo' }, 'Andamento'),
        h('div', { class: 'linha-campos' },
          h('label', { for: 'temporada' }, 'Temporada', temporada),
          h('label', { for: 'episodio' }, 'Episódio', episodio)
        ),
        proximo,
        h('p', { class: 'suave pequeno' }, 'Terminou a temporada? Aumente a temporada e volte o episódio para 1.')
      ) : null,
      h('div', { class: 'bloco' }, h('label', { for: 'nota', class: 'rotulo' }, 'Como você avalia este título?'), seletorEstrelas(nota), nota, avisoNota),
      h('div', { class: 'bloco' }, h('label', { for: 'comentario', class: 'rotulo' }, 'Sua crítica'), comentario),
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

/** Cinco estrelas clicáveis ligadas ao campo de nota (cada estrela = 2 pontos; clicar de novo na mesma tira meio ponto). */
function seletorEstrelas(campo) {
  const botoes = [1, 2, 3, 4, 5].map((i) => h('button', { type: 'button', class: 'estrela-btn', 'aria-label': `${i} ${i === 1 ? 'estrela' : 'estrelas'}`,
    onclick: () => {
      if (campo.disabled) return;
      const atual = Number(String(campo.value).replace(',', '.'));
      campo.value = atual === i * 2 ? String(i * 2 - 1) : String(i * 2);
      campo.dispatchEvent(new Event('input'));
    } }, '★'));
  const pintar = () => {
    const n = Number(String(campo.value).replace(',', '.')) || 0;
    botoes.forEach((b, k) => { b.classList.toggle('cheia', n >= (k + 1) * 2); b.classList.toggle('meia', n === (k + 1) * 2 - 1); b.disabled = campo.disabled; });
  };
  campo.addEventListener('input', pintar);
  setTimeout(pintar);
  return h('div', { class: 'estrelas-seletor', role: 'group', 'aria-label': 'Escolher nota em estrelas' }, botoes);
}

