import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo, aplicarStatusLocal } from '../estado.js';
import { chamar } from '../api.js';
import { cartaoTitulo } from '../cartao.js';
import { casca, avatar, capa, fundoImg, avisar, ROTULOS, COR_STATUS, CATEGORIAS, rotuloCategoria, haQuanto } from '../ui.js';

const VERBO = { visto: 'viu', assistindo: 'está assistindo', quero_ver: 'quer ver' };
const PLURAL = { filme: 'Filmes', serie: 'Séries', anime: 'Animes', dorama: 'Doramas', reality: 'Reality', documentario: 'Documentários' };
let filtroCat = 'todos';
let slideAtual = 0; // lembra o destaque ao redesenhar a tela

export function telaInicio({ raiz, ativa }) {
  const conteudo = h('div', { class: 'inicio' }, h('p', { class: 'suave' }, 'Carregando…'));
  montar(raiz, casca('inicio', conteudo));
  let timer = null;

  if (estado.catalogo) desenhar();
  carregarCatalogo().then(() => { if (ativa()) desenhar(); }).catch((e) => {
    if (!ativa() || estado.catalogo) return;
    montar(conteudo, h('p', { class: 'erro' }, e.message),
      h('button', { type: 'button', class: 'btn-sec', onclick: () => telaInicio({ raiz, ativa }) }, 'Tentar de novo'));
  });

  function desenhar() {
    clearInterval(timer);
    const { titulos, membros, status } = estado.catalogo;
    const porId = Object.fromEntries(titulos.map((t) => [t.id, t]));
    const quem = Object.fromEntries(membros.map((m) => [m.id, m]));
    const recentes = titulos.slice().sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    montar(conteudo,
      h('div', { class: 'inicio-principal' }, hero(recentes.slice(0, 5), quem), continuar(porId), catalogo(recentes)),
      h('aside', { class: 'inicio-lateral' }, atividade(titulos, status, porId, quem), minhaLista(porId), chamada())
    );
  }

  function hero(slides, quem) {
    if (!slides.length) {
      return h('section', { class: 'hero vazio' },
        h('div', { class: 'slide ativo' }, h('div', { class: 'hero-texto' },
          h('h1', null, 'Descubra, compartilhe e monte ', h('span', { class: 'ouro' }, 'sua lista!')),
          h('p', { class: 'hero-sinopse' }, 'Busque um filme, série, anime ou dorama e indique o primeiro título da galera.'),
          h('a', { class: 'btn-primario', href: '#/adicionar' }, icone('busca', 18), 'Adicionar título'))));
    }
    if (slideAtual >= slides.length) slideAtual = 0;
    const caixa = h('section', { class: 'hero', 'aria-roledescription': 'carrossel', 'aria-label': 'Últimas indicações' });
    const pontos = [];
    const fatias = slides.map((t) => {
      const indicador = quem[t.adicionado_por];
      const meu = estado.catalogo.status.find((s) => s.membro_id === estado.membro.id && s.titulo_id === t.id);
      const botaoLista = h('button', {
        type: 'button', class: 'btn-icone', 'aria-label': 'Quero ver ' + t.nome, title: meu ? ROTULOS[meu.status] : 'Quero ver', disabled: !!meu,
        onclick: async () => {
          botaoLista.disabled = true;
          try {
            await chamar('marcar_status', { titulo_id: t.id, status: 'quero_ver' });
            aplicarStatusLocal(estado.membro.id, t.id, { status: 'quero_ver' });
            avisar(`“${t.nome}” entrou na sua lista.`); desenhar();
          } catch (e) { avisar(e.message, 'erro'); botaoLista.disabled = false; }
        }
      }, icone(meu ? 'check' : 'mais', 20));
      return h('div', { class: 'slide' },
        fundoImg(t, 'hero-fundo'),
        h('div', { class: 'hero-texto' },
          h('span', { class: 'etiqueta ouro-etq' }, 'Em destaque'),
          h('h1', null, t.nome),
          h('p', { class: 'hero-meta' }, [rotuloCategoria(t), t.ano, t.nota_tmdb !== null ? '★ ' + String(t.nota_tmdb).replace('.', ',') : null].filter(Boolean).join(' · ')),
          h('p', { class: 'hero-sinopse' }, t.recado ? `“${t.recado}” — indicado por ${indicador ? indicador.nome : 'alguém da galera'}` : (t.sinopse || '')),
          h('div', { class: 'hero-acoes' }, h('a', { class: 'btn-primario', href: '#/titulo/' + t.id }, icone('play', 18), 'Ver ficha'), botaoLista)));
    });
    function mostrar(i) {
      slideAtual = i;
      fatias.forEach((f, k) => {
        f.classList.toggle('ativo', k === i);
        f.setAttribute('aria-hidden', k === i ? 'false' : 'true');
        if (k === i) f.removeAttribute('inert'); else f.setAttribute('inert', '');
      });
      pontos.forEach((b, k) => { b.classList.toggle('ligado', k === i); b.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    }
    caixa.append(...fatias);
    if (slides.length > 1) {
      caixa.append(h('div', { class: 'pontos-hero', role: 'group', 'aria-label': 'Escolher destaque' },
        slides.map((_, i) => { const b = h('button', { type: 'button', 'aria-label': 'Destaque ' + (i + 1), onclick: () => mostrar(i) }); pontos.push(b); return b; })));
    }
    mostrar(slideAtual);
    if (slides.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      timer = setInterval(() => {
        if (!ativa() || !document.contains(caixa)) { clearInterval(timer); return; }
        if (caixa.matches(':hover, :focus-within')) return;
        mostrar((slideAtual + 1) % slides.length);
      }, 8000);
    }
    return caixa;
  }

  function continuar(porId) {
    const meus = estado.catalogo.status
      .filter((s) => s.membro_id === estado.membro.id && s.status === 'assistindo' && porId[s.titulo_id])
      .sort((a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em)));
    if (!meus.length) return null;
    return h('section', { class: 'bloco-home' },
      h('div', { class: 'titulo-secao' }, h('h2', null, 'Está assistindo'), h('a', { href: '#/perfil' }, 'Ver todos →')),
      h('div', { class: 'linha-cards' }, meus.slice(0, 4).map((s) => {
        const t = porId[s.titulo_id];
        const serie = t.tipo === 'serie';
        const prog = serie && s.temporada_atual && s.episodio_atual ? `T${s.temporada_atual} · Ep. ${s.episodio_atual}` : (serie ? 'Sem episódio marcado' : 'Em andamento');
        const pct = serie && t.temporadas === 1 && t.episodios && s.episodio_atual ? Math.min(100, Math.round((s.episodio_atual / t.episodios) * 100)) : null;
        return h('a', { class: 'card-continuar', href: '#/titulo/' + t.id },
          fundoImg(t), h('span', { class: 'sombra' }),
          h('span', { class: 'cc-texto' }, h('strong', null, t.nome), h('small', null, prog)),
          pct !== null ? h('span', { class: 'barra', role: 'img', 'aria-label': pct + '% assistido' }, h('span', { style: { width: pct + '%' } })) : null);
      })));
  }

  function catalogo(recentes) {
    const presentes = Object.keys(CATEGORIAS).filter((c) => recentes.some((t) => t.categoria === c));
    if (filtroCat !== 'todos' && !presentes.includes(filtroCat)) filtroCat = 'todos';
    const lista = recentes.filter((t) => filtroCat === 'todos' || t.categoria === filtroCat).slice(0, 10);
    const pill = (id, texto) => h('button', { type: 'button', class: 'chip' + (filtroCat === id ? ' ligado' : ''), 'aria-pressed': String(filtroCat === id), onclick: () => { filtroCat = id; desenhar(); } }, texto);
    return h('section', { class: 'bloco-home' },
      h('div', { class: 'titulo-secao' }, h('h2', null, h('span', { class: 'ouro' }, icone('grade', 22)), ' Catálogo'),
        h('div', { class: 'filtros' }, pill('todos', 'Todos'), presentes.map((c) => pill(c, PLURAL[c])))),
      lista.length ? h('div', { class: 'grade' }, lista.map((t) => cartaoTitulo(t, { aoMudar: desenhar }))) : h('p', { class: 'suave' }, 'Ainda não há títulos.'),
      recentes.length > 10 ? h('p', { class: 'ver-tudo' }, h('a', { class: 'btn-sec', href: '#/catalogo' }, 'Ver o catálogo completo')) : null);
  }

  function atividade(titulos, status, porId, quem) {
    const eventos = [];
    status.forEach((s) => { if (s.atualizado_em && quem[s.membro_id] && porId[s.titulo_id]) eventos.push({ quando: s.atualizado_em, m: quem[s.membro_id], t: porId[s.titulo_id], txt: VERBO[s.status], cor: COR_STATUS[s.status] }); });
    titulos.forEach((t) => { if (t.criado_em && quem[t.adicionado_por]) eventos.push({ quando: t.criado_em, m: quem[t.adicionado_por], t, txt: 'indicou', cor: 'var(--ouro)' }); });
    eventos.sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
    return h('section', { class: 'card lateral' },
      h('div', { class: 'titulo-secao' }, h('h2', null, h('span', { class: 'ouro' }, '⚡'), ' Atividade recente')),
      eventos.length ? h('ul', { class: 'atividade' }, eventos.slice(0, 5).map((e) =>
        h('li', null, avatar(e.m, { tamanho: 36, cor: e.cor }),
          h('div', { class: 'at-texto' }, h('span', null, h('strong', null, e.m.nome.split(' ')[0]), ' ' + e.txt + ' ', h('a', { href: '#/titulo/' + e.t.id }, e.t.nome)),
            h('span', { class: 'suave pequeno' }, haQuanto(e.quando))))))
        : h('p', { class: 'suave' }, 'Quando a galera marcar títulos, a atividade aparece aqui.'));
  }

  function minhaLista(porId) {
    const meus = estado.catalogo.status.filter((s) => s.membro_id === estado.membro.id && s.status === 'quero_ver' && porId[s.titulo_id])
      .sort((a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em))).slice(0, 3);
    return h('section', { class: 'card lateral' },
      h('div', { class: 'titulo-secao' }, h('h2', null, 'Quero ver'), h('a', { href: '#/perfil' }, 'Ver todos →')),
      meus.length ? h('ul', { class: 'mini-lista' }, meus.map((s) => { const t = porId[s.titulo_id];
        return h('li', null, h('a', { href: '#/titulo/' + t.id }, h('span', { class: 'mini-capa' }, capa(t)), h('span', null, h('strong', null, t.nome), h('small', null, rotuloCategoria(t) + (t.ano ? ' · ' + t.ano : ''))))); }))
        : h('p', { class: 'suave' }, 'Use o “+” nos títulos para montar sua lista.'));
  }

  function chamada() {
    return h('section', { class: 'card lateral chamada' },
      h('h2', null, h('span', { class: 'ouro' }, '★'), ' Indique um título'),
      h('p', { class: 'suave' }, 'Achou algo bom? Coloque no catálogo e conte para a galera por que vale a pena.'),
      h('a', { class: 'btn-primario', href: '#/adicionar' }, 'Começar agora'));
  }
}
