import { h, icone } from './dom.js';
import { estado, limparCatalogo } from './estado.js';
import { chamar } from './api.js';
import { apagarToken } from './sessao.js';
import { NOME_DO_GRUPO } from './config.js';

export const ROTULOS = { quero_ver: 'Quero ver', assistindo: 'Assistindo', visto: 'Visto', abandonado: 'Abandonado' };
export const COR_STATUS = { quero_ver: 'var(--quer)', assistindo: 'var(--assistindo)', visto: 'var(--ouro)', abandonado: 'var(--abandonou)' };
export const ORDEM_STATUS = { visto: 0, assistindo: 1, quero_ver: 2, abandonado: 3 };
export const ICONE_STATUS = { quero_ver: 'marcador', assistindo: 'play', visto: 'check', abandonado: 'fechar' };

export const BANNERS = {
  ameixa: 'linear-gradient(120deg, #6a3a63, #2a1a2a)',
  ouro: 'linear-gradient(120deg, #c4821c, #4a2b47)',
  noite: 'linear-gradient(120deg, #1b101b, #5a4163)',
  aurora: 'linear-gradient(120deg, #3d2840, #2f6a63)',
  vinho: 'linear-gradient(120deg, #8a2b47, #2a1520)'
};
export const CORES_AVATAR = ['#F5B942', '#EE8E62', '#A3BCA6', '#C9A0DC', '#E37B9B', '#7FB7D6', '#F8EAD8', '#D96B5F'];

/** O banner de um perfil: foto enviada, ou um degradê escolhido, ou o padrão. */
export function banner(membro) {
  const el = h('div', { class: 'banner', style: { background: BANNERS[membro.banner_preset] || BANNERS.ameixa } });
  const foto = seguro(membro.banner_url);
  if (foto) {
    const img = suave(h('img', { src: foto, alt: '', referrerpolicy: 'no-referrer' }));
    img.addEventListener('error', () => img.remove());
    el.append(img);
  }
  return el;
}

export const CATEGORIAS = {
  filme: 'Filme', serie: 'Série', anime: 'Anime', dorama: 'Dorama', reality: 'Reality', documentario: 'Documentário'
};
export const CATEGORIAS_POR_TIPO = {
  filme: ['filme', 'anime', 'documentario'],
  serie: ['serie', 'anime', 'dorama', 'reality', 'documentario']
};
export const rotuloCategoria = (t) => CATEGORIAS[t.categoria] || (t.tipo === 'filme' ? 'Filme' : 'Série');

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
  return rotuloCategoria(t) + (t.ano ? ' · ' + t.ano : '');
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

/** Imagem em paisagem (TMDB backdrop). Se o título não tiver, usa a capa. */
export function fundoImg(titulo, classe = 'fundo-img') {
  const src = seguro(titulo.fundo_url) || seguro(titulo.capa_url);
  if (!src) return null;
  return suave(h('img', { class: classe, src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }));
}

export function capa(titulo) {
  const el = h('div', { class: 'capa' });
  const foto = seguro(titulo.capa_url);
  if (foto) {
    const img = h('img', { src: foto, alt: 'Capa de ' + titulo.nome, loading: 'lazy', referrerpolicy: 'no-referrer' });
    suave(img);
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
  limparCatalogo();
  location.hash = '#/entrar';
}

/** A marca do site: quadrado dourado com um "play". */
export function marcaLogo() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32'); svg.setAttribute('class', 'logo'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F8CF6B"/><stop offset="1" stop-color="#C4821C"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#lg)"/><path d="M12 9l12 7-12 7z" fill="#2A1500"/>';
  return svg;
}

