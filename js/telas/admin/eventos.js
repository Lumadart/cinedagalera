import { h, montar, icone } from '../../dom.js';
import { estado, carregarCatalogo } from '../../estado.js';
import { chamar } from '../../api.js';
import { avisar, capa } from '../../ui.js';
import { carregarEventos, limparEventos, colagem, TIPOS_EVENTO } from '../../eventos.js';
import { dataLonga, paraLocal, paraIso } from '../../datas.js';
import { seletorTitulos } from '../../seletor.js';
import { ajustarImagem } from '../../imagem.js';

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
    const horarios = { ...(e ? e.horarios : {}) };
    const progBox = h('div', { class: 'prog-editor' });
    const sel = seletorTitulos(e ? e.titulos : [], 30, () => pintarProg());
    const ordenados = () => sel.valor();
    function pintarProg() {
      const ids = ordenados();
      Object.keys(horarios).forEach((id) => { if (!ids.includes(id)) delete horarios[id]; });
      if (!ids.length) { montar(progBox, h('p', { class: 'suave pequeno' }, 'Adicione títulos acima para definir o dia e o horário de cada um.')); return; }
      montar(progBox,
        ids.map((id) => {
          const t = estado.catalogo.titulos.find((x) => x.id === id); if (!t) return null;
          const campoH = h('input', { type: 'datetime-local', value: horarios[id] ? paraLocal(horarios[id]) : '', 'aria-label': 'Horário de ' + t.nome,
            onchange: (ev) => { if (ev.target.value) horarios[id] = paraIso(ev.target.value); else delete horarios[id]; } });
          return h('div', { class: 'prog-linha' }, h('span', { class: 'mini-capa p' }, capa(t)), h('strong', null, t.nome), campoH);
        }),
        h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'btn-sec', onclick: () => {
          if (!campo.inicio.value) { avisar('Defina primeiro o início do evento.', 'erro'); return; }
          let t0 = new Date(campo.inicio.value).getTime();
          ids.forEach((id) => {
            const t = estado.catalogo.titulos.find((x) => x.id === id);
            horarios[id] = new Date(t0).toISOString();
            t0 += ((t && t.tipo === 'filme' && t.duracao_min ? t.duracao_min : 120) + 20) * 60000; // duração + 20 min de intervalo
          });
          pintarProg();
        } }, 'Distribuir em sequência a partir do início')));
    }
    let imagem; // undefined = não mexer · texto = nova imagem · null = remover
    const previa = h('div', { class: 'campo-imagem-previa' });
    const pintarPrevia = () => {
      const url = imagem === null ? '' : (imagem || (e ? e.imagem_url : ''));
      montar(previa, url ? h('img', { src: url, alt: 'Imagem do evento', referrerpolicy: 'no-referrer' }) : h('span', { class: 'suave pequeno' }, 'Sem imagem — o evento usa a colagem das capas.'));
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
    const campo = {
      nome: h('input', { type: 'text', maxlength: 80, value: e ? e.nome : '', required: true }),
      tipo: h('select', null, Object.entries(TIPOS_EVENTO).map(([k, r]) => h('option', { value: k }, r))),
      tema: h('input', { type: 'text', maxlength: 60, value: e ? e.tema : '', placeholder: 'Ex.: Halloween, Natal…' }),
      inicio: h('input', { type: 'datetime-local', value: e ? paraLocal(e.inicio) : '', required: true }),
      fim: h('input', { type: 'datetime-local', value: e && e.fim ? paraLocal(e.fim) : '' }),
      local: h('input', { type: 'text', maxlength: 80, value: e ? e.local : '', placeholder: 'Ex.: Discord, casa da Ana…' }),
      descricao: h('textarea', { rows: 3, maxlength: 600 }, e ? e.descricao : ''),
      avisar: h('input', { type: 'checkbox', checked: !e }),
      sugestoes_max: h('input', { type: 'number', min: 0, max: 10, step: 1, value: e ? e.sugestoes_max : 0 })
    };
    if (e) campo.tipo.value = e.tipo;
    pintarProg();
    const msg = h('p', { class: 'erro', role: 'alert' });
    const form = h('form', { class: 'painel-discreto form-evento', onsubmit: async (ev) => {
      ev.preventDefault(); msg.textContent = '';
      const botao = form.querySelector('button[type=submit]'); botao.disabled = true;
      const corpo = {
        id: e ? e.id : undefined, nome: campo.nome.value, tipo: campo.tipo.value, tema: campo.tema.value, inicio: paraIso(campo.inicio.value), fim: paraIso(campo.fim.value),
        local: campo.local.value, descricao: campo.descricao.value, titulos: sel.valor(), horarios, sugestoes_max: Number(campo.sugestoes_max.value) || 0, avisar: campo.avisar.checked
      };
      if (imagem) corpo.imagem = imagem; else if (imagem === null) corpo.remover_imagem = true;
      try {
        const r = await chamar('admin_evento_salvar', corpo);
        avisar((e ? 'Evento atualizado.' : 'Evento criado.') + (r.discord ? ' Aviso enviado ao Discord.' : '')); refazer();
      } catch (err) { msg.textContent = err.message; botao.disabled = false; }
    } },
      h('h2', null, e ? 'Editar evento' : 'Novo evento'),
      h('label', null, 'Nome', campo.nome),
      h('div', { class: 'duas-colunas' }, h('label', null, 'Tipo', campo.tipo), h('label', null, 'Tema (opcional)', campo.tema)),
      h('div', { class: 'duas-colunas' }, h('label', null, 'Início', campo.inicio), h('label', null, 'Término (opcional)', campo.fim)),
      h('label', null, 'Local (opcional)', campo.local),
      h('label', null, 'Descrição (opcional)', campo.descricao),
      h('div', { class: 'campo-imagem' },
        h('span', { class: 'rotulo' }, 'Imagem do evento (opcional, 1200 × 675)'), previa,
        h('div', { class: 'acoes' },
          h('label', { class: 'btn-sec', for: 'ev-imagem' }, icone('editar', 16), 'Escolher imagem'),
          h('button', { type: 'button', class: 'btn-sec', onclick: () => { imagem = null; pintarPrevia(); } }, 'Remover'), arquivo)),
      h('label', null, 'Sugestões de filmes por pessoa (0 = a galera não sugere)', campo.sugestoes_max),
      e && e.sugestoes.length ? h('div', null, h('span', { class: 'rotulo' }, `Sugestões da galera (${e.sugestoes.length})`),
        h('div', { class: 'ev-titulos' }, e.sugestoes.map((x) => {
          const t = estado.catalogo.titulos.find((y) => y.id === x.titulo_id), m = estado.catalogo.membros.find((y) => y.id === x.membro_id);
          return h('span', { class: 'chip-titulo' }, (t ? t.nome : '?') + ' · ' + (m ? m.nome.split(' ')[0] : '?'),
            h('button', { type: 'button', 'aria-label': 'Remover sugestão', onclick: async (ev) => {
              try { await chamar('admin_sugestao_remover', { evento_id: e.id, membro_id: x.membro_id, titulo_id: x.titulo_id }); ev.target.closest('.chip-titulo').remove(); limparEventos(); }
              catch (err) { avisar(err.message, 'erro'); } } }, '×'));
        }))) : null,
      h('div', null, h('span', { class: 'rotulo' }, 'Filmes que vão (programação)'), sel.el, progBox),
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
    const evento = h('select', null, h('option', { value: '' }, '(sem evento)'), d.eventos.filter((x) => !x.cancelado).map((x) => h('option', { value: x.id }, x.nome)));
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
      infoSug.textContent = ` Votar nos ${n} filmes sugeridos pela galera para este evento (fecha as sugestões)`;
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
  const cartaoEvento = (e) => h('li', { class: 'adm-evento' + (e.cancelado ? ' cancelado' : '') },
    h('div', { class: 'adm-ev-capa' }, colagem(e)),
    h('div', { class: 'adm-ev-info' },
      h('strong', null, e.nome, e.cancelado ? h('small', { class: 'suave' }, ' (cancelado)') : null),
      h('span', { class: 'suave pequeno' }, `${TIPOS_EVENTO[e.tipo]} · ${dataLonga(e.inicio)}`),
      h('span', { class: 'suave pequeno' }, `${Object.values(e.presencas).filter((x) => x === 'vou').length} vão · ${e.titulos.length} ${e.titulos.length === 1 ? 'filme' : 'filmes'}` + (e.sugestoes.length ? ` · ${e.sugestoes.length} ${e.sugestoes.length === 1 ? 'sugestão' : 'sugestões'}` : ''))),
    h('div', { class: 'acoes' },
      h('button', { type: 'button', class: 'btn-sec', onclick: () => abrir('evento', e) }, 'Editar'),
      h('button', { type: 'button', class: 'btn-sec', onclick: async () => {
        try { await chamar('admin_evento_salvar', { id: e.id, nome: e.nome, tipo: e.tipo, inicio: e.inicio, fim: e.fim, tema: e.tema, local: e.local, descricao: e.descricao, titulos: e.titulos, cancelado: !e.cancelado, avisar: false }); refazer(false); }
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
