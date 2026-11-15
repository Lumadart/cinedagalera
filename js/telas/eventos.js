import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo, achaTitulo } from '../estado.js';
import { casca, esqueleto, avisar, capa, haQuanto } from '../ui.js';
import { cartaoTitulo } from '../cartao.js';
import { carregarEventos, limparEventos, chamar, dataLonga, contagem, jaComecou, colagem, quemVai, TIPOS_EVENTO } from '../eventos.js';

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
        ts.length ? h('div', { class: 'ev-titulos' }, ts.map((t) => h('a', { href: '#/titulo/' + t.id, class: 'chip-titulo' }, h('span', { class: 'mini-capa p' }, capa(t)), t.nome))) : null,
        ligada ? h('p', { class: 'ev-aviso' }, 'Tem votação aberta ligada a este evento ↑') : null,
        h('div', { class: 'ev-presenca' },
          h('div', { class: 'resps', role: 'group', 'aria-label': 'Sua presença' }, botao('vou', 'Eu vou'), botao('talvez', 'Talvez'), botao('nao_vou', 'Não vou')),
          h('div', { class: 'ev-quem' }, vao.pilha, h('span', { class: 'suave pequeno' }, `${vao.total} ${vao.total === 1 ? 'confirmado' : 'confirmados'}` + (talvez.total ? ` · ${talvez.total} talvez` : ''))))));
  }

  function cartaoVotacao(v, refazer) {
    const aberta = !v.encerrada;
    const podeVer = !!v.contagem;
    const max = podeVer ? Math.max(1, ...Object.values(v.contagem)) : 1;
    return h('article', { class: 'card votacao' + (aberta ? '' : ' fechada') },
      h('div', { class: 'vt-topo' },
        h('h3', null, v.pergunta),
        h('span', { class: 'suave pequeno' }, aberta ? (v.encerra_em ? 'até ' + dataLonga(v.encerra_em) : 'sem prazo') : 'encerrada ' + haQuanto(v.encerrada_em || v.encerra_em))),
      !aberta && v.empate.length ? h('p', { class: 'ev-aviso' }, 'Deu empate — a decisão fica com os admins.') : null,
      h('div', { class: 'vt-opcoes' }, v.opcoes.map((id) => {
        const t = achaTitulo(id);
        if (!t) return null;
        const n = podeVer ? v.contagem[id] || 0 : null;
        const meu = v.meu_voto === id, venceu = v.vencedor === id;
        return h('div', { class: 'vt-opcao' + (meu ? ' meu' : '') + (venceu ? ' venceu' : '') },
          h('a', { class: 'vt-capa', href: '#/titulo/' + t.id, 'aria-label': 'Abrir ' + t.nome }, capa(t)),
          h('strong', { class: 'vt-nome' }, t.nome),
          podeVer ? h('div', { class: 'vt-barra', 'aria-label': `${n} votos` }, h('span', { style: { width: Math.round((n / max) * 100) + '%' } })) : null,
          podeVer ? h('small', { class: 'suave' }, `${n} ${n === 1 ? 'voto' : 'votos'}` + (venceu ? ' · 🏆' : meu ? ' · seu voto' : '')) : null,
          aberta && !v.meu_voto ? h('button', { type: 'button', class: 'btn-contorno', onclick: async (ev) => {
            ev.target.disabled = true;
            try { await chamar('votar', { votacao_id: v.id, titulo_id: id }); avisar('Voto registrado!'); await refazer(); }
            catch (err) { avisar(err.message, 'erro'); ev.target.disabled = false; }
          } }, 'Votar') : null);
      })),
      aberta && !v.meu_voto ? h('p', { class: 'suave pequeno' }, 'Cada pessoa vota uma vez só — e o placar aparece depois do seu voto.') : null);
  }
}
