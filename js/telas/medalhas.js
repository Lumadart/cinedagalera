import { h, montar } from '../dom.js';
import { chamar } from '../api.js';
import { estado } from '../estado.js';
import { casca, esqueleto } from '../ui.js';
import { slotMedalha, fmtNum, qtd, unidadeDisputa, valorDisputa } from '../medalhas.js';

const SECOES = [
  ['trilha', 'Conquistas com níveis', 'Cada conquista tem vários níveis,: eles sobem conforme você assiste, avalia e participa.'],
  ['unica', 'Únicas', 'Ganhou, é sua para sempre.'],
  ['selo', 'Conquistas de eventos', 'Confirme presença e veja mais da metade da programação no dia do evento.'],
  ['disputada', 'Disputadas', 'Só uma pessoa tem cada uma por vez. Quem passa o recorde toma a conquista (nas de gênero e mídia, a disputa só começa com 5 títulos de vantagem).'],
  ['secreta', 'Secretas já descobertas', 'Alguém do grupo já ganhou. Falta você descobrir como.']
];

let dados = null;                 // última resposta (a tela abre na hora e atualiza em seguida)
const ui = { aba: null };

export function telaMedalhas({ raiz, ativa }) {
  const area = h('div', { class: 'med-pagina' }, dados ? null : esqueleto('lista', 4));
  montar(raiz, casca('medalhas', area));
  if (dados) desenhar();
  chamar('medalhas_todas').then((r) => { dados = r; if (ativa()) desenhar(); })
    .catch((e) => { if (ativa() && !dados) montar(area, h('p', { class: 'erro' }, e.message)); });

  function desenhar() {
    const lista = dados.medalhas;
    const grupos = dados.grupos.filter((g) => lista.some((b) => b.grupo === g));
    if (!grupos.includes(ui.aba)) ui.aba = grupos[0];
    
    const abas = h('div', { class: 'abas abas-linha', role: 'tablist' }, grupos.map((g) => {
      const doGrupo = lista.filter((b) => b.grupo === g);
      return h('button', { type: 'button', role: 'tab', class: 'aba' + (g === ui.aba ? ' ligada' : ''), 'aria-selected': String(g === ui.aba),
        onclick: () => { ui.aba = g; desenhar(); } }, g,
      h('small', { class: 'med-contagem' }, String(doGrupo.length)));
    }));
        const doGrupo = lista.filter((b) => b.grupo === ui.aba);
    const blocos = SECOES.map(([tipo, titulo, texto]) => {
      const itens = doGrupo.filter((b) => b.tipo === tipo);
      if (!itens.length) return null;
      return h('section', { class: 'med-secao' },
        h('div', { class: 'med-secao-topo' }, h('h3', null, titulo), h('p', { class: 'suave pequeno' }, texto)),
        tipo === 'trilha' ? h('div', { class: 'med-trilhas' }, itens.map(cartaTrilha))
          : h('div', { class: 'med-grade' }, itens.map(cartaUnica)));
    }).filter(Boolean);

    montar(area,
      h('div', { class: 'titulo-linha' }, h('div', null, h('h1', null, 'Conquistas'),
        h('p', { class: 'suave' }, 'A vitrine do grupo: todas as conquistas, com todos os níveis, tenha você ou não.'))),
      abas,
      ...(blocos.length ? blocos : [h('p', { class: 'suave med-vazio' }, 'Nada por aqui ainda.')]));
  }

  function cartaTrilha(b) {
    const proximo = b.niveis[b.nivel];
    return h('article', { class: 'med-trilha-card' },
      h('div', { class: 'med-trilha-topo' },
        h('strong', null, b.nome),
        h('small', null, `Você: ${qtd(b.valor, b.unidade)}` + (proximo ? ` · próximo nível em ${qtd(proximo.meta, b.unidade)}` : ' · último nível alcançado'))),
      h('div', { class: 'med-niveis' }, b.niveis.map((n, i) => {
        const tem = i < b.nivel;
        return h('div', { class: 'med-nivel' + (tem ? ' tem' : '') },
          slotMedalha({ chave: b.chave, nivel: i + 1, imagens: dados.imagens, tem }),
          h('strong', { class: 'med-nivel-num' }, `Nível ${i + 1}`),
          h('small', null, qtd(n.meta, b.unidade)),
          h('small', { class: tem ? 'feito' : '' }, tem ? 'Conquistado' : (n.quantos ? `${n.quantos} ${n.quantos === 1 ? 'pessoa' : 'pessoas'}` : 'Ninguém ainda')),
          tem && n.quantos ? h('small', null, `${n.quantos} ${n.quantos === 1 ? 'pessoa' : 'pessoas'}`) : null);
      })));
  }

  function cartaUnica(b) {
    const eu = estado.membro && b.dono && b.dono.id === estado.membro.id;
    const dono = b.dono;
    const linhaDono = b.tipo !== 'disputada' ? null : (dono
      ? h('div', { class: 'med-dono' }, eu ? h('b', null, 'Está com você agora') : h('span', null, 'Com ', h('a', { href: '#/perfil/' + dono.id }, dono.nome)),
        valorDisputa(b, dono.valor) ? h('small', null, ' · ' + valorDisputa(b, dono.valor)) : null)
      : h('div', { class: 'med-dono' }, `Sem dono ainda. Mínimo para existir: ${fmtNum(b.minimo)}${b.medida === 'pole' ? '' : ' ' + unidadeDisputa(b)}.`));
    return h('article', { class: 'med-card' + (b.nivel ? ' tem' : '') },
      slotMedalha({ chave: b.chave, nivel: 1, imagens: dados.imagens, tem: b.nivel > 0 }),
      h('div', { class: 'med-texto' },
        h('strong', { class: 'med-nome' }, b.nome),
        h('p', { class: 'med-desc' }, b.descricao),
        linhaDono,
        b.tipo === 'disputada' && !eu && b.meu_valor ? h('small', { class: 'med-quem' }, `Você: ${valorDisputa(b, b.meu_valor) || 'na disputa'}`) : null,
        b.tipo !== 'disputada' ? h('span', { class: 'badge-estado' + (b.nivel ? ' ouro' : '') }, b.nivel ? 'Conquistada por você' : 'Ainda não conquistada') : null,
        b.tipo !== 'disputada' ? h('small', { class: 'med-quem' }, b.quantos ? `${b.quantos} ${b.quantos === 1 ? 'pessoa já ganhou' : 'pessoas já ganharam'}` : 'Ninguém ganhou ainda') : null));
  }
}
