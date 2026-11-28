import { h, montar } from '../../dom.js';
import { chamar } from '../../api.js';
import { esqueleto, avisar } from '../../ui.js';
import { slotMedalha, ROTULO_TIPO } from '../../medalhas.js';
import { dropdown } from '../../dropdown.js';

const ABAS = [['trilha', 'Com níveis'], ['disputada', 'Disputadas'], ['selo', 'De eventos'], ['unica', 'Únicas'], ['secreta', 'Secretas']];
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
  const filtro = { aba: 'trilha', grupo: 'todos', busca: '' };
  const abertos = new Map();   // chave -> 'editar' | 'conceder'

  /** Um espaço de imagem clicável: escolhe o arquivo, envia e atualiza. */
  function espacoImagem(b, nivel, rotulo) {
    const entrada = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'sr-only', tabindex: '-1' });
    const slot = slotMedalha({ chave: b.chave, nivel, imagens: d.imagens, tamanho: 52, tem: true });
    const url = d.imagens[b.chave.replace(/[^a-zA-Z0-9_]/g, '_') + '_' + nivel];
    const nomeImg = rotulo ? `${b.nome}, nível ${rotulo}` : b.nome;
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
    slot.setAttribute('role', 'button'); slot.tabIndex = 0; slot.setAttribute('aria-label', 'Enviar imagem: ' + nomeImg);
    slot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrada.click(); } });
    slot.removeAttribute('aria-hidden');
    return h('div', { class: 'adm-img', title: 'Clique para enviar a imagem' }, slot, rotulo ? h('small', null, rotulo) : null,
      url ? h('button', { type: 'button', class: 'adm-img-x', 'aria-label': 'Remover imagem: ' + nomeImg, title: 'Remover imagem', onclick: async () => {
        if (!confirm(`Remover a imagem de “${nomeImg}”?`)) return;
        try { await chamar('admin_medalha_imagem', { chave: b.chave, nivel, remover: true, palavra }); avisar('Imagem removida.'); recarregar(); } catch (e) { avisar(e.message, 'erro'); }
      } }, '×') : null, entrada);
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
      conquista ? espacoImagem(conquista, 1, '') : slotMedalha({ chave: 'selo:' + e.id, nivel: 1, imagens: d.imagens, tamanho: 52 }),
      h('form', { onsubmit: (ev) => { ev.preventDefault(); salvar(false); } },
        h('strong', null, e.nome), h('small', { class: 'suave' }, new Date(e.inicio).toLocaleDateString('pt-BR') + (conquista ? ` · ${conquista.tem} ${conquista.tem === 1 ? 'pessoa ganhou' : 'pessoas ganharam'}` : '')),
        nome, desc,
        h('div', { class: 'acoes' },
          h('button', { type: 'submit', class: 'btn-sec' }, e.selo_nome ? 'Salvar' : 'Criar conquista'),
          e.selo_nome ? h('button', { type: 'button', class: 'btn-sec perigo', onclick: () => { if (confirm(`Remover a conquista “${e.selo_nome}”? Quem já a ganhou deixa de vê-la.`)) salvar(true); } }, 'Remover') : null)));
  }

  // ---- editar nome, descrição e nomes dos níveis ----
  function painelEditar(b) {
    const nome = h('input', { type: 'text', maxlength: 60, value: b.nome, placeholder: b.padrao.nome, 'aria-label': 'Nome da conquista' });
    const desc = h('textarea', { rows: 2, maxlength: 200, 'aria-label': 'Descrição' }, b.descricao);
    const niveis = b.padrao.niveis.map((_, i) => h('input', { type: 'text', maxlength: 40, value: b.niveis_nomes[i] || '', placeholder: `Nível ${i + 1}`, 'aria-label': `Nome do nível ${i + 1}` }));
    const salvar = async (restaurar) => {
      try {
        await chamar('admin_medalha_textos', restaurar ? { chave: b.chave, restaurar: true } : { chave: b.chave, nome: nome.value, descricao: desc.value, niveis: niveis.map((x) => x.value) });
        avisar(restaurar ? 'Voltou ao texto original.' : 'Texto salvo.'); abertos.delete(b.chave); recarregar();
      } catch (e) { avisar(e.message, 'erro'); }
    };
    return h('form', { class: 'adm-edicao', onsubmit: (ev) => { ev.preventDefault(); salvar(false); } },
      h('div', { class: 'adm-edicao-topo' },
        h('label', null, 'Nome', nome),
        h('label', { class: 'adm-edicao-desc' }, 'Descrição (o que a pessoa precisa fazer)', desc)),
      niveis.length ? h('div', { class: 'adm-edicao-niveis' }, niveis.map((inp, i) =>
        h('label', null, `Nível ${i + 1} · ${b.metas[i]} ${b.unidade}`, inp))) : null,
      h('div', { class: 'acoes' },
        h('button', { type: 'submit', class: 'btn-primario' }, 'Salvar'),
        h('button', { type: 'button', class: 'btn-sec', onclick: () => { abertos.delete(b.chave); pintar(); } }, 'Cancelar'),
        b.editado ? h('button', { type: 'button', class: 'btn-sec perigo', onclick: () => { if (confirm('Voltar nome, descrição e níveis ao texto original?')) salvar(true); } }, 'Voltar ao original') : null,
        niveis.length ? h('small', { class: 'suave' }, 'Deixe um nível em branco para ele ficar só como “Nível N”.') : null));
  }

  // ---- conceder à mão ----
  function painelConceder(b) {
    const sel = dropdown({ rotulo: 'Pessoa para ' + b.nome, mini: true, opcoes: d.membros.map((m) => [m.id, m.nome]) });
    const niv = dropdown({ rotulo: 'Nível de ' + b.nome, mini: true });
    const aviso = h('small', { class: 'suave' });
    const pintarNiv = () => {
      const q = b.membros[sel.value] || { nivel: 0, concedida: false };
      niv.definirOpcoes([['0', q.concedida ? 'Retirar concessão' : 'Escolha o nível'],
        ...(b.niveis.length ? b.niveis.map((n, i) => [String(i + 1), n]) : [['1', 'Conceder']])]);
      niv.value = q.concedida ? String(q.nivel) : '0';
      aviso.textContent = q.nivel ? `Atual: ${b.niveis.length ? b.niveis[q.nivel - 1] : 'conquistada'}${q.concedida ? ' (concedida)' : ''}` : 'Ainda não tem';
    };
    sel.addEventListener('change', pintarNiv); pintarNiv();
    const aplicar = h('button', { type: 'button', class: 'btn-sec', onclick: async () => {
      aplicar.disabled = true;
      try { await chamar('admin_medalha_conceder', { membro_id: sel.value, chave: b.chave, nivel: Number(niv.value) }); avisar('Conquista atualizada.'); recarregar(); }
      catch (e) { avisar(e.message, 'erro'); aplicar.disabled = false; }
    } }, 'Aplicar');
    return h('div', { class: 'adm-conceder' }, h('div', { class: 'conceder-linha' }, sel, niv, aplicar), aviso,
      h('small', { class: 'suave' }, 'A concessão nunca rebaixa quem já ganhou pelo uso.'));
  }

  // ---- uma linha por conquista, sempre com a mesma altura; o que se edita abre embaixo ----
  function linha(b) {
    const aberto = abertos.get(b.chave);
    const alterna = (modo) => { if (abertos.get(b.chave) === modo) abertos.delete(b.chave); else abertos.set(b.chave, modo); pintar(); };
    const interruptor = h('input', { type: 'checkbox', checked: b.ativa, 'aria-label': 'Ativa: ' + b.nome });
    interruptor.addEventListener('change', async () => {
      try { await chamar('admin_medalha_ativar', { chave: b.chave, ativa: interruptor.checked }); avisar(interruptor.checked ? 'Conquista ativada.' : 'Conquista desativada: ninguém a vê.'); }
      catch (e) { avisar(e.message, 'erro'); interruptor.checked = !interruptor.checked; }
    });
    const resumo = b.tipo === 'disputada' ? (b.dono ? `Com ${b.dono}` : 'Sem dono ainda') : `${b.tem} ${b.tem === 1 ? 'pessoa tem' : 'pessoas têm'}`;
    const imgs = b.niveis.length ? b.niveis.map((n, i) => espacoImagem(b, i + 1, String(i + 1))) : [espacoImagem(b, 1, '')];
    const editavel = b.tipo !== 'selo';
    return h('li', { class: 'adm-linha' + (b.ativa ? '' : ' inativo') },
      h('div', { class: 'adm-l-info' },
        h('div', { class: 'adm-l-nome' }, h('strong', null, b.nome), h('span', { class: 'etiqueta cinza' }, b.grupo), b.editado ? h('span', { class: 'etiqueta' }, 'editada') : null),
        h('p', { class: 'adm-l-desc', title: b.descricao }, b.descricao || 'Sem descrição.')),
      h('div', { class: 'adm-l-imgs' }, imgs),
      h('div', { class: 'adm-l-acoes' },
        h('span', { class: 'suave pequeno adm-l-resumo' }, resumo),
        editavel ? h('button', { type: 'button', class: 'btn-sec' + (aberto === 'editar' ? ' ligado' : ''), onclick: () => alterna('editar') }, 'Editar texto') : null,
        b.tipo !== 'disputada' ? h('button', { type: 'button', class: 'btn-sec' + (aberto === 'conceder' ? ' ligado' : ''), onclick: () => alterna('conceder') }, 'Conceder') : null,
        h('label', { class: 'interruptor' }, interruptor, h('span', null, 'Ativa'))),
      aberto === 'editar' ? painelEditar(b) : aberto === 'conceder' ? painelConceder(b) : null);
  }

  const lista = h('ul', { class: 'adm-lista' });
  function pintar() {
    const q = filtro.busca.trim().toLowerCase();
    const todas = d.medalhas.filter((b) => b.tipo === filtro.aba && (filtro.grupo === 'todos' || b.grupo === filtro.grupo)
      && (!q || b.nome.toLowerCase().includes(q) || (b.descricao || '').toLowerCase().includes(q) || b.niveis.some((n) => n.toLowerCase().includes(q))));
    montar(lista, todas.length ? todas.map(linha) : h('li', { class: 'suave adm-vazio' }, 'Nenhuma conquista aqui.'));
  }
  const grupo = dropdown({ rotulo: 'Tema', mini: true, valor: 'todos', opcoes: [['todos', 'Todos os temas'], ...d.grupos.filter((g) => g !== 'Secretas').map((g) => [g, g])] });
  const busca = h('input', { type: 'search', placeholder: 'Buscar conquista…', 'aria-label': 'Buscar conquista' });
  grupo.addEventListener('change', () => { filtro.grupo = grupo.value; pintar(); });
  busca.addEventListener('input', () => { filtro.busca = busca.value; pintar(); });

  const campoPalavra = h('input', { type: 'password', autocomplete: 'off', placeholder: 'Palavra-chave das secretas', 'aria-label': 'Palavra-chave das conquistas secretas', value: '' });
  const liberar = () => { palavra = campoPalavra.value.trim(); recarregar(); };
  campoPalavra.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); liberar(); } });

  const eventosSemConquista = d.eventos.filter((e) => !e.selo_nome);
  const novoEvento = dropdown({ rotulo: 'Evento', mini: true, opcoes: eventosSemConquista.length ? eventosSemConquista.map((e) => [e.id, e.nome]) : [['', 'Todos os eventos já têm conquista']] });

  const abasDisponiveis = ABAS.filter(([k]) => k === 'trilha' || k === 'disputada' || k === 'selo'
    || (k === 'unica' && d.medalhas.some((b) => b.tipo === 'unica')) || (k === 'secreta' && d.tem_secretas));
  const contar = (k) => (k === 'selo' ? d.eventos.filter((e) => e.selo_nome).length : d.medalhas.filter((b) => b.tipo === k).length);
  const barra = h('div', { class: 'adm-abas abas-linha', role: 'tablist' }, abasDisponiveis.map(([k, r]) =>
    h('button', { type: 'button', role: 'tab', class: 'aba' + (k === filtro.aba ? ' ligada' : ''), 'aria-selected': String(k === filtro.aba),
      onclick: () => { filtro.aba = k; filtro.grupo = 'todos'; grupo.value = 'todos'; desenharAba(); } }, r, h('small', { class: 'med-contagem' }, String(contar(k))))));
  const corpo = h('div', { class: 'adm-corpo' });

  function desenharAba() {
    barra.querySelectorAll('.aba').forEach((el, i) => { const ligada = abasDisponiveis[i][0] === filtro.aba; el.classList.toggle('ligada', ligada); el.setAttribute('aria-selected', String(ligada)); });
    if (filtro.aba === 'selo') {
      montar(corpo,
        h('p', { class: 'suave pequeno' }, 'Dê nome a uma conquista só do evento e envie a imagem quando ele acontecer. Ganha quem confirmar presença e marcar como Visto, no dia, mais da metade dos títulos.'),
        eventosSemConquista.length ? h('div', { class: 'acoes' }, novoEvento, h('button', { type: 'button', class: 'btn-sec', onclick: () => {
          const ev = d.eventos.find((x) => x.id === novoEvento.value);
          if (!ev) return;
          const nome = prompt(`Nome da conquista do evento “${ev.nome}”:`);
          if (nome && nome.trim()) chamar('admin_evento_selo', { evento_id: ev.id, selo_nome: nome.trim(), selo_descricao: '' }).then(() => { avisar('Conquista criada.'); recarregar(); }).catch((e) => avisar(e.message, 'erro'));
        } }, 'Criar conquista de evento')) : null,
        d.eventos.some((e) => e.selo_nome) ? h('div', { class: 'adm-eventos' }, d.eventos.filter((e) => e.selo_nome).map(cartaoEvento)) : h('p', { class: 'suave pequeno' }, 'Nenhum evento tem conquista ainda.'));
      return;
    }
    const dicas = { trilha: 'Cada conquista tem níveis. Clique no espaço de um nível para enviar a imagem, ou em “Editar texto” para mudar nome, descrição e nomes dos níveis.',
      disputada: 'Uma pessoa por vez. Elas mudam de dono sozinhas.', unica: 'Ganhou, é sua.', secreta: 'Só aparecem para o grupo depois que alguém ganha.' };
    montar(corpo,
      h('p', { class: 'suave pequeno' }, dicas[filtro.aba]),
      filtro.aba === 'secreta' && !d.secretas_liberadas ? h('div', { class: 'adm-secretas' }, campoPalavra, h('button', { type: 'button', class: 'btn-sec', onclick: liberar }, 'Liberar secretas'),
        d.palavra_errada ? h('small', { class: 'erro' }, 'Palavra-chave incorreta.') : h('small', { class: 'suave' }, 'As secretas só aparecem com a palavra-chave.')) : null,
      h('div', { class: 'adm-filtros' }, busca, grupo),
      lista);
    pintar();
  }
  desenharAba();

  montar(painel, barra, corpo);
}
