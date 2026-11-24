import { h, montar } from '../../dom.js';
import { chamar } from '../../api.js';
import { esqueleto, avisar } from '../../ui.js';
import { medalha } from '../../medalhas.js';
import { dropdown } from '../../dropdown.js';

const TIPOS = [['todos', 'Todos os tipos'], ['trilha', 'Trilhas'], ['unica', 'Únicas'], ['disputada', 'Disputadas'], ['secreta', 'Secretas'], ['selo', 'Selos de eventos']];
const ROTULO_TIPO = { trilha: 'trilha', unica: 'única', disputada: 'disputada', secreta: 'secreta', selo: 'evento' };

export async function abaConquistas({ painel, ativa }) {
  montar(painel, esqueleto('lista', 5));
  let d;
  try { d = await chamar('admin_medalhas_painel'); } catch (e) { if (ativa()) montar(painel, h('p', { class: 'erro' }, e.message)); return; }
  if (!ativa()) return;
  const filtro = { grupo: 'todos', tipo: 'todos', busca: '' };

  const linha = (b) => {
    const conceder = b.tipo !== 'disputada';
    let sel, niv, aviso, aplicar;
    if (conceder) {
      sel = dropdown({ rotulo: 'Pessoa para ' + b.nome, mini: true, opcoes: d.membros.map((m) => [m.id, m.nome]) });
      niv = dropdown({ rotulo: 'Nível de ' + b.nome, mini: true });
      aviso = h('small', { class: 'suave' });
      const pintar = () => {
        const q = b.membros[sel.value] || { nivel: 0, concedida: false };
        niv.definirOpcoes([['0', q.concedida ? 'Retirar concessão' : 'Escolha o nível'],
          ...(b.niveis.length ? b.niveis.map((n, i) => [String(i + 1), n]) : [['1', 'Conceder']])]);
        niv.value = q.concedida ? String(q.nivel) : '0';
        aviso.textContent = q.nivel ? `Atual: ${b.niveis.length ? b.niveis[q.nivel - 1] : 'conquistada'}${q.concedida ? ' (concedida)' : ''}` : 'Ainda não tem';
      };
      sel.addEventListener('change', pintar); pintar();
      aplicar = h('button', { type: 'button', class: 'btn-sec', onclick: async () => {
        aplicar.disabled = true;
        try {
          await chamar('admin_medalha_conceder', { membro_id: sel.value, chave: b.chave, nivel: Number(niv.value) });
          avisar('Medalha atualizada.'); abaConquistas({ painel, ativa });
        } catch (e) { avisar(e.message, 'erro'); aplicar.disabled = false; }
      } }, 'Aplicar');
    }
    const interruptor = h('input', { type: 'checkbox', checked: b.ativa, 'aria-label': (b.ativa ? 'Desativar ' : 'Ativar ') + b.nome });
    interruptor.addEventListener('change', async () => {
      try { await chamar('admin_medalha_ativar', { chave: b.chave, ativa: interruptor.checked }); avisar(interruptor.checked ? 'Medalha ativada.' : 'Medalha desativada: ninguém a vê.'); }
      catch (e) { avisar(e.message, 'erro'); interruptor.checked = !interruptor.checked; }
    });
    const resumo = b.tipo === 'disputada' ? (b.dono ? `Com ${b.dono}` : 'Sem dono ainda') : `${b.tem} ${b.tem === 1 ? 'pessoa tem' : 'pessoas têm'}`;
    return h('li', { class: 'membro-adm adm-badge' + (b.ativa ? '' : ' inativo') },
      medalha({ chave: b.chave, tipo: b.tipo, grupo: b.grupo, nivel: 1, niveis: b.niveis.map((n) => ({ nome: n })) , dono: { id: 'x' } }, 52),
      h('div', { class: 'membro-info' },
        h('div', { class: 'membro-topo' }, h('strong', null, b.nome), h('span', { class: 'etiqueta cinza' }, b.grupo), h('span', { class: 'etiqueta' }, ROTULO_TIPO[b.tipo])),
        h('div', { class: 'suave pequeno adm-niveis', title: b.niveis.join(' → ') }, b.niveis.length ? b.niveis.join(' → ') : ''),
        h('div', { class: 'suave pequeno' }, resumo)),
      h('div', { class: 'acoes adm-conceder' },
        h('label', { class: 'interruptor' }, interruptor, h('span', null, 'Ativa')),
        conceder ? h('div', { class: 'conceder-linha' }, sel, niv, aplicar) : null,
        conceder ? aviso : null));
  };

  const lista = h('ul', { class: 'lista-adm' });
  const contagem = h('p', { class: 'suave pequeno' });
  const MAX = 40;
  let mostrando = MAX;
  function pintar() {
    const q = filtro.busca.trim().toLowerCase();
    const todas = d.medalhas.filter((b) => (filtro.grupo === 'todos' || b.grupo === filtro.grupo) && (filtro.tipo === 'todos' || b.tipo === filtro.tipo)
      && (!q || b.nome.toLowerCase().includes(q) || b.niveis.some((n) => n.toLowerCase().includes(q))));
    contagem.textContent = `${todas.length} ${todas.length === 1 ? 'medalha' : 'medalhas'}`;
    montar(lista, todas.slice(0, mostrando).map(linha),
      todas.length > mostrando ? h('li', { class: 'ver-mais' }, h('button', { type: 'button', class: 'btn-sec', onclick: () => { mostrando += MAX; pintar(); } }, `Mostrar mais (${todas.length - mostrando})`)) : null);
  }
  const grupo = dropdown({ rotulo: 'Grupo', mini: true, valor: 'todos', opcoes: [['todos', 'Todos os grupos'], ...d.grupos.map((g) => [g, g])] });
  const tipo = dropdown({ rotulo: 'Tipo', mini: true, valor: 'todos', opcoes: TIPOS });
  const busca = h('input', { type: 'search', placeholder: 'Buscar medalha ou nível…', 'aria-label': 'Buscar medalha' });
  grupo.addEventListener('change', () => { filtro.grupo = grupo.value; mostrando = MAX; pintar(); });
  tipo.addEventListener('change', () => { filtro.tipo = tipo.value; mostrando = MAX; pintar(); });
  busca.addEventListener('input', () => { filtro.busca = busca.value; mostrando = MAX; pintar(); });
  pintar();
  montar(painel,
    h('p', { class: 'suave' }, 'As medalhas são calculadas sozinhas e o que já foi ganho fica guardado. Aqui você pode desligar uma medalha para todos ou conceder (e retirar) à mão. A concessão nunca rebaixa quem já ganhou pelo uso. As disputadas mudam de dono sozinhas.'),
    h('div', { class: 'adm-filtros' }, busca, grupo, tipo),
    contagem, lista);
}
