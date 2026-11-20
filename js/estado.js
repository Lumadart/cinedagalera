import { chamar } from './api.js';

// Dados que o site mantém em memória enquanto está aberto.
export const estado = {
  membro: null,    // quem está logado
  catalogo: null,  // { titulos, membros, status, favoritos }
  filtro: { categoria: 'todos', genero: null, busca: '', ordem: 'recentes' }  // do catálogo; a busca do topo também usa
};

let carregadoEm = 0;
let emVoo = null;
const FRESCO_MS = 45000; // dentro desse prazo, trocar de tela não refaz a consulta

/** Busca o catálogo. Sem `forcar`, reaproveita o que já está na memória se for recente. */
export function carregarCatalogo({ forcar = false } = {}) {
  if (!forcar && estado.catalogo && Date.now() - carregadoEm < FRESCO_MS) return Promise.resolve(estado.catalogo);
  if (emVoo) return emVoo;
  emVoo = chamar('catalogo').then((d) => {
    estado.catalogo = d; carregadoEm = Date.now(); return d;
  }).finally(() => { emVoo = null; });
  return emVoo;
}

export function limparCatalogo() { estado.catalogo = null; carregadoEm = 0; emVoo = null; }

export function achaTitulo(id) {
  return estado.catalogo ? estado.catalogo.titulos.find((t) => t.id === id) : undefined;
}

export function statusDe(membroId, tituloId) {
  return estado.catalogo
    ? estado.catalogo.status.find((s) => s.membro_id === membroId && s.titulo_id === tituloId)
    : undefined;
}

/** Atualiza na memória (sem recarregar tudo) depois que o servidor confirmou a gravação. */
export function aplicarStatusLocal(membroId, tituloId, campos) {
  if (!estado.catalogo) return;
  const atual = statusDe(membroId, tituloId);
  if (atual) {
    Object.assign(atual, { atualizado_em: new Date().toISOString() }, campos);
  } else {
    estado.catalogo.status.push({
      membro_id: membroId, titulo_id: tituloId, status: 'quero_ver', nota: null,
      comentario: '', temporada_atual: null, episodio_atual: null, visto_em: '',
      atualizado_em: new Date().toISOString(), ...campos
    });
  }
}

export function removerStatusLocal(membroId, tituloId) {
  if (!estado.catalogo) return;
  estado.catalogo.status = estado.catalogo.status.filter(
    (s) => !(s.membro_id === membroId && s.titulo_id === tituloId)
  );
}
