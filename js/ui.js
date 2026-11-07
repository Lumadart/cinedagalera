import { h, icone } from './dom.js';
import { estado } from './estado.js';
import { chamar } from './api.js';
import { apagarToken } from './sessao.js';
import { NOME_DO_GRUPO } from './config.js';

export const ROTULOS = { quero_ver: 'Quero ver', assistindo: 'Assistindo', visto: 'Visto' };
export const COR_STATUS = { quero_ver: 'var(--quer)', assistindo: 'var(--assistindo)', visto: 'var(--ouro)' };
export const ORDEM_STATUS = { visto: 0, assistindo: 1, quero_ver: 2 };
export const ICONE_STATUS = { quero_ver: 'marcador', assistindo: 'play', visto: 'check' };

export function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Só aceita endereços https, para nunca usar algo estranho como imagem. */
export function seguro(url) {
  return typeof url === 'string' && /^https:\/\//.test(url) ? url : '';
}

export function iniciais(nome) {
  const p = String(nome || '?').trim().split(/\s+/);
  return ((p[0][0] || '?') + (p[1] ? p[1][0] : '')).toUpperCase();
}

export function formatarNota(n) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function tituloMeta(t) {
  return (t.tipo === 'filme' ? 'Filme' : 'Série') + (t.ano ? ' · ' + t.ano : '');
}

/** Bolinha do membro: foto, ou iniciais sobre a cor escolhida. `cor` desenha o anel de status. */
export function avatar(membro, { tamanho = 36, cor = null, dica = null } = {}) {
  const el = h('span', {
    class: 'avatar',
    title: dica || membro.nome,
    style: {
      width: tamanho + 'px', height: tamanho + 'px', fontSize: Math.round(tamanho * 0.38) + 'px',
      background: membro.avatar_cor || '#F5B942', borderColor: cor || 'transparent'
    }
  }, iniciais(membro.nome));
  const foto = seguro(membro.avatar_url);
  if (foto) {
    const img = h('img', { src: foto, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => img.remove());
    el.append(img);
  }
  return el;
}

export function capa(titulo) {
  const el = h('div', { class: 'capa' });
  const foto = seguro(titulo.capa_url);
  if (foto) {
    const img = h('img', { src: foto, alt: 'Capa de ' + titulo.nome, loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => { img.remove(); el.classList.add('sem-imagem'); el.append(titulo.nome); });
    el.append(img);
  } else {
    el.classList.add('sem-imagem');
    el.append(titulo.nome);
  }
  return el;
}

export function avisar(texto, tipo = 'ok') {
  const area = document.getElementById('avisos');
  const aviso = h('div', { class: 'aviso ' + tipo }, texto);
  area.append(aviso);
  setTimeout(() => aviso.remove(), 4200);
}

export async function sair() {
  try { await chamar('sair'); } catch (_) { /* sai mesmo se o servidor não responder */ }
  apagarToken();
  estado.membro = null;
  estado.catalogo = null;
  location.hash = '#/entrar';
}

/** A moldura de todas as telas internas: menu lateral, topo e rodapé. */
export function casca(rota, conteudo, { busca = null } = {}) {
  const item = (id, href, texto) =>
    h('a', { class: 'item', href, 'aria-current': rota === id ? 'page' : null }, texto);
  const m = estado.membro;
  const emBreve = (texto) => h('span', { class: 'item desativado', 'aria-disabled': 'true' }, texto, h('small', null, 'em breve'));
  return h('div', { class: 'casca' },
    h('aside', { class: 'menu' },
      h('a', { class: 'marca', href: '#/' }, h('span', { class: 'logo', 'aria-hidden': 'true' }), NOME_DO_GRUPO),
      h('nav', { class: 'nav', 'aria-label': 'Principal' },
        item('catalogo', '#/', 'Catálogo'),
        item('adicionar', '#/adicionar', 'Adicionar título'),
        m && m.admin ? item('admin', '#/admin', 'Administração') : null,
        emBreve('Eventos'),
        emBreve('Minha lista')
      ),
      h('div', { class: 'menu-rodape' },
        h('p', { class: 'lema' }, 'Registre. Descubra. Compartilhe.'),
        h('button', { type: 'button', class: 'btn-sair', onclick: sair }, 'Sair')
      )
    ),
    h('div', { class: 'principal' },
      h('header', { class: 'topo' },
        h('div', { class: 'topo-busca' }, busca ? [h('span', { class: 'icone-busca' }, icone('busca', 18)), busca] : null),
        h('div', { class: 'usuario' }, h('span', { class: 'usuario-nome' }, m.nome), avatar(m, { tamanho: 40 }))
      ),
      h('main', { id: 'conteudo', class: 'conteudo', tabindex: '-1' }, conteudo),
      h('footer', { class: 'rodape-pagina' },
        'Dados e imagens dos títulos: ',
        h('a', { href: 'https://www.themoviedb.org', target: '_blank', rel: 'noopener noreferrer' }, 'TMDB'),
        '. Este site usa a API do TMDB, mas não é endossado nem certificado por ele.'
      )
    )
  );
}
