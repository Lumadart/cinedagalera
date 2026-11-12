import { h, montar } from '../dom.js';
import { estado, carregarCatalogo } from '../estado.js';
import { chamar } from '../api.js';
import { casca, esqueleto, avatar, avisar, capa, normalizar, rotuloCategoria } from '../ui.js';
import { medalha } from '../badges.js';

function quando(iso) {
  if (!iso) return 'nunca';
  const d = new Date(iso);
  return isNaN(d) ? 'nunca' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function telaAdmin({ raiz, ativa }) {
  if (!estado.membro.admin) {
    montar(raiz, casca('admin', h('div', { class: 'estado-vazio' },
      h('p', null, 'Esta área é só para admins.'), h('a', { class: 'btn-sec', href: '#/' }, 'Voltar ao catálogo'))));
    return;
  }
  const area = h('div', { class: 'admin' });
  const painel = h('div', { class: 'admin-painel' }, esqueleto('lista', 3));
  const ABAS = [['membros', 'Membros'], ['titulos', 'Títulos'], ['conquistas', 'Conquistas'], ['manutencao', 'Manutenção e histórico']];
  let aba = 'membros';
  const abasEl = h('div', { class: 'abas', role: 'tablist', 'aria-label': 'Áreas da administração' });
  function pintarAbas() {
    montar(abasEl, ABAS.map(([k, r]) => h('button', { type: 'button', role: 'tab', class: 'aba' + (aba === k ? ' ligada' : ''), 'aria-selected': String(aba === k),
      onclick: () => { aba = k; pintarAbas(); abrir(); } }, r)));
  }
  montar(area,
    h('div', { class: 'titulo-linha' }, h('div', null, h('h1', null, 'Administração'), h('p', { class: 'suave' }, 'Membros, catálogo, conquistas e histórico de alterações.'))),
    abasEl, painel);
  montar(raiz, casca('admin', area));
  pintarAbas(); abrir();

  function abrir() {
    if (aba === 'membros') carregar();
    else if (aba === 'titulos') abaTitulos();
    else if (aba === 'conquistas') abaConquistas();
    else abaManutencao();
  }

  // ---------- Títulos: corrigir o catálogo ----------
  async function abaTitulos(busca = '') {
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
                const sel = h('select', { 'aria-label': 'Quem indicou ' + t.nome },
                  !por ? h('option', { value: '' }, '(sem indicador)') : null,
                  estado.catalogo.membros.map((m) => h('option', { value: m.id }, m.nome)));
                sel.value = por ? por.id : '';
                sel.addEventListener('change', async () => {
                  try {
                    const r = await chamar('admin_atribuir_indicacao', { titulo_id: t.id, membro_id: sel.value });
                    Object.assign(t, r.titulo); avisar('Indicação atualizada.'); pintar();
                  } catch (err) { avisar(err.message, 'erro'); sel.value = por ? por.id : ''; }
                });
                return sel;
              })()),
            h('div', { class: 'suave pequeno' }, `${marcacoes} ${marcacoes === 1 ? 'marcação' : 'marcações'}`)),
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
    campo.addEventListener('input', pintar);
    montar(painel,
      h('p', { class: 'suave' }, 'Corrija dados vindos do TMDB ou remova indicações erradas. Para mudar a categoria ou o recado, abra o título.'),
      campo, lista);
    pintar();
  }

  // ---------- Conquistas: ligar/desligar e conceder ----------
  async function abaConquistas() {
    montar(painel, esqueleto('lista', 5));
    let d;
    try { d = await chamar('admin_badges_painel'); } catch (e) { if (ativa()) montar(painel, h('p', { class: 'erro' }, e.message)); return; }
    if (!ativa() || aba !== 'conquistas') return;
    const NOMES = ['', 'Bronze', 'Prata', 'Ouro'];
    const linhas = d.badges.map((b) => {
      const max = b.metas ? 3 : 1;
      const sel = h('select', { 'aria-label': 'Membro para ' + b.nome }, d.membros.map((m) => h('option', { value: m.id }, m.nome)));
      const niv = h('select', { 'aria-label': 'Nível de ' + b.nome });
      const aviso = h('small', { class: 'suave' });
      const pintarNiveis = () => {
        const q = b.membros[sel.value] || { nivel: 0, concedida: false };
        montar(niv, h('option', { value: '0' }, q.concedida ? 'Retirar concessão' : 'Escolha o nível'),
          Array.from({ length: max }, (_, i) => h('option', { value: String(i + 1) }, b.metas ? NOMES[i + 1] : 'Conceder')));
        niv.value = q.concedida ? String(q.nivel) : '0';
        aviso.textContent = q.nivel ? `Atual: ${b.metas ? NOMES[q.nivel] : 'conquistada'}${q.concedida ? ' (concedida)' : ''}` : 'Ainda não tem';
      };
      sel.addEventListener('change', pintarNiveis); pintarNiveis();
      const aplicar = h('button', { type: 'button', class: 'btn-sec', onclick: async () => {
        aplicar.disabled = true;
        try {
          await chamar('admin_badge_conceder', { membro_id: sel.value, chave: b.chave, nivel: Number(niv.value) });
          avisar('Conquista atualizada.'); abaConquistas();
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

  // ---------- Manutenção e histórico ----------
  async function abaManutencao() {
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
        h('li', null, h('span', { class: 'suave pequeno' }, quando(l.data)), h('span', null, h('strong', null, l.admin), ' · ' + l.acao.replaceAll('_', ' ') + (l.detalhes ? ' — ' + l.detalhes : '')))))
        : h('p', { class: 'suave' }, 'Nenhuma ação registrada ainda.'));
    } catch (e) { montar(logEl, h('p', { class: 'erro' }, e.message)); }
  }

  async function carregar() {
    try {
      const d = await chamar('admin_listar_membros');
      if (ativa() && aba === 'membros') desenhar(d);
    } catch (e) {
      if (ativa()) montar(painel, h('p', { class: 'erro' }, e.message),
        h('button', { type: 'button', class: 'btn-sec', onclick: carregar }, 'Tentar de novo'));
    }
  }

  async function agir(acao, dados, ok) {
    try {
      const r = await chamar(acao, dados);
      avisar(r && r.aviso ? r.aviso : ok, r && r.aviso ? 'erro' : 'ok');
      await carregar();
    } catch (e) { avisar(e.message, 'erro'); }
  }

  function desenhar({ membros, limites }) {
    const erro = h('p', { class: 'erro', role: 'alert' });
    const nome = h('input', { id: 'novo-nome', maxlength: '40', autocomplete: 'off', placeholder: 'Nome' });
    const email = h('input', { id: 'novo-email', type: 'email', autocomplete: 'off', placeholder: 'email@exemplo.com' });
    const ehAdmin = h('input', { id: 'novo-admin', type: 'checkbox' });
    const botao = h('button', { type: 'submit', class: 'btn-primario' }, 'Adicionar e enviar PIN');
    const cheio = limites.membros_ativos >= limites.max_membros;

    const form = h('form', {
      class: 'card form-membro', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault(); erro.textContent = '';
        if (nome.value.trim().length < 2 || !email.value.trim()) { erro.textContent = 'Informe o nome e o e-mail.'; return; }
        botao.disabled = true; botao.textContent = 'Enviando…';
        try {
          const r = await chamar('admin_adicionar_membro', { nome: nome.value.trim(), email: email.value.trim(), admin: ehAdmin.checked });
          avisar(r.aviso || `${nome.value.trim()} foi adicionado(a). O PIN foi enviado por e-mail.`, r.aviso ? 'erro' : 'ok');
          await carregar();
        } catch (err) { erro.textContent = err.message; botao.disabled = false; botao.textContent = 'Adicionar e enviar PIN'; }
      }
    },
      h('h2', null, 'Adicionar membro'),
      cheio ? h('p', { class: 'suave' }, 'O grupo está no limite de membros.') : [
        h('div', { class: 'linha-campos' }, h('label', { for: 'novo-nome' }, 'Nome', nome), h('label', { for: 'novo-email' }, 'E-mail', email)),
        h('label', { class: 'check', for: 'novo-admin' }, ehAdmin, 'Também será admin'),
        erro, botao,
        h('p', { class: 'suave pequeno' }, 'O PIN é gerado pelo sistema e enviado ao e-mail da pessoa. Você nunca vê o PIN.')
      ]
    );

    const linha = (m) => {
      const eu = m.id === estado.membro.id;
      const tags = [m.admin ? h('span', { class: 'etiqueta' }, 'admin') : null,
        !m.ativo ? h('span', { class: 'etiqueta cinza' }, 'desativado') : null,
        m.bloqueado ? h('span', { class: 'etiqueta aviso-et' }, 'bloqueado') : null];
      const acoes = [
        m.ativo ? h('button', { type: 'button', class: 'btn-sec', onclick: () => {
          if (confirm(`Gerar um novo PIN para ${m.nome}? O PIN antigo deixa de valer e ela(e) será desconectada(o).`))
            agir('admin_gerar_pin', { membro_id: m.id }, `Novo PIN enviado para ${m.email}.`);
        } }, 'Gerar novo PIN') : null,
        !eu ? h('button', { type: 'button', class: 'btn-sec', onclick: () => {
          const msg = m.ativo ? `Desativar ${m.nome}? A pessoa perde o acesso, mas os registros dela ficam.` : `Reativar ${m.nome}?`;
          if (confirm(msg)) agir('admin_atualizar_membro', { membro_id: m.id, ativo: !m.ativo }, m.ativo ? 'Membro desativado.' : 'Membro reativado.');
        } }, m.ativo ? 'Desativar' : 'Reativar') : null,
        !eu && m.ativo ? h('button', { type: 'button', class: 'btn-sec', onclick: () => {
          if (confirm(m.admin ? `Tirar o acesso de admin de ${m.nome}?` : `Tornar ${m.nome} admin?`))
            agir('admin_atualizar_membro', { membro_id: m.id, admin: !m.admin }, m.admin ? 'Não é mais admin.' : 'Agora é admin.');
        } }, m.admin ? 'Tirar admin' : 'Tornar admin') : null
      ];
      return h('li', { class: 'membro-adm' + (m.ativo ? '' : ' inativo') },
        avatar({ nome: m.nome }, { tamanho: 40 }),
        h('div', { class: 'membro-info' },
          h('div', { class: 'membro-topo' }, h('strong', null, m.nome + (eu ? ' (você)' : '')), tags),
          h('div', { class: 'suave pequeno' }, m.email),
          h('div', { class: 'suave pequeno' }, 'Último acesso: ' + quando(m.ultimo_acesso))
        ),
        h('div', { class: 'acoes' }, acoes)
      );
    };

    montar(painel, h('div', { class: 'adm-membros' },
      h('div', { class: 'adm-lado' },
        h('div', { class: 'contagens' },
          h('span', null, h('b', null, `${limites.membros_ativos}/${limites.max_membros}`), ' membros'),
          h('span', null, h('b', null, `${limites.admins_ativos}/${limites.max_admins}`), ' admins')),
        form),
      h('ul', { class: 'lista-adm' }, membros.map(linha))
    ));
  }
}
