import { h, icone } from './dom.js';
import { estado, aplicarStatusLocal, removerStatusLocal } from './estado.js';
import { chamar } from './api.js';
import { capa, avisar, ROTULOS, COR_STATUS, rotuloCategoria, detalheTitulo, formatarNota } from './ui.js';

export function fecharMenus() {
  document.querySelectorAll('.menu-status').forEach((m) => {
    const botao = m.parentElement && m.parentElement.querySelector('.btn-status');
    if (botao) botao.setAttribute('aria-expanded', 'false');
    m.remove();
  });
}
document.addEventListener('click', fecharMenus);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenus(); });

/** Cartão de um título (sempre do mesmo tamanho): capa com nome por cima e botão de status na base. */
export function cartaoTitulo(t, { aoMudar, nota = null }) {
  const meu = estado.catalogo.status.find((s) => s.titulo_id === t.id && s.membro_id === estado.membro.id);
  const capaBox = h('div', { class: 'cartao-capa' });
  const botao = h('button', {
    type: 'button', class: 'btn-status' + (meu ? ' tem' : ''),
    'aria-haspopup': 'menu', 'aria-expanded': 'false',
    'aria-label': meu ? `Meu status em ${t.nome}: ${ROTULOS[meu.status]}. Alterar` : `Marcar ${t.nome} na minha lista`,
    style: meu ? { borderColor: COR_STATUS[meu.status], color: COR_STATUS[meu.status] } : null,
    onclick: (e) => { e.stopPropagation(); abrirMenu(); }
  }, icone(meu ? { visto: 'check', assistindo: 'play', quero_ver: 'marcador', abandonado: 'fechar' }[meu.status] : 'mais', 20));

  capaBox.append(
    h('a', { class: 'link-capa', href: '#/titulo/' + t.id, 'aria-label': 'Abrir ' + t.nome }, capa(t),
      h('span', { class: 'sombra' }),
      h('span', { class: 'nome-sobre' }, h('strong', null, t.nome), h('small', null, [t.ano, detalheTitulo(t)].filter(Boolean).join(' · ')))),
    h('span', { class: 'pill-tipo' }, rotuloCategoria(t)),
    ...(nota !== null && nota !== undefined ? [h('span', { class: 'nota-sobre' }, '★ ' + formatarNota(nota))] : []),
    ...(meu ? [h('span', { class: 'fita', style: { color: COR_STATUS[meu.status] }, title: ROTULOS[meu.status] })] : []),
    botao
  );

  function abrirMenu() {
    const jaAberto = capaBox.querySelector('.menu-status');
    fecharMenus();
    if (jaAberto) return;
    const op = (st) => h('button', {
      type: 'button', role: 'menuitem', class: 'op' + (meu && meu.status === st ? ' atual' : ''),
      onclick: (e) => { e.stopPropagation(); definir(st); }
    }, h('span', { class: 'ponto', style: { background: COR_STATUS[st] } }), ROTULOS[st]);
    const menu = h('div', { class: 'menu-status', role: 'menu', onclick: (e) => e.stopPropagation() },
      op('quero_ver'), op('assistindo'), op('visto'), op('abandonado'),
      ...(meu ? [h('button', { type: 'button', role: 'menuitem', class: 'op remover', onclick: (e) => { e.stopPropagation(); remover(); } }, 'Tirar da minha lista')] : []));
    capaBox.append(menu);
    botao.setAttribute('aria-expanded', 'true');
    menu.querySelector('button').focus();
  }
  async function definir(st) {
    fecharMenus();
    try {
      await chamar('marcar_status', { titulo_id: t.id, status: st });
      aplicarStatusLocal(estado.membro.id, t.id, { status: st, visto_em: st === 'visto' ? new Date().toISOString() : '' });
      avisar(`“${t.nome}” marcado como ${ROTULOS[st].toLowerCase()}.`);
      aoMudar();
    } catch (e) { avisar(e.message, 'erro'); }
  }
  async function remover() {
    fecharMenus();
    try {
      await chamar('remover_status', { titulo_id: t.id });
      removerStatusLocal(estado.membro.id, t.id);
      avisar(`“${t.nome}” saiu da sua lista.`);
      aoMudar();
    } catch (e) { avisar(e.message, 'erro'); }
  }

  return h('article', { class: 'cartao' }, capaBox);
}
