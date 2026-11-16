import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo, achaTitulo } from '../estado.js';
import { casca, esqueleto, avisar, capa, haQuanto, avatar, normalizar } from '../ui.js';
import { cartaoTitulo } from '../cartao.js';
import { carregarEventos, limparEventos, chamar, dataLonga, contagem, jaComecou, colagem, quemVai, programacao, horaCurta, TIPOS_EVENTO } from '../eventos.js';

export function telaEventos({ raiz, ativa }) {
  const area = h('div', { class: 'eventos' }, esqueleto('lista', 3));
  montar(raiz, casca('eventos', area));
  Promise.all([carregarCatalogo(), carregarEventos({ forcar: true })])
    .then(([, d]) => { if (ativa()) desenhar(d); })
    .catch((e) => { if (ativa()) montar(area, h('p', { class: 'erro' }, e.message)); });

  function desenhar(d) {
    const membros = estado.catalogo.membros;
    const prox = d.eventos.filter((e) => !e.cancelado && !jaComecou(e)).sort((a, b) => a.inicio.localeCompare(b.inicio));
    const passados = d.eventos.filter((e) => !e.cancelado && jaComecou(e)).sort((a, b) => b.inicio.localeCompare(a.inicio)).slice(0, 6);
    const abertas = d.votacoes.filter((v) => !v.encerrada);
    const fechadas = d.votacoes.filter((v) => v.encerrada).slice(-4).reverse();
    const refazer = async () => { limparEventos(); try { desenhar(await carregarEventos({ forcar: true })); } catch (e) { avisar(e.message, 'erro'); } };

    montar(area,
      h('div', { class: 'titulo-linha' }, h('div', null, h('h1', null, 'Eventos'), h('p', { class: 'suave' }, 'Maratonas, noites temáticas e votações da galera.'))),
      abertas.length ? h('section', { class: 'bloco-home' },
        h('div', { class: 'titulo-secao' }, h('h2', null, h('span', { class: 'ico-ouro' }, icone('check', 20)), 'Votações abertas')),
        h('div', { class: 'lista-votacoes' }, abertas.map((v) => cartaoVotacao(v, refazer)))) : null,
      h('section', { class: 'bloco-home' },
        h('div', { class: 'titulo-secao' }, h('h2', null, h('span', { class: 'ico-ouro' }, icone('calendario', 20)), 'Próximos eventos')),
        prox.length ? h('div', { class: 'lista-eventos' }, prox.map((e) => cartaoEvento(e, membros, d, refazer)))
          : h('p', { class: 'suave' }, 'Nenhum evento marcado por enquanto.' + (estado.membro.admin ? ' Crie um em Administração → Eventos.' : ''))),
      fechadas.length ? h('section', { class: 'bloco-home' },
        h('div', { class: 'titulo-secao' }, h('h2', null, 'Votações encerradas')),
        h('div', { class: 'lista-votacoes' }, fechadas.map((v) => cartaoVotacao(v, refazer)))) : null,
      passados.length ? h('section', { class: 'bloco-home' },
        h('div', { class: 'titulo-secao' }, h('h2', null, 'Já rolou')),
        h('div', { class: 'lista-eventos' }, passados.map((e) => cartaoEvento(e, membros, d, refazer)))) : null);
  }

  function cartaoEvento(e, membros, d, refazer) {
    const minha = e.presencas[estado.membro.id] || '';
    const passou = jaComecou(e);
    const vao = quemVai(e, membros, 'vou'), talvez = quemVai(e, membros, 'talvez');
    const ligada = d.votacoes.find((v) => v.evento_id === e.id && !v.encerrada);
    const ts = e.titulos.map(achaTitulo).filter(Boolean);
    const botao = (valor, rotulo) => h('button', {
      type: 'button', class: 'resp' + (minha === valor ? ' ligada' : ''), 'aria-pressed': String(minha === valor), disabled: passou,
      onclick: async (ev) => {
        ev.target.disabled = true;
        try { await chamar('evento_presenca', { evento_id: e.id, resposta: minha === valor ? '' : valor }); await refazer(); }
        catch (err) { avisar(err.message, 'erro'); ev.target.disabled = false; }
      }
    }, rotulo);
    return h('article', { class: 'card evento' },
      colagem(e),
      h('div', { class: 'ev-corpo' },
        h('div', { class: 'ev-linha' }, h('span', { class: 'pill-tipo fixo' }, TIPOS_EVENTO[e.tipo]), e.tema ? h('span', { class: 'suave pequeno' }, e.tema) : null),
        h('h3', null, e.nome),
        h('p', { class: 'ev-quando' }, icone('calendario', 16), dataLonga(e.inicio), e.local ? ' · ' + e.local : '', h('span', { class: 'suave' }, ' · ' + contagem(e.inicio))),
        e.descricao ? h('p', { class: 'suave ev-desc' }, e.descricao) : null,
        ts.length ? programa(e) : null,
        e.sugestoes_max > 0 ? sugestoes(e, membros, refazer) : null,
        ligada ? h('p', { class: 'ev-aviso' }, 'Tem votação aberta ligada a este evento ↑') : null,
        h('div', { class: 'ev-presenca' },
          h('div', { class: 'resps', role: 'group', 'aria-label': 'Sua presença' }, botao('vou', 'Eu vou'), botao('talvez', 'Talvez'), botao('nao_vou', 'Não vou')),
          h('div', { class: 'ev-quem' }, vao.pilha, h('span', { class: 'suave pequeno' }, `${vao.total} ${vao.total === 1 ? 'confirmado' : 'confirmados'}` + (talvez.total ? ` · ${talvez.total} talvez` : ''))))));
  }

  /** Os filmes que vão, com dia e horário. */
  function programa(e) {
    const itens = programacao(e).map((x) => ({ ...x, t: achaTitulo(x.titulo_id) })).filter((x) => x.t);
    return h('div', { class: 'programa' },
      h('h4', null, 'Programação'),
      h('ol', null, itens.map((x) => h('li', null,
        h('a', { href: '#/titulo/' + x.t.id, class: 'prog-item' },
          h('span', { class: 'mini-capa p' }, capa(x.t)),
          h('span', { class: 'prog-nome' }, h('strong', null, x.t.nome), h('small', { class: 'suave' }, [x.t.ano, rotuloCat(x.t)].filter(Boolean).join(' · '))),
          h('span', { class: 'prog-hora' + (x.inicio ? '' : ' a-definir') }, x.inicio ? horaCurta(x.inicio) : 'horário a definir'))))));
  }
  const rotuloCat = (t) => (t.tipo === 'filme' ? 'Filme' : 'Série');

  /** Sugestões da galera para o evento. */
  function sugestoes(e, membros, refazer) {
    const meuId = estado.membro.id;
    const minhas = e.sugestoes.filter((x) => x.membro_id === meuId);
    const aberta = e.sugestoes_abertas;
    const porTitulo = {};
    e.sugestoes.forEach((x) => { (porTitulo[x.titulo_id] = porTitulo[x.titulo_id] || []).push(x.membro_id); });
    const ids = Object.keys(porTitulo);
    if (!aberta && !ids.length) return null;
    const msg = h('p', { class: 'erro', role: 'alert' });
    const lista = h('ul', { class: 'sugestoes-lista' }, ids.map((id) => {
      const t = achaTitulo(id); if (!t) return null;
      const quem = porTitulo[id].map((mid) => membros.find((m) => m.id === mid)).filter(Boolean);
      const sou = porTitulo[id].includes(meuId);
      return h('li', null, h('a', { href: '#/titulo/' + t.id, class: 'chip-titulo' }, h('span', { class: 'mini-capa p' }, capa(t)), t.nome),
        h('span', { class: 'pilha-avatares' }, quem.map((m) => avatar(m, { tamanho: 22, dica: m.nome }))),
        aberta && sou ? h('button', { type: 'button', class: 'link-discreto', 'aria-label': 'Remover minha sugestão ' + t.nome, onclick: async () => {
          try { await chamar('evento_sugestao_remover', { evento_id: e.id, titulo_id: id }); await refazer(); } catch (err) { avisar(err.message, 'erro'); } } }, 'remover') : null);
    }));
    const campo = h('input', { type: 'search', placeholder: 'Buscar no catálogo para sugerir…', autocomplete: 'off', 'aria-label': 'Sugerir filme' });
    const achados = h('ul', { class: 'sugestoes' });
    campo.addEventListener('input', () => {
      const q = normalizar(campo.value.trim());
      const lista2 = q ? estado.catalogo.titulos.filter((t) => !minhas.some((x) => x.titulo_id === t.id) && normalizar(t.nome).includes(q)).slice(0, 5) : [];
      montar(achados, lista2.map((t) => h('li', null, h('button', { type: 'button', onclick: async () => {
        msg.textContent = '';
        try { await chamar('evento_sugerir', { evento_id: e.id, titulo_id: t.id }); avisar(`“${t.nome}” sugerido!`); await refazer(); }
        catch (err) { msg.textContent = err.message; }
      } }, h('span', { class: 'mini-capa p' }, capa(t)), t.nome, h('small', { class: 'suave' }, ' ' + (t.ano || ''))))));
    });
    return h('div', { class: 'sugestoes-bloco' },
      h('h4', null, 'Sugestões da galera', aberta ? h('small', { class: 'suave' }, ` · você usou ${minhas.length} de ${e.sugestoes_max}`) : h('small', { class: 'suave' }, ' · encerradas')),
      aberta && minhas.length < e.sugestoes_max ? h('div', { class: 'seletor' }, campo, achados) : null,
      aberta && minhas.length >= e.sugestoes_max ? h('p', { class: 'suave pequeno' }, 'Você já usou todas as suas sugestões. Remova uma para trocar.') : null,
      msg,
      ids.length ? lista : h('p', { class: 'suave pequeno' }, 'Ninguém sugeriu ainda. Seja o primeiro!'));
  }

  function cartaoVotacao(v, refazer) {
    const aberta = !v.encerrada;
    const podeVer = !!v.contagem;
    const max = podeVer ? Math.max(1, ...Object.values(v.contagem)) : 1;
    const meus = v.meus_votos || [];
    const restantes = v.max_votos - meus.length;
    return h('article', { class: 'card votacao' + (aberta ? '' : ' fechada') },
      h('div', { class: 'vt-topo' },
        h('h3', null, v.pergunta),
        h('span', { class: 'suave pequeno' }, aberta ? (v.encerra_em ? 'até ' + dataLonga(v.encerra_em) : 'sem prazo') : 'encerrada ' + haQuanto(v.encerrada_em || v.encerra_em))),
      aberta ? h('p', { class: 'suave pequeno' },
        v.max_votos === 1 ? 'Cada pessoa vota uma vez só.' : `Você tem ${v.max_votos} votos (um por título) — ${restantes > 0 ? `faltam ${restantes}` : 'todos usados'}.`,
        v.vagas > 1 ? ` Entram no evento os ${v.vagas} mais votados.` : '') : null,
      !aberta && v.empate.length ? h('p', { class: 'ev-aviso' }, 'Deu empate na última vaga — a decisão fica com os admins.') : null,
      h('div', { class: 'vt-opcoes' }, v.opcoes.map((id) => {
        const t = achaTitulo(id);
        if (!t) return null;
        const n = podeVer ? v.contagem[id] || 0 : null;
        const meu = meus.includes(id), venceu = v.vencedores.includes(id);
        return h('div', { class: 'vt-opcao' + (meu ? ' meu' : '') + (venceu ? ' venceu' : '') },
          h('a', { class: 'vt-capa', href: '#/titulo/' + t.id, 'aria-label': 'Abrir ' + t.nome }, capa(t)),
          h('strong', { class: 'vt-nome' }, t.nome),
          podeVer ? h('div', { class: 'vt-barra', 'aria-label': `${n} votos` }, h('span', { style: { width: Math.round((n / max) * 100) + '%' } })) : null,
          podeVer ? h('small', { class: 'suave' }, `${n} ${n === 1 ? 'voto' : 'votos'}` + (venceu ? ' · 🏆' : meu ? ' · seu voto' : '')) : (meu ? h('small', { class: 'suave' }, '✓ seu voto') : null),
          aberta && restantes > 0 && !meu ? h('button', { type: 'button', class: 'btn-contorno', onclick: async (ev) => {
            ev.target.disabled = true;
            try { await chamar('votar', { votacao_id: v.id, titulo_id: id }); avisar('Voto registrado!'); await refazer(); }
            catch (err) { avisar(err.message, 'erro'); ev.target.disabled = false; }
          } }, 'Votar') : null);
      })),
      aberta && podeVer === false && v.max_votos > 1 ? h('p', { class: 'suave pequeno' }, 'O placar aparece quando você usar todos os seus votos.') : null,
      aberta && v.max_votos === 1 && !meus.length ? h('p', { class: 'suave pequeno' }, 'O placar aparece depois do seu voto.') : null);
  }
}
