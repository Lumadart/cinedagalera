import { h, montar } from '../../dom.js';
import { estado } from '../../estado.js';
import { chamar } from '../../api.js';
import { avisar } from '../../ui.js';
import { dataCurta } from '../../datas.js';
import { dropdown } from '../../dropdown.js';

const ESTADOS = { ativo: 'ativo', usado: 'esgotado', expirado: 'expirado', revogado: 'revogado' };

/** Texto pronto para mandar a quem vai entrar (com link que já abre a tela de convite). */
function mensagemDeConvite(codigo) {
  const base = location.href.replace(/#.*$/, '');
  return `Você foi convidado(a) para o Cine Arkham! 🎬\nEntre por aqui: ${base}#/convite/${codigo}\nSe preferir, abra o site, toque em "Tenho um convite" e use o código: ${codigo}`;
}

async function copiar(texto, ok) {
  try { await navigator.clipboard.writeText(texto); avisar(ok); } catch { avisar('Não deu para copiar automaticamente. Selecione o texto e copie.', 'erro'); }
}

export async function abaConvites(ctx) {
  const { painel, ativa } = ctx;
  try {
    const d = await chamar('admin_convites');
    if (ativa()) desenhar(d.convites, ctx);
  } catch (e) {
    if (ativa()) montar(painel, h('p', { class: 'erro' }, e.message), h('button', { type: 'button', class: 'btn-sec', onclick: () => abaConvites(ctx) }, 'Tentar de novo'));
  }
}

function desenhar(convites, ctx) {
  const { painel } = ctx;
  const erro = h('p', { class: 'erro', role: 'alert' });
  const rotulo = h('input', { id: 'cv-rotulo', maxlength: '40', autocomplete: 'off', placeholder: 'Ex.: para o Léo (opcional)' });
  const validade = dropdown({ rotulo: 'Validade', valor: '7', opcoes: [['1', '1 dia'], ['3', '3 dias'], ['7', '7 dias'], ['14', '14 dias'], ['30', '30 dias']] });
  const usos = dropdown({ rotulo: 'Quantas pessoas', valor: '1', opcoes: [['1', '1 pessoa'], ['2', '2 pessoas'], ['5', '5 pessoas'], ['10', '10 pessoas']] });
  const botao = h('button', { type: 'submit', class: 'btn-primario' }, 'Gerar convite');
  const novo = h('div', { class: 'convite-novo', hidden: true, role: 'status' });

  const form = h('form', {
    class: 'card form-membro', novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault(); erro.textContent = ''; botao.disabled = true;
      try {
        const r = await chamar('admin_convite_criar', { rotulo: rotulo.value.trim(), validade_dias: Number(validade.value), usos_max: Number(usos.value) });
        const msg = mensagemDeConvite(r.codigo);
        montar(novo,
          h('p', { class: 'suave' }, 'Convite criado. Este código aparece só agora — guarde ou copie a mensagem:'),
          h('div', { class: 'convite-codigo' }, r.codigo),
          h('pre', { class: 'convite-msg' }, msg),
          h('button', { type: 'button', class: 'btn-primario', onclick: () => copiar(msg, 'Mensagem copiada!') }, 'Copiar mensagem'));
        novo.hidden = false; rotulo.value = '';
        const lista = await chamar('admin_convites');
        if (ctx.ativa()) montar(listaEl, ...linhas(lista.convites));
      } catch (err) { erro.textContent = err.message; }
      botao.disabled = false;
    }
  },
    h('h2', null, 'Convidar alguém'),
    h('p', { class: 'suave' }, 'Gere um código e passe para a pessoa. Ela entra pelo link (ou em "Tenho um convite" na tela de entrada) e recebe o PIN por e-mail.'),
    h('div', { class: 'linha-campos' },
      h('label', { for: 'cv-rotulo' }, 'Anotação', rotulo),
      h('div', null, h('span', { class: 'rotulo' }, 'Validade'), validade),
      h('div', null, h('span', { class: 'rotulo' }, 'Pode ser usado por'), usos)),
    erro, botao, novo);

  const revogar = (c) => h('button', { type: 'button', class: 'link-discreto', onclick: async () => {
    try { await chamar('admin_convite_revogar', { id: c.id }); avisar('Convite revogado.'); await abaConvites(ctx); } catch (e) { avisar(e.message, 'erro'); }
  } }, 'Revogar');

  const linhas = (lista) => lista.length ? lista.map((c) => h('li', { class: 'convite-linha ' + c.estado },
    h('span', { class: 'etiqueta' + (c.estado === 'ativo' ? '' : ' cinza') }, ESTADOS[c.estado]),
    h('div', { class: 'convite-info' },
      h('strong', null, c.rotulo || 'Convite sem anotação'),
      h('small', { class: 'suave' }, `por ${c.criado_por || '—'} · criado ${dataCurta(c.criado_em)} · vale até ${dataCurta(c.expira_em)} · usado ${c.usos}/${c.usos_max}` + (c.usados_por.length ? ' (' + c.usados_por.join(', ') + ')' : ''))),
    c.estado === 'ativo' ? revogar(c) : null))
    : [h('li', { class: 'suave' }, 'Nenhum convite criado ainda.')];
  const listaEl = h('ul', { class: 'convites-lista' }, ...linhas(convites));

  montar(painel, form, h('section', { class: 'card' }, h('h2', null, 'Convites'),
    h('p', { class: 'suave pequeno' }, 'O código em si não fica guardado em lugar nenhum (só uma "impressão digital"), por isso não dá para ver de novo. Se perder, revogue e gere outro.'),
    listaEl));
}
