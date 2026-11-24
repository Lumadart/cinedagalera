import { h, icone } from './dom.js';
import { ICONE_CATEGORIAS } from './categorias.js';

// A arte das medalhas chega numa próxima etapa: quando existir img/medalhas/<chave>[-nivel].png, é só ligar aqui.
const COM_ARTE = false;

const ICONE_TRILHA = {
  titulos_vistos: 'play', horas_de_tela: 'relogio', generos_diferentes: 'grade', classicos: 'novo', lancados_no_ano: 'novo',
  categorias_vistas: 'dado', episodios_vistos: 'raio', series_finalizadas: 'check', semanas_ativas: 'calendario', quero_ver: 'marcador',
  de_volta_ao_jogo: 'voltar', tempo_no_grupo: 'escudo', presenca_eventos: 'calendario', eventos_tematicos: 'estrela', votacoes_votadas: 'check',
  indicacoes: 'marcador', indicacoes_vistas: 'olho', indicou_top_mes: 'estrela', indicou_media_alta: 'coracao', todo_mundo_viu: 'amigos',
  sugestao_escolhida: 'check', fura_fila: 'raio', gas_de_assunto: 'editar', avaliacoes: 'estrela', contra_a_mare: 'raio', nota_dez: 'coracao',
  nota_baixa: 'fechar', abandonados: 'fechar', mesma_nota: 'amigos', vistos_em_comum: 'amigos', duelo_de_opinioes: 'raio'
};
const ICONE_GENERO = {
  terror: 'cadeado', comedia: 'animacao', romance: 'coracao', acao: 'raio', aventura: 'busca', drama: 'coracao', ficcao: 'novo', fantasia: 'novo',
  suspense: 'olho', crime: 'escudo', misterio: 'busca', familia: 'amigos', historia: 'relogio', guerra: 'escudo', faroeste: 'estrela'
};
const ICONE_GRUPO = { 'Presença': 'calendario', 'Exploração': 'play', 'Comunidade': 'amigos', 'Progressão': 'raio', 'Secretas': 'estrela' };

function iconeDe(b) {
  if (b.tipo === 'trilha' && b.chave.startsWith('midia_')) {
    const id = b.chave.slice(6);
    return ICONE_CATEGORIAS[id] || ICONE_GENERO[id] || 'estrela';
  }
  if (b.tipo === 'disputada' && b.chave.startsWith('disp_')) {
    const id = b.chave.slice(5);
    return ICONE_CATEGORIAS[id] || ICONE_GENERO[id] || 'escudo';
  }
  if (b.tipo === 'trilha') return ICONE_TRILHA[b.chave] || ICONE_GRUPO[b.grupo];
  if (b.tipo === 'disputada') return 'escudo';
  if (b.tipo === 'secreta') return b.oculta ? 'cadeado' : 'estrela';
  if (b.tipo === 'selo' || b.tipo === 'periodo') return 'estrela';
  return ICONE_GRUPO[b.grupo] || 'estrela';
}

const BRONZE = '#C98B5A', PRATA = '#C9CCD8', OURO = '#F5B942', LENDA = '#FFD978', APAGADA = '#7a6275';
/** Cor pela posição do nível na trilha: começa bronze, passa pela prata e termina em ouro. */
function corDe(b) {
  if (b.tipo === 'trilha') {
    if (!b.nivel) return APAGADA;
    const f = b.nivel / b.niveis.length;
    return b.nivel === b.niveis.length && b.niveis.length > 1 ? LENDA : f <= 0.34 ? BRONZE : f <= 0.67 ? PRATA : OURO;
  }
  if (b.tipo === 'disputada') return b.dono && b.dono.id && b.nivel ? OURO : APAGADA;
  if (b.oculta || !b.nivel) return APAGADA;
  return OURO;
}

/** Medalha desenhada: círculo com ícone. A arte (imagens) entra depois. */
export function medalha(b, tamanho = 64) {
  const cor = corDe(b);
  const cheia = b.tipo === 'trilha' && b.nivel === b.niveis.length && b.niveis.length > 1;
  const caixa = h('div', {
    class: 'medalha' + (b.nivel ? '' : ' bloqueada') + (cheia ? ' lendaria' : ''),
    style: { width: tamanho + 'px', height: tamanho + 'px', '--cor-medalha': cor }
  }, h('span', { class: 'medalha-ico' }, icone(iconeDe(b), Math.round(tamanho * 0.42))));
  if (COM_ARTE && !b.oculta) {
    const img = h('img', { src: `img/medalhas/${b.chave}${b.tipo === 'trilha' ? '-' + Math.max(b.nivel, 1) : ''}.png`, alt: '', class: 'medalha-img' });
    img.addEventListener('load', () => { caixa.classList.add('com-arte'); caixa.append(img); }, { once: true });
  }
  return caixa;
}

