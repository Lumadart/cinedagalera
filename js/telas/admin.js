import { h, montar } from '../dom.js';
import { estado } from '../estado.js';
import { casca, esqueleto } from '../ui.js';
import { abaMembros } from './admin/membros.js';
import { abaConvites } from './admin/convites.js';
import { abaTitulos } from './admin/titulos.js';
import { abaEventos } from './admin/eventos.js';
import { abaConquistas } from './admin/conquistas.js';
import { abaManutencao } from './admin/manutencao.js';
import { abaAparencia } from './admin/aparencia.js';

const ABAS = [
  ['membros', 'Membros', abaMembros],
  ['convites', 'Convites', abaConvites],
  ['titulos', 'Títulos', abaTitulos],
  ['eventos', 'Eventos', abaEventos],
  ['conquistas', 'Conquistas', abaConquistas],
  ['aparencia', 'Aparência', abaAparencia],
  ['manutencao', 'Manutenção e histórico', abaManutencao]
];

/** Área de administração: só o esqueleto e a troca de abas. Cada aba mora em telas/admin/. */
export function telaAdmin({ raiz, ativa }) {
  if (!estado.membro.admin) {
    montar(raiz, casca('admin', h('div', { class: 'estado-vazio' },
      h('p', null, 'Esta área é só para admins.'), h('a', { class: 'btn-sec', href: '#/' }, 'Voltar ao catálogo'))));
    return;
  }
  const painel = h('div', { class: 'admin-painel' }, esqueleto('lista', 3));
  const abasEl = h('div', { class: 'abas', role: 'tablist', 'aria-label': 'Áreas da administração' });
  let atual = 'membros';
  // a aba só continua desenhando enquanto ela e a tela ainda estão abertas
  const abrir = () => {
    const [chave, , desenhar] = ABAS.find((a) => a[0] === atual);
    desenhar({ painel, ativa: () => ativa() && atual === chave });
  };
  const pintarAbas = () => montar(abasEl, ABAS.map(([chave, rotulo]) => h('button', {
    type: 'button', role: 'tab', class: 'aba' + (atual === chave ? ' ligada' : ''), 'aria-selected': String(atual === chave),
    onclick: () => { atual = chave; pintarAbas(); abrir(); }
  }, rotulo)));

  montar(raiz, casca('admin', h('div', { class: 'admin' },
    h('div', { class: 'titulo-linha' }, h('div', null, h('h1', null, 'Administração'), h('p', { class: 'suave' }, 'Membros, catálogo, eventos, conquistas e histórico de alterações.'))),
    abasEl, painel)));
  pintarAbas(); abrir();
}
