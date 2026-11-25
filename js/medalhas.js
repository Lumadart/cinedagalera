import { h } from './dom.js';

/**
 * Espaço da imagem de uma medalha (só a moldura; a arte entra depois).
 * Procura a imagem enviada pelo Admin (mapa `imagens`, chave "<chave>_<nível>") e, se não houver,
 * o arquivo img/medalhas/<chave>-<nível>.png. Sem nenhuma das duas, fica o espaço vazio.
 */
export const chaveImagem = (chave, nivel = 1) => String(chave).replace(/[^a-zA-Z0-9_]/g, '_') + '_' + nivel;

export function slotMedalha({ chave, nivel = 1, imagens = {}, tamanho = 88, tem = false }) {
  const caixa = h('div', { class: 'med-slot' + (tem ? ' tem' : ' bloqueada'), style: { '--tam': tamanho + 'px' }, 'aria-hidden': 'true' });
  const url = imagens[chaveImagem(chave, nivel)] || `img/medalhas/${chaveImagem(chave, nivel).replace(/_(\d+)$/, '-$1')}.png`;
  const img = h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('load', () => caixa.classList.add('com-arte'), { once: true });
  img.addEventListener('error', () => img.remove(), { once: true });
  caixa.append(img);
  return caixa;
}

const SINGULAR = { 'títulos': 'título', 'horas': 'hora', 'gêneros': 'gênero', 'categorias': 'categoria', 'episódios': 'episódio', 'séries': 'série', 'semanas': 'semana', 'eventos': 'evento',
  'datas': 'data', 'indicações': 'indicação', 'vezes': 'vez', 'notas': 'nota', 'meses': 'mês', 'presenças': 'presença', 'avaliações': 'avaliação' };
export const fmtNum = (n) => String(Number.isInteger(n) ? n : Math.round(n * 100) / 100).replace('.', ',');
const UNIDADE_DISPUTA = { generoso: 'de média', exigente: 'de média', olho: 'de média', sala: 'presenças', semana: 'avaliações', mes: 'títulos', pole: '' };
/** "1 título", "5 títulos". */
export const qtd = (n, unidade) => `${fmtNum(n)} ${n === 1 ? (SINGULAR[unidade] || unidade) : unidade}`;
export const unidadeDisputa = (b) => (b.medida in UNIDADE_DISPUTA ? UNIDADE_DISPUTA[b.medida] : 'títulos');
export const valorDisputa = (b, v) => (b.medida === 'pole' ? '' : fmtNum(v) + ' ' + unidadeDisputa(b));

export const ROTULO_TIPO = { trilha: 'trilha', unica: 'única', disputada: 'disputada', secreta: 'secreta', selo: 'de evento' };
