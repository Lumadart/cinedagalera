import { h, montar } from '../../dom.js';
import { chamar } from '../../api.js';
import { esqueleto, avisar } from '../../ui.js';
import { medalha } from '../../badges.js';
import { dropdown } from '../../dropdown.js';

export async function abaConquistas({ painel, ativa }) {
  montar(painel, esqueleto('lista', 5));
  let d;
  try { d = await chamar('admin_badges_painel'); } catch (e) { if (ativa()) montar(painel, h('p', { class: 'erro' }, e.message)); return; }
  if (!ativa()) return;
  const NOMES = ['', 'Bronze', 'Prata', 'Ouro'];
  const linhas = d.badges.map((b) => {
    const max = b.metas ? 3 : 1;
    const sel = dropdown({ rotulo: 'Membro para ' + b.nome, mini: true, opcoes: d.membros.map((m) => [m.id, m.nome]) });
    const niv = dropdown({ rotulo: 'Nível de ' + b.nome, mini: true });
    const aviso = h('small', { class: 'suave' });
    const pintarNiveis = () => {
      const q = b.membros[sel.value] || { nivel: 0, concedida: false };
      niv.definirOpcoes([['0', q.concedida ? 'Retirar concessão' : 'Escolha o nível'],
        ...Array.from({ length: max }, (_, i) => [String(i + 1), b.metas ? NOMES[i + 1] : 'Conceder'])]);
      niv.value = q.concedida ? String(q.nivel) : '0';
      aviso.textContent = q.nivel ? `Atual: ${b.metas ? NOMES[q.nivel] : 'conquistada'}${q.concedida ? ' (concedida)' : ''}` : 'Ainda não tem';
    };
    sel.addEventListener('change', pintarNiveis); pintarNiveis();
    const aplicar = h('button', { type: 'button', class: 'btn-sec', onclick: async () => {
      aplicar.disabled = true;
      try {
        await chamar('admin_badge_conceder', { membro_id: sel.value, chave: b.chave, nivel: Number(niv.value) });
        avisar('Conquista atualizada.'); abaConquistas({ painel, ativa });
      } catch (e) { avisar(e.message, 'erro'); aplicar.disabled = false; }
    } }, 'Aplicar');
    const interruptor = h('input', { type: 'checkbox', checked: b.ativa, 'aria-label': (b.ativa ? 'Desativar ' : 'Ativar ') + b.nome });
    interruptor.addEventListener('change', async () => {
      try { await chamar('admin_badge_ativar', { chave: b.chave, ativa: interruptor.checked }); avisar(interruptor.checked ? 'Conquista ativada.' : 'Conquista desativada — ninguém a vê.'); }
      catch (e) { avisar(e.message, 'erro'); interruptor.checked = !interruptor.checked; }
    });
    const c = b.contagem;
    const total = b.metas ? `${c[1]} bronze · ${c[2]} prata · ${c[3]} ouro` : `${c[1]} ${c[1] === 1 ? 'pessoa tem' : 'pessoas têm'}`;
    return h('li', { class: 'membro-adm adm-badge' + (b.ativa ? '' : ' inativo') },
      medalha({ chave: b.chave, nivel: b.metas ? 3 : 1, metas: b.metas, tipo: b.metas ? 'niveis' : 'unica' }, 56),
      h('div', { class: 'membro-info' },
        h('div', { class: 'membro-topo' }, h('strong', null, b.nome), h('span', { class: 'etiqueta cinza' }, b.categoria), b.evento ? h('span', { class: 'etiqueta' }, 'eventos') : null),
        h('div', { class: 'suave pequeno' }, b.descricao),
        h('div', { class: 'suave pequeno' }, total)),
      h('div', { class: 'acoes adm-conceder' },
        h('label', { class: 'interruptor' }, interruptor, h('span', null, 'Ativa')),
        h('div', { class: 'conceder-linha' }, sel, niv, aplicar),
        aviso));
  });
  montar(painel,
    h('p', { class: 'suave' }, 'As conquistas são calculadas sozinhas. Aqui você pode desligar uma conquista para todos ou conceder (e retirar) à mão — útil para as de eventos enquanto eles não existem. A concessão nunca rebaixa quem já ganhou pelo uso.'),
    h('ul', { class: 'lista-adm' }, linhas));
}
