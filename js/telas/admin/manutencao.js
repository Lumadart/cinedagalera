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
  const tempos = h('div', null, tabelaTempos());
  montar(painel,
    h('section', { class: 'card' }, h('h2', null, 'Manutenção'),
      h('p', { class: 'suave' }, 'Remove marcações e favoritos que apontam para títulos ou pessoas que não existem mais (sobras de limpezas manuais na planilha).'),
      limpar, resultado),
    h('section', { class: 'card' }, h('h2', null, 'Desempenho (neste navegador)'),
      h('p', { class: 'suave' }, 'Quanto cada ação levou, em média. "Total" é o que você sente; "Servidor" é o tempo dentro do Apps Script; "Planilha" é a parte gasta lendo abas. Total muito maior que Servidor = demora de rede/Google.'),
      tempos,
      h('button', { type: 'button', class: 'btn-sec', onclick: () => { try { localStorage.removeItem('cine_tempos'); } catch (_) {} montar(tempos, tabelaTempos()); } }, 'Zerar medidas')),
    h('section', { class: 'card' }, h('h2', null, 'Histórico de ações de admin'), logEl));
  try {
    const { log } = await chamar('admin_listar_log');
    if (!ativa()) return;
    montar(logEl, log.length ? h('ul', { class: 'log-adm' }, log.map((l) =>
      h('li', null, h('span', { class: 'suave pequeno' }, dataCurta(l.data)), h('span', null, h('strong', null, l.admin), ' · ' + l.acao.replaceAll('_', ' ') + (l.detalhes ? ' — ' + l.detalhes : '')))))
      : h('p', { class: 'suave' }, 'Nenhuma ação registrada ainda.'));
  } catch (e) { montar(logEl, h('p', { class: 'erro' }, e.message)); }
}

function tabelaTempos() {
  let todos = {};
  try { todos = JSON.parse(localStorage.getItem('cine_tempos') || '{}'); } catch (_) { /* vazio */ }
  const linhas = Object.entries(todos).sort((a, b) => b[1].total / b[1].n - a[1].total / a[1].n);
  if (!linhas.length) return h('p', { class: 'suave' }, 'Use o site um pouco e volte aqui: as medidas aparecem sozinhas.');
  const ms = (v) => Math.round(v) + ' ms';
  return h('div', { class: 'tabela-rolagem' }, h('table', { class: 'tabela-tempos' },
    h('thead', null, h('tr', null, ['Ação', 'Vezes', 'Total', 'Servidor', 'Planilha', 'Leituras', 'Pior'].map((t) => h('th', null, t)))),
    h('tbody', null, linhas.map(([acao, x]) => h('tr', null,
      h('td', null, acao), h('td', null, String(x.n)), h('td', null, ms(x.total / x.n)), h('td', null, ms(x.servidor / x.n)),
      h('td', null, ms(x.leitura_ms / x.n)), h('td', null, (x.leituras / x.n).toFixed(1)), h('td', null, ms(x.max)))))));
}
