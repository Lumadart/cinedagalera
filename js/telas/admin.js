import { h, montar } from '../dom.js';
import { estado } from '../estado.js';
import { chamar } from '../api.js';
import { casca, avatar, avisar } from '../ui.js';

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
  const area = h('div', { class: 'admin' }, h('p', { class: 'suave' }, 'Carregando…'));
  montar(raiz, casca('admin', area));
  carregar();

  async function carregar() {
    try {
      const d = await chamar('admin_listar_membros');
      if (ativa()) desenhar(d);
    } catch (e) {
      if (ativa()) montar(area, h('p', { class: 'erro' }, e.message),
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

    montar(area,
      h('div', { class: 'titulo-linha' },
        h('div', null, h('h1', null, 'Administração'), h('p', { class: 'suave' }, 'Gerencie quem participa do grupo.')),
        h('div', { class: 'contagens' },
          h('span', null, `${limites.membros_ativos} de ${limites.max_membros} membros`),
          h('span', null, `${limites.admins_ativos} de ${limites.max_admins} admins`))
      ),
      form,
      h('ul', { class: 'lista-adm' }, membros.map(linha))
    );
  }
}
