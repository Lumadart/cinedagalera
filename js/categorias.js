// Todas as categorias do site num lugar só. Para criar uma nova: acrescente uma linha aqui,
// a mesma chave em CATEGORIAS_ (Config.gs) e em CATEGORIAS_SORTEIO_ (Sorteio.gs), e uma imagem em Aparencia.gs.
// 'tipos' diz em quais tipos do TMDB ela existe (filme / serie).
export const CATEGORIAS_DEF = [
  { id: 'filme',        singular: 'Filme',        plural: 'Filmes',        icone: 'play',      tipos: ['filme'],          texto: 'Para ver em uma sentada só.' },
  { id: 'serie',        singular: 'Série',        plural: 'Séries',        icone: 'grade',     tipos: ['serie'],          texto: 'Para maratonar episódio por episódio.' },
  { id: 'miniserie',    singular: 'Minissérie',   plural: 'Minisséries',   icone: 'miniserie', tipos: ['serie'],          texto: 'História completa, com começo, meio e fim.' },
  { id: 'anime',        singular: 'Anime',        plural: 'Animes',        icone: 'raio',      tipos: ['filme', 'serie'], texto: 'Animação japonesa, de clássicos a lançamentos.' },
  { id: 'animacao',     singular: 'Animação',     plural: 'Animações',     icone: 'animacao',  tipos: ['filme', 'serie'], texto: 'Cartoons, Disney, Pixar e outros desenhos.' },
  { id: 'dorama',       singular: 'Dorama',       plural: 'Doramas',       icone: 'coracao',   tipos: ['serie'],          texto: 'Romance, drama e muita emoção do Oriente.' },
  { id: 'reality',      singular: 'Reality',      plural: 'Reality shows', icone: 'amigos',    tipos: ['serie'],          texto: 'Competição, convivência e muita resenha.' },
  { id: 'documentario', singular: 'Documentário', plural: 'Documentários', icone: 'busca',     tipos: ['filme', 'serie'], texto: 'Histórias reais que valem o tempo.' },
  { id: 'musical',      singular: 'Musical',      plural: 'Musicais',      icone: 'musical',   tipos: ['filme'],          texto: 'Para cantar junto: musicais, shows e filmes com trilha de destaque.' },
  { id: 'standup',      singular: 'Stand-up',     plural: 'Stand-up',      icone: 'standup',   tipos: ['filme'],          texto: 'Especiais de comédia para rir sem parar.' }
];

export const CATEGORIAS = Object.fromEntries(CATEGORIAS_DEF.map((c) => [c.id, c.singular]));
export const PLURAL_CATEGORIAS = Object.fromEntries(CATEGORIAS_DEF.map((c) => [c.id, c.plural]));
export const ICONE_CATEGORIAS = { todos: 'dado', ...Object.fromEntries(CATEGORIAS_DEF.map((c) => [c.id, c.icone])) };
export const TEXTO_CATEGORIAS = { todos: 'Tudo o que a comunidade escolheu, em um só lugar.', ...Object.fromEntries(CATEGORIAS_DEF.map((c) => [c.id, c.texto])) };
export const CATEGORIAS_POR_TIPO = {
  filme: CATEGORIAS_DEF.filter((c) => c.tipos.includes('filme')).map((c) => c.id),
  serie: CATEGORIAS_DEF.filter((c) => c.tipos.includes('serie')).map((c) => c.id)
};
