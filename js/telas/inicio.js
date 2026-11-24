import { PLURAL_CATEGORIAS } from '../categorias.js';
import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo, achaTitulo } from '../estado.js';
import { chamar } from '../api.js';
import { cartaoTitulo } from '../cartao.js';
import { carregarEventos, eventoAtivo, limparEventos, colagem, quemVai, diaLongo, hhmm } from '../eventos.js';
import { dataLonga, contagem, jaComecou, haQuanto } from '../datas.js';
import { casca, esqueleto, avatar, capa, fundoImg, avisar, COR_STATUS, duracaoTitulo } from '../ui.js';

const VERBO = { visto: 'viu', assistindo: 'está assistindo', quero_ver: 'quer ver' };
const PLURAL = PLURAL_CATEGORIAS;
let slideAtual = 0; // lembra o destaque ao redesenhar a tela

export function telaInicio({ raiz, ativa }) {
  const conteudo = h('div', { class: 'inicio' }, esqueleto('grade', 6));
  montar(raiz, casca('inicio', conteudo));
  let timer = null;
  const bannerEvento = h('a', { class: 'aviso-evento', hidden: true, href: '#/eventos', 'aria-label': 'Evento da comunidade' });
  let dadosEvento = null; // { e, vt } do último carregamento: o card é redesenhado quando o catálogo (com os membros) chega
  function pintarEvento() {
    if (!dadosEvento) return;
    const { e, vt } = dadosEvento;
    bannerEvento.hidden = false;
    bannerEvento.href = e ? '#/evento/' + e.id : '#/eventos';
    const rolando = e && jaComecou(e);
    const membros = estado.catalogo ? estado.catalogo.membros : [];
    const vao = e ? quemVai(e, membros, 'vou', 6) : null;
    const filmes = e ? (e.titulos || []).length : 0;
    const primeiro = e ? (e.titulos || []).map(achaTitulo).find(Boolean) : null;
    const fundo = primeiro ? fundoImg(primeiro, 'ae-fundo') : null;
    const chip = (ic, txt, extra = '') => h('span', { class: 'ae-chip ' + extra }, icone(ic, 16), txt);
    montar(bannerEvento,
      fundo,
      e ? h('div', { class: 'ae-capa' }, colagem(e)) : null,
      h('div', { class: 'ae-texto' },
        h('span', { class: 'ae-rotulo' + (rolando ? ' ao-vivo' : '') }, rolando ? h('i', { class: 'ae-ponto' }) : icone('calendario', 16), e ? (rolando ? 'Rolando agora' : 'Próximo evento') : 'Votação aberta'),
        e ? h('h2', null, e.nome) : null,
        e ? h('div', { class: 'ae-chips' },
          chip('calendario', diaLongo(e.inicio).replace(/^./, (c) => c.toUpperCase())),
          chip('relogio', hhmm(e.inicio)),
          rolando ? null : chip('raio', contagem(e.inicio), 'ouro')) : null,
        e && e.descricao ? h('p', { class: 'ae-desc' }, e.descricao) : null,
        vt ? h('p', { class: 'ae-voto' }, `🗳️ ${vt} ${vt === 1 ? 'votação aberta esperando' : 'votações abertas esperando'} o seu voto`) : null),
      e ? h('div', { class: 'ae-lado' },
        h('div', { class: 'ae-quem' },
          vao.total ? [vao.pilha, h('span', null, h('strong', null, String(vao.total)), vao.total === 1 ? ' confirmado' : ' confirmados')]
            : h('span', { class: 'suave' }, 'Ninguém confirmou ainda'),
          filmes ? h('span', { class: 'suave' }, `${filmes} ${filmes === 1 ? 'filme' : 'filmes'} na programação`) : null),
        h('span', { class: 'btn-primario' }, 'Ver evento', h('span', { 'aria-hidden': 'true' }, '→'))) : null);
  }
  function carregarWidget() {
    carregarEventos().then((d) => {
      if (!ativa()) return;
      const ativos = d.eventos.filter(eventoAtivo).sort((a, b) => a.inicio.localeCompare(b.inicio));
      const e = ativos[0];
      const vt = d.votacoes.filter((v) => !v.encerrada && (v.meus_votos || []).length < v.max_votos).length;
      if (!e && !vt) return;
      dadosEvento = { e, vt };
      pintarEvento();
    }).catch(() => { /* a home funciona sem o aviso */ });
  }

  carregarWidget();
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
    pintarEvento(); // agora que os membros chegaram, mostra quem vai
    const recentes = titulos.slice().sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    montar(conteudo,
      hero(recentes.slice(0, 5)),
      h('div', { class: 'inicio-corpo' },
        h('div', { class: 'inicio-principal' }, bannerEvento, ultimos(recentes), queridos(titulos)),
        h('aside', { class: 'inicio-lateral' }, atividade(titulos, status, porId, quem))
      )
    );
  }

  function hero(slides) {
    if (!slides.length) {
      return h('section', { class: 'hero vazio' },
        h('div', { class: 'slide ativo' }, h('div', { class: 'hero-texto' },
          h('h1', null, 'Descubra, compartilhe e monte ', h('span', { class: 'ouro' }, 'sua lista!')),
          h('p', { class: 'hero-sinopse' }, 'Busque um filme, série, anime ou dorama e indique o primeiro título da comunidade.'),
          h('a', { class: 'btn-primario', href: '#/adicionar' }, icone('busca', 18), 'Adicionar título'))));
    }
    if (slideAtual >= slides.length) slideAtual = 0;
    const caixa = h('section', { class: 'hero', 'aria-roledescription': 'carrossel', 'aria-label': 'Últimas indicações' });
    const pontos = [];
    const fatias = slides.map((t) => {
      return h('div', { class: 'slide' },
        fundoImg(t, 'hero-fundo'),
        h('div', { class: 'hero-texto' },
          h('h1', null, t.nome),
          [t.ano, duracaoTitulo(t)].filter(Boolean).length ? h('p', { class: 'hero-meta' }, [t.ano, duracaoTitulo(t)].filter(Boolean).join(' • ')) : null,
          h('p', { class: 'hero-sinopse' }, t.sinopse || 'Sem sinopse cadastrada.'),
          h('div', { class: 'hero-acoes' }, h('a', { class: 'btn-primario', href: '#/titulo/' + t.id }, 'Ver detalhes'))));
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

  function secao(icone_, titulo, lista, vazio, rodape) {
    return h('section', { class: 'bloco-home' },
      h('div', { class: 'titulo-secao' },
        h('h2', null, h('span', { class: 'ico-ouro' }, icone(icone_, 20)), titulo),
        h('a', { href: '#/catalogo' }, 'Ver todos')),
      lista.length ? h('div', { class: 'grade grade-home' }, lista.map((t) => cartaoTitulo(t, { aoMudar: desenhar }))) : h('p', { class: 'suave' }, vazio));
  }

  function ultimos(recentes) {
    return secao('novo', 'Últimos adicionados', recentes.slice(0, 12), 'Ainda não há títulos. Que tal adicionar o primeiro?');
  }

  function queridos(titulos) {
    const querem = (t) => estado.catalogo.status.filter((x) => x.titulo_id === t.id && x.status === 'quero_ver').length;
    const lista = titulos.filter((t) => querem(t) > 0)
      .sort((a, b) => querem(b) - querem(a) || String(b.criado_em).localeCompare(String(a.criado_em))).slice(0, 12);
    return secao('coracao', 'Mais querem ver', lista, 'Ninguém marcou “quero ver” ainda.');
  }

  function atividade(titulos, status, porId, quem) {
    const eventos = [];
    status.forEach((s) => { if (s.atualizado_em && quem[s.membro_id] && porId[s.titulo_id]) eventos.push({ quando: s.atualizado_em, m: quem[s.membro_id], t: porId[s.titulo_id], txt: VERBO[s.status], cor: COR_STATUS[s.status] }); });
    titulos.forEach((t) => { if (t.criado_em && quem[t.adicionado_por]) eventos.push({ quando: t.criado_em, m: quem[t.adicionado_por], t, txt: 'indicou', cor: 'var(--ouro)' }); });
    eventos.sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
    return h('section', { class: 'card lateral' },
      h('div', { class: 'titulo-secao' }, h('h2', null, h('span', { class: 'ico-ouro' }, icone('raio', 20)), 'Atividade da comunidade')),
      eventos.length ? h('ul', { class: 'atividade' }, eventos.slice(0, 8).map((e) =>
        h('li', null, avatar(e.m, { tamanho: 36, cor: e.cor }),
          h('div', { class: 'at-texto' }, h('span', null, h('strong', null, e.m.nome.split(' ')[0]), ' ' + e.txt + ' ', h('a', { href: '#/titulo/' + e.t.id }, e.t.nome)),
            h('span', { class: 'suave pequeno' }, haQuanto(e.quando))),
          h('a', { class: 'at-capa', href: '#/titulo/' + e.t.id, 'aria-label': e.t.nome, tabindex: '-1' }, capa(e.t)))))
        : h('p', { class: 'suave' }, 'Quando a comunidade marcar títulos, a atividade aparece aqui.'));
  }
}
