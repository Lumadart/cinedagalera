import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo, achaTitulo } from '../estado.js';
import { casca, esqueleto, avisar, capa, avatar } from '../ui.js';
import { haQuanto, dataLonga, contagem, jaComecou, horaCurta } from '../datas.js';
import { buscaTitulos } from '../seletor.js';
import { chamar } from '../api.js';
import { carregarEventos, previaEventos, limparEventos, colagem, quemVai, programacao, relogio, seloData, TIPOS_EVENTO } from '../eventos.js';
import { seguro, suave, fundoImg } from '../ui.js';

export function telaEventos({ raiz, ativa }) {
  const rotuloCat = (t) => (t.tipo === 'filme' ? 'Filme' : 'Série');
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
    const prox = d.eventos.filter((e) => !e.cancelado && !jaComecou(e)).sort((a, b) => a.inicio.localeCompare(b.inicio));
    const passados = d.eventos.filter((e) => !e.cancelado && jaComecou(e)).sort((a, b) => b.inicio.localeCompare(a.inicio)).slice(0, 6);
    const abertas = d.votacoes.filter((v) => !v.encerrada);
    const fechadas = d.votacoes.filter((v) => v.encerrada).slice(-4).reverse();
    const refazer = async () => { limparEventos(); try { desenhar(await carregarEventos({ forcar: true })); } catch (e) { avisar(e.message, 'erro'); } };

    refazer.local = () => desenhar(d);   // redesenha com o que já está na memória (usado pelo "Eu vou" instantâneo)
    const [destaque, ...resto] = prox;
    montar(area,
      h('div', { class: 'titulo-linha' }, h('div', null, h('h1', null, 'Eventos'), h('p', { class: 'suave' }, 'Maratonas, noites temáticas e votações da galera.'))),
      destaque ? heroEvento(destaque, membros, d, refazer) : h('section', { class: 'ev-vazio' }, icone('calendario', 44), h('h2', null, 'Nenhum evento marcado'),
        h('p', { class: 'suave' }, 'Quando a galera marcar uma maratona ou noite temática, ela aparece aqui com contagem regressiva.' + (estado.membro.admin ? ' Crie um em Administração → Eventos.' : ''))),
      abertas.length ? h('section', { class: 'bloco-home' },
        h('div', { class: 'titulo-secao' }, h('h2', null, h('span', { class: 'ico-ouro' }, icone('check', 20)), 'Votações abertas')),
        h('div', { class: 'lista-votacoes' }, abertas.map((v) => cartaoVotacao(v, refazer)))) : null,
      resto.length ? h('section', { class: 'bloco-home' },
        h('div', { class: 'titulo-secao' }, h('h2', null, h('span', { class: 'ico-ouro' }, icone('calendario', 20)), 'Depois disso')),
        h('div', { class: 'lista-eventos' }, resto.map((e) => cartaoEvento(e, membros, d, refazer)))) : null,
      fechadas.length ? h('section', { class: 'bloco-home' },
        h('div', { class: 'titulo-secao' }, h('h2', null, 'Votações encerradas')),
        h('div', { class: 'lista-votacoes' }, fechadas.map((v) => cartaoVotacao(v, refazer)))) : null,
      passados.length ? h('section', { class: 'bloco-home' },
        h('div', { class: 'titulo-secao' }, h('h2', null, 'Já rolou')),
        h('div', { class: 'lista-eventos' }, passados.map((e) => cartaoEvento(e, membros, d, refazer)))) : null);
  }

  /** Botões "Eu vou / Talvez / Não vou" + quem já confirmou. */
  function presenca(e, membros, refazer) {
    const minha = e.presencas[estado.membro.id] || '';
    const passou = jaComecou(e);
    const vao = quemVai(e, membros, 'vou'), talvez = quemVai(e, membros, 'talvez');
    const botao = (valor, rotulo) => h('button', {
      type: 'button', class: 'resp' + (minha === valor ? ' ligada' : ''), 'aria-pressed': String(minha === valor), disabled: passou,
      onclick: async () => {
        // muda na hora; se o servidor recusar, volta ao que era
        const novo = minha === valor ? '' : valor, antes = e.presencas[estado.membro.id];
        const aplicar = (v) => { if (v) e.presencas[estado.membro.id] = v; else delete e.presencas[estado.membro.id]; if (refazer.local) refazer.local(); };
        aplicar(novo);
        try { await chamar('evento_presenca', { evento_id: e.id, resposta: novo }); limparEventos(); }
        catch (err) { avisar(err.message, 'erro'); aplicar(antes); }
      }
    }, rotulo);
    return h('div', { class: 'ev-presenca' },
      h('div', { class: 'resps', role: 'group', 'aria-label': 'Sua presença' }, botao('vou', 'Eu vou'), botao('talvez', 'Talvez'), botao('nao_vou', 'Não vou')),
      h('div', { class: 'ev-quem' }, vao.pilha, h('span', { class: 'suave pequeno' }, `${vao.total} ${vao.total === 1 ? 'confirmado' : 'confirmados'}` + (talvez.total ? ` · ${talvez.total} talvez` : ''))));
  }

  /** O próximo evento, em destaque: imagem, contagem regressiva, programação em linha do tempo e presença. */
  function heroEvento(e, membros, d, refazer) {
    const primeiro = e.titulos.map(achaTitulo).find(Boolean);
    const imagem = seguro(e.imagem_url);
    const fundo = imagem ? suave(h('img', { class: 'ev-hero-img', src: imagem, alt: '', referrerpolicy: 'no-referrer' })) : (primeiro ? fundoImg(primeiro, 'ev-hero-img') : null);
    const ligada = d.votacoes.find((v) => v.evento_id === e.id && !v.encerrada);
    const tem = e.titulos.length > 0;
    return h('section', { class: 'ev-hero' },
      fundo, h('div', { class: 'ev-hero-veu' }),
      h('div', { class: 'ev-hero-conteudo' + (tem ? '' : ' sem-programa') },
        h('div', { class: 'ev-hero-info' },
          h('div', { class: 'ev-linha' }, h('span', { class: 'ev-etiqueta' }, 'Próximo evento'), h('span', { class: 'pill-tipo fixo' }, TIPOS_EVENTO[e.tipo]), e.tema ? h('span', { class: 'suave pequeno' }, e.tema) : null),
          h('h2', null, e.nome),
          h('p', { class: 'ev-quando' }, icone('calendario', 18), dataLonga(e.inicio), e.local ? ' · ' + e.local : ''),
          relogio(e.inicio, ativa),
          e.descricao ? h('p', { class: 'ev-desc' }, e.descricao) : null,
          presenca(e, membros, refazer),
          ligada ? h('p', { class: 'ev-aviso' }, '🗳️ Tem votação aberta para este evento — veja logo abaixo.') : null),
        tem ? h('div', { class: 'ev-hero-programa' }, programa(e)) : null),
      e.sugestoes_max > 0 ? h('div', { class: 'ev-hero-sugestoes' }, sugestoes(e, membros, refazer)) : null);
  }

  function cartaoEvento(e, membros, d, refazer) {
    const ligada = d.votacoes.find((v) => v.evento_id === e.id && !v.encerrada);
    const ts = e.titulos.map(achaTitulo).filter(Boolean);
    return h('article', { class: 'card evento' },
      colagem(e),
      h('div', { class: 'ev-corpo' },
        h('div', { class: 'ev-linha' }, seloData(e.inicio), h('div', { class: 'ev-titulo-bloco' },
          h('div', { class: 'ev-linha' }, h('span', { class: 'pill-tipo fixo' }, TIPOS_EVENTO[e.tipo]), e.tema ? h('span', { class: 'suave pequeno' }, e.tema) : null),
          h('h3', null, e.nome))),
        h('p', { class: 'ev-quando' }, icone('calendario', 16), dataLonga(e.inicio), e.local ? ' · ' + e.local : '', h('span', { class: 'suave' }, ' · ' + contagem(e.inicio))),
        e.descricao ? h('p', { class: 'suave ev-desc' }, e.descricao) : null,
        ts.length ? programa(e) : null,
        e.sugestoes_max > 0 ? sugestoes(e, membros, refazer) : null,
        ligada ? h('p', { class: 'ev-aviso' }, 'Tem votação aberta ligada a este evento ↑') : null,
        presenca(e, membros, refazer)));
  }

  /** Os filmes que vão, com dia e horário. */
  function programa(e) {
    const itens = programacao(e).map((x) => ({ ...x, t: achaTitulo(x.titulo_id) })).filter((x) => x.t);
    return h('div', { class: 'programa linha-tempo' },
      h('h4', null, 'Programação'),
      h('ol', null, itens.map((x) => h('li', null,
        h('a', { href: '#/titulo/' + x.t.id, class: 'prog-item' },
          h('span', { class: 'mini-capa p' }, capa(x.t)),
          h('span', { class: 'prog-nome' }, h('strong', null, x.t.nome), h('small', { class: 'suave' }, [x.t.ano, rotuloCat(x.t)].filter(Boolean).join(' · '))),
          h('span', { class: 'prog-hora' + (x.inicio ? '' : ' a-definir') }, x.inicio ? horaCurta(x.inicio) : 'horário a definir'))))));
  }

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
    const busca = buscaTitulos({
      placeholder: 'Buscar no catálogo para sugerir…', excluir: () => minhas.map((x) => x.titulo_id),
      aoEscolher: async (t) => {
        msg.textContent = '';
        try { await chamar('evento_sugerir', { evento_id: e.id, titulo_id: t.id }); avisar(`“${t.nome}” sugerido!`); await refazer(); }
        catch (err) { msg.textContent = err.message; }
      }
    });
    return h('div', { class: 'sugestoes-bloco' },
      h('h4', null, 'Sugestões da galera', aberta ? h('small', { class: 'suave' }, ` · você usou ${minhas.length} de ${e.sugestoes_max}`) : h('small', { class: 'suave' }, ' · encerradas')),
      aberta && minhas.length < e.sugestoes_max ? busca.el : null,
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
            ev.currentTarget.classList.add('salvando'); ev.currentTarget.disabled = true;
            try { await chamar('votar', { votacao_id: v.id, titulo_id: id }); avisar('Voto registrado!'); await refazer(); }
            catch (err) { avisar(err.message, 'erro'); ev.currentTarget.classList.remove('salvando'); ev.currentTarget.disabled = false; }
          } }, 'Votar') : null);
      })),
      aberta && podeVer === false && v.max_votos > 1 ? h('p', { class: 'suave pequeno' }, 'O placar aparece quando você usar todos os seus votos.') : null,
      aberta && v.max_votos === 1 && !meus.length ? h('p', { class: 'suave pequeno' }, 'O placar aparece depois do seu voto.') : null);
  }
}
