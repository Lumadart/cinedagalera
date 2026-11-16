import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo, aplicarStatusLocal } from '../estado.js';
import { chamar } from '../api.js';
import { cartaoTitulo } from '../cartao.js';
import { carregarEventos, dataLonga, contagem, jaComecou, eventoAtivo, limparEventos, colagem } from '../eventos.js';
import { casca, esqueleto, avatar, capa, fundoImg, avisar, ROTULOS, COR_STATUS, CATEGORIAS, rotuloCategoria, haQuanto } from '../ui.js';

const VERBO = { visto: 'viu', assistindo: 'está assistindo', quero_ver: 'quer ver' };
const PLURAL = { filme: 'Filmes', serie: 'Séries', anime: 'Animes', dorama: 'Doramas', reality: 'Reality', documentario: 'Documentários' };
let slideAtual = 0; // lembra o destaque ao redesenhar a tela

export function telaInicio({ raiz, ativa }) {
  const conteudo = h('div', { class: 'inicio' }, esqueleto('grade', 6));
  montar(raiz, casca('inicio', conteudo));
  let timer = null;
  const bannerEvento = h('section', { class: 'aviso-evento', hidden: true, 'aria-label': 'Evento da galera' });
  function carregarWidget() {
    carregarEventos().then((d) => {
      if (!ativa()) return;
      const ativos = d.eventos.filter(eventoAtivo).sort((a, b) => a.inicio.localeCompare(b.inicio));
      const e = ativos[0];
      const vt = d.votacoes.filter((v) => !v.encerrada && (v.meus_votos || []).length < v.max_votos).length;
      if (!e && !vt) return;
      bannerEvento.hidden = false;
      const rolando = e && jaComecou(e);
      const minha = e ? e.presencas[estado.membro.id] || '' : '';
      montar(bannerEvento,
        e ? h('div', { class: 'ae-capa' }, colagem(e)) : null,
        h('div', { class: 'ae-texto' },
          e ? h('span', { class: 'ae-rotulo' }, icone('calendario', 16), rolando ? 'Rolando agora' : 'Próximo evento') : null,
          e ? h('h2', null, e.nome) : null,
          e ? h('p', null, dataLonga(e.inicio) + (e.local ? ' · ' + e.local : '') + ' · ' + contagem(e.inicio)) : null,
          ativos.length > 1 ? h('p', { class: 'suave pequeno' }, `+ ${ativos.length - 1} ${ativos.length === 2 ? 'outro evento' : 'outros eventos'} nesta semana`) : null,
          e && e.sugestoes_abertas ? h('p', { class: 'ae-voto' }, `💡 Sugira até ${e.sugestoes_max} ${e.sugestoes_max === 1 ? 'filme' : 'filmes'} (você usou ${e.sugestoes.filter((x) => x.membro_id === estado.membro.id).length})`) : null,
          vt ? h('p', { class: 'ae-voto' }, `🗳️ ${vt} ${vt === 1 ? 'votação aberta esperando' : 'votações abertas esperando'} o seu voto`) : null),
        h('div', { class: 'ae-acoes' },
          e && !rolando ? h('button', { type: 'button', class: minha === 'vou' ? 'btn-primario' : 'btn-contorno', 'aria-pressed': String(minha === 'vou'), onclick: async (ev) => {
            ev.target.disabled = true;
            try { await chamar('evento_presenca', { evento_id: e.id, resposta: minha === 'vou' ? '' : 'vou' }); limparEventos(); carregarWidget(); }
            catch (err) { avisar(err.message, 'erro'); ev.target.disabled = false; }
          } }, minha === 'vou' ? '✓ Eu vou' : 'Eu vou') : null,
          h('a', { class: 'btn-sec', href: '#/eventos' }, vt && !e ? 'Votar' : (e && e.sugestoes_abertas ? 'Sugerir filmes' : 'Ver detalhes'))));
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
    const recentes = titulos.slice().sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    montar(conteudo,
      h('div', { class: 'inicio-principal' }, bannerEvento, hero(recentes.slice(0, 5), quem), ultimos(recentes), queridos(titulos)),
      h('aside', { class: 'inicio-lateral' }, assistindo(porId), minhaLista(porId), atividade(titulos, status, porId, quem))
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

  function secao(icone_, titulo, lista, vazio, rodape) {
    return h('section', { class: 'bloco-home' },
      h('div', { class: 'titulo-secao' },
        h('h2', null, h('span', { class: 'ico-ouro' }, icone(icone_, 20)), titulo),
        h('a', { href: '#/catalogo' }, 'Ver catálogo →')),
      lista.length ? h('div', { class: 'grade' }, lista.map((t) => cartaoTitulo(t, { aoMudar: desenhar }))) : h('p', { class: 'suave' }, vazio));
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

  function assistindo(porId) {
    const meus = estado.catalogo.status
      .filter((s) => s.membro_id === estado.membro.id && s.status === 'assistindo' && porId[s.titulo_id])
      .sort((a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em))).slice(0, 3);
    return h('section', { class: 'card lateral' },
      h('div', { class: 'titulo-secao' }, h('h2', null, h('span', { class: 'ico-ouro' }, icone('play', 20)), 'Está assistindo'), h('a', { href: '#/perfil' }, 'Ver todos →')),
      meus.length ? h('ul', { class: 'mini-lista' }, meus.map((s) => {
        const t = porId[s.titulo_id];
        const prog = t.tipo === 'serie' && s.temporada_atual && s.episodio_atual ? `T${s.temporada_atual} · Ep. ${s.episodio_atual}` : rotuloCategoria(t);
        return h('li', null, h('a', { href: '#/titulo/' + t.id }, h('span', { class: 'mini-capa' }, capa(t)), h('span', null, h('strong', null, t.nome), h('small', null, prog))));
      })) : h('p', { class: 'suave' }, 'Nada em andamento. Marque um título como “assistindo”.'));
  }

  function atividade(titulos, status, porId, quem) {
    const eventos = [];
    status.forEach((s) => { if (s.atualizado_em && quem[s.membro_id] && porId[s.titulo_id]) eventos.push({ quando: s.atualizado_em, m: quem[s.membro_id], t: porId[s.titulo_id], txt: VERBO[s.status], cor: COR_STATUS[s.status] }); });
    titulos.forEach((t) => { if (t.criado_em && quem[t.adicionado_por]) eventos.push({ quando: t.criado_em, m: quem[t.adicionado_por], t, txt: 'indicou', cor: 'var(--ouro)' }); });
    eventos.sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
    return h('section', { class: 'card lateral' },
      h('div', { class: 'titulo-secao' }, h('h2', null, h('span', { class: 'ico-ouro' }, icone('raio', 20)), 'Atividade recente')),
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
      h('div', { class: 'titulo-secao' }, h('h2', null, h('span', { class: 'ico-ouro' }, icone('marcador', 20)), 'Quero ver'), h('a', { href: '#/perfil' }, 'Ver todos →')),
      meus.length ? h('ul', { class: 'mini-lista' }, meus.map((s) => { const t = porId[s.titulo_id];
        return h('li', null, h('a', { href: '#/titulo/' + t.id }, h('span', { class: 'mini-capa' }, capa(t)), h('span', null, h('strong', null, t.nome), h('small', null, rotuloCategoria(t) + (t.ano ? ' · ' + t.ano : ''))))); }))
        : h('p', { class: 'suave' }, 'Use o “+” nos títulos para montar sua lista.'));
  }
}
