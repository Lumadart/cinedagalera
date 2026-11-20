import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo } from '../estado.js';
import { chamar } from '../api.js';
import { dropdown } from '../dropdown.js';
import { criarCarta, confete } from '../carta.js';
import { casca, esqueleto, capa, avisar, seguro, CATEGORIAS, CATEGORIAS_POR_TIPO, rotuloCategoria } from '../ui.js';

// O que a pessoa escolheu nos filtros fica guardado enquanto o site estiver aberto.
const escolha = { aba: 'catalogo', categoria: 'todos', genero: '', quem: 'qualquer', categoriaNovo: 'filme', generoNovo: '' };
let ultimoId = null;

const PLURAL = { filme: 'Filmes', serie: 'Séries', anime: 'Animes', dorama: 'Doramas', reality: 'Reality', documentario: 'Documentários' };
const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];

/** Texto de espera, antes do primeiro sorteio. */
function vazio(texto) {
  return h('div', { class: 'sorteio-vazio' }, icone('dado', 40), h('h2', null, 'Pronto para sortear?'), h('p', null, texto));
}

/** Põe a capa sorteada (desfocada) no fundo da área do resultado. */
function fundoDaCena(cena, t) {
  const url = seguro(t.capa_url);
  if (url) cena.style.setProperty('--cena-bg', `url("${url}")`); else cena.style.removeProperty('--cena-bg');
  cena.classList.toggle('com-fundo', !!url);
}

function cartaoResultado(t, acoes) {
  return h('article', { class: 'sorteado' },
    h('div', { class: 'sorteado-info' },
      h('div', { class: 'linha-pills' },
        h('span', { class: 'pill-tipo fixo' }, rotuloCategoria(t)),
        t.ano ? h('span', { class: 'meta-chip' }, t.ano) : null,
        t.nota_tmdb ? h('span', { class: 'meta-chip' }, '★ ' + Number(t.nota_tmdb).toFixed(1)) : null),
      h('h2', null, t.nome),
      t.generos && t.generos.length ? h('div', { class: 'generos' }, t.generos.map((g) => h('span', { class: 'genero' }, g))) : null,
      t.sinopse ? h('p', { class: 'sinopse-curta' }, t.sinopse) : null,
      h('div', { class: 'acoes-linha' }, acoes)));
}

/** A área do resultado: a carta em cima; depois do sorteio ela some e entram a capa e os dados. */
function criarCena(textoVazio) {
  const carta = criarCarta();
  const palco = h('div', { class: 'palco' });
  const saida = h('div', { class: 'sorteio-saida' }, vazio(textoVazio));
  const cena = h('div', { class: 'sorteio-cena' }, carta.el, h('div', { class: 'sorteio-resultado' }, palco, saida));
  return {
    cena, saida, carta,
    sorteando() { cena.classList.remove('tem-resultado'); montar(saida, h('p', { class: 'sorteio-sorteando', role: 'status' }, 'Sorteando…')); },
    async revelar(t, lista, acoes, aindaAtiva) {
      await carta.girar(lista, t);
      if (!aindaAtiva()) return;
      montar(palco, capa(t, true)); fundoDaCena(cena, t);
      montar(saida, cartaoResultado(t, acoes));
      cena.classList.add('tem-resultado');
      saida.querySelector('.sorteado')?.classList.add('entrou');
      confete(cena);
    }
  };
}

