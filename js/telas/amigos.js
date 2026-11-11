import { h, montar } from '../dom.js';
import { estado, carregarCatalogo } from '../estado.js';
import { casca, avatar, banner, capa } from '../ui.js';

export function telaAmigos({ raiz, ativa }) {
  const area = h('div', { class: 'amigos' }, h('p', { class: 'suave' }, 'Carregando…'));
  montar(raiz, casca('amigos', area));
  if (estado.catalogo) desenhar();
  carregarCatalogo().then(() => { if (ativa()) desenhar(); }).catch((e) => {
    if (ativa() && !estado.catalogo) montar(area, h('p', { class: 'erro' }, e.message));
  });

  function desenhar() {
    const { membros, status } = estado.catalogo;
    const { titulos, favoritos } = estado.catalogo;
    const porId = Object.fromEntries(titulos.map((t) => [t.id, t]));
    const contar = (id, st) => status.filter((s) => s.membro_id === id && s.status === st && porId[s.titulo_id]).length;
    const indicados = (id) => titulos.filter((t) => t.adicionado_por === id).length;
    montar(area,
      h('div', { class: 'titulo-linha' }, h('div', null, h('h1', null, 'Amigos'), h('p', { class: 'suave' }, 'Quem faz parte do grupo.'))),
      h('div', { class: 'grade-amigos' }, membros.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((m) => {
        const favs = favoritos.filter((f) => f.membro_id === m.id && porId[f.titulo_id]).sort((a, b) => a.posicao - b.posicao).slice(0, 5).map((f) => porId[f.titulo_id]);
        return h('a', { class: 'card-amigo', href: '#/perfil/' + (m.id === estado.membro.id ? '' : m.id) },
          h('div', { class: 'card-amigo-topo' }, banner(m), h('span', { class: 'perfil-veu' }), h('span', { class: 'card-amigo-avatar' }, avatar(m, { tamanho: 76, cor: 'var(--ouro)' }))),
          h('div', { class: 'card-amigo-corpo' },
            h('strong', { class: 'card-amigo-nome' }, m.nome, m.id === estado.membro.id ? h('small', null, ' (você)') : null),
            h('span', { class: 'suave pequeno frase-amigo' }, m.frase ? '“' + m.frase + '”' : 'Sem frase por enquanto'),
            h('div', { class: 'pilulas' },
              h('span', null, h('b', null, String(contar(m.id, 'visto'))), ' vistos'),
              h('span', null, h('b', null, String(contar(m.id, 'assistindo'))), ' assistindo'),
              h('span', null, h('b', null, String(indicados(m.id))), ' indicações')),
            favs.length ? h('div', { class: 'mini-favs' }, favs.map((t) => h('span', { title: t.nome }, capa(t)))) : h('span', { class: 'suave pequeno' }, 'Ainda sem favoritos')));
      })));
  }
}
