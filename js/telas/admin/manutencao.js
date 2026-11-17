import { h, montar } from '../../dom.js';
import { carregarCatalogo } from '../../estado.js';
import { chamar } from '../../api.js';
import { dataCurta } from '../../datas.js';

export async function abaManutencao({ painel, ativa }) {
  const resultado = h('p', { class: 'suave', role: 'status' });
  const limpar = h('button', { type: 'button', class: 'btn-sec', onclick: async () => {
    limpar.disabled = true;
    try {
      const r = await chamar('admin_limpar_orfaos');
      resultado.textContent = r.marcacoes + r.favoritos ? `Removidos: ${r.marcacoes} marcações e ${r.favoritos} favoritos sem dono ou sem título.` : 'Está tudo em ordem. Nada para limpar.';
      await carregarCatalogo({ forcar: true });
    } catch (e) { resultado.textContent = e.message; }
    limpar.disabled = false;
  } }, 'Limpar registros órfãos');
  const logEl = h('div', null, h('p', { class: 'suave' }, 'Carregando histórico…'));
  montar(painel,
    h('section', { class: 'card' }, h('h2', null, 'Manutenção'),
      h('p', { class: 'suave' }, 'Remove marcações e favoritos que apontam para títulos ou pessoas que não existem mais (sobras de limpezas manuais na planilha).'),
      limpar, resultado),
    h('section', { class: 'card' }, h('h2', null, 'Histórico de ações de admin'), logEl));
  try {
    const { log } = await chamar('admin_listar_log');
    if (!ativa()) return;
    montar(logEl, log.length ? h('ul', { class: 'log-adm' }, log.map((l) =>
      h('li', null, h('span', { class: 'suave pequeno' }, dataCurta(l.data)), h('span', null, h('strong', null, l.admin), ' · ' + l.acao.replaceAll('_', ' ') + (l.detalhes ? ' — ' + l.detalhes : '')))))
      : h('p', { class: 'suave' }, 'Nenhuma ação registrada ainda.'));
  } catch (e) { montar(logEl, h('p', { class: 'erro' }, e.message)); }
}