const UNIDADE_DISPUTA = { generoso: 'de média', exigente: 'de média', olho: 'de média', sala: 'presenças', semana: 'avaliações', mes: 'títulos', pole: '' };
const fmt = (n) => String(Number.isInteger(n) ? n : Math.round(n * 100) / 100).replace('.', ',');
const unidadeDisputa = (b) => (b.medida in UNIDADE_DISPUTA ? UNIDADE_DISPUTA[b.medida] : 'títulos');
const valorDisputa = (b, v) => (b.medida === 'pole' ? '' : fmt(v) + ' ' + unidadeDisputa(b));

function cartaTrilha(b) {
  const total = b.niveis.length;
  const atual = b.nivel ? b.niveis[b.nivel - 1] : null;
  const proximo = b.niveis[b.nivel]; // undefined quando já está no último
  const base = b.nivel ? b.niveis[b.nivel - 1].meta : 0;
  const pct = proximo ? Math.max(3, Math.min(100, Math.round(((b.valor - base) / (proximo.meta - base)) * 100))) : 100;
  return h('article', { class: 'med-card' + (b.nivel ? ' tem' : '') },
    medalha(b),
    h('div', { class: 'med-texto' },
      h('small', { class: 'med-trilha' }, b.nome),
      h('strong', { class: 'med-nome' }, atual ? atual.nome : (proximo ? proximo.nome : ''),
        b.concedida ? h('span', { class: 'etiqueta cinza' }, 'concedida') : null),
      h('div', { class: 'med-prog' },
        h('div', { class: 'barra-badge', role: 'img', 'aria-label': proximo ? `${b.valor} de ${proximo.meta} ${b.unidade}` : 'Último nível' },
          h('span', { style: { width: pct + '%' } })),
        h('small', null, proximo ? `${b.valor} / ${proximo.meta} ${b.unidade}` + (b.nivel ? ` · próxima: ${proximo.nome}` : '') : `Último nível · ${b.valor} ${b.unidade}`)),
      h('details', { class: 'med-niveis' },
        h('summary', null, `${b.nivel} de ${total} níveis`),
        h('ol', null, b.niveis.map((n, i) => h('li', { class: i < b.nivel ? 'feito' : '' },
          h('span', { class: 'med-pip' }, i < b.nivel ? icone('check', 12) : String(i + 1)), h('span', null, n.nome), h('small', null, `${n.meta} ${b.unidade}`)))))));
}

function cartaSimples(b) {
  return h('article', { class: 'med-card' + (b.nivel ? ' tem' : '') },
    medalha(b),
    h('div', { class: 'med-texto' },
      h('strong', { class: 'med-nome' }, b.nome, b.concedida ? h('span', { class: 'etiqueta cinza' }, 'concedida') : null),
      h('p', { class: 'med-desc' }, b.descricao),
      h('span', { class: 'badge-estado' + (b.nivel ? ' ouro' : '') }, b.nivel ? 'Conquistada' : 'Ainda não conquistada')));
}

function cartaDisputada(b, meuId) {
  const eu = b.dono && b.dono.id === meuId;
  const dono = b.dono;
  return h('article', { class: 'med-card disp' + (b.nivel ? ' tem' : '') },
    medalha(b),
    h('div', { class: 'med-texto' },
      h('strong', { class: 'med-nome' }, b.nome, h('span', { class: 'etiqueta' }, 'disputada')),
      h('p', { class: 'med-desc' }, b.descricao),
      dono
        ? h('div', { class: 'med-dono' }, eu ? h('b', null, 'Está com ela agora') : h('span', null, 'Com ', h('a', { href: '#/perfil/' + dono.id }, dono.nome)),
            valorDisputa(b, dono.valor) ? h('small', null, ' · ' + valorDisputa(b, dono.valor)) : null)
        : h('div', { class: 'med-dono suave' }, `Sem dono ainda. Mínimo para existir: ${fmt(b.minimo)}${b.medida === 'pole' ? '' : ' ' + (b.medida in UNIDADE_DISPUTA ? UNIDADE_DISPUTA[b.medida] : 'títulos')}.`),
      !eu && b.meu_valor ? h('small', { class: 'suave' }, `Perfil atual: ${valorDisputa(b, b.meu_valor) || 'na disputa'}`) : null,
      b.ja_foi.vezes ? h('small', { class: 'suave' }, `Já teve esta medalha ${b.ja_foi.vezes} ${b.ja_foi.vezes === 1 ? 'vez' : 'vezes'}, por ${b.ja_foi.dias} ${b.ja_foi.dias === 1 ? 'dia' : 'dias'} no total.`) : null));
}

function cartaOculta() {
  return h('div', { class: 'med-oculta', title: 'Medalha secreta: aparece quando for ganha' }, medalha({ tipo: 'secreta', oculta: true, nivel: 0, grupo: 'Secretas' }, 44), h('span', null, '???'));
}

