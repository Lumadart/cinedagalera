import { h, icone } from './dom.js';

const NIVEIS = ['', 'Bronze', 'Prata', 'Ouro'];
const COR = { 0: '#503b4b', 1: '#C98B5A', 2: '#C9CCD8', 3: '#F5B942' };
const ICONE = {
  cinefilo: 'check', horas_de_tela: 'play', ecletico: 'grade', classico: 'novo', primeiro_play: 'play',
  maratonista: 'raio', serie_completa: 'check', em_dia: 'calendario', presenca: 'calendario', maratona_fds: 'play',
  anfitriao: 'escudo', datas_especiais: 'estrela', curador: 'marcador', faro_certeiro: 'estrela', unanimidade: 'coracao',
  critico: 'estrela', voz_ativa: 'editar', contra_a_mare: 'raio', perfil_completo: 'amigos', gemeos_de_gosto: 'coracao',
  chamou_a_galera: 'amigos', fundador: 'escudo'
};

/** Medalha: se existir img/badges/<chave>.png ela é usada; senão, desenhamos uma medalha com ícone. */
export function medalha(b, tamanho = 76) {
  const cor = b.tipo === 'unica' && b.nivel ? COR[3] : COR[b.nivel];
  const caixa = h('div', {
    class: 'medalha' + (b.nivel ? '' : ' bloqueada'),
    style: { width: tamanho + 'px', height: tamanho + 'px', '--cor-medalha': cor }
  }, h('span', { class: 'medalha-ico' }, icone(ICONE[b.chave] || 'estrela', Math.round(tamanho * 0.42))));
  // A arte fica em img/badges/. Bloqueadas aparecem em cinza (versão bronze), para mostrar o que dá para ganhar.
  const nivelArte = Math.max(b.nivel, 1);
  const img = h('img', { src: `img/badges/${b.chave}${b.metas ? '-' + nivelArte : ''}.png`, alt: '', class: 'medalha-img' });
  img.addEventListener('load', () => { caixa.classList.add('com-arte'); caixa.append(img); }, { once: true });
  return caixa;
}

function progresso(b) {
  if (!b.disponivel) return h('span', { class: 'badge-estado' }, 'Chega com os eventos');
  if (b.tipo === 'unica') return h('span', { class: 'badge-estado' }, b.nivel ? 'Conquistada' : 'Ainda não conquistada');
  const proxima = b.metas[b.nivel]; // undefined quando já é ouro
  if (proxima === undefined) return h('span', { class: 'badge-estado ouro' }, `Nível máximo · ${b.valor} ${b.unidade}`);
  const base = b.nivel ? b.metas[b.nivel - 1] : 0;
  const pct = Math.max(2, Math.min(100, Math.round(((b.valor - base) / (proxima - base)) * 100)));
  return h('div', { class: 'badge-prog' },
    h('div', { class: 'barra-badge', role: 'img', 'aria-label': `${b.valor} de ${proxima} ${b.unidade}` }, h('span', { style: { width: pct + '%' } })),
    h('small', null, `${b.valor} / ${proxima} ${b.unidade}`));
}

export function cartaoBadge(b) {
  return h('article', { class: 'badge-card' + (b.nivel ? ' tem' : '') + (b.disponivel ? '' : ' em-breve') },
    medalha(b),
    h('div', { class: 'badge-texto' },
      h('strong', null, b.nome, b.tipo === 'niveis' && b.nivel ? h('span', { class: 'nivel nivel-' + b.nivel }, NIVEIS[b.nivel]) : null),
      h('p', null, b.descricao),
      progresso(b)));
}

/** Todas as badges, agrupadas por categoria. */
export function painelBadges(lista) {
  const categorias = [...new Set(lista.map((b) => b.categoria))];
  const conquistadas = lista.filter((b) => b.nivel > 0).length;
  return h('div', { class: 'badges' },
    h('p', { class: 'suave badges-resumo' }, h('strong', { class: 'ouro' }, String(conquistadas)), ` de ${lista.length} conquistadas`),
    categorias.map((c) => h('section', { class: 'badges-grupo' },
      h('h3', null, c),
      h('div', { class: 'badges-grade' }, lista.filter((b) => b.categoria === c).map(cartaoBadge)))));
}
