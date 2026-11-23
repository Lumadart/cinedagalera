import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo, achaTitulo, statusDe, aplicarStatusLocal, removerStatusLocal } from '../estado.js';
import { chamar } from '../api.js';
import { statusDoTipo, casca, esqueleto, avatar, capa, fundoImg, avisar, ROTULOS, COR_STATUS, ORDEM_STATUS, formatarNota, CATEGORIAS, CATEGORIAS_POR_TIPO, duracaoTitulo } from '../ui.js';
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
      // Sem texto ainda = esqueleto (mantém o espaço reservado e evita a página "pular" quando a ficha chega).
      const dd = h('dd', { class: conteudoDd ? '' : 'sk-texto' }, conteudoDd || '');
      const linha = h('div', { class: 'ficha-linha' }, h('dt', null, rotulo + ':'), dd);
      return { linha, preencher: (texto) => { if (!texto) { linha.hidden = true; return; } dd.className = ''; dd.textContent = texto; } };
    };
    const fDirecao = linhaFicha(t.tipo === 'filme' ? 'Direção' : 'Criação');
    const fRoteiro = linhaFicha('Roteiro');
    const fElenco = linhaFicha('Elenco');
    const fProducao = linhaFicha('Distribuição');
    const generosLinha = t.generos.length ? h('div', { class: 'ficha-linha' }, h('dt', null, 'Gêneros:'),
      h('dd', { class: 'generos-links' }, t.generos.map((g, i) => [i ? ', ' : '', h('a', { href: '#/catalogo', onclick: () => { estado.filtro.categoria = 'todos'; estado.filtro.genero = g; estado.filtro.busca = ''; } }, g)]))) : null;
    const trailerSlot = h('span', { class: 'trailer-slot' }, h('span', { class: 'sk-botao' }));
    const acoes = h('div', { class: 'tit-acoes carregando' }, trailerSlot);
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
      trailerSlot.textContent = ''; acoes.classList.remove('carregando');
      if (d.trailer) trailerSlot.append(h('button', { type: 'button', class: 'btn-primario', onclick: () => abrirTrailer(d.trailer) }, icone('play', 16), 'Trailer'));
      if (d.votos) votosTmdb.textContent = `(${d.votos.toLocaleString('pt-BR')} votos)`;
    }).catch(() => { /* a ficha é um bônus: some o esqueleto */
      [fDirecao, fRoteiro, fElenco, fProducao].forEach((f) => f.preencher(''));
      trailerSlot.textContent = ''; acoes.classList.remove('carregando');
    });

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
    // Filme: só "Quero ver" e "Visto". Série, anime, dorama etc.: os quatro.
    const statusDisponiveis = statusDoTipo(t.tipo, meu && meu.status);
    const painelStatus = h('div', { class: 'resumo-status' }, h('small', null, 'Marque como você está'), h('div', { class: 'resumo-status-botoes', 'data-n': String(statusDisponiveis.length) }, statusDisponiveis.map(rapido)));

    const conteudo = h('div', { class: 'pagina-titulo' },
      h('a', { class: 'voltar', href: '#/catalogo' }, icone('voltar', 18), 'Voltar ao catálogo'),
      h('section', { class: 'tit-hero' },
        fundoImg(t, 'tit-fundo'),
        classifSlot,
        h('div', { class: 'tit-topo' },
          h('div', { class: 'tit-capa' }, capa(t, true)),
          h('div', { class: 'tit-info' },
            h('h1', null, t.nome),
            alternativos(t),
            h('p', { class: 'tit-meta' }, ...metaLinha(t, votosTmdb)),
            acoes,
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

  /** Faixa de avaliação: média da comunidade + distribuição em estrelas, e quantos querem ver / assistiram. */
  function resumoAvaliacao(t, linhas, notas, media, contagem, painelStatus) {
    const balde = [0, 0, 0, 0, 0];   // 1★ … 5★ (notas de 0 a 10 → cada estrela vale 2 pontos)
    notas.forEach((n) => { balde[Math.min(5, Math.max(1, Math.ceil(n / 2))) - 1] += 1; });
    const topo = Math.max(1, ...balde);
    const numero = (n, rotulo, cor) => h('div', { class: 'resumo-num' }, h('strong', { style: cor ? { color: cor } : null }, String(n)), h('span', null, rotulo));
    return h('section', { class: 'aval-resumo', 'aria-label': 'Avaliação da comunidade' },
      h('div', { class: 'resumo-media' },
        h('small', null, 'Avaliação da comunidade'),
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

  /** Até dois outros nomes do título (original e alternativos), diferentes do nome principal: "Psicose ou Psycho". */
  function alternativos(t) {
    const vistos = new Set([t.nome.trim().toLowerCase()]);
    const nomes = [t.titulo_original, ...(t.outros_titulos || [])].filter((n) => {
      const k = String(n || '').trim().toLowerCase();
      if (!k || vistos.has(k)) return false;
      vistos.add(k); return true;
    }).slice(0, 2);
    if (!nomes.length) return null;
    return h('p', { class: 'tit-alt' }, nomes.map((n, i) => [i ? ' ' : '', h('span', { class: 'ou' }, 'ou'), ' ', h('span', { class: 'alt' }, n)]));
  }

  /** Ano • duração • ★ nota (votos): a nota do TMDB vai na mesma linha e abre o título lá. */
  function metaLinha(t, votos) {
    const itens = [t.ano, duracaoTitulo(t)].filter(Boolean).map((x) => h('span', null, String(x)));
    if (t.nota_tmdb !== null) {
      const texto = '★ ' + formatarNota(t.nota_tmdb);
      const nota = t.tmdb_id ? linkTmdb(t, texto) : h('span', null, texto);
      if (t.tmdb_id) nota.title = 'Ver no TMDB';
      nota.append(' ', votos);
      itens.push(nota);
    }
    return itens.flatMap((x, i) => (i ? [h('span', { class: 'sep', 'aria-hidden': 'true' }, '•'), x] : [x]));
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

  /** Avaliações da comunidade: um cartão por pessoa (status, estrelas, nota, andamento e crítica), com filtro por status. */
  function painelGrupo(t, linhas, membros, contagem) {
    const porMembro = Object.fromEntries(linhas.map((s) => [s.membro_id, s]));
    const marcaram = membros.filter((m) => porMembro[m.id]).sort((a, b) =>
      (porMembro[b.id].comentario ? 1 : 0) - (porMembro[a.id].comentario ? 1 : 0) ||
      ORDEM_STATUS[porMembro[a.id].status] - ORDEM_STATUS[porMembro[b.id].status] || a.nome.localeCompare(b.nome, 'pt-BR'));
    const faltam = membros.filter((m) => !porMembro[m.id]).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    let filtro = 'todos';

    const estrelasTexto = (n) => { const c = Math.round(n / 2); return '★'.repeat(c) + '☆'.repeat(5 - c); };

    const cartaoMembro = (m) => {
      const s = porMembro[m.id];
      const cor = COR_STATUS[s.status];
      const prog = t.tipo !== 'filme' && s.temporada_atual && s.episodio_atual ? `Temporada ${s.temporada_atual} · episódio ${s.episodio_atual}` : '';
      const moderar = s.comentario && estado.membro.admin && m.id !== estado.membro.id ? h('button', { type: 'button', class: 'link-discreto', onclick: async (e) => {
        if (!confirm('Apagar este comentário? A nota é mantida.')) return;
        try {
          await chamar('admin_limpar_comentario', { titulo_id: t.id, membro_id: m.id });
          s.comentario = ''; const q = e.target.parentElement.querySelector('.av-critica'); if (q) q.remove(); e.target.remove(); avisar('Comentário apagado.');
        } catch (err) { avisar(err.message, 'erro'); }
      } }, 'Apagar comentário (moderação)') : null;
      return h('li', { class: 'av-card', style: { '--cor': cor } },
        h('div', { class: 'av-topo' },
          avatar(m, { tamanho: 46, cor }),
          h('div', { class: 'av-quem' },
            h('strong', null, m.nome + (m.id === estado.membro.id ? ' (você)' : '')),
            h('span', { class: 'pill-status', style: { color: cor, borderColor: cor } }, ROTULOS[s.status])),
          s.nota !== null ? h('div', { class: 'av-nota', title: 'Nota de 0 a 10' },
            h('span', { class: 'estrelas' }, estrelasTexto(s.nota)), h('strong', null, formatarNota(s.nota))) : null),
        prog ? h('p', { class: 'av-prog' }, icone('play', 13), prog) : null,
        s.comentario ? h('blockquote', { class: 'av-critica' }, s.comentario) : null,
        moderar);
    };

    const lista = h('ul', { class: 'av-lista' });
    const filtros = h('div', { class: 'av-filtros', role: 'group', 'aria-label': 'Filtrar avaliações' });
    function pintar() {
      const vistos = marcaram.filter((m) => filtro === 'todos' || porMembro[m.id].status === filtro);
      montar(lista, vistos.map(cartaoMembro));
      montar(filtros, [['todos', 'Todos', marcaram.length], ...['visto', 'assistindo', 'quero_ver', 'abandonado'].map((k) => [k, ROTULOS[k], contagem[k]])]
        .filter(([k, , n]) => n > 0 && (k === 'todos' || marcaram.length > 1))
        .map(([k, rotulo, n]) => h('button', { type: 'button', class: 'av-filtro' + (filtro === k ? ' ligado' : ''), 'aria-pressed': String(filtro === k),
          onclick: () => { filtro = k; pintar(); } }, rotulo, h('span', { class: 'n' }, String(n)))));
      if (marcaram.length < 2) filtros.hidden = true;
    }
    pintar();

    const vazio = h('div', { class: 'av-vazio' },
      h('span', { class: 'av-vazio-ico' }, icone('estrela', 30)),
      h('strong', null, 'Ninguém avaliou ainda'),
      h('p', { class: 'suave' }, 'Marque como você está e deixe sua nota e sua crítica. Elas aparecem aqui para toda a comunidade.'),
      h('button', { type: 'button', class: 'btn-primario', onclick: () => {
        const campo = document.getElementById('comentario');
        const painel = campo && campo.closest('form');
        if (painel) painel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } }, 'Avaliar agora'));

    return h('div', { class: 'grupo-painel' },
      h('div', { class: 'grupo-topo' },
        h('h2', null, h('span', { class: 'ico-ouro' }, icone('estrela', 20)), 'Avaliações da comunidade'),
        h('span', { class: 'suave av-contagem' }, `${linhas.length} de ${membros.length} já marcaram`)),
      marcaram.length ? [filtros, lista] : vazio,
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
    const avisoNota = h('p', { class: 'suave pequeno', hidden: true }, 'Você pode dar nota depois de marcar como visto' + (t.tipo === 'filme' ? '.' : ', assistindo ou abandonado.'));
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

    const grupoStatus = h('div', { class: 'grupo-chips' }, statusDoTipo(t.tipo, meu && meu.status).map((st) => {
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
        if (!escolhido) { erro.textContent = 'Escolha um status antes de salvar.'; return; }
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
      h('div', { class: 'bloco' }, h('label', { for: 'nota', class: 'rotulo' }, 'Sua nota'), h('div', { class: 'nota-linha' }, seletorEstrelas(nota), h('span', { class: 'nota-campo' }, nota, h('small', null, '/ 10'))), avisoNota),
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

