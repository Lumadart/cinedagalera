import { chamar } from './api.js';
import { estado } from './estado.js';
import { lerToken } from './sessao.js';
import { h, montar } from './dom.js';
import { avisar } from './ui.js';
import { telaLogin } from './telas/login.js';
import { telaInicio } from './telas/inicio.js';
import { telaCatalogo } from './telas/catalogo.js';
import { telaTitulo } from './telas/titulo.js';
import { telaAdicionar } from './telas/adicionar.js';
import { telaAdmin } from './telas/admin.js';

const raiz = document.getElementById('app');
let versao = 0; // cada troca de tela invalida respostas atrasadas da tela anterior

function rotaAtual() {
  const partes = location.hash.replace(/^#/, '').split('/').filter(Boolean);
  if (partes[0] === 'entrar') return { nome: 'entrar' };
  if (partes[0] === 'catalogo') return { nome: 'catalogo' };
  if (partes[0] === 'adicionar') return { nome: 'adicionar' };
  if (partes[0] === 'admin') return { nome: 'admin' };
  if (partes[0] === 'titulo' && /^[A-Za-z0-9_]+$/.test(partes[1] || '')) return { nome: 'titulo', id: partes[1] };
  return { nome: 'inicio' };
}

const TELAS = { inicio: telaInicio, entrar: telaLogin, catalogo: telaCatalogo, titulo: telaTitulo, adicionar: telaAdicionar, admin: telaAdmin };
const TITULOS = { inicio: 'Início', entrar: 'Entrar', catalogo: 'Catálogo', titulo: 'Título', adicionar: 'Adicionar título', admin: 'Administração' };

function rotear() {
  const rota = rotaAtual();
  if (!estado.membro && rota.nome !== 'entrar') { location.replace('#/entrar'); return; }
  if (estado.membro && rota.nome === 'entrar') { location.replace('#/'); return; }

  const minha = ++versao;
  document.title = TITULOS[rota.nome] + ' · Cine Arkham';
  window.scrollTo(0, 0);
  TELAS[rota.nome]({ raiz, params: rota, ativa: () => minha === versao });
  const principal = document.getElementById('conteudo');
  if (principal) principal.focus({ preventScroll: true });
}

function sessaoExpirou() {
  estado.membro = null;
  estado.catalogo = null;
  avisar('Sua sessão expirou. Entre novamente.', 'erro');
  if (location.hash !== '#/entrar') location.hash = '#/entrar';
  else rotear();
}

async function iniciar() {
  if (lerToken()) {
    try {
      estado.membro = (await chamar('eu')).membro;
    } catch (e) {
      if (e.codigo !== 'sessao') {
        montar(raiz, h('div', { class: 'estado-vazio tela-cheia' },
          h('p', { class: 'erro' }, e.message),
          h('button', { type: 'button', class: 'btn-primario', onclick: () => location.reload() }, 'Tentar de novo')));
        return;
      }
    }
  }
  window.addEventListener('hashchange', rotear);
  window.addEventListener('sessao-expirada', sessaoExpirou);
  rotear();
}

iniciar();
