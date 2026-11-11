import { h, icone } from './dom.js';
import { estado, aplicarStatusLocal, removerStatusLocal } from './estado.js';
import { chamar } from './api.js';
import { avatar, capa, avisar, ROTULOS, COR_STATUS, ORDEM_STATUS, rotuloCategoria, detalheTitulo } from './ui.js';

export function fecharMenus() {
  document.querySelectorAll('.menu-status').forEach((m) => {
    const botao = m.parentElement && m.parentElement.querySelector('.btn-status');
    if (botao) botao.setAttribute('aria-expanded', 'false');
    m.remove();
  });
}
document.addEventListener('click', fecharMenus);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenus(); });

/** Cartão de um título: capa com nome em cima, botão de status e anéis dos amigos. */
export function cartaoTitulo(t, { aoMudar }) {
  const { status, membros } = estado.catalogo;
  const porMembro = Object.fromEntries(membros.map((m) => [m.id, m]));
  const linhas = status.filter((s) => s.titulo_id === t.id && porMembro[s.membro_id]);
  const meu = linhas.find((s) => s.membro_id === estado.membro.id);
  const cont = { visto: 0, assistindo: 0, quero_ver: 0 };
  linhas.forEach((s) => { cont[s.status] += 1; });
  const partes = [];
  if (cont.visto) partes.push(cont.visto + (cont.visto === 1 ? ' viu' : ' viram'));
  if (cont.assistindo) partes.push(cont.assistindo + ' assistindo');
  if (cont.quero_ver) partes.push(cont.quero_ver + (cont.quero_ver === 1 ? ' quer ver' : ' querem ver'));
  const ordenadas = linhas.filter((s) => porMembro[s.membro_id]).sort((a, b) => ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status]);
  const mostrados = ordenadas.slice(0, 5);
  const extra = ordenadas.length - mostrados.length;

  const capaBox = h('div', { class: 'cartao-capa' });
  const botao = h('button', {
    type: 'button', class: 'btn-status' + (meu ? ' tem' : ''),
    'aria-haspopup': 'menu', 'aria-expanded': 'false',
    'aria-label': meu ? `Meu status em ${t.nome}: ${ROTULOS[meu.status]}. Alterar` : `Marcar ${t.nome} na minha lista`,
    style: meu ? { borderColor: COR_STATUS[meu.status], color: COR_STATUS[meu.status] } : null,
    onclick: (e) => { e.stopPropagation(); abrirMenu(); }
  }, icone(meu ? { visto: 'check', assistindo: 'play', quero_ver: 'marcador' }[meu.status] : 'mais', 20));

  capaBox.append(
    h('a', { class: 'link-capa', href: '#/titulo/' + t.id, 'aria-label': 'Abrir ' + t.nome }, capa(t),
      h('span', { class: 'sombra' }),
      h('span', { class: 'nome-sobre' }, h('strong', null, t.nome), h('small', null, [t.ano, detalheTitulo(t)].filter(Boolean).join(' · ')))),
    h('span', { class: 'pill-tipo' }, rotuloCategoria(t)),
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
      op('quero_ver'), op('assistindo'), op('visto'),
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

  return h('article', { class: 'cartao' },
    capaBox,
    mostrados.length ? h('div', { class: 'aneis' },
      mostrados.map((s) => avatar(porMembro[s.membro_id], { tamanho: 26, cor: COR_STATUS[s.status], dica: `${porMembro[s.membro_id].nome}: ${ROTULOS[s.status].toLowerCase()}` })),
      extra > 0 ? h('span', { class: 'mais-gente' }, '+' + extra) : null) : null,
    h('p', { class: 'resumo' }, partes.length ? partes.join(' · ') : 'Ninguém marcou ainda')
  );
}
