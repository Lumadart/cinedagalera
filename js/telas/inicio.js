import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo, aplicarStatusLocal } from '../estado.js';
import { chamar } from '../api.js';
import { casca, avatar, capa, avisar, ROTULOS, COR_STATUS, rotuloCategoria, seguro, haQuanto } from '../ui.js';

const VERBO = { visto: 'viu', assistindo: 'está assistindo', quero_ver: 'quer ver' };

export function telaInicio({ raiz, ativa }) {
  const conteudo = h('div', { class: 'inicio' }, h('p', { class: 'suave' }, 'Carregando…'));
  montar(raiz, casca('inicio', conteudo, { larga: true }));

  const pronto = () => { if (ativa()) desenhar(); };
  if (estado.catalogo) desenhar();
  carregarCatalogo().then(pronto).catch((e) => {
    if (!ativa() || estado.catalogo) return;
    montar(conteudo, h('p', { class: 'erro' }, e.message),
      h('button', { type: 'button', class: 'btn-sec', onclick: () => telaInicio({ raiz, ativa }) }, 'Tentar de novo'));
  });

  function desenhar() {
    const { titulos, membros, status } = estado.catalogo;
    const porId = Object.fromEntries(titulos.map((t) => [t.id, t]));
    const quem = Object.fromEntries(membros.map((m) => [m.id, m]));
    const recentes = titulos.slice().sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    montar(conteudo,
      h('div', { class: 'inicio-principal' }, hero(recentes[0], quem), continuar(porId), novidades(recentes)),
      h('aside', { class: 'inicio-lateral' }, galera(membros), atividade(titulos, status, porId, quem))
    );
  }

  function hero(t, quem) {
    if (!t) {
      return h('section', { class: 'hero vazio' },
        h('div', { class: 'hero-texto' },
          h('span', { class: 'etiqueta' }, 'Bem-vindo'),
          h('h1', null, 'O catálogo da galera começa aqui'),
          h('p', null, 'Busque um filme, série, anime ou dorama e indique o primeiro título.'),
          h('a', { class: 'btn-primario', href: '#/adicionar' }, 'Adicionar título')));
    }
    const fundo = seguro(t.capa_url);
    const indicador = quem[t.adicionado_por];
    const meu = estado.catalogo.status.find((s) => s.membro_id === estado.membro.id && s.titulo_id === t.id);
    const botaoLista = h('button', {
      type: 'button', class: 'btn-icone', 'aria-label': 'Quero ver ' + t.nome, title: meu ? ROTULOS[meu.status] : 'Quero ver',
      disabled: !!meu,
      onclick: async () => {
        botaoLista.disabled = true;
        try {
          await chamar('marcar_status', { titulo_id: t.id, status: 'quero_ver' });
          aplicarStatusLocal(estado.membro.id, t.id, { status: 'quero_ver' });
          avisar(`“${t.nome}” entrou na sua lista.`); desenhar();
        } catch (e) { avisar(e.message, 'erro'); botaoLista.disabled = false; }
      }
    }, icone(meu ? 'check' : 'mais', 20));
    return h('section', { class: 'hero' },
      fundo ? h('img', { class: 'hero-fundo', src: fundo, alt: '', referrerpolicy: 'no-referrer' }) : null,
      h('div', { class: 'hero-texto' },
        h('span', { class: 'etiqueta' }, 'Última indicação'),
        h('h1', null, t.nome),
        h('p', { class: 'hero-meta' }, [rotuloCategoria(t), t.ano, t.nota_tmdb !== null ? '★ ' + String(t.nota_tmdb).replace('.', ',') : null].filter(Boolean).join(' · ')),
        h('p', { class: 'hero-sinopse' }, t.recado ? `“${t.recado}” — ${indicador ? indicador.nome : 'alguém da galera'}` : (t.sinopse || '')),
        h('div', { class: 'hero-acoes' }, h('a', { class: 'btn-primario', href: '#/titulo/' + t.id }, 'Ver ficha'), botaoLista)
      ),
      h('div', { class: 'hero-capa' }, capa(t))
    );
  }

  function continuar(porId) {
    const meus = estado.catalogo.status
      .filter((s) => s.membro_id === estado.membro.id && s.status === 'assistindo' && porId[s.titulo_id])
      .sort((a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em)));
    return h('section', { class: 'bloco-home' },
      h('div', { class: 'titulo-secao' }, h('h2', null, 'Continue assistindo')),
      meus.length ? h('div', { class: 'linha-cards' }, meus.slice(0, 6).map((s) => {
        const t = porId[s.titulo_id];
        const serie = t.tipo === 'serie';
        const prog = serie && s.temporada_atual && s.episodio_atual ? `T${s.temporada_atual} · E${s.episodio_atual}` : (serie ? 'Sem episódio marcado' : 'Em andamento');
        const pct = serie && t.temporadas === 1 && t.episodios && s.episodio_atual ? Math.min(100, Math.round((s.episodio_atual / t.episodios) * 100)) : null;
        return h('a', { class: 'card-continuar', href: '#/titulo/' + t.id },
          h('div', { class: 'mini-capa' }, capa(t)),
          h('div', { class: 'cc-info' }, h('strong', null, t.nome), h('span', { class: 'suave pequeno' }, prog),
            pct !== null ? h('div', { class: 'barra', role: 'img', 'aria-label': pct + '% assistido' }, h('span', { style: { width: pct + '%' } })) : null));
      })) : h('p', { class: 'suave' }, 'Nada em andamento. Marque um título como “Assistindo” e ele aparece aqui.')
    );
  }

  function novidades(recentes) {
    return h('section', { class: 'bloco-home' },
      h('div', { class: 'titulo-secao' }, h('h2', null, 'Novidades no catálogo'), h('a', { href: '#/catalogo' }, 'Ver todos →')),
      recentes.length ? h('div', { class: 'linha-posters' }, recentes.slice(0, 8).map((t) =>
        h('a', { class: 'poster', href: '#/titulo/' + t.id, 'aria-label': t.nome }, capa(t), h('span', { class: 'poster-nome' }, t.nome)))) :
        h('p', { class: 'suave' }, 'Ainda não há títulos.')
    );
  }

  function galera(membros) {
    return h('section', { class: 'card lateral' },
      h('div', { class: 'titulo-secao' }, h('h2', null, 'A galera'), h('span', { class: 'suave pequeno' }, membros.length + (membros.length === 1 ? ' membro' : ' membros'))),
      h('ul', { class: 'galera' }, membros.map((m) => h('li', { title: m.nome }, avatar(m, { tamanho: 46 }), h('span', null, m.nome.split(' ')[0]))))
    );
  }

  function atividade(titulos, status, porId, quem) {
    const eventos = [];
    status.forEach((s) => { if (s.atualizado_em && quem[s.membro_id] && porId[s.titulo_id]) eventos.push({ quando: s.atualizado_em, m: quem[s.membro_id], t: porId[s.titulo_id], txt: VERBO[s.status], cor: COR_STATUS[s.status] }); });
    titulos.forEach((t) => { if (t.criado_em && quem[t.adicionado_por]) eventos.push({ quando: t.criado_em, m: quem[t.adicionado_por], t, txt: 'indicou', cor: 'var(--ouro)' }); });
    eventos.sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
    return h('section', { class: 'card lateral' },
      h('div', { class: 'titulo-secao' }, h('h2', null, 'Atividade recente')),
      eventos.length ? h('ul', { class: 'atividade' }, eventos.slice(0, 6).map((e) =>
        h('li', null,
          avatar(e.m, { tamanho: 36, cor: e.cor }),
          h('div', { class: 'at-texto' }, h('span', null, h('strong', null, e.m.nome.split(' ')[0]), ' ' + e.txt + ' ', h('a', { href: '#/titulo/' + e.t.id }, e.t.nome)),
            h('span', { class: 'suave pequeno' }, haQuanto(e.quando))))))
        : h('p', { class: 'suave' }, 'Quando a galera marcar títulos, a atividade aparece aqui.')
    );
  }
}
