// Compatibilidade entre duas pessoas, calculada no navegador com o que já está no catálogo.
// Quatro sinais (cada um vale um peso; os que não têm dados são ignorados e o resto é reajustado):
//   notas      (40) — nos títulos vistos pelos dois com nota, quão perto estão as notas
//   generos    (25) — quanto os gêneros que cada um mais assiste se parecem
//   interesse  (20) — quanto da lista de cada um (vistos + vendo + quero ver) coincide
//   favoritos  (15) — favoritos em comum

const PESOS = { notas: 40, generos: 25, interesse: 20, favoritos: 15 };

function cosseno(a, b) {
  let ab = 0, aa = 0, bb = 0;
  Object.keys(a).forEach((k) => { aa += a[k] * a[k]; if (b[k]) ab += a[k] * b[k]; });
  Object.values(b).forEach((v) => { bb += v * v; });
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

function perfilDe(id, { status, favoritos }, porId) {
  const meus = status.filter((s) => s.membro_id === id && porId[s.titulo_id]);
  const generos = {};
  meus.filter((s) => s.status === 'visto' || s.status === 'assistindo').forEach((s) => porId[s.titulo_id].generos.forEach((g) => { generos[g] = (generos[g] || 0) + 1; }));
  return {
    porTitulo: Object.fromEntries(meus.map((s) => [s.titulo_id, s])),
    vistos: new Set(meus.filter((s) => s.status === 'visto').map((s) => s.titulo_id)),
    interesse: new Set(meus.filter((s) => s.status !== 'abandonado').map((s) => s.titulo_id)),
    favs: new Set(favoritos.filter((f) => f.membro_id === id && porId[f.titulo_id]).map((f) => f.titulo_id)),
    generos,
    total: meus.length
  };
}

/** Quem vê (a) e quem é visto (b). Retorna { pct, faixa, partes, vistosJuntos, naListaDeAmbos, generosComuns, maiorDiscordancia }. */
export function compatibilidade(idA, idB, catalogo) {
  const porId = Object.fromEntries(catalogo.titulos.map((t) => [t.id, t]));
  const A = perfilDe(idA, catalogo, porId), B = perfilDe(idB, catalogo, porId);
  const comuns = (x, y) => [...x].filter((i) => y.has(i));
  const vistosJuntos = comuns(A.vistos, B.vistos).map((i) => porId[i]);
  const naListaDeAmbos = comuns(A.interesse, B.interesse).map((i) => porId[i]);

  const partes = {};
  // notas
  const pares = vistosJuntos.map((t) => [A.porTitulo[t.id].nota, B.porTitulo[t.id].nota, t]).filter(([a, b]) => a !== null && b !== null);
  if (pares.length) partes.notas = { valor: pares.reduce((s, [a, b]) => s + (1 - Math.abs(a - b) / 10), 0) / pares.length, n: pares.length };
  // gêneros
  if (Object.keys(A.generos).length && Object.keys(B.generos).length) partes.generos = { valor: cosseno(A.generos, B.generos) };
  // interesse
  if (A.interesse.size && B.interesse.size) partes.interesse = { valor: naListaDeAmbos.length / Math.min(A.interesse.size, B.interesse.size), n: naListaDeAmbos.length };
  // favoritos
  if (A.favs.size && B.favs.size) { const n = comuns(A.favs, B.favs).length; partes.favoritos = { valor: n / Math.min(A.favs.size, B.favs.size), n }; }

  const chaves = Object.keys(partes);
  let pct = null;
  if (chaves.length >= 2 && A.total >= 3 && B.total >= 3) {
    const soma = chaves.reduce((s, k) => s + PESOS[k], 0);
    pct = Math.round(chaves.reduce((s, k) => s + PESOS[k] * partes[k].valor, 0) / soma * 100);
  }
  const topo = (g) => Object.entries(g).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([n]) => n);
  const topB = new Set(topo(B.generos));
  const generosComuns = topo(A.generos).filter((g) => topB.has(g));
  const maior = pares.slice().sort((x, y) => Math.abs(y[0] - y[1]) - Math.abs(x[0] - x[1]))[0];
  return {
    pct, partes, vistosJuntos, naListaDeAmbos, generosComuns,
    maiorDiscordancia: maior && Math.abs(maior[0] - maior[1]) >= 3 ? { titulo: maior[2], a: maior[0], b: maior[1] } : null,
    faixa: pct === null ? '' : pct >= 80 ? 'Almas gêmeas de sofá' : pct >= 60 ? 'Gostos parecidos' : pct >= 40 ? 'Dá para negociar o filme' : 'Gostos bem diferentes'
  };
}

export const ROTULO_PARTE = { notas: 'Notas parecidas', generos: 'Gêneros em comum', interesse: 'Mesma lista', favoritos: 'Favoritos em comum' };
