import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo } from '../estado.js';
import { chamar } from '../api.js';
import { conquistadasGrade } from '../badges.js';
import { compatibilidade, ROTULO_PARTE } from '../compat.js';
import { carregarEventos } from '../eventos.js';
import { sair, casca, esqueleto, avatar, banner, capa, formatarNota } from '../ui.js';
import { haQuanto } from '../datas.js';

const ABAS = [['tudo', 'Tudo'], ['assistindo', 'Assistindo'], ['visto', 'Vistos'], ['quero_ver', 'Quero ver'], ['indicou', 'Indicações']];
const VERBO = { visto: 'Viu', assistindo: 'Está assistindo', quero_ver: 'Quer ver', abandonado: 'Abandonou', indicou: 'Indicou' };
const ICONE_ACAO = { visto: 'check', assistindo: 'play', quero_ver: 'marcador', abandonado: 'fechar', indicou: 'estrela' };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const PASSO = 8;

const estrelas = (nota) => { const n = Math.round(nota / 2); return '★'.repeat(n) + '☆'.repeat(5 - n); };

export function telaPerfil({ raiz, ativa, params }) {
  const area = h('div', { class: 'perfil' }, esqueleto('lista', 4));
  const id = params.id || estado.membro.id;
  let aba = 'tudo', mostrando = PASSO, mostrandoAval = 6;
  let conquistas = null, erroConquistas = '';     // medalhas: buscadas só quando a tela abre
  let proximos = null;                           // eventos em que a pessoa vai
  montar(raiz, casca('perfil', area));
  if (estado.catalogo) desenhar();
  carregarCatalogo().then(() => { if (ativa()) desenhar(); }).catch((e) => {
    if (ativa() && !estado.catalogo) montar(area, h('p', { class: 'erro' }, e.message));
  });
  chamar('badges', { membro_id: id }).then((r) => { conquistas = r.badges; if (ativa()) desenhar(); })
    .catch((e) => { erroConquistas = e.message; if (ativa()) desenhar(); });
  carregarEventos().then((d) => {
    const agora = Date.now();
    proximos = d.eventos.filter((e) => !e.cancelado && e.presencas[id] === 'vou' && new Date(e.fim || e.inicio).getTime() + (e.fim ? 0 : 6 * 3600000) > agora)
      .sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, 4);
    if (ativa()) desenhar();
  }).catch(() => { proximos = []; });

  function desenhar() {
    const { membros, titulos, status, favoritos } = estado.catalogo;
    const m = id === estado.membro.id ? Object.assign({}, membros.find((x) => x.id === id), estado.membro) : membros.find((x) => x.id === id);
    if (!m) {
      montar(area, h('div', { class: 'estado-vazio' }, h('p', null, 'Perfil não encontrado.'), h('a', { class: 'btn-sec', href: '#/amigos' }, 'Ver amigos')));
      return;
    }
    document.title = m.nome + ' · Cine Arkham';
    const meu = m.id === estado.membro.id;
    const primeiro = m.nome.split(' ')[0];
    const porId = Object.fromEntries(titulos.map((t) => [t.id, t]));
    const deles = status.filter((s) => s.membro_id === m.id && porId[s.titulo_id]);
    const de = (st) => deles.filter((s) => s.status === st);
    const indicados = titulos.filter((t) => t.adicionado_por === m.id);
    const favs = favoritos.filter((f) => f.membro_id === m.id && porId[f.titulo_id]).sort((a, b) => a.posicao - b.posicao).map((f) => porId[f.titulo_id]);
    const avaliacoes = deles.filter((s) => s.nota !== null || s.comentario).sort((a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em)));
    const compat = meu ? null : compatibilidade(estado.membro.id, m.id, estado.catalogo);

    // ----- atividade (tudo o que a pessoa fez, do mais novo ao mais antigo) -----
    const atos = [
      ...deles.filter((s) => s.atualizado_em).map((s) => ({ quando: s.atualizado_em, tipo: s.status, t: porId[s.titulo_id], nota: s.nota, s })),
      ...indicados.filter((t) => t.criado_em).map((t) => ({ quando: t.criado_em, tipo: 'indicou', t, nota: null }))
    ].sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
    const filtrados = aba === 'tudo' ? atos : atos.filter((a) => a.tipo === aba);

    const abas = h('div', { class: 'abas abas-linha', role: 'tablist', 'aria-label': 'Filtrar atividade' },
      ABAS.map(([k, r]) => h('button', { type: 'button', role: 'tab', class: 'aba' + (aba === k ? ' ligada' : ''), 'aria-selected': String(aba === k),
        onclick: () => { aba = k; mostrando = PASSO; desenhar(); } }, r)));
    const linhaAtividade = (a) => h('li', { class: 'ativ-linha' },
      h('a', { class: 'ativ-capa', href: '#/titulo/' + a.t.id, tabindex: '-1', 'aria-hidden': 'true' }, capa(a.t)),
      h('span', { class: 'ativ-ico ' + a.tipo }, icone(ICONE_ACAO[a.tipo] || 'estrela', 18)),
      h('div', { class: 'ativ-texto' },
        h('small', { class: 'suave' }, VERBO[a.tipo] || ''),
        h('a', { href: '#/titulo/' + a.t.id }, a.t.nome),
        a.nota !== null && a.tipo !== 'indicou' ? h('span', { class: 'ativ-nota' }, h('span', { class: 'estrelas' }, estrelas(a.nota)), ' ' + formatarNota(a.nota)) : h('small', { class: 'suave' }, [a.t.ano, a.t.tipo === 'filme' ? 'Filme' : 'Série'].filter(Boolean).join(' · '))),
      h('span', { class: 'suave pequeno ativ-quando' }, haQuanto(a.quando)));
    const blocoAtividade = h('section', { class: 'card' },
      h('div', { class: 'titulo-secao' }, h('h2', null, meu ? 'Sua atividade' : 'Atividade de ' + primeiro), abas),
      filtrados.length ? h('ul', { class: 'ativ-lista' }, filtrados.slice(0, mostrando).map(linhaAtividade)) : h('p', { class: 'suave' }, 'Nada por aqui ainda.'),
      filtrados.length > mostrando ? h('button', { type: 'button', class: 'link-discreto', onclick: () => { mostrando += PASSO; desenhar(); } }, `Ver mais (${filtrados.length - mostrando})`) : null);

    // ----- avaliações -----
    const cartaoAval = (s) => { const t = porId[s.titulo_id];
      return h('article', { class: 'aval' },
        h('a', { class: 'aval-capa', href: '#/titulo/' + t.id, tabindex: '-1', 'aria-hidden': 'true' }, capa(t)),
        h('div', { class: 'aval-corpo' },
          h('a', { class: 'aval-nome', href: '#/titulo/' + t.id }, t.nome, t.ano ? h('small', { class: 'suave' }, ' ' + t.ano) : null),
          s.nota !== null ? h('span', { class: 'ativ-nota' }, h('span', { class: 'estrelas' }, estrelas(s.nota)), ' ' + formatarNota(s.nota)) : null,
          s.comentario ? h('p', { class: 'aval-texto' }, s.comentario) : null,
          h('small', { class: 'suave' }, haQuanto(s.atualizado_em)))); };
    const blocoAval = h('section', { class: 'card' },
      h('div', { class: 'titulo-secao' }, h('h2', null, meu ? 'Suas avaliações' : 'Avaliações de ' + primeiro), h('span', { class: 'suave pequeno' }, String(avaliacoes.length))),
      avaliacoes.length ? h('div', { class: 'aval-grade' }, avaliacoes.slice(0, mostrandoAval).map(cartaoAval)) : h('p', { class: 'suave' }, meu ? 'Dê nota e escreva o que achou na página de um título.' : 'Ainda sem avaliações.'),
      avaliacoes.length > mostrandoAval ? h('button', { type: 'button', class: 'link-discreto', onclick: () => { mostrandoAval += 6; desenhar(); } }, `Ver mais (${avaliacoes.length - mostrandoAval})`) : null);

    // ----- lateral -----
    const blocoCompat = compat ? h('section', { class: 'card compat', 'aria-label': 'Compatibilidade' },
      h('div', { class: 'titulo-secao' }, h('h2', null, h('span', { class: 'ico-ouro' }, icone('coracao', 20)), 'Compatibilidade')),
      compat.pct === null
        ? h('p', { class: 'suave' }, 'Ainda há poucos títulos marcados para comparar vocês dois. Quanto mais a comunidade marca, mais isto fica certeiro.')
        : [
          h('div', { class: 'compat-topo' },
            h('div', { class: 'compat-anel', style: { '--p': compat.pct } }, h('strong', null, compat.pct + '%')),
            h('div', null, h('strong', null, compat.faixa), h('p', { class: 'suave pequeno' }, `entre você e ${primeiro}`))),
          h('ul', { class: 'compat-partes' }, Object.entries(compat.partes).map(([k, p]) => h('li', null,
            h('span', null, ROTULO_PARTE[k]), h('span', { class: 'compat-barra' }, h('span', { style: { width: Math.round(p.valor * 100) + '%' } })), h('b', null, Math.round(p.valor * 100) + '%')))),
          h('ul', { class: 'compat-fatos' },
            h('li', null, compat.vistosJuntos.length ? `Vocês viram ${compat.vistosJuntos.length} ${compat.vistosJuntos.length === 1 ? 'título' : 'títulos'} em comum.` : 'Ainda não viram nenhum título em comum.'),
            compat.generosComuns.length ? h('li', null, 'Mais assistem: ' + compat.generosComuns.join(', ') + '.') : null,
            compat.maiorDiscordancia ? h('li', null, 'Maior discordância: ', h('a', { href: '#/titulo/' + compat.maiorDiscordancia.titulo.id }, compat.maiorDiscordancia.titulo.nome),
              ` (você ${formatarNota(compat.maiorDiscordancia.a)} × ${formatarNota(compat.maiorDiscordancia.b)}).`) : null),
          compat.naListaDeAmbos.length ? h('div', null, h('p', { class: 'suave pequeno' }, 'Nas listas dos dois'),
            h('div', { class: 'mini-favs' }, compat.naListaDeAmbos.slice(0, 6).map((t) => h('a', { href: '#/titulo/' + t.id, title: t.nome, 'aria-label': t.nome }, capa(t))))) : null
        ]) : null;

    const blocoConquistas = h('section', { class: 'card' },
      h('div', { class: 'titulo-secao' }, h('h2', null, h('span', { class: 'ico-ouro' }, icone('estrela', 20)), 'Conquistas')),
      conquistas ? conquistadasGrade(conquistas) : erroConquistas ? h('p', { class: 'erro' }, erroConquistas) : esqueleto('lista', 1));

    const contaGenero = {};
    deles.filter((s) => s.status === 'visto' || s.status === 'assistindo').forEach((s) => porId[s.titulo_id].generos.forEach((g) => { contaGenero[g] = (contaGenero[g] || 0) + 1; }));
    favs.forEach((t) => t.generos.forEach((g) => { contaGenero[g] = (contaGenero[g] || 0) + 1; }));
    const generos = Object.entries(contaGenero).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).slice(0, 8);
    const blocoGeneros = h('section', { class: 'card' },
      h('div', { class: 'titulo-secao' }, h('h2', null, 'Gêneros favoritos')),
      generos.length ? h('div', { class: 'generos-fav' }, generos.map(([g, n], i) => h('span', { class: 'genero' + (i === 0 ? ' topo' : '') }, g, h('small', null, String(n))))) : h('p', { class: 'suave' }, 'Aparecem conforme os títulos são marcados.'));

    const blocoEventos = h('section', { class: 'card' },
      h('div', { class: 'titulo-secao' }, h('div', null, h('h2', null, 'Próximos eventos'), h('p', { class: 'suave pequeno' }, meu ? 'Onde você vai' : 'Onde ' + primeiro + ' vai')), h('a', { href: '#/eventos' }, 'Ver todos')),
      proximos === null ? esqueleto('lista', 1)
        : proximos.length ? h('ul', { class: 'perfil-eventos' }, proximos.map((e) => { const d = new Date(e.inicio);
          return h('li', null, h('a', { href: '#/eventos' },
            h('span', { class: 'ev-dia' }, h('strong', null, String(d.getDate()).padStart(2, '0')), h('small', null, MESES[d.getMonth()].toUpperCase())),
            h('span', { class: 'ev-info' }, h('strong', null, e.nome), h('small', { class: 'suave' }, String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + (e.local ? ' · ' + e.local : ''))))); }))
          : h('p', { class: 'suave' }, 'Nenhum evento confirmado por enquanto.'));

    montar(area,
      h('section', { class: 'perfil-topo' },
        banner(m),
        h('span', { class: 'perfil-veu' }),
        meu ? h('div', { class: 'perfil-ferramentas' },
          h('a', { class: 'btn-lapis', href: '#/perfil/editar', 'aria-label': 'Editar perfil', title: 'Editar perfil' }, icone('editar', 16)),
          h('button', { type: 'button', class: 'btn-lapis', onclick: sair, 'aria-label': 'Sair da conta', title: 'Sair da conta' }, icone('sair', 16))) : null,
        h('div', { class: 'perfil-id' },
          avatar(m, { tamanho: 112, cor: 'var(--ouro)' }),
          h('div', { class: 'perfil-nome' },
            h('h1', null, m.nome),
            m.frase ? h('p', { class: 'frase' }, m.frase) : null,
            m.desde ? h('p', { class: 'desde' }, icone('calendario', 16), 'Membro desde ' + MESES[new Date(m.desde).getMonth()] + '/' + new Date(m.desde).getFullYear()) : null,
            h('div', { class: 'estatisticas' }, [[de('visto').length, 'vistos'], [de('quero_ver').length, 'quero ver'], [indicados.length, 'indicações'], [deles.filter((s) => s.nota !== null).length, 'avaliações']].map(([n, r]) =>
              h('div', null, h('strong', null, String(n)), h('span', null, r))))),
          compat && compat.pct !== null ? h('div', { class: 'perfil-compat', title: compat.faixa }, h('strong', null, compat.pct + '%'), h('span', null, 'compatível com você')) : null,
          h('div', { class: 'perfil-favs', 'aria-label': 'Favoritos' },
            h('span', { class: 'perfil-favs-rotulo' }, h('span', { class: 'ouro' }, '★'), ' Favoritos'),
            favs.length ? h('div', { class: 'mini-favs' }, favs.map((t) => h('a', { href: '#/titulo/' + t.id, title: t.nome, 'aria-label': t.nome }, capa(t))))
              : h('span', { class: 'pequeno' }, meu ? h('a', { href: '#/perfil/editar' }, 'Escolher favoritos') : 'Sem favoritos')))),
      h('div', { class: 'perfil-corpo' },
        h('div', { class: 'perfil-principal' }, blocoAtividade, blocoAval),
        h('aside', { class: 'perfil-lateral' }, blocoCompat, blocoConquistas, blocoGeneros, blocoEventos))
    );
  }
}
