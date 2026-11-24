import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo, achaTitulo } from '../estado.js';
import { casca, esqueleto, avisar, capa, avatar, seguro, suave, fundoImg } from '../ui.js';
import { jaComecou } from '../datas.js';
import { buscaTitulos } from '../seletor.js';
import { chamar } from '../api.js';
import { carregarEventos, previaEventos, limparEventos, colagem, quemVai, programacao, relogio, diaLongo, hhmm, TIPOS_EVENTO, FASES, passosDoEvento, programaPorDia, textoEpisodios } from '../eventos.js';

/** Página de um evento: hero, abas (Filmes / Participantes), votação, programação e filmes já escolhidos. */
export function telaEvento({ raiz, params, ativa }) {
  const area = h('div', { class: 'evento-pag' }, esqueleto('lista', 3));
  montar(raiz, casca('eventos', area));
  let subaba = null, ultimoD = null, exibicoes = {};
  const dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).replace(' de ', ' ').replace('.', '');

  /** Para cada título: a última vez em que a comunidade o exibiu em algum evento (programação com horário passado ou evento já começado). */
  function mapaExibicoes(eventos) {
    const mapa = {}, agora = Date.now();
    eventos.filter((x) => !x.cancelado).forEach((x) => x.titulos.forEach((id) => {
      const quando = (x.horarios || {})[id] || x.inicio;
      if (!quando || new Date(quando).getTime() > agora) return;
      if (!mapa[id] || mapa[id].quando < quando) mapa[id] = { quando, evento: x.nome };
    }));
    return mapa;
  }
  const exibido = (id) => exibicoes[id] ? h('span', { class: 'ev-exibido', title: 'Exibido em: ' + exibicoes[id].evento }, icone('check', 13), 'Já exibido em ' + dataCurta(exibicoes[id].quando)) : null;

  const previa = estado.catalogo ? previaEventos() : null;
  if (previa) desenhar(previa);
  Promise.all([carregarCatalogo(), carregarEventos({ forcar: true })])
    .then(([, d]) => { if (ativa()) desenhar(d); })
    .catch((e) => { if (ativa() && !previa) montar(area, h('p', { class: 'erro' }, e.message)); });

  async function refazer() {
    limparEventos();
    try { desenhar(await carregarEventos({ forcar: true })); } catch (e) { avisar(e.message, 'erro'); }
  }

  function desenhar(d) {
    ultimoD = d;
    exibicoes = mapaExibicoes(d.eventos);
    const e = d.eventos.find((x) => x.id === params.id);
    const voltar = h('nav', { class: 'migalhas', 'aria-label': 'Onde estou' }, h('a', { href: '#/eventos' }, 'Eventos'), h('span', null, '›'), h('span', null, e ? e.nome : 'Evento'));
    if (!e) {
      montar(area, voltar, h('section', { class: 'ev-vazio' }, icone('calendario', 44), h('h2', null, 'Evento não encontrado'),
        h('p', { class: 'suave' }, 'Ele pode ter sido removido.'), h('a', { class: 'btn-sec', href: '#/eventos' }, 'Ver todos os eventos')));
      return;
    }
    const membros = estado.catalogo.membros;
    const votacao = d.votacoes.find((v) => v.evento_id === e.id && !v.encerrada) || null;
    const refazerLocal = () => desenhar(d);
    const vao = quemVai(e, membros, 'vou', 5);
    const talvez = Object.values(e.presencas || {}).filter((r) => r === 'talvez').length;

    if (!subaba) subaba = e.fase === 'votacao' || e.fase === 'empate' ? 'votacao' : e.fase === 'sugestoes' ? 'sugeridos' : (e.titulos.length ? 'selecionados' : 'sugeridos');
    montar(area, voltar, hero(e, membros, vao, talvez, refazerLocal), faixaFase(e), filmes(e, votacao, membros));

    function filmes(ev, vt, ms) {
      const selecionados = programacao(ev).map((x) => ({ ...x, t: achaTitulo(x.titulo_id) })).filter((x) => x.t);
      return h('div', { class: 'ev-filmes' },
        h('div', { class: 'ev-grade' },
          painelVotacao(ev, vt, ms, selecionados),
          h('aside', { class: 'ev-lateral' }, linhaTempo(selecionados, ev))),
        selecionados.length ? h('section', { class: 'ev-sec' },
          h('h2', null, `Filmes já selecionados (${selecionados.length})`),
          h('p', { class: 'suave pequeno' }, 'Estes títulos já estão confirmados para o evento.'),
          h('div', { class: 'ev-faixa' }, selecionados.map((x, i) => h('a', { href: '#/titulo/' + x.t.id, class: 'ev-sel' },
            h('span', { class: 'ev-sel-num' }, String(i + 1)), capa(x.t), h('strong', null, x.t.nome), h('small', { class: 'suave' }, x.t.ano || ''), exibido(x.t.id)))) ) : null);
    }
  }

  /** Passo a passo (só eventos com votação) e o aviso do que fazer agora. */
  function faixaFase(e) {
    const passos = passosDoEvento(e);
    const info = FASES[e.fase] || FASES.legado;
    if (!passos.length && !info[0]) return null;
    const c = e.cotas || {};
    let extra = '';
    if (e.fase === 'confirmacao') extra = ` As sugestões abrem em ${dataCurta(e.sug_ini)}.`;
    else if (e.fase === 'sugestoes') extra = ` Cada pessoa pode sugerir ${c.sugestoes_por_pessoa} ${c.sugestoes_por_pessoa === 1 ? 'título' : 'títulos'}; vão ${e.vagas} ${e.vagas === 1 ? 'título' : 'títulos'} ao evento. Até ${dataCurta(e.sug_fim)} às ${hhmm(e.sug_fim)}.`;
    else if (e.fase === 'votacao') extra = ` Você tem ${c.votos_por_pessoa} ${c.votos_por_pessoa === 1 ? 'voto' : 'votos'}. Até ${dataCurta(e.vot_fim)} às ${hhmm(e.vot_fim)}.`;
    return h('section', { class: 'ev-fases' },
      passos.length ? h('ol', { class: 'ev-passos' }, passos.map((p, i) => h('li', { class: 'ev-passo ' + p.estado },
        h('span', { class: 'ev-passo-bola' }, p.estado === 'feito' ? icone('check', 14) : String(i + 1)),
        h('strong', null, p.nome), p.data ? h('small', { class: 'suave' }, dataCurta(p.data)) : null))) : null,
      info[0] ? h('p', { class: 'ev-fase-txt' }, h('b', null, info[0] + '. '), info[1] + extra) : null);
  }

  /** A imagem do evento; sem ela, a capa do primeiro filme; sem filmes, a colagem padrão. */
  function poster(e, primeiro) {
    if (seguro(e.imagem_url) || !primeiro) return colagem(e);
    return h('div', { class: 'evp-capa' }, capa(primeiro, true));
  }

  // ---------- hero ----------
  function hero(e, membros, vao, talvez, refazerLocal) {
    const primeiro = e.titulos.map(achaTitulo).find(Boolean);
    const imagem = seguro(e.imagem_url);
    const fundo = imagem ? suave(h('img', { class: 'evp-fundo', src: imagem, alt: '', referrerpolicy: 'no-referrer' })) : (primeiro ? fundoImg(primeiro, 'evp-fundo') : null);
    const local = e.local ? (/^https:\/\//i.test(e.local) ? h('a', { href: e.local, target: '_blank', rel: 'noopener noreferrer' }, 'Entrar no evento online') : e.local) : null;
    const passou = jaComecou(e);
    const minha = e.presencas[estado.membro.id] || '';
    const botao = (valor, rotulo, classe = '') => h('button', {
      type: 'button', class: 'resp ' + classe + (minha === valor ? ' ligada' : ''), 'aria-pressed': String(minha === valor), disabled: passou,
      onclick: async () => {
        const novo = minha === valor ? '' : valor, antes = e.presencas[estado.membro.id];
        const aplicar = (v) => { if (v) e.presencas[estado.membro.id] = v; else delete e.presencas[estado.membro.id]; refazerLocal(); };
        aplicar(novo);
        try { await chamar('evento_presenca', { evento_id: e.id, resposta: novo }); limparEventos(); }
        catch (err) { avisar(err.message, 'erro'); aplicar(antes); }
      }
    }, rotulo);
    const copiar = h('button', { type: 'button', class: 'link-discreto evp-compartilhar', onclick: async () => {
      const link = location.href;
      try { await navigator.clipboard.writeText(link); avisar('Link do evento copiado!'); } catch (_) { avisar('Copie o endereço na barra do navegador.', 'erro'); }
    } }, icone('seta', 14), 'Copiar link');

    return h('section', { class: 'evp-hero' },
      fundo, h('div', { class: 'evp-veu' }),
      h('div', { class: 'evp-conteudo' },
        h('div', { class: 'evp-poster' }, poster(e, primeiro)),
        h('div', { class: 'evp-info' },
          h('div', { class: 'ev-linha' }, h('span', { class: 'ev-etiqueta' }, TIPOS_EVENTO[e.tipo] || 'Evento'), e.tema ? h('span', { class: 'suave pequeno' }, e.tema) : null),
          h('h1', null, e.nome),
          e.descricao ? h('p', { class: 'evp-desc' }, e.descricao) : null,
          h('ul', { class: 'evp-dados' },
            h('li', null, icone('calendario', 20), diaLongo(e.inicio)),
            h('li', null, icone('relogio', 20), 'A partir das ' + hhmm(e.inicio)),
            local ? h('li', null, icone('amigos', 20), local) : null),
          passou ? null : relogio(e.inicio, ativa)),
        h('aside', { class: 'evp-card' },
          h('div', { class: 'evp-quem' }, vao.total ? vao.pilha : null,
            h('span', { class: 'evp-num' }, h('strong', null, String(vao.total)), ' ' + (vao.total === 1 ? 'confirmado' : 'confirmados') + (talvez ? ` · ${talvez} talvez` : ''))),
          h('div', { class: 'evp-botoes', role: 'group', 'aria-label': 'Sua presença' }, botao('vou', 'Eu vou', 'principal'), botao('talvez', 'Talvez'), botao('nao_vou', 'Não vou')),
          copiar)));
  }

  // ---------- aba Filmes: sugestões e votação ----------
  function painelVotacao(e, vt, membros, selecionados) {
    const meuId = estado.membro.id;
    const minhas = e.sugestoes.filter((x) => x.membro_id === meuId);
    const msg = h('p', { class: 'erro', role: 'alert' });
    const porTitulo = {};
    e.sugestoes.forEach((x) => { (porTitulo[x.titulo_id] = porTitulo[x.titulo_id] || []).push(x.membro_id); });
    const nomes = (ids) => ids.map((mid) => (membros.find((m) => m.id === mid) || {}).nome).filter(Boolean);

    // 1) Em votação
    const linhasVotacao = () => {
      if (!vt) return [vazio('Nenhuma votação aberta para este evento.')];
      const podeVer = !!vt.contagem;
      const meus = vt.meus_votos || [];
      const restantes = vt.max_votos - meus.length;
      const ordenadas = vt.opcoes.map((id) => ({ id, t: achaTitulo(id), n: podeVer ? (vt.contagem[id] || 0) : 0 })).filter((x) => x.t)
        .sort((a, b) => b.n - a.n);
      return [
        h('p', { class: 'suave pequeno' }, vt.pergunta + ' — ' + (vt.max_votos === 1 ? 'um voto por pessoa.' : `você tem ${vt.max_votos} votos (${restantes > 0 ? `faltam ${restantes}` : 'todos usados'}).`) +
          (podeVer ? '' : ' O placar aparece depois do seu voto.')),
        ...ordenadas.map((x, i) => {
          const meu = meus.includes(x.id);
          const pessoas = nomes(porTitulo[x.id] || []);
          return linhaFilme({
            pos: i + 1, t: x.t, extra: pessoas.length ? 'Sugerido por ' + pessoas.join(', ') : '',
            votos: podeVer ? x.n : null,
            acao: meu ? h('span', { class: 'ev-votei' }, icone('check', 16), 'Seu voto')
              : (restantes > 0 ? h('button', { type: 'button', class: 'btn-contorno', onclick: async (ev) => {
                const b = ev.currentTarget; b.disabled = true; b.classList.add('salvando');
                try { await chamar('votar', { votacao_id: vt.id, titulo_id: x.id }); avisar('Voto registrado!'); await refazer(); }
                catch (err) { avisar(err.message, 'erro'); b.disabled = false; b.classList.remove('salvando'); }
              } }, 'Votar') : null)
          });
        })];
    };

    // 2) Mais sugeridos
    const linhasSugeridos = () => {
      const ids = Object.keys(porTitulo).sort((a, b) => porTitulo[b].length - porTitulo[a].length);
      if (!ids.length) return [vazio('Ninguém sugeriu ainda. Seja o primeiro!')];
      return ids.map((id, i) => {
        const t = achaTitulo(id); if (!t) return null;
        const sou = porTitulo[id].includes(meuId);
        return linhaFilme({
          pos: i + 1, t, extra: 'Sugerido por ' + nomes(porTitulo[id]).join(', '), votos: null, pedidos: porTitulo[id].length,
          acao: e.sugestoes_abertas && sou ? h('button', { type: 'button', class: 'link-discreto', 'aria-label': 'Remover minha sugestão ' + t.nome, onclick: async () => {
            try { await chamar('evento_sugestao_remover', { evento_id: e.id, titulo_id: id }); await refazer(); } catch (err) { avisar(err.message, 'erro'); } } }, 'remover') : null
        });
      });
    };

    // 3) Já selecionados
    const linhasSelecionados = () => selecionados.length
      ? selecionados.map((x, i) => linhaFilme({ pos: i + 1, t: x.t, extra: x.inicio ? 'Começa às ' + hhmm(x.inicio) : 'Horário a definir', votos: null, acao: h('span', { class: 'ev-selo-ok' }, 'Selecionado') }))
      : [vazio('Ainda não há filmes selecionados.')];

    const todas = [
      ['votacao', 'Em votação', vt ? vt.opcoes.length : 0, linhasVotacao],
      ['sugeridos', 'Mais sugeridos', 0, linhasSugeridos],
      ['selecionados', 'Já selecionados', selecionados.length, linhasSelecionados]
    ];
    const partes = todas.filter(([id]) => e.modo === 'programado' ? id === 'selecionados' : (id !== 'votacao' || vt) && (id !== 'sugeridos' || e.modo === 'votacao' || e.sugestoes.length || e.sugestoes_max > 0));
    const atual = partes.find((p) => p[0] === subaba) || partes[partes.length - 1];
    const busca = e.sugestoes_max > 0 && e.sugestoes_abertas && minhas.length < e.sugestoes_max ? buscaTitulos({
      placeholder: 'Sugira um filme ou série do catálogo…', excluir: () => minhas.map((x) => x.titulo_id),
      aoEscolher: async (t) => {
        msg.textContent = '';
        try { await chamar('evento_sugerir', { evento_id: e.id, titulo_id: t.id }); avisar(`“${t.nome}” sugerido!`); subaba = 'sugeridos'; await refazer(); }
        catch (err) { msg.textContent = err.message; }
      }
    }) : null;

    return h('section', { class: 'ev-painel' },
      h('div', { class: 'ev-painel-topo' }, h('h2', null, e.modo === 'programado' ? 'Filmes do evento' : 'Sugira e vote nos filmes')),
      e.sugestoes_max > 0 ? h('p', { class: 'suave pequeno' },
        e.sugestoes_abertas ? `Ajude a escolher o que vai passar! Você usou ${minhas.length} de ${e.sugestoes_max} sugestões.` : 'As sugestões estão encerradas.') : null,
      busca ? busca.el : null,
      e.sugestoes_abertas && e.sugestoes_max > 0 && minhas.length >= e.sugestoes_max ? h('p', { class: 'suave pequeno' }, 'Você já usou todas as suas sugestões. Remova uma para trocar.') : null,
      msg,
      partes.length > 1 ? h('div', { class: 'ev-subabas', role: 'tablist' }, partes.map(([id, texto, n]) => h('button', {
        type: 'button', role: 'tab', class: 'ev-subaba' + (subaba === id ? ' ligada' : ''), 'aria-selected': String(subaba === id),
        onclick: () => { subaba = id; desenhar(ultimoD); }
      }, texto, n ? h('span', { class: 'contador' }, String(n)) : null))) : null,
      h('div', { class: 'ev-linhas' }, atual[3]()));

  }

  function vazio(texto) { return h('p', { class: 'suave ev-vazio-linha' }, texto); }

  function linhaFilme({ pos, t, extra, votos, pedidos, acao }) {
    return h('div', { class: 'ev-linha-filme' },
      h('span', { class: 'ev-pos p' + Math.min(pos, 4) }, String(pos)),
      h('a', { href: '#/titulo/' + t.id, class: 'ev-mini', 'aria-label': 'Abrir ' + t.nome }, capa(t)),
      h('div', { class: 'ev-fn' }, h('strong', null, t.nome), h('small', { class: 'suave' }, t.ano || ''), extra ? h('small', { class: 'suave' }, extra) : null, exibido(t.id)),
      votos !== null && votos !== undefined ? h('div', { class: 'ev-votos' }, h('b', null, String(votos)), h('small', { class: 'suave' }, votos === 1 ? 'voto' : 'votos')) : null,
      pedidos ? h('div', { class: 'ev-votos' }, h('b', null, String(pedidos)), h('small', { class: 'suave' }, pedidos === 1 ? 'sugestão' : 'sugestões')) : null,
      acao ? h('div', { class: 'ev-acao' }, acao) : null);
  }

  // ---------- programação em linha do tempo ----------
  function linhaTempo(itens, e) {
    const dias = programaPorDia(e);
    if (dias.length) {
      return h('section', { class: 'ev-painel ev-prog' }, h('h2', null, 'Programação'),
        dias.map((dia) => h('div', { class: 'ev-pdia' },
          h('h3', null, diaLongo(dia.data + 'T12:00:00')),
          h('ol', { class: 'ev-tempo' }, dia.itens.map((x, i) => {
            const t = achaTitulo(x.t); if (!t) return null;
            const ep = textoEpisodios(x);
            return h('li', null,
              h('span', { class: 'ev-hora' }, hhmm(x.inicio)),
              h('a', { href: '#/titulo/' + t.id, class: 'ev-prog-item' }, h('span', { class: 'ev-mini' }, capa(t)),
                h('span', { class: 'ev-fn' }, h('strong', null, t.nome), h('small', { class: 'suave' }, [ep, 'até ' + hhmm(x.fim)].filter(Boolean).join(' · ')),
                  i < dia.itens.length - 1 && x.pausa ? h('small', { class: 'suave' }, `intervalo de ${x.pausa} min depois`) : null)));
          })))));
    }
    return h('section', { class: 'ev-painel ev-prog' },
      h('h2', null, 'Programação'),
      itens.length ? h('ol', { class: 'ev-tempo' }, itens.map((x) => h('li', null,
        h('span', { class: 'ev-hora' + (x.inicio ? '' : ' a-definir') }, x.inicio ? hhmm(x.inicio) : '—'),
        h('a', { href: '#/titulo/' + x.t.id, class: 'ev-prog-item' }, h('span', { class: 'ev-mini' }, capa(x.t)),
          h('span', { class: 'ev-fn' }, h('strong', null, x.t.nome), h('small', { class: 'suave' }, x.t.ano || ''), exibido(x.t.id))))))
        : h('p', { class: 'suave pequeno' }, 'A programação aparece aqui quando os filmes forem escolhidos.'));
  }
}
