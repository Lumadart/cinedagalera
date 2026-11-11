import { h, montar } from '../dom.js';
import { estado, carregarCatalogo } from '../estado.js';
import { casca, avatar, banner } from '../ui.js';

export function telaAmigos({ raiz, ativa }) {
  const area = h('div', { class: 'amigos' }, h('p', { class: 'suave' }, 'Carregando…'));
  montar(raiz, casca('amigos', area));
  if (estado.catalogo) desenhar();
  carregarCatalogo().then(() => { if (ativa()) desenhar(); }).catch((e) => {
    if (ativa() && !estado.catalogo) montar(area, h('p', { class: 'erro' }, e.message));
  });

  function desenhar() {
    const { membros, status } = estado.catalogo;
    const contar = (id, st) => status.filter((s) => s.membro_id === id && s.status === st).length;
    montar(area,
      h('div', { class: 'titulo-linha' }, h('div', null, h('h1', null, 'Amigos'), h('p', { class: 'suave' }, 'Quem faz parte do grupo.'))),
      h('div', { class: 'grade-amigos' }, membros.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((m) =>
        h('a', { class: 'card-amigo', href: '#/perfil/' + m.id },
          banner(m), h('div', { class: 'card-amigo-corpo' }, avatar(m, { tamanho: 64 }),
            h('strong', null, m.nome + (m.id === estado.membro.id ? ' (você)' : '')),
            m.frase ? h('span', { class: 'suave pequeno' }, m.frase) : null,
            h('span', { class: 'suave pequeno' }, `${contar(m.id, 'visto')} vistos · ${contar(m.id, 'assistindo')} assistindo`))))));
  }
}
