import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo, achaTitulo } from '../estado.js';
import { casca, esqueleto, avisar, capa } from '../ui.js';
import { haQuanto, dataLonga, contagem, jaComecou } from '../datas.js';
import { chamar } from '../api.js';
import { carregarEventos, previaEventos, limparEventos, colagem, quemVai, seloData, diaLongo, hhmm, TIPOS_EVENTO, faseRotulo } from '../eventos.js';

let filtro = 'proximos';   // lembrado enquanto o site estiver aberto

export function telaEventos({ raiz, ativa }) {
  const area = h('div', { class: 'eventos' }, esqueleto('lista', 3));
  montar(raiz, casca('eventos', area));
  // Se já temos o catálogo e uma versão anterior dos eventos, mostra na hora e atualiza em segundo plano.
  const previa = estado.catalogo ? previaEventos() : null;
  let mostrado = previa ? JSON.stringify(previa) : '';
  if (previa) desenhar(previa);
  Promise.all([carregarCatalogo(), carregarEventos({ forcar: true })])
    .then(([, d]) => { if (ativa() && JSON.stringify(d) !== mostrado) desenhar(d); })
    .catch((e) => { if (ativa() && !previa) montar(area, h('p', { class: 'erro' }, e.message)); });

  function desenhar(d) {
    const membros = estado.catalogo.membros;
    const todos = d.eventos.filter((e) => !e.cancelado);
    const proximos = todos.filter((e) => !jaComecou(e)).sort((a, b) => a.inicio.localeCompare(b.inicio));
    const passados = todos.filter((e) => jaComecou(e)).sort((a, b) => b.inicio.localeCompare(a.inicio));
    const lista = filtro === 'proximos' ? proximos : filtro === 'passados' ? passados : [...proximos, ...passados];
    // votações que não pertencem a nenhum evento aparecem aqui; as de um evento ficam na página dele
    const avulsas = d.votacoes.filter((v) => !v.evento_id || !todos.some((e) => e.id === v.evento_id));
    const abertas = avulsas.filter((v) => !v.encerrada);
    const fechadas = avulsas.filter((v) => v.encerrada).slice(-4).reverse();
    const refazer = async () => { limparEventos(); try { desenhar(await carregarEventos({ forcar: true })); } catch (e) { avisar(e.message, 'erro'); } };

    const chip = (id, texto, n) => h('button', { type: 'button', class: 'chip' + (filtro === id ? ' ligado' : ''), 'aria-pressed': String(filtro === id),
      onclick: () => { filtro = id; desenhar(d); } }, texto, h('span', { class: 'contador' }, String(n)));

    montar(area,
      h('div', { class: 'titulo-linha' }, h('div', null, h('h1', null, h('span', { class: 'ico-ouro' }, icone('calendario', 30)), 'Eventos'),
        h('p', { class: 'suave' }, 'Maratonas, noites temáticas e votações da comunidade.'))),
      h('div', { class: 'filtros ev-filtros' }, chip('proximos', 'Em breve', proximos.length), chip('passados', 'Já rolou', passados.length), chip('todos', 'Todos', todos.length)),
      lista.length
        ? h('div', { class: 'ev-lista' }, lista.map((e, i) => linhaEvento(e, membros, filtro !== 'passados' && !jaComecou(e) && i === 0)))
        : h('section', { class: 'ev-vazio' }, icone('calendario', 44), h('h2', null, filtro === 'passados' ? 'Nenhum evento passado' : 'Nenhum evento marcado'),
          h('p', { class: 'suave' }, 'Quando a comunidade marcar uma maratona ou noite temática, ela aparece aqui.' + (estado.membro.admin ? ' Crie um em Administração → Eventos.' : ''))),
      abertas.length ? h('section', { class: 'bloco-home' },
        h('div', { class: 'titulo-secao' }, h('h2', null, h('span', { class: 'ico-ouro' }, icone('check', 20)), 'Votações abertas')),
        h('div', { class: 'lista-votacoes' }, abertas.map((v) => cartaoVotacao(v, refazer)))) : null,
      fechadas.length ? h('section', { class: 'bloco-home' },
        h('div', { class: 'titulo-secao' }, h('h2', null, 'Votações encerradas')),
        h('div', { class: 'lista-votacoes' }, fechadas.map((v) => cartaoVotacao(v, refazer)))) : null);
  }

  /** Uma linha da lista: selo de data, capa, nome, quando e quantos vão. */
  function linhaEvento(e, membros, proximo) {
    const vao = quemVai(e, membros, 'vou', 4);
    const filmes = e.titulos.length;
    return h('a', { class: 'ev-item' + (proximo ? ' proximo' : ''), href: '#/evento/' + e.id },
      h('div', { class: 'ev-item-capa' }, colagem(e), seloData(e.inicio)),
      h('div', { class: 'ev-item-corpo' },
        h('div', { class: 'ev-linha' }, proximo ? h('span', { class: 'ev-etiqueta' }, 'Próximo') : null, faseRotulo(e) ? h('span', { class: 'ev-fase-pill f-' + e.fase }, faseRotulo(e)) : null, h('span', { class: 'pill-tipo fixo' }, TIPOS_EVENTO[e.tipo] || 'Evento'), e.tema ? h('span', { class: 'suave pequeno' }, e.tema) : null),
        h('h2', null, e.nome),
        e.descricao ? h('p', { class: 'suave ev-item-desc' }, e.descricao) : null,
        h('p', { class: 'ev-item-meta' }, icone('calendario', 16), diaLongo(e.inicio) + ' · ' + hhmm(e.inicio),
          h('span', { class: 'suave' }, jaComecou(e) ? '' : ' · ' + contagem(e.inicio)),
          filmes ? h('span', { class: 'suave' }, ` · ${filmes} ${filmes === 1 ? 'filme' : 'filmes'}`) : null)),
      h('div', { class: 'ev-item-lado' },
        h('div', { class: 'ev-quem' }, vao.pilha, h('span', { class: 'suave pequeno' }, `${vao.total} ${vao.total === 1 ? 'confirmado' : 'confirmados'}`)),
        h('span', { class: 'btn-primario ev-ver' }, 'Ver detalhes')));
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
            ev.currentTarget.classList.add('salvando'); ev.currentTarget.disabled = true;
            try { await chamar('votar', { votacao_id: v.id, titulo_id: id }); avisar('Voto registrado!'); await refazer(); }
            catch (err) { avisar(err.message, 'erro'); ev.currentTarget.classList.remove('salvando'); ev.currentTarget.disabled = false; }
          } }, 'Votar') : null);
      })),
      aberta && podeVer === false && v.max_votos > 1 ? h('p', { class: 'suave pequeno' }, 'O placar aparece quando você usar todos os seus votos.') : null,
      aberta && v.max_votos === 1 && !meus.length ? h('p', { class: 'suave pequeno' }, 'O placar aparece depois do seu voto.') : null);
  }
}
