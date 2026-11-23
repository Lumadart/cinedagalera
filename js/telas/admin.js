import { h, montar, icone } from '../dom.js';
import { estado } from '../estado.js';
import { casca, esqueleto } from '../ui.js';
import { abaVisao } from './admin/visao.js';
import { abaMembros } from './admin/membros.js';
import { abaConvites } from './admin/convites.js';
import { abaTitulos } from './admin/titulos.js';
import { abaEventos } from './admin/eventos.js';
import { abaConquistas } from './admin/conquistas.js';
import { abaManutencao } from './admin/manutencao.js';
import { abaAparencia } from './admin/aparencia.js';

// [chave, rótulo, ícone, descrição, função]; os grupos organizam o menu lateral
const GRUPOS = [
  ['', [['visao', 'Visão geral', 'inicio', 'Um resumo do grupo, do catálogo e dos próximos eventos.', abaVisao]]],
  ['Comunidade', [
    ['membros', 'Membros', 'amigos', 'Quem participa, permissões e PINs de acesso.', abaMembros],
    ['convites', 'Convites', 'email', 'Convites para novas pessoas entrarem no grupo.', abaConvites]]],
  ['Conteúdo', [
    ['titulos', 'Títulos', 'play', 'Corrija dados vindos do TMDB ou remova indicações erradas.', abaTitulos],
    ['aparencia', 'Aparência', 'estrela', 'Imagens de capa das páginas do site.', abaAparencia]]],
  ['Atividades', [
    ['eventos', 'Eventos', 'calendario', 'Crie eventos, acompanhe as fases e organize votações.', abaEventos],
    ['conquistas', 'Conquistas', 'escudo', 'Medalhas que as pessoas ganham ao participar.', abaConquistas]]],
  ['Sistema', [['manutencao', 'Manutenção e histórico', 'chave', 'Rotinas de limpeza e o registro de tudo que os admins fizeram.', abaManutencao]]]
];
const ABAS = GRUPOS.flatMap(([, itens]) => itens);

/** Área de administração: menu lateral + conteúdo. Cada aba mora em telas/admin/. */
export function telaAdmin({ raiz, ativa }) {
  if (!estado.membro.admin) {
    montar(raiz, casca('admin', h('div', { class: 'estado-vazio' },
      h('p', null, 'Esta área é só para admins.'), h('a', { class: 'btn-sec', href: '#/' }, 'Voltar ao catálogo'))));
    return;
  }
  const painel = h('div', { class: 'admin-painel' }, esqueleto('lista', 3));
  const cabecalho = h('header', { class: 'adm-cab' });
  const menu = h('nav', { class: 'adm-menu', 'aria-label': 'Áreas da administração' });
  let atual = 'visao';
  try { const g = sessionStorage.getItem('cine-arkham.admin'); if (g && ABAS.some((a) => a[0] === g)) atual = g; } catch { /* sem armazenamento */ }
  // a aba só continua desenhando enquanto ela e a tela ainda estão abertas
  const abrir = () => {
    const [chave, rotulo, , desc, desenhar] = ABAS.find((a) => a[0] === atual);
    montar(cabecalho, h('h1', null, rotulo), h('p', { class: 'suave' }, desc));
    montar(painel, esqueleto('lista', 3));
    desenhar({ painel, ativa: () => ativa() && atual === chave });
  };
  const pintarMenu = () => montar(menu, GRUPOS.map(([grupo, itens]) => h('div', { class: 'adm-grupo' },
    grupo ? h('span', { class: 'adm-grupo-nome' }, grupo) : null,
    itens.map(([chave, rotulo, ic]) => h('button', {
      type: 'button', class: 'adm-item' + (atual === chave ? ' ligada' : ''), 'aria-current': atual === chave ? 'page' : null,
      onclick: () => { atual = chave; try { sessionStorage.setItem('cine-arkham.admin', chave); } catch { /* ok */ } pintarMenu(); abrir(); }
    }, icone(ic, 18), rotulo)))));

  montar(raiz, casca('admin', h('div', { class: 'admin adm-shell' }, menu, h('div', { class: 'adm-conteudo' }, cabecalho, painel))));
  pintarMenu(); abrir();
}
