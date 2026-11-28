import { h, montar } from '../../dom.js';
import { chamar } from '../../api.js';
import { esqueleto, avisar } from '../../ui.js';
import { slotMedalha, ROTULO_TIPO } from '../../medalhas.js';
import { dropdown } from '../../dropdown.js';

const TIPOS = [['todos', 'Todos os tipos'], ['trilha', 'Trilhas'], ['unica', 'Únicas'], ['disputada', 'Disputadas'], ['selo', 'De eventos'], ['secreta', 'Secretas']];
let palavra = '';   // só na memória desta aba do navegador; nunca é guardada

/** Reduz a imagem para no máximo 512 px mantendo a transparência (PNG). */
async function prepararImagem(arquivo) {
  if (!arquivo || !/^image\/(jpeg|png|webp)$/.test(arquivo.type)) throw new Error('Use uma imagem PNG, JPG ou WebP.');
  if (arquivo.size > 15 * 1024 * 1024) throw new Error('Essa imagem é grande demais. Escolha uma de até 15 MB.');
  let bmp;
  try { bmp = await createImageBitmap(arquivo); } catch (_) { throw new Error('Não foi possível abrir essa imagem.'); }
  const f = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return c.toDataURL('image/png');
}

export async function abaConquistas({ painel, ativa }) {
  montar(painel, esqueleto('lista', 5));
  let d;
  try { d = await chamar('admin_medalhas_painel', { palavra }); } catch (e) { if (ativa()) montar(painel, h('p', { class: 'erro' }, e.message)); return; }
  if (!ativa()) return;
  const recarregar = () => abaConquistas({ painel, ativa });
  const filtro = { grupo: 'todos', tipo: 'todos', busca: '' };

  /** Um espaço de imagem clicável: escolhe o arquivo, envia e atualiza. */
  function espacoImagem(b, nivel, rotulo) {
    const entrada = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'sr-only', tabindex: '-1' });
    const slot = slotMedalha({ chave: b.chave, nivel, imagens: d.imagens, tamanho: 72, tem: true });
    const url = d.imagens[b.chave.replace(/[^a-zA-Z0-9_]/g, '_') + '_' + nivel];
    entrada.addEventListener('change', async () => {
      const f = entrada.files[0]; entrada.value = '';
      if (!f) return;
      try {
        const imagem = await prepararImagem(f);
        await chamar('admin_medalha_imagem', { chave: b.chave, nivel, imagem, palavra });
        avisar('Imagem salva.'); recarregar();
      } catch (e) { avisar(e.message, 'erro'); }
    });
    slot.addEventListener('click', () => entrada.click());
    slot.setAttribute('role', 'button'); slot.tabIndex = 0; slot.setAttribute('aria-label', 'Enviar imagem: ' + rotulo);
    slot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrada.click(); } });
    slot.removeAttribute('aria-hidden');
    return h('div', { class: 'adm-img' }, slot, h('small', null, rotulo),
      url ? h('button', { type: 'button', class: 'btn-sec perigo', onclick: async () => {
        if (!confirm(`Remover a imagem de “${rotulo}”?`)) return;
        try { await chamar('admin_medalha_imagem', { chave: b.chave, nivel, remover: true, palavra }); avisar('Imagem removida.'); recarregar(); } catch (e) { avisar(e.message, 'erro'); }
      } }, 'Remover') : null, entrada);
  }

  // ---- conquistas de evento: criar, nomear e enviar a imagem quando o evento acontecer ----
  function cartaoEvento(e) {
    const conquista = d.medalhas.find((m) => m.chave === 'selo:' + e.id);
    const nome = h('input', { type: 'text', maxlength: 60, value: e.selo_nome, placeholder: 'Nome da conquista. Ex.: Sobrevivente da Noite do Terror', 'aria-label': 'Nome da conquista de ' + e.nome });
    const desc = h('input', { type: 'text', maxlength: 200, value: e.selo_descricao, placeholder: 'Descrição (opcional)', 'aria-label': 'Descrição da conquista de ' + e.nome });
    const salvar = async (remover) => {
      try {
        await chamar('admin_evento_selo', { evento_id: e.id, selo_nome: remover ? '' : nome.value, selo_descricao: remover ? '' : desc.value });
        avisar(remover ? 'Conquista do evento removida.' : 'Conquista do evento salva.'); recarregar();
      } catch (er) { avisar(er.message, 'erro'); }
    };
    return h('article', { class: 'adm-evento-med' },
      conquista ? espacoImagem(conquista, 1, 'Imagem') : slotMedalha({ chave: 'selo:' + e.id, nivel: 1, imagens: d.imagens, tamanho: 72 }),
      h('form', { onsubmit: (ev) => { ev.preventDefault(); salvar(false); } },
        h('strong', null, e.nome), h('small', { class: 'suave' }, new Date(e.inicio).toLocaleDateString('pt-BR') + (conquista ? ` · ${conquista.tem} ${conquista.tem === 1 ? 'pessoa ganhou' : 'pessoas ganharam'}` : '')),
        nome, desc,
        h('div', { class: 'acoes' },
          h('button', { type: 'submit', class: 'btn-sec' }, e.selo_nome ? 'Salvar' : 'Criar conquista'),
          e.selo_nome ? h('button', { type: 'button', class: 'btn-sec perigo', onclick: () => { if (confirm(`Remover a conquista “${e.selo_nome}”? Quem já a ganhou deixa de vê-la.`)) salvar(true); } }, 'Remover') : null)));
  }

  // ---- cada conquista, com todos os níveis ----
  function cartaoMedalha(b) {
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
        try { await chamar('admin_medalha_conceder', { membro_id: sel.value, chave: b.chave, nivel: Number(niv.value) }); avisar('Conquista atualizada.'); recarregar(); }
        catch (e) { avisar(e.message, 'erro'); aplicar.disabled = false; }
      } }, 'Aplicar');
    }
    const interruptor = h('input', { type: 'checkbox', checked: b.ativa, 'aria-label': (b.ativa ? 'Desativar ' : 'Ativar ') + b.nome });
    interruptor.addEventListener('change', async () => {
      try { await chamar('admin_medalha_ativar', { chave: b.chave, ativa: interruptor.checked }); avisar(interruptor.checked ? 'Conquista ativada.' : 'Conquista desativada: ninguém a vê.'); }
      catch (e) { avisar(e.message, 'erro'); interruptor.checked = !interruptor.checked; }
    });
    const resumo = b.tipo === 'disputada' ? (b.dono ? `Com ${b.dono}` : 'Sem dono ainda') : `${b.tem} ${b.tem === 1 ? 'pessoa tem' : 'pessoas têm'}`;
    const niveis = b.niveis.length ? b.niveis : [b.nome];
    return h('li', { class: 'adm-med' + (b.ativa ? '' : ' inativo') },
      h('div', { class: 'adm-med-topo' }, h('strong', null, b.nome), h('span', { class: 'etiqueta cinza' }, b.grupo), h('span', { class: 'etiqueta' }, ROTULO_TIPO[b.tipo]),
        h('span', { class: 'suave pequeno' }, resumo), h('label', { class: 'interruptor' }, interruptor, h('span', null, 'Ativa'))),
      h('div', { class: 'adm-niveis-img' }, niveis.map((n, i) => espacoImagem(b, i + 1, b.niveis.length ? `${i + 1}. ${n}` : 'Imagem'))),
      conceder ? h('div', { class: 'acoes adm-conceder' }, h('div', { class: 'conceder-linha' }, sel, niv, aplicar), aviso) : null);
  }

  const lista = h('ul', { class: 'adm-meds' });
  const contagem = h('p', { class: 'suave pequeno' });
  const MAX = 30;
  let mostrando = MAX;
  function pintar() {
    const q = filtro.busca.trim().toLowerCase();
    const todas = d.medalhas.filter((b) => (filtro.grupo === 'todos' || b.grupo === filtro.grupo) && (filtro.tipo === 'todos' || b.tipo === filtro.tipo)
      && (!q || b.nome.toLowerCase().includes(q) || b.niveis.some((n) => n.toLowerCase().includes(q))));
    contagem.textContent = `${todas.length} ${todas.length === 1 ? 'medalha' : 'medalhas'}`;
    montar(lista, todas.slice(0, mostrando).map(cartaoMedalha),
      todas.length > mostrando ? h('li', { class: 'ver-mais' }, h('button', { type: 'button', class: 'btn-sec', onclick: () => { mostrando += MAX; pintar(); } }, `Mostrar mais (${todas.length - mostrando})`)) : null);
  }
  const grupo = dropdown({ rotulo: 'Grupo', mini: true, valor: 'todos', opcoes: [['todos', 'Todos os grupos'], ...d.grupos.filter((g) => d.secretas_liberadas || g !== 'Secretas').map((g) => [g, g])] });
  const tipo = dropdown({ rotulo: 'Tipo', mini: true, valor: 'todos', opcoes: TIPOS.filter(([k]) => d.secretas_liberadas || k !== 'secreta') });
  const busca = h('input', { type: 'search', placeholder: 'Buscar conquista ou nível…', 'aria-label': 'Buscar conquista' });
  grupo.addEventListener('change', () => { filtro.grupo = grupo.value; mostrando = MAX; pintar(); });
  tipo.addEventListener('change', () => { filtro.tipo = tipo.value; mostrando = MAX; pintar(); });
  busca.addEventListener('input', () => { filtro.busca = busca.value; mostrando = MAX; pintar(); });
  pintar();

  const campoPalavra = h('input', { type: 'password', autocomplete: 'off', placeholder: 'Palavra-chave das secretas', 'aria-label': 'Palavra-chave das conquistas secretas', value: '' });
  const liberar = () => { palavra = campoPalavra.value.trim(); recarregar(); };
  campoPalavra.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); liberar(); } });

  const eventosSemMedalha = d.eventos.filter((e) => !e.selo_nome);
  const novoEvento = dropdown({ rotulo: 'Evento', mini: true, opcoes: eventosSemMedalha.length ? eventosSemMedalha.map((e) => [e.id, e.nome]) : [['', 'Todos os eventos já têm conquista']] });

  montar(painel,
    h('p', { class: 'suave' }, 'As conquistas são calculadas sozinhas e o que já foi ganho fica guardado. Aqui você envia a imagem de cada nível (clique no espaço), liga ou desliga uma conquista para todos e concede à mão. A concessão nunca rebaixa quem já ganhou pelo uso. As disputadas mudam de dono sozinhas.'),
    h('section', { class: 'med-secao' },
      h('div', { class: 'med-secao-topo' }, h('h3', null, 'Conquistas de eventos'), h('p', { class: 'suave pequeno' }, 'Dê nome a uma conquista só do evento e envie a imagem quando ele acontecer. Ganha quem confirmar presença e marcar como Visto, no dia, mais da metade dos títulos.')),
      eventosSemMedalha.length ? h('div', { class: 'acoes' }, novoEvento, h('button', { type: 'button', class: 'btn-sec', onclick: () => {
        const ev = d.eventos.find((x) => x.id === novoEvento.value);
        if (!ev) return;
        const nome = prompt(`Nome da conquista do evento “${ev.nome}”:`);
        if (nome && nome.trim()) chamar('admin_evento_selo', { evento_id: ev.id, selo_nome: nome.trim(), selo_descricao: '' }).then(() => { avisar('Conquista criada.'); recarregar(); }).catch((e) => avisar(e.message, 'erro'));
      } }, 'Criar conquista de evento')) : null,
      d.eventos.some((e) => e.selo_nome) ? h('div', { class: 'adm-eventos' }, d.eventos.filter((e) => e.selo_nome).map(cartaoEvento)) : h('p', { class: 'suave pequeno' }, 'Nenhum evento tem conquista ainda.')),
    h('section', { class: 'med-secao' },
      h('div', { class: 'med-secao-topo' }, h('h3', null, 'Todas as conquistas')),
      h('div', { class: 'adm-secretas' }, d.secretas_liberadas
        ? h('span', { class: 'etiqueta' }, 'Secretas liberadas nesta sessão')
        : [campoPalavra, h('button', { type: 'button', class: 'btn-sec', onclick: liberar }, 'Liberar secretas'),
          d.palavra_errada ? h('small', { class: 'erro' }, 'Palavra-chave incorreta.') : h('small', { class: 'suave' }, 'As conquistas secretas só aparecem com a palavra-chave.')]),
      h('div', { class: 'adm-filtros' }, busca, grupo, tipo),
      contagem, lista));
}