const SECOES = [
  ['trilha', 'Trilhas', 'Sobem de nível conforme você assiste, avalia e participa.'],
  ['unica', 'Únicas', 'Ganhou, é sua para sempre.'],
  ['selo', 'Selos de eventos', 'Medalhas de eventos temáticos: confirme presença e veja mais da metade da programação no dia.'],
  ['disputada', 'Disputadas', 'Só uma pessoa tem cada uma por vez. Quem supera o recorde toma a medalha.'],
  ['periodo', 'De períodos', 'Ficam para sempre com quem fechou o mês ou a semana na frente.'],
  ['secreta', 'Secretas', 'Só aparecem depois de ganhas.']
];

/**
 * Tela de medalhas de uma pessoa, com uma aba por grupo.
 * dados = resposta da ação `medalhas`: { grupos, medalhas, ganhas, total }.
 */
export function painelMedalhas(dados, { meuId = '', primeiroNome = '', ui = {} } = {}) {
  // `ui` guarda a aba e o filtro entre uma pintura e outra da tela
  let aba = dados.grupos.includes(ui.aba) ? ui.aba : dados.grupos[0];
  let filtro = ui.filtro || 'todas';
  const raiz = h('div', { class: 'medalhas' });

  const doGrupo = (g) => dados.medalhas.filter((b) => b.grupo === g);
  const ganhaFeita = (b) => (b.tipo === 'trilha' ? b.nivel : (b.nivel > 0 ? 1 : 0));
  const totalDe = (b) => (b.tipo === 'trilha' ? b.niveis.length : b.tipo === 'periodo' ? 0 : 1);

  function desenhar() {
    const ganhas = dados.ganhas;
    const pct = Math.round((ganhas / dados.total) * 100);
    const abas = h('div', { class: 'abas abas-linha', role: 'tablist' }, dados.grupos.map((g) => {
      const lista = doGrupo(g);
      const f = lista.reduce((a, b) => a + ganhaFeita(b), 0);
      const t = lista.reduce((a, b) => a + totalDe(b), 0);
      return h('button', { type: 'button', role: 'tab', class: 'aba' + (g === aba ? ' ligada' : ''), 'aria-selected': String(g === aba),
        onclick: () => { aba = ui.aba = g; desenhar(); } }, g, h('small', { class: 'med-contagem' }, `${f}/${t}`));
    }));
    const filtros = h('div', { class: 'med-filtros' }, [['todas', 'Todas'], ['ganhas', 'Ganhas'], ['faltam', 'Faltam']].map(([k, r]) =>
      h('button', { type: 'button', class: 'chip' + (filtro === k ? ' ligado' : ''), 'aria-pressed': String(filtro === k), onclick: () => { filtro = ui.filtro = k; desenhar(); } }, r)));

    const lista = doGrupo(aba);
    const mostrar = (b) => filtro === 'todas' || (filtro === 'ganhas' ? b.nivel > 0 : (b.tipo === 'periodo' ? false : b.tipo === 'trilha' ? b.nivel < b.niveis.length : b.nivel === 0));
    const blocos = SECOES.map(([tipo, titulo, texto]) => {
      let itens = lista.filter((b) => b.tipo === tipo);
      if (!itens.length) return null;
      let ocultas = 0;
      if (tipo === 'secreta') { ocultas = itens.filter((b) => b.oculta).length; itens = itens.filter((b) => !b.oculta); }
      itens = itens.filter(mostrar);
      if (!itens.length && !(tipo === 'secreta' && ocultas && filtro !== 'ganhas')) return null;
      const cartas = itens.map((b) => (b.tipo === 'trilha' ? cartaTrilha(b) : b.tipo === 'disputada' ? cartaDisputada(b, meuId) : cartaSimples(b)));
      return h('section', { class: 'med-secao' },
        h('div', { class: 'med-secao-topo' }, h('h3', null, titulo), h('p', { class: 'suave pequeno' }, texto)),
        h('div', { class: 'med-grade' }, cartas),
        tipo === 'secreta' && ocultas && filtro !== 'ganhas' ? h('div', { class: 'med-ocultas' }, Array.from({ length: Math.min(ocultas, 30) }, cartaOculta),
          h('small', { class: 'suave' }, `${ocultas} ${ocultas === 1 ? 'secreta ainda por descobrir' : 'secretas ainda por descobrir'}`)) : null);
    }).filter(Boolean);

    raiz.replaceChildren(
      h('div', { class: 'med-topo' },
        h('div', null, h('strong', { class: 'med-total' }, String(ganhas)), h('span', { class: 'suave' }, ` de ${dados.total} medalhas` + (primeiroNome ? ` de ${primeiroNome}` : ''))),
        h('div', { class: 'barra-badge med-barra', role: 'img', 'aria-label': `${pct}% das medalhas` }, h('span', { style: { width: Math.max(1, pct) + '%' } }))),
      abas, filtros,
      ...(blocos.length ? blocos : [h('p', { class: 'suave med-vazio' }, filtro === 'ganhas' ? 'Nada por aqui ainda.' : 'Tudo conquistado por aqui.')]));
  }
  desenhar();
  return raiz;
}
