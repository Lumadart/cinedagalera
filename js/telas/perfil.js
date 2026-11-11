import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo } from '../estado.js';
import { casca, avatar, banner, capa, COR_STATUS, formatarNota, haQuanto } from '../ui.js';

const VERBO = { visto: 'viu', assistindo: 'está assistindo', quero_ver: 'quer ver' };
const ABAS = [['lista', 'Minha lista'], ['vistos', 'Vistos'], ['indicacoes', 'Indicações']];

export function telaPerfil({ raiz, ativa, params }) {
  const area = h('div', { class: 'perfil' }, h('p', { class: 'suave' }, 'Carregando…'));
  const id = params.id || estado.membro.id;
  let aba = 'lista';
  montar(raiz, casca('perfil', area));
  if (estado.catalogo) desenhar();
  carregarCatalogo().then(() => { if (ativa()) desenhar(); }).catch((e) => {
    if (ativa() && !estado.catalogo) montar(area, h('p', { class: 'erro' }, e.message));
  });

  function desenhar() {
    const { membros, titulos, status, favoritos } = estado.catalogo;
    const m = id === estado.membro.id ? Object.assign({}, membros.find((x) => x.id === id), estado.membro) : membros.find((x) => x.id === id);
    if (!m) {
      montar(area, h('div', { class: 'estado-vazio' }, h('p', null, 'Perfil não encontrado.'), h('a', { class: 'btn-sec', href: '#/amigos' }, 'Ver amigos')));
      return;
    }
    document.title = m.nome + ' · Cine Arkham';
    const meu = m.id === estado.membro.id;
    const porId = Object.fromEntries(titulos.map((t) => [t.id, t]));
    const deles = status.filter((s) => s.membro_id === m.id && porId[s.titulo_id]);
    const de = (st) => deles.filter((s) => s.status === st);
    const indicados = titulos.filter((t) => t.adicionado_por === m.id).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    const favs = favoritos.filter((f) => f.membro_id === m.id && porId[f.titulo_id]).sort((a, b) => a.posicao - b.posicao).map((f) => porId[f.titulo_id]);
    const recente = (a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em));

    const poster = (t, extra, pos) => h('a', { class: 'poster', href: '#/titulo/' + t.id, 'aria-label': t.nome },
      pos ? h('span', { class: 'posicao' }, String(pos)) : null, capa(t), h('span', { class: 'poster-nome' }, t.nome), extra || null);
    const linha = (lista) => h('div', { class: 'grade-posters' }, lista);
    const bloco = (titulo, sub, conteudo) => h('section', { class: 'bloco-home' },
      h('div', { class: 'titulo-secao' }, h('div', null, h('h2', null, titulo), sub ? h('p', { class: 'suave pequeno' }, sub) : null)), conteudo);
    const vazio = (txt) => h('p', { class: 'suave' }, txt);

    const paineis = {
      lista: () => [
        bloco('Está assistindo', null, de('assistindo').length ? linha(de('assistindo').sort(recente).map((s) => poster(porId[s.titulo_id]))) : vazio('Nada em andamento.')),
        bloco('Quero ver', null, de('quero_ver').length ? linha(de('quero_ver').sort(recente).map((s) => poster(porId[s.titulo_id]))) : vazio('A lista de desejos está vazia.')),
        ...(de('abandonado').length ? [bloco('Abandonados', null, linha(de('abandonado').sort(recente).map((s) => poster(porId[s.titulo_id], s.nota !== null ? h('span', { class: 'nota' }, '★ ' + formatarNota(s.nota)) : null))))] : [])
      ],
      vistos: () => [bloco('Vistos', 'Do mais recente para o mais antigo',
        de('visto').length ? linha(de('visto').sort((a, b) => String(b.visto_em || b.atualizado_em).localeCompare(String(a.visto_em || a.atualizado_em)))
          .map((s) => poster(porId[s.titulo_id], s.nota !== null ? h('span', { class: 'nota' }, '★ ' + formatarNota(s.nota)) : null))) : vazio('Nenhum título visto ainda.'))],
      indicacoes: () => [bloco('Indicações', 'Títulos que ' + (meu ? 'você colocou' : 'a pessoa colocou') + ' no catálogo',
        indicados.length ? linha(indicados.map((t) => poster(t))) : vazio('Nenhuma indicação ainda.'))]
    };
    const tabs = h('div', { class: 'abas', role: 'tablist', 'aria-label': 'Seções do perfil' },
      ABAS.map(([k, r]) => h('button', { type: 'button', role: 'tab', class: 'aba' + (aba === k ? ' ligada' : ''), 'aria-selected': String(aba === k),
        onclick: () => { aba = k; desenhar(); } }, r)));

    const eventos = [];
    deles.forEach((s) => { if (s.atualizado_em) eventos.push({ quando: s.atualizado_em, t: porId[s.titulo_id], txt: VERBO[s.status] }); });
    indicados.forEach((t) => { if (t.criado_em) eventos.push({ quando: t.criado_em, t, txt: 'indicou' }); });
    eventos.sort((a, b) => String(b.quando).localeCompare(String(a.quando)));

    montar(area,
      h('section', { class: 'perfil-topo' },
        banner(m),
        h('span', { class: 'perfil-veu' }),
        meu ? h('a', { class: 'btn-lapis', href: '#/perfil/editar', 'aria-label': 'Editar perfil', title: 'Editar perfil' }, icone('editar', 16)) : null,
        h('div', { class: 'perfil-id' },
          avatar(m, { tamanho: 112, cor: 'var(--ouro)' }),
          h('div', { class: 'perfil-nome' },
            h('h1', null, m.nome), m.frase ? h('p', { class: 'frase' }, '“' + m.frase + '”') : null,
            h('div', { class: 'estatisticas' }, [[de('visto').length, 'vistos'], [de('assistindo').length, 'assistindo'], [de('quero_ver').length, 'quero ver'], [indicados.length, 'indicações']].map(([n, r]) =>
              h('div', null, h('strong', null, String(n)), h('span', null, r))))),
          h('div', { class: 'perfil-favs', 'aria-label': 'Favoritos' },
            h('span', { class: 'perfil-favs-rotulo' }, h('span', { class: 'ouro' }, '★'), ' Favoritos'),
            favs.length ? h('div', { class: 'mini-favs' }, favs.map((t) => h('a', { href: '#/titulo/' + t.id, title: t.nome, 'aria-label': t.nome }, capa(t))))
              : h('span', { class: 'pequeno' }, meu ? h('a', { href: '#/perfil/editar' }, 'Escolher favoritos') : 'Sem favoritos')))),
      h('div', { class: 'perfil-corpo' },
        h('div', { class: 'perfil-principal' }, tabs, h('div', { class: 'painel-aba', role: 'tabpanel' }, paineis[aba]())),
        h('aside', { class: 'card lateral' },
          h('div', { class: 'titulo-secao' }, h('h2', null, meu ? 'Sua atividade recente' : 'Atividade recente')),
          eventos.length ? h('ul', { class: 'atividade' }, eventos.slice(0, 8).map((e) =>
            h('li', null, h('span', { class: 'mini-capa p' }, capa(e.t)),
              h('div', { class: 'at-texto' }, h('span', null, h('strong', null, m.nome.split(' ')[0]), ' ' + e.txt + ' ', h('a', { href: '#/titulo/' + e.t.id }, e.t.nome)),
                h('span', { class: 'suave pequeno' }, haQuanto(e.quando)))))) : h('p', { class: 'suave' }, 'Nada por aqui ainda.')))
    );
  }
}
