import { chamar } from './api.js';

// Dados que o site mantém em memória enquanto está aberto.
export const estado = {
  membro: null,    // quem está logado
  catalogo: null,  // { titulos, membros, status, favoritos }
  filtro: { categoria: 'todos', genero: null, busca: '', ordem: 'recentes' }  // do catálogo; a busca do topo também usa
};

export async function carregarCatalogo() {
  estado.catalogo = await chamar('catalogo');
  return estado.catalogo;
}

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