/** Tempo relativo curto: "há 5 min", "há 3 h", "há 2 d". */
export function haQuanto(iso) {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} d`;
}

/** Busca do topo: no catálogo filtra na hora; nas outras telas, Enter leva ao catálogo já filtrado. */
function buscaTopo(aoBuscar) {
  const campo = h('input', {
    type: 'search', id: 'busca', name: 'q', autocomplete: 'off', placeholder: 'Buscar filmes, séries, animes…',
    'aria-label': 'Buscar no catálogo', value: estado.filtro.busca,
    oninput: aoBuscar ? (e) => { estado.filtro.busca = e.target.value; aoBuscar(); } : null
  });
  return h('form', {
    class: 'topo-busca', role: 'search',
    onsubmit: (e) => {
      e.preventDefault();
      estado.filtro.busca = campo.value.trim();
      if (location.hash !== '#/catalogo') location.hash = '#/catalogo';
      else if (aoBuscar) aoBuscar();
    }
  }, h('span', { class: 'icone-busca' }, icone('busca', 18)), campo);
}

/** Espaço no fim do menu para uma imagem do grupo (coloque o arquivo em img/menu.png). */
function menuImagem() {
  const caixa = h('div', { class: 'menu-imagem' });
  const img = h('img', { src: 'img/menu.png', alt: '' });
  img.addEventListener('error', () => { caixa.remove(); }); // sem imagem, o espaço fica vazio
  caixa.append(img);
  return caixa;
}

/** A moldura de todas as telas internas: menu lateral, topo e rodapé. */
export function casca(rota, conteudo, { aoBuscar = null } = {}) {
  const item = (id, href, texto, ico) =>
    h('a', { class: 'item', href, 'aria-current': rota === id ? 'page' : null }, icone(ico, 20), h('span', null, texto));
  const emBreve = (texto, ico) => h('span', { class: 'item desativado', 'aria-disabled': 'true' }, icone(ico, 20), h('span', null, texto), h('small', null, 'em breve'));
  const m = estado.membro;

  return h('div', { class: 'casca' },
    h('aside', { class: 'menu' },
      h('a', { class: 'marca', href: '#/' }, marcaLogo(), h('span', null, NOME_DO_GRUPO)),
      h('nav', { class: 'nav', 'aria-label': 'Principal' },
        item('inicio', '#/', 'Início', 'inicio'),
        item('catalogo', '#/catalogo', 'Catálogo', 'grade'),
        item('adicionar', '#/adicionar', 'Adicionar título', 'mais'),
        item('perfil', '#/perfil', 'Meu perfil', 'marcador'),
        item('amigos', '#/amigos', 'Amigos', 'amigos'),
        emBreve('Eventos', 'calendario'),
        m && m.admin ? item('admin', '#/admin', 'Administração', 'escudo') : null
      ),
      menuImagem()
    ),
    h('div', { class: 'principal' },
      h('header', { class: 'topo' },
        buscaTopo(aoBuscar),
        h('div', { class: 'usuario' },
          h('a', { class: 'usuario-link', href: '#/perfil', 'aria-label': 'Meu perfil' }, h('span', { class: 'usuario-nome' }, m.nome), avatar(m, { tamanho: 40 })),
          h('button', { type: 'button', class: 'btn-sair', onclick: sair, 'aria-label': 'Sair da conta', title: 'Sair da conta' }, icone('sair', 18)))
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


/** "2h05" para filmes; "3 temp. · 24 eps" para séries. Vazio se o TMDB não informou. */
export function detalheTitulo(t) {
  if (t.tipo === 'filme') {
    if (!t.duracao_min) return '';
    const hh = Math.floor(t.duracao_min / 60), mm = t.duracao_min % 60;
    return hh ? `${hh}h${String(mm).padStart(2, '0')}` : `${mm} min`;
  }
  const p = [];
  if (t.temporadas) p.push(t.temporadas + (t.temporadas === 1 ? ' temp.' : ' temps.'));
  if (t.episodios) p.push(t.episodios + (t.episodios === 1 ? ' ep.' : ' eps.'));
  return p.join(' · ');
}


/** Imagem que aparece com um fade quando termina de carregar (em vez de "pular" na tela). */
export function suave(img) {
  img.classList.add('img-suave');
  const pronta = () => img.classList.add('pronta');
  if (img.complete && img.naturalWidth) pronta(); else img.addEventListener('load', pronta, { once: true });
  img.addEventListener('error', pronta, { once: true });
  return img;
}

/** Blocos cinza "respirando" enquanto os dados chegam. */
export function esqueleto(tipo = 'grade', n = 6) {
  if (tipo === 'lista') return h('div', { class: 'esq-lista', 'aria-busy': 'true', 'aria-label': 'Carregando' },
    Array.from({ length: n }, () => h('div', { class: 'esq esq-linha' })));
  return h('div', { class: 'esq-grade', 'aria-busy': 'true', 'aria-label': 'Carregando' },
    Array.from({ length: n }, () => h('div', { class: 'esq esq-card' })));
}
