import { h, montar } from '../../dom.js';
import { estado, carregarCatalogo } from '../../estado.js';
import { chamar } from '../../api.js';
import { avisar, capa, normalizar, rotuloCategoria } from '../../ui.js';
import { dropdown } from '../../dropdown.js';

export async function abaTitulos({ painel, ativa }, busca = '') {
  montar(painel, h('p', { class: 'suave' }, 'Carregando…'));
  try { await carregarCatalogo({ forcar: true }); } catch (e) { if (ativa()) montar(painel, h('p', { class: 'erro' }, e.message)); return; }
  if (!ativa()) return;
  const campo = h('input', { type: 'search', placeholder: 'Buscar título no catálogo…', 'aria-label': 'Buscar título', value: busca, autocomplete: 'off' });
  const lista = h('ul', { class: 'lista-adm' });
  const pintar = () => {
    const q = normalizar(campo.value.trim());
    const itens = estado.catalogo.titulos.filter((t) => !q || normalizar(t.nome).includes(q)).slice(0, 40);
    const porMembro = Object.fromEntries(estado.catalogo.membros.map((m) => [m.id, m]));
    montar(lista, itens.length ? itens.map((t) => {
      const marcacoes = estado.catalogo.status.filter((x) => x.titulo_id === t.id).length;
      const por = porMembro[t.adicionado_por];
      return h('li', { class: 'membro-adm' },
        h('span', { class: 'mini-capa' }, capa(t)),
        h('div', { class: 'membro-info' },
          h('strong', null, t.nome), h('div', { class: 'suave pequeno' }, [rotuloCategoria(t), t.ano].filter(Boolean).join(' · ')),
          h('label', { class: 'indicador-adm' }, 'Indicado por',
            (() => {
              const sel = dropdown({ rotulo: 'Quem indicou ' + t.nome, mini: true, valor: por ? por.id : '',
                opcoes: [...(!por ? [['', '(sem indicador)']] : []), ...estado.catalogo.membros.map((m) => [m.id, m.nome])] });
              sel.addEventListener('change', async () => {
                try {
                  const r = await chamar('admin_atribuir_indicacao', { titulo_id: t.id, membro_id: sel.value });
                  Object.assign(t, r.titulo); avisar('Indicação atualizada.'); pintar();
                } catch (err) { avisar(err.message, 'erro'); sel.value = por ? por.id : ''; }
              });
              return sel;
            })()),
          h('div', { class: 'suave pequeno' }, `${marcacoes} ${marcacoes === 1 ? 'marcação' : 'marcações'}`),
          campoExibido(t)),
        h('div', { class: 'acoes' },
          h('a', { class: 'btn-sec', href: '#/titulo/' + t.id }, 'Abrir'),
          h('button', { type: 'button', class: 'btn-sec', onclick: async (e) => {
            e.target.disabled = true;
            try {
              const r = await chamar('admin_atualizar_titulo_tmdb', { titulo_id: t.id });
              Object.assign(t, r.titulo); avisar(`“${t.nome}” atualizado com os dados do TMDB.`); pintar();
            } catch (err) { avisar(err.message, 'erro'); e.target.disabled = false; }
          } }, 'Atualizar do TMDB'),
          h('button', { type: 'button', class: 'btn-sec perigo', onclick: async () => {
            if (!confirm(`Remover “${t.nome}” do catálogo? Isso apaga também as marcações, notas, comentários e favoritos deste título. Não dá para desfazer.`)) return;
            try {
              await chamar('admin_remover_titulo', { titulo_id: t.id });
              await carregarCatalogo({ forcar: true }); avisar('Título removido.'); pintar();
            } catch (err) { avisar(err.message, 'erro'); }
          } }, 'Remover')));
    }) : h('li', { class: 'suave' }, 'Nenhum título encontrado.'));
  };
  /** Marca manualmente que o grupo já viu o título (sem evento): escolhe a data e salva; "Limpar" tira a marca. */
  function campoExibido(t) {
    const hoje = new Date().toISOString().slice(0, 10);
    const data = h('input', { type: 'date', max: hoje, value: t.exibido_em ? t.exibido_em.slice(0, 10) : '', 'aria-label': 'Data em que o grupo viu ' + t.nome });
    const enviar = async (valor) => {
      try {
        const r = await chamar('admin_titulo_exibido', { titulo_id: t.id, data: valor });
        Object.assign(t, r.titulo); avisar(valor ? 'Marcado como exibido.' : 'Marca de exibição removida.'); pintar();
      } catch (err) { avisar(err.message, 'erro'); }
    };
    return h('div', { class: 'exibido-adm' }, h('span', { class: 'suave pequeno' }, 'Exibido ao grupo em'), data,
      h('button', { type: 'button', class: 'btn-sec', onclick: () => { if (!data.value) { avisar('Escolha a data primeiro.', 'erro'); return; } enviar(data.value); } }, 'Marcar'),
      t.exibido_em ? h('button', { type: 'button', class: 'btn-sec', onclick: () => enviar('') }, 'Limpar') : null);
  }
  campo.addEventListener('input', pintar);
  montar(painel,
    
    campo, lista);
  pintar();
}
