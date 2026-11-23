import { h, montar, icone } from '../../dom.js';
import { estado, carregarCatalogo } from '../../estado.js';
import { chamar } from '../../api.js';
import { avisar, capa } from '../../ui.js';
import { carregarEventos, limparEventos, colagem, TIPOS_EVENTO, FASES } from '../../eventos.js';
import { dataLonga, paraLocal, paraIso } from '../../datas.js';
import { seletorTitulos } from '../../seletor.js';
import { ajustarImagem } from '../../imagem.js';
import { dropdown } from '../../dropdown.js';
import { editorProgramacao } from './programacao.js';

// Qual formulário está aberto na aba: 'evento' | 'votacao' | 'discord'
let gaveta = null;
let editando = null;

/** Aba Eventos: abre sempre com os formulários fechados. */
export function abaEventos(ctx) {
  gaveta = null; editando = null;
  return desenharEventos(ctx);
}

async function desenharEventos({ painel, ativa }) {
  montar(painel, h('p', { class: 'suave' }, 'Carregando…'));
  let d;
  try { await carregarCatalogo(); d = await carregarEventos({ forcar: true }); } catch (e) { if (ativa()) montar(painel, h('p', { class: 'erro' }, e.message)); return; }
  if (!ativa()) return;
  const refazer = (fechar = true) => { if (fechar) { gaveta = null; editando = null; } limparEventos(); desenharEventos({ painel, ativa }); };
  const nomeDe = (id) => { const t = estado.catalogo.titulos.find((x) => x.id === id); return t ? t.nome : '(removido)'; };
  const abrir = (g, e = null) => { gaveta = g; editando = e; desenharEventos({ painel, ativa }); };

  // --- evento (criar / editar) ---
  function formEvento(e) {
    let modo = e ? (e.modo || 'programado') : 'votacao';
    const progIds = new Set(e && e.programacao ? e.programacao.dias.flatMap((x) => x.itens.map((i) => i.t)) : []);
    const sel = seletorTitulos(e ? e.titulos.filter((id) => !progIds.has(id)) : [], 40);
    const dataPadrao = () => (campo.inicio.value ? campo.inicio.value.slice(0, 10) : '');
    const prog = editorProgramacao(e ? e.programacao : null, { aoMudar: () => atualizarVisivel(), dataPadrao });
    let imagem; // undefined = não mexer · texto = nova imagem · null = remover
    const previa = h('div', { class: 'campo-imagem-previa' });
    const pintarPrevia = () => {
      const url = imagem === null ? '' : (imagem || (e ? e.imagem_url : ''));
      montar(previa, url ? h('img', { src: url, alt: 'Imagem do evento', referrerpolicy: 'no-referrer' }) : h('span', { class: 'suave pequeno' }, 'Sem imagem — o evento usa a capa do primeiro filme.'));
    };
    const arquivo = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr-only', id: 'ev-imagem', onchange: async (ev) => {
      const f = ev.target.files[0]; ev.target.value = '';
      if (!f) return;
      try {
        const r = await ajustarImagem(f, 1200, 675, { titulo: 'Ajustar imagem do evento' });
        if (r) { imagem = r; pintarPrevia(); }
      } catch (err) { avisar(err.message, 'erro'); }
    } });
    pintarPrevia();
    const local = (iso) => (iso ? paraLocal(iso) : '');
    const campo = {
      nome: h('input', { type: 'text', maxlength: 80, value: e ? e.nome : '', required: true }),
      tipo: dropdown({ rotulo: 'Tipo do evento', opcoes: Object.entries(TIPOS_EVENTO) }),
      tema: h('input', { type: 'text', maxlength: 60, value: e ? e.tema : '', placeholder: 'Ex.: Halloween, Natal…' }),
      inicio: h('input', { type: 'datetime-local', value: local(e && e.inicio) }),
      fim: h('input', { type: 'datetime-local', value: local(e && e.fim) }),
      local: h('input', { type: 'text', maxlength: 80, value: e ? e.local : '', placeholder: 'Ex.: Discord, casa da Ana…' }),
      descricao: h('textarea', { rows: 3, maxlength: 600 }, e ? e.descricao : ''),
      avisar: h('input', { type: 'checkbox', checked: !e }),
      vagas: h('input', { type: 'number', min: 1, max: 40, step: 1, value: e && e.vagas ? e.vagas : 10 }),
      sug_ini: h('input', { type: 'datetime-local', value: local(e && e.sug_ini) }),
      sug_fim: h('input', { type: 'datetime-local', value: local(e && e.sug_fim) }),
      vot_fim: h('input', { type: 'datetime-local', value: local(e && e.vot_fim) }),
      sugestoes_max: h('input', { type: 'number', min: 0, max: 10, step: 1, value: e ? e.sugestoes_cfg || 0 : 0 }),
      votos_max: h('input', { type: 'number', min: 0, max: 20, step: 1, value: e ? e.votos_max : 0 })
    };
    if (e) campo.tipo.value = e.tipo;
    // Datas sugeridas: sugestões 8 dias antes, votação 4 dias antes, fim da votação 1 dia antes (só se o admin ainda não mexeu).
    const tocados = new Set(e && e.modo === 'votacao' ? ['sug_ini', 'sug_fim', 'vot_fim'] : []);
    ['sug_ini', 'sug_fim', 'vot_fim'].forEach((k) => campo[k].addEventListener('change', () => tocados.add(k)));
    campo.inicio.addEventListener('change', () => {
      const t0 = new Date(campo.inicio.value).getTime(); if (!t0) return;
      const dias = { sug_ini: 8, sug_fim: 4, vot_fim: 1 };
      Object.entries(dias).forEach(([k, n]) => { if (!tocados.has(k)) campo[k].value = paraLocal(new Date(t0 - n * 86400000).toISOString()); });
      atualizarVisivel();
    });
    const cotasInfo = h('p', { class: 'suave pequeno' });
    const blocoVotacao = h('fieldset', { class: 'painel-discreto' },
      h('legend', null, 'Sugestões e votação'),
      h('div', { class: 'duas-colunas' },
        h('label', null, 'Quantos títulos vão passar no evento', campo.vagas),
        h('span')),
      h('div', { class: 'duas-colunas' }, h('label', null, 'Sugestões começam', campo.sug_ini), h('label', null, 'Sugestões terminam (e a votação começa)', campo.sug_fim)),
      h('div', { class: 'duas-colunas' }, h('label', null, 'Votação termina', campo.vot_fim), h('span')),
      h('div', { class: 'duas-colunas' },
        h('label', null, 'Sugestões por pessoa (0 = automático)', campo.sugestoes_max),
        h('label', null, 'Votos por pessoa (0 = automático)', campo.votos_max)),
      cotasInfo);
    const blocoInicio = h('div', { class: 'duas-colunas' }, h('label', { class: 'rotulo-inicio' }, 'Início do evento', campo.inicio), h('label', null, 'Término (opcional)', campo.fim));
    const blocoProg = h('div', null,
      h('span', { class: 'rotulo' }, 'Programação por dia'),
      h('p', { class: 'suave pequeno' }, 'Escolha os dias, o horário de início e os títulos de cada um, com o intervalo entre eles. Em séries, informe quais episódios serão vistos.'),
      prog.el);
    const blocoExtras = h('div', null, h('span', { class: 'rotulo' }, 'Outros títulos já confirmados (sem dia/horário definido)'), sel.el);
    const botoesModo = h('div', { class: 'ev-modos', role: 'group', 'aria-label': 'Como será o evento' });
    const opcoesModo = [
      ['votacao', 'Com sugestões e votação', 'Primeiro todos confirmam presença, depois sugerem e votam nos títulos. Os prazos andam sozinhos e avisam no Discord.'],
      ['programado', 'Programação já definida', 'Você escolhe os títulos de cada dia e o intervalo entre eles. Sem sugestões nem votos.']
    ];
    function pintarModos() {
      montar(botoesModo, opcoesModo.map(([id, titulo, texto]) => h('button', { type: 'button', class: 'ev-modo' + (modo === id ? ' ligada' : ''), 'aria-pressed': String(modo === id),
        onclick: () => { modo = id; pintarModos(); atualizarVisivel(); } }, h('strong', null, titulo), h('small', null, texto))));
    }
    function atualizarVisivel() {
      const v = modo === 'votacao';
      blocoVotacao.hidden = !v;
      blocoProg.hidden = v;
      // início: no modo programado, quando já há dias montados, ele vem do primeiro horário
      const deProg = !v && prog.temItens();
      blocoInicio.hidden = deProg;
      if (v) {
        const vagas = Number(campo.vagas.value) || 0, n = e && e.cotas ? e.cotas : null;
        cotasInfo.textContent = n
          ? `Hoje: ${n.participantes} ${n.usa_confirmados ? 'confirmados' : 'membros (ninguém confirmou ainda)'} → ${n.sugestoes_por_pessoa} ${n.sugestoes_por_pessoa === 1 ? 'sugestão' : 'sugestões'} e ${n.votos_por_pessoa} ${n.votos_por_pessoa === 1 ? 'voto' : 'votos'} por pessoa. O cálculo é refeito quando as sugestões abrem, com base em quem confirmou.`
          : `No automático, as sugestões e votos por pessoa são calculados quando as sugestões abrem, a partir de quantos confirmaram e de ${vagas || '…'} vagas.`;
      }
    }
    campo.vagas.addEventListener('input', atualizarVisivel);
    pintarModos(); atualizarVisivel();

    const msg = h('p', { class: 'erro', role: 'alert' });
    const form = h('form', { class: 'painel-discreto form-evento', onsubmit: async (ev) => {
      ev.preventDefault(); msg.textContent = '';
      const botao = form.querySelector('button[type=submit]'); botao.disabled = true;
      const corpo = {
        id: e ? e.id : undefined, nome: campo.nome.value, tipo: campo.tipo.value, tema: campo.tema.value, modo,
        local: campo.local.value, descricao: campo.descricao.value, titulos: sel.valor(), avisar: campo.avisar.checked
      };
      if (modo === 'votacao') {
        Object.assign(corpo, { inicio: paraIso(campo.inicio.value), fim: paraIso(campo.fim.value), vagas: Number(campo.vagas.value) || 0,
          sug_ini: paraIso(campo.sug_ini.value), sug_fim: paraIso(campo.sug_fim.value), vot_fim: paraIso(campo.vot_fim.value),
          sugestoes_max: Number(campo.sugestoes_max.value) || 0, votos_max: Number(campo.votos_max.value) || 0, programacao: { dias: [] } });
      } else {
        const p = prog.valor();
        Object.assign(corpo, { programacao: p, fim: p.dias.length ? '' : paraIso(campo.fim.value) });
        if (!p.dias.length) corpo.inicio = paraIso(campo.inicio.value);
      }
      if (imagem) corpo.imagem = imagem; else if (imagem === null) corpo.remover_imagem = true;
      try {
        const r = await chamar('admin_evento_salvar', corpo);
        avisar((e ? 'Evento atualizado.' : 'Evento criado.') + (r.discord ? ' Aviso enviado ao Discord.' : '')); refazer();
      } catch (err) { msg.textContent = err.message; botao.disabled = false; }
    } },
      h('h2', null, e ? 'Editar evento' : 'Novo evento'),
      h('label', null, 'Nome', campo.nome),
      h('div', { class: 'duas-colunas' }, h('label', null, 'Tipo', campo.tipo), h('label', null, 'Tema (opcional)', campo.tema)),
      h('div', null, h('span', { class: 'rotulo' }, 'Como será o evento?'), botoesModo),
      blocoInicio,
      blocoVotacao,
      h('label', null, 'Local (opcional)', campo.local),
      h('label', null, 'Descrição (opcional)', campo.descricao),
      h('div', { class: 'campo-imagem' },
        h('span', { class: 'rotulo' }, 'Imagem do evento (opcional, 1200 × 675)'), previa,
        h('div', { class: 'acoes' },
          h('label', { class: 'btn-sec', for: 'ev-imagem' }, icone('editar', 16), 'Escolher imagem'),
          h('button', { type: 'button', class: 'btn-sec', onclick: () => { imagem = null; pintarPrevia(); } }, 'Remover'), arquivo)),
      e && e.sugestoes.length ? h('div', null, h('span', { class: 'rotulo' }, `Sugestões da comunidade (${e.sugestoes.length})`),
        h('div', { class: 'ev-titulos' }, e.sugestoes.map((x) => {
          const t = estado.catalogo.titulos.find((y) => y.id === x.titulo_id), m = estado.catalogo.membros.find((y) => y.id === x.membro_id);
          return h('span', { class: 'chip-titulo' }, (t ? t.nome : '?') + ' · ' + (m ? m.nome.split(' ')[0] : '?'),
            h('button', { type: 'button', 'aria-label': 'Remover sugestão', onclick: async (ev) => {
              try { await chamar('admin_sugestao_remover', { evento_id: e.id, membro_id: x.membro_id, titulo_id: x.titulo_id }); ev.target.closest('.chip-titulo').remove(); limparEventos(); }
              catch (err) { avisar(err.message, 'erro'); } } }, '×'));
        }))) : null,
      blocoProg,
      blocoExtras,
      h('label', { class: 'check' }, campo.avisar, ' Avisar no Discord'),
      msg,
      h('div', { class: 'acoes' }, h('button', { type: 'submit', class: 'btn-primario' }, e ? 'Salvar' : 'Criar evento'),
        h('button', { type: 'button', class: 'btn-sec', onclick: () => refazer() }, 'Cancelar')));
    return form;
  }

  // --- votação ---
  function formVotacao() {
    const sel = seletorTitulos([], 20);
    const pergunta = h('input', { type: 'text', maxlength: 120, placeholder: 'Ex.: Quais filmes vão para a maratona?', required: true });
    const evento = dropdown({ rotulo: 'Evento', opcoes: [['', '(sem evento)'], ...d.eventos.filter((x) => !x.cancelado).map((x) => [x.id, x.nome])] });
    const prazo = h('input', { type: 'datetime-local' });
    const maxVotos = h('input', { type: 'number', min: 1, max: 20, value: 1 });
    const vagas = h('input', { type: 'number', min: 1, max: 20, value: 1 });
    const av = h('input', { type: 'checkbox', checked: true });
    const usar = h('input', { type: 'checkbox' });
    const infoSug = h('span', { class: 'suave pequeno' });
    const caixaUsar = h('label', { class: 'check', hidden: true }, usar, infoSug);
    const caixaOpcoes = h('div', null, h('span', { class: 'rotulo' }, 'Opções (de 2 a 20 títulos)'), sel.el);
    const atualizar = () => {
      const ev = d.eventos.find((x) => x.id === evento.value);
      const n = ev ? new Set(ev.sugestoes.map((x) => x.titulo_id)).size : 0;
      caixaUsar.hidden = !n;
      infoSug.textContent = ` Votar nos ${n} filmes sugeridos pela comunidade para este evento (fecha as sugestões)`;
      if (!n) usar.checked = false;
      caixaOpcoes.hidden = usar.checked;
    };
    evento.addEventListener('change', atualizar); usar.addEventListener('change', atualizar);
    const msg = h('p', { class: 'erro', role: 'alert' });
    const form = h('form', { class: 'painel-discreto form-evento', onsubmit: async (ev) => {
      ev.preventDefault(); msg.textContent = '';
      const botao = form.querySelector('button[type=submit]'); botao.disabled = true;
      try {
        await chamar('admin_votacao_criar', { pergunta: pergunta.value, opcoes: usar.checked ? undefined : sel.valor(), das_sugestoes: usar.checked, evento_id: evento.value,
          encerra_em: paraIso(prazo.value), max_votos: Number(maxVotos.value) || 1, vagas: Number(vagas.value) || 1, avisar: av.checked });
        avisar('Votação aberta.'); refazer();
      } catch (err) { msg.textContent = err.message; botao.disabled = false; }
    } },
      h('h2', null, 'Nova votação'),
      h('label', null, 'Pergunta', pergunta),
      h('div', { class: 'duas-colunas' }, h('label', null, 'Evento ligado (opcional)', evento), h('label', null, 'Prazo (opcional)', prazo)),
      caixaUsar, caixaOpcoes,
      h('div', { class: 'duas-colunas' }, h('label', null, 'Votos por pessoa', maxVotos), h('label', null, 'Quantos filmes entram (mais votados)', vagas)),
      h('label', { class: 'check' }, av, ' Avisar no Discord'),
      msg, h('div', { class: 'acoes' }, h('button', { type: 'submit', class: 'btn-primario' }, 'Abrir votação'), h('button', { type: 'button', class: 'btn-sec', onclick: () => refazer() }, 'Cancelar')));
    return form;
  }

  // --- Discord + link do site ---
  function formDiscord() {
    const url = h('input', { type: 'url', placeholder: 'https://discord.com/api/webhooks/…', autocomplete: 'off', 'aria-label': 'Link do webhook do Discord' });
    const site = h('input', { type: 'url', placeholder: 'https://seu-usuario.github.io/seu-site/', autocomplete: 'off', value: d.site_url || location.href.replace(/#.*$/, ''), 'aria-label': 'Endereço do site' });
    const msgD = h('p', { class: 'erro', role: 'alert' });
    return h('section', { class: 'painel-discreto form-evento' },
      h('h2', null, 'Discord e link do site'),
      h('p', { class: 'suave' }, d.discord_configurado ? '✓ Discord conectado. Eventos e votações são avisados no canal.' : 'Discord ainda não conectado. No canal: Configurações → Integrações → Webhooks → Novo webhook → Copiar URL.'),
      h('label', null, d.discord_configurado ? 'Trocar o link do webhook' : 'Link do webhook', url),
      h('div', { class: 'acoes' },
        h('button', { type: 'button', class: 'btn-primario', onclick: async () => {
          msgD.textContent = '';
          try { await chamar('admin_discord_configurar', { url: url.value.trim() }); avisar('Discord conectado.'); refazer(false); } catch (err) { msgD.textContent = err.message; } } }, 'Salvar webhook'),
        d.discord_configurado ? h('button', { type: 'button', class: 'btn-sec', onclick: async () => {
          try { await chamar('admin_discord_testar'); avisar('Mensagem de teste enviada.'); } catch (err) { msgD.textContent = err.message; } } }, 'Enviar teste') : null,
        d.discord_configurado ? h('button', { type: 'button', class: 'btn-sec perigo', onclick: async () => {
          try { await chamar('admin_discord_configurar', { url: '' }); avisar('Discord desconectado.'); refazer(false); } catch (err) { avisar(err.message, 'erro'); } } }, 'Desconectar') : null),
      h('label', null, 'Endereço do site (vai como link nos avisos do Discord e no e-mail do PIN)', site),
      h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'btn-primario', onclick: async () => {
        msgD.textContent = '';
        try { await chamar('admin_site_configurar', { url: site.value.trim() }); avisar('Endereço do site salvo.'); refazer(false); } catch (err) { msgD.textContent = err.message; } } }, 'Salvar endereço')),
      msgD);
  }

  // --- listas ---
  const lista = d.eventos.slice().sort((a, b) => b.inicio.localeCompare(a.inicio));
  const fase = async (e, acao, texto) => {
    if (!confirm(texto)) return;
    try { await chamar('admin_evento_fase', { id: e.id, acao }); avisar('Feito. A comunidade foi avisada no Discord.'); refazer(false); } catch (err) { avisar(err.message, 'erro'); }
  };
  const botoesFase = (e) => {
    if (e.modo !== 'votacao' || e.cancelado) return [];
    const b = (acao, rotulo, texto) => h('button', { type: 'button', class: 'btn-sec', onclick: () => fase(e, acao, texto) }, rotulo);
    if (e.fase === 'confirmacao') return [b('abrir_sugestoes', 'Abrir sugestões agora', 'Abrir as sugestões agora, antes da data marcada?')];
    if (e.fase === 'sugestoes') return [b('abrir_votacao', 'Ir para a votação', 'Encerrar as sugestões e abrir a votação agora?')];
    if (e.fase === 'votacao') return [b('encerrar_votacao', 'Encerrar votação', 'Encerrar a votação agora e fechar o resultado?')];
    return [];
  };
  const cartaoEvento = (e) => h('li', { class: 'adm-evento' + (e.cancelado ? ' cancelado' : '') },
    h('div', { class: 'adm-ev-capa' }, colagem(e)),
    h('div', { class: 'adm-ev-info' },
      h('strong', null, e.nome, e.cancelado ? h('small', { class: 'suave' }, ' (cancelado)') : null),
      h('span', { class: 'suave pequeno' }, `${TIPOS_EVENTO[e.tipo]} · ${dataLonga(e.inicio)}`),
      e.fase && FASES[e.fase] && FASES[e.fase][0] ? h('span', { class: 'ev-fase-pill f-' + e.fase }, FASES[e.fase][0]) : null,
      h('span', { class: 'suave pequeno' }, `${Object.values(e.presencas).filter((x) => x === 'vou').length} vão · ${e.titulos.length} ${e.titulos.length === 1 ? 'filme' : 'filmes'}` + (e.sugestoes.length ? ` · ${e.sugestoes.length} ${e.sugestoes.length === 1 ? 'sugestão' : 'sugestões'}` : ''))),
    h('div', { class: 'acoes' },
      ...botoesFase(e),
      h('button', { type: 'button', class: 'btn-sec', onclick: () => abrir('evento', e) }, 'Editar'),
      h('button', { type: 'button', class: 'btn-sec', onclick: async () => {
        try { await chamar('admin_evento_salvar', { id: e.id, cancelado: !e.cancelado, avisar: false }); refazer(false); }
        catch (err) { avisar(err.message, 'erro'); } } }, e.cancelado ? 'Reativar' : 'Cancelar'),
      h('button', { type: 'button', class: 'btn-sec perigo', onclick: async () => {
        if (!confirm(`Apagar “${e.nome}”? As confirmações de presença também serão apagadas.`)) return;
        try { await chamar('admin_evento_apagar', { id: e.id }); avisar('Evento apagado.'); refazer(false); } catch (err) { avisar(err.message, 'erro'); } } }, 'Apagar')));

  const cartaoVotacao = (v) => {
    const painelDesempate = h('div', { class: 'desempate', hidden: true });
    const encerrar = async (ids) => {
      try {
        const r = await chamar('admin_votacao_encerrar', { votacao_id: v.id, vencedores_ids: ids, adicionar_ao_evento: !!v.evento_id });
        avisar('Votação encerrada.' + (r.no_evento ? ' Os vencedores entraram no evento.' : '')); refazer(false);
      } catch (err) {
        if (err.codigo !== 'empate') { avisar(err.message, 'erro'); return; }
        const caixas = v.opcoes.map((id) => ({ id, el: h('input', { type: 'checkbox', checked: v.empate.length > 0 && !v.empate.includes(id) && ((v.placar || {})[id] || 0) > ((v.placar || {})[v.empate[0]] || 0) }) }));
        painelDesempate.hidden = false;
        montar(painelDesempate,
          h('p', null, `Deu empate na última vaga. Marque até ${v.vagas} ${v.vagas === 1 ? 'filme' : 'filmes'} que entram:`),
          caixas.map((c) => h('label', { class: 'check' }, c.el, ` ${nomeDe(c.id)} · ${(v.placar || {})[c.id] || 0} ${((v.placar || {})[c.id] || 0) === 1 ? 'voto' : 'votos'}`)),
          h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'btn-primario', onclick: () => {
            const marcados = caixas.filter((c) => c.el.checked).map((c) => c.id);
            if (!marcados.length) { avisar('Marque pelo menos um filme.', 'erro'); return; }
            encerrar(marcados);
          } }, 'Encerrar com estes')));
      }
    };
    return h('li', { class: 'adm-evento adm-voto' },
      h('div', { class: 'adm-ev-info' }, h('strong', null, v.pergunta),
        h('span', { class: 'suave pequeno' }, `${v.encerrada ? 'Encerrada' : 'Aberta'} · ${v.total} ${v.total === 1 ? 'voto' : 'votos'} · ${v.max_votos} por pessoa · ${v.vagas} ${v.vagas === 1 ? 'vaga' : 'vagas'}` +
          (v.vencedores.length ? ' · vencedores: ' + v.vencedores.map(nomeDe).join(', ') : '')),
        !v.encerrada && v.placar ? h('span', { class: 'suave pequeno' }, 'Placar: ' + v.opcoes.map((id) => `${nomeDe(id)} (${v.placar[id] || 0})`).join(' · ')) : null),
      h('div', { class: 'acoes' },
        !v.encerrada ? h('button', { type: 'button', class: 'btn-sec', onclick: () => encerrar(undefined) }, 'Encerrar') : null,
        h('button', { type: 'button', class: 'btn-sec perigo', onclick: async () => {
          if (!confirm(`Apagar a votação “${v.pergunta}” e todos os votos?`)) return;
          try { await chamar('admin_votacao_apagar', { votacao_id: v.id }); avisar('Votação apagada.'); refazer(false); } catch (err) { avisar(err.message, 'erro'); } } }, 'Apagar')),
      painelDesempate);
  };

  const botaoGaveta = (g, rotulo, ico) => h('button', { type: 'button', class: (gaveta === g ? 'btn-primario' : 'btn-sec'), onclick: () => (gaveta === g ? refazer() : abrir(g)) }, icone(ico, 16), rotulo);
  montar(painel,
    h('div', { class: 'barra-adm' },
      botaoGaveta('evento', 'Novo evento', 'mais'), botaoGaveta('votacao', 'Nova votação', 'check'), botaoGaveta('discord', 'Discord e link do site', 'raio')),
    gaveta === 'evento' ? formEvento(editando) : null,
    gaveta === 'votacao' ? formVotacao() : null,
    gaveta === 'discord' ? formDiscord() : null,
    h('section', { class: 'bloco-adm' }, h('h2', { class: 'mini' }, `Eventos (${lista.length})`),
      lista.length ? h('ul', { class: 'adm-lista' }, lista.map(cartaoEvento)) : h('p', { class: 'suave' }, 'Nenhum evento ainda. Use “Novo evento” acima.')),
    h('section', { class: 'bloco-adm' }, h('h2', { class: 'mini' }, `Votações (${d.votacoes.length})`),
      d.votacoes.length ? h('ul', { class: 'adm-lista' }, d.votacoes.slice().reverse().map(cartaoVotacao)) : h('p', { class: 'suave' }, 'Nenhuma votação ainda.')));
}