export function telaSorteio({ raiz, ativa }) {
  const abasEl = h('div', { class: 'abas', role: 'tablist' });
  const painel = h('div', { class: 'sorteio-painel' });
  montar(raiz, casca('sorteio', h('div', { class: 'sorteio' },
    h('h1', null, 'Sorteio'),
    h('p', { class: 'suave' }, 'Sem ideia do que ver? Deixe a sorte decidir — no nosso catálogo ou com novidades pelo gosto da galera.'),
    abasEl, painel)));

  function abas() {
    const aba = (id, texto) => h('button', {
      type: 'button', role: 'tab', class: 'aba' + (escolha.aba === id ? ' ligada' : ''), 'aria-selected': escolha.aba === id ? 'true' : 'false',
      onclick: () => { escolha.aba = id; abas(); desenhar(); }
    }, texto);
    montar(abasEl, aba('catalogo', 'Do nosso catálogo'), aba('novos', 'Descobrir novos'));
  }
  function desenhar() { (escolha.aba === 'catalogo' ? abaCatalogo : abaNovos)(); }

  // ---------- do catálogo ----------
  function abaCatalogo() {
    if (!estado.catalogo) {
      montar(painel, esqueleto('lista', 2));
      carregarCatalogo().then(() => { if (ativa() && escolha.aba === 'catalogo') abaCatalogo(); })
        .catch((e) => { if (ativa()) montar(painel, h('p', { class: 'erro' }, e.message)); });
      return;
    }
    const { titulos, status } = estado.catalogo;
    const meu = (id) => status.find((s) => s.membro_id === estado.membro.id && s.titulo_id === id);
    const opcoes = () => titulos.filter((t) => {
      if (escolha.categoria !== 'todos' && t.categoria !== escolha.categoria) return false;
      if (escolha.genero && !t.generos.includes(escolha.genero)) return false;
      const meus = meu(t.id);
      if (escolha.quem === 'nao_vi') return !meus || meus.status === 'quero_ver' || meus.status === 'assistindo';
      if (escolha.quem === 'quero_ver') return !!meus && meus.status === 'quero_ver';
      if (escolha.quem === 'ninguem') return !status.some((s) => s.titulo_id === t.id && s.status === 'visto');
      return true;
    });

    const categorias = Object.keys(CATEGORIAS).filter((c) => titulos.some((t) => t.categoria === c));
    const generos = [...new Set(titulos.flatMap((t) => t.generos))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (escolha.categoria !== 'todos' && !categorias.includes(escolha.categoria)) escolha.categoria = 'todos';
    if (escolha.genero && !generos.includes(escolha.genero)) escolha.genero = '';

    const { cena, saida, carta, sorteando, revelar } = criarCena('Escolha os filtros ao lado e aperte “Sortear!” — a roleta decide o que a galera vai ver.');
    carta.ocioso(opcoes());
    const contagem = h('p', { class: 'suave pequeno', role: 'status' });
    const botao = h('button', { type: 'button', class: 'btn-primario grande', onclick: rodar }, icone('dado', 20), 'Sortear!');

    const chip = (texto, ligado, aoClicar) => h('button', { type: 'button', class: 'chip' + (ligado ? ' ligado' : ''), 'aria-pressed': ligado ? 'true' : 'false', onclick: aoClicar }, texto);
    const mudar = (campo, valor) => () => { escolha[campo] = valor; abaCatalogo(); };
    const selGenero = dropdown({ rotulo: 'Gênero', valor: escolha.genero, opcoes: [['', 'Qualquer gênero'], ...generos],
      aoMudar: (e) => { escolha.genero = e.target.value; abaCatalogo(); } });
    const selQuem = dropdown({ rotulo: 'Para quem', valor: escolha.quem, aoMudar: (e) => { escolha.quem = e.target.value; abaCatalogo(); },
      opcoes: [['qualquer', 'Qualquer título'], ['nao_vi', 'Que eu ainda não vi'], ['quero_ver', 'Da minha lista “quero ver”'], ['ninguem', 'Que ninguém da galera viu']] });

    const n = opcoes().length;
    contagem.textContent = n ? `${n} ${n === 1 ? 'título possível' : 'títulos possíveis'} com esses filtros.` : 'Nenhum título com esses filtros.';
    botao.disabled = n === 0;

    montar(painel, h('div', { class: 'sorteio-grade' },
      h('div', { class: 'sorteio-controles' },
      h('div', { class: 'filtro-linha', role: 'group', 'aria-label': 'Tipo' },
        h('span', { class: 'filtro-rotulo' }, 'Tipo'),
        h('div', { class: 'filtros' },
          chip('Todos', escolha.categoria === 'todos', mudar('categoria', 'todos')),
          categorias.map((c) => chip(CATEGORIAS[c], escolha.categoria === c, mudar('categoria', c))))),
      h('div', { class: 'sorteio-selects' },
        h('div', null, h('span', { class: 'rotulo' }, 'Gênero'), selGenero),
        h('div', null, h('span', { class: 'rotulo' }, 'Para quem'), selQuem)),
      contagem, botao),
      cena));

    async function rodar() {
      const lista = opcoes();
      if (!lista.length) return;
      const candidatos = lista.length > 1 ? lista.filter((t) => t.id !== ultimoId) : lista;
      const t = sortear(candidatos);
      ultimoId = t.id;
      botao.disabled = true; sorteando();
      await revelar(t, lista, [h('a', { class: 'btn-sec', href: '#/titulo/' + t.id }, 'Ver detalhes')], ativa);
      if (!ativa()) return;
      botao.disabled = false;
      botao.replaceChildren(icone('dado', 20), 'Sortear de novo');
    }
  }

  // ---------- descobrir novos ----------
  let fila = [];          // candidatos que o servidor já devolveu
  let generosTmdb = [];
  let gostos = [];
  let personalizado = false;

  function abaNovos() {
    const { cena, saida, carta, sorteando, revelar } = criarCena('Escolha o tipo e o gênero e aperte “Descobrir!” para ver títulos novos que ainda não estão no catálogo.');
    carta.ocioso(fila);
    const botao = h('button', { type: 'button', class: 'btn-primario grande', onclick: () => rodar(true) }, icone('dado', 20), 'Descobrir!');
    const aviso = h('p', { class: 'suave pequeno', role: 'status' });
    const chip = (texto, ligado, aoClicar) => h('button', { type: 'button', class: 'chip' + (ligado ? ' ligado' : ''), 'aria-pressed': ligado ? 'true' : 'false', onclick: aoClicar }, texto);
    const selGenero = dropdown({ rotulo: 'Gênero', valor: escolha.generoNovo, opcoes: [['', 'Pelo gosto da galera'], ...generosTmdb],
      aoMudar: (e) => { escolha.generoNovo = e.target.value; fila = []; } });
    const blocoGenero = h('div', { class: 'sorteio-selects' }, h('div', null, h('span', { class: 'rotulo' }, 'Gênero'), selGenero));
    const preencherGeneros = () => {
      selGenero.definirOpcoes([['', 'Pelo gosto da galera'], ...generosTmdb]);
      blocoGenero.hidden = !generosTmdb.length;
    };
    preencherGeneros();

    montar(painel, h('div', { class: 'sorteio-grade' },
      h('div', { class: 'sorteio-controles' },
      h('div', { class: 'filtro-linha', role: 'group', 'aria-label': 'Tipo' },
        h('span', { class: 'filtro-rotulo' }, 'Tipo'),
        h('div', { class: 'filtros' },
          Object.keys(CATEGORIAS).map((c) => chip(PLURAL[c], escolha.categoriaNovo === c, () => {
            escolha.categoriaNovo = c; escolha.generoNovo = ''; fila = []; generosTmdb = []; gostos = []; abaNovos();
          })))),
      blocoGenero,
      aviso, botao),
      cena));
    if (!generosTmdb.length) {
      const cat = escolha.categoriaNovo;
      chamar('sortear_tmdb', { categoria: cat, so_generos: true }).then((d) => {
        if (!ativa() || escolha.categoriaNovo !== cat || generosTmdb.length) return;
        generosTmdb = d.generos_disponiveis; preencherGeneros();
      }).catch(() => {});   // sem a lista o sorteio continua funcionando
    }
    if (gostos.length) mostrarGostos(aviso);
    else aviso.textContent = 'Vamos olhar o que a galera mais gosta e buscar títulos novos no TMDB que ainda não estão no catálogo.';

    async function rodar(giro) {
      botao.disabled = true; sorteando();
      try {
        if (!fila.length) {
          montar(saida, h('p', { class: 'sorteio-sorteando', role: 'status' }, 'Procurando no TMDB…'));
          const d = await chamar('sortear_tmdb', { categoria: escolha.categoriaNovo, genero: escolha.generoNovo });
          if (!ativa()) return;
          const primeira = !generosTmdb.length;
          fila = d.resultados; gostos = d.gostos; personalizado = d.personalizado; generosTmdb = d.generos_disponiveis;
          montar(saida, h('p', { class: 'sorteio-sorteando', role: 'status' }, 'Sorteando…'));
          if (primeira) preencherGeneros();
          mostrarGostos(aviso);
        }
        if (!fila.length) { montar(saida, h('p', { class: 'suave' }, 'Não achamos nada novo com esses critérios. Tente outro gênero.')); botao.disabled = false; return; }
        const t = fila.shift();
        const add = h('button', { type: 'button', class: 'btn-primario' }, 'Adicionar ao catálogo');
        add.onclick = async () => {
          add.disabled = true; add.textContent = 'Adicionando…';
          try {
            const r = await chamar('adicionar_titulo', { tmdb_id: t.tmdb_id, tipo: t.tipo, categoria: t.categoria });
            if (estado.catalogo && !estado.catalogo.titulos.some((x) => x.id === r.titulo.id)) estado.catalogo.titulos.unshift(r.titulo);
            avisar(`“${r.titulo.nome}” entrou no catálogo.`);
            location.hash = '#/titulo/' + r.titulo.id;
          } catch (err) { avisar(err.message, 'erro'); add.disabled = false; add.textContent = 'Adicionar ao catálogo'; }
        };
        await revelar(t, [t, ...fila], [add], ativa);
        if (!ativa()) return;
        botao.disabled = false;
        botao.replaceChildren(icone('dado', 20), 'Outro');
      } catch (e) {
        if (!ativa()) return;
        montar(saida, h('p', { class: 'erro', role: 'alert' }, e.message));
        botao.disabled = false;
      }
    }
  }

  function mostrarGostos(el) {
    el.textContent = personalizado
      ? 'Baseado no que a galera mais curte: ' + gostos.join(', ') + '.'
      : (gostos.length ? 'Gênero escolhido: ' + gostos.join(', ') + '.' : 'Ainda não há gostos suficientes — mostrando os populares.');
  }

  abas(); desenhar();
}
