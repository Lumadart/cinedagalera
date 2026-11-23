import { h, montar, icone } from '../dom.js';
import { estado, carregarCatalogo } from '../estado.js';
import { chamar } from '../api.js';
import { dropdown } from '../dropdown.js';
import { fundoAparencia } from '../aparencia.js';
import { PLURAL_CATEGORIAS, ICONE_CATEGORIAS } from '../categorias.js';
import { casca, esqueleto, capa, avisar, seguro, CATEGORIAS, rotuloCategoria } from '../ui.js';

// O que a pessoa escolheu fica guardado enquanto o site estiver aberto.
const VAZIO = { fonte: 'catalogo', categoria: 'todos', genero: '', anoDe: '', anoAte: '', nota: 0, quem: 'qualquer', semVistos: false };
const escolha = { ...VAZIO };
let ultimoId = null;

const ICONE_CAT = ICONE_CATEGORIAS;
const PLURAL = { todos: 'Todos', ...PLURAL_CATEGORIAS };
const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));
const reduzido = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Confete curto quando o sorteio é revelado. */
function confete(area) {
  if (reduzido()) return;
  const cores = ['#F5B942', '#FFD883', '#F8EAD8', '#B7869A', '#EE8E62'];
  const caixa = h('div', { class: 'confete', 'aria-hidden': 'true' });
  for (let i = 0; i < 46; i++) {
    const p = h('span', { class: 'confete-p' });
    p.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
    p.style.setProperty('--dx', (Math.random() * 160 - 80).toFixed(0) + 'px');
    p.style.setProperty('--dy', (260 + Math.random() * 260).toFixed(0) + 'px');
    p.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
    p.style.setProperty('--atraso', (Math.random() * 0.35).toFixed(2) + 's');
    p.style.background = cores[i % cores.length];
    caixa.append(p);
  }
  area.append(caixa);
  setTimeout(() => caixa.remove(), 2600);
}

/** Estrelas para a nota mínima (cada estrela vale 2 pontos da nota do TMDB). Clicar de novo na mesma limpa. */
function estrelasMinimas(valor, aoMudar) {
  const caixa = h('div', { class: 'sort-estrelas', role: 'group', 'aria-label': 'Avaliação mínima' });
  const pintar = (n) => {
    caixa.replaceChildren(...[1, 2, 3, 4, 5].map((i) => h('button', {
      type: 'button', class: 'sort-estrela' + (i <= n ? ' ligada' : ''), 'aria-label': `${i} ${i === 1 ? 'estrela' : 'estrelas'} (nota ${i * 2} ou mais)`, 'aria-pressed': i === n ? 'true' : 'false',
      onclick: () => { n = n === i ? 0 : i; aoMudar(n); pintar(n); }
    }, icone('estrela', 22))));
  };
  pintar(valor);
  return { el: caixa, limpar: () => pintar(0) };
}

export function telaSorteio({ raiz, ativa }) {
  const painel = h('section', { class: 'sorteio-painel' });
  const resultado = h('section', { class: 'sorteio-res', hidden: true, 'aria-live': 'polite' });

  montar(raiz, casca('sorteio', h('div', { class: 'sorteio' },
    fundoAparencia(h('header', { class: 'sorteio-hero' },
      h('div', { class: 'sorteio-hero-texto' },
        h('h1', null, 'SORTEIO', h('span', { class: 'ouro' }, 'ALEATÓRIO')),
        h('p', { class: 'sorteio-lead' }, 'Não sabe o que assistir? Deixe o destino escolher!'),
        h('p', { class: 'suave' }, 'Sorteamos um título aleatório entre o nosso catálogo ou do TMDB. Use os filtros para refinar e descobrir algo novo!'))), 'sorteio'),
    painel, resultado)));

  // ---------- dados do TMDB ----------
  let fila = [];            // candidatos que o servidor já devolveu
  let assinaturaFila = '';
  let generosTmdb = [];
  let gostos = [];
  let personalizado = false;
  let ocupado = false;
  let jaSorteou = false;

  const anoAtual = new Date().getFullYear();
  const categoriasDaFonte = () => {
    if (escolha.fonte === 'tmdb') return Object.keys(CATEGORIAS);
    const titulos = estado.catalogo ? estado.catalogo.titulos : [];
    return Object.keys(CATEGORIAS).filter((c) => titulos.some((t) => t.categoria === c));
  };

  function filtrarCatalogo() {
    const { titulos, status } = estado.catalogo;
    const meu = (id) => status.find((s) => s.membro_id === estado.membro.id && s.titulo_id === id);
    const de = Number(escolha.anoDe) || 0, ate = Number(escolha.anoAte) || 0;
    const menor = de && ate ? Math.min(de, ate) : de, maior = de && ate ? Math.max(de, ate) : ate;
    return titulos.filter((t) => {
      if (escolha.categoria !== 'todos' && t.categoria !== escolha.categoria) return false;
      if (escolha.genero && !t.generos.includes(escolha.genero)) return false;
      const ano = Number(t.ano) || 0;
      if (menor && (!ano || ano < menor)) return false;
      if (maior && (!ano || ano > maior)) return false;
      if (escolha.nota && !(Number(t.nota_tmdb) >= escolha.nota * 2)) return false;
      const meus = meu(t.id);
      if (escolha.semVistos && meus && meus.status === 'visto') return false;
      if (escolha.quem === 'nao_vi') return !meus || meus.status === 'quero_ver' || meus.status === 'assistindo';
      if (escolha.quem === 'quero_ver') return !!meus && meus.status === 'quero_ver';
      if (escolha.quem === 'ninguem') return !status.some((s) => s.titulo_id === t.id && s.status === 'visto');
      return true;
    });
  }

  function paramsTmdb() {
    const de = Number(escolha.anoDe) || 0, ate = Number(escolha.anoAte) || 0;
    const categoria = escolha.categoria === 'todos' ? (Math.random() < 0.5 ? 'filme' : 'serie') : escolha.categoria;
    return {
      categoria, genero: escolha.genero,
      ano_de: de && ate ? Math.min(de, ate) : de, ano_ate: de && ate ? Math.max(de, ate) : ate,
      nota_min: escolha.nota ? escolha.nota * 2 : 0
    };
  }
  const assinatura = () => JSON.stringify([escolha.categoria, escolha.genero, escolha.anoDe, escolha.anoAte, escolha.nota]);

  async function carregarGenerosTmdb() {
    const cat = escolha.categoria === 'todos' ? 'filme' : escolha.categoria;
    try {
      const d = await chamar('sortear_tmdb', { categoria: cat, so_generos: true });
      if (!ativa() || escolha.fonte !== 'tmdb') return;
      generosTmdb = d.generos_disponiveis; desenhar();
    } catch (_) { /* sem a lista o sorteio continua funcionando */ }
  }

  // ---------- painel ----------
  function desenhar() {
    if (escolha.fonte === 'catalogo' && !estado.catalogo) {
      montar(painel, esqueleto('lista', 2));
      carregarCatalogo().then(() => { if (ativa()) desenhar(); })
        .catch((e) => { if (ativa()) montar(painel, h('p', { class: 'erro' }, e.message)); });
      return;
    }
    const noCatalogo = escolha.fonte === 'catalogo';
    const titulos = estado.catalogo ? estado.catalogo.titulos : [];
    const cats = categoriasDaFonte();
    if (escolha.categoria !== 'todos' && !cats.includes(escolha.categoria)) escolha.categoria = 'todos';

    const generos = noCatalogo
      ? [...new Set(titulos.flatMap((t) => t.generos))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
      : generosTmdb;
    if (escolha.genero && !generos.includes(escolha.genero) && (noCatalogo || generosTmdb.length)) escolha.genero = '';
    const anos = noCatalogo
      ? [...new Set(titulos.map((t) => Number(t.ano)).filter(Boolean))].sort((a, b) => b - a)
      : Array.from({ length: anoAtual - 1949 }, (_, i) => anoAtual - i);

    const aviso = h('p', { class: 'suave pequeno sorteio-aviso', role: 'status' });
    const botao = h('button', { type: 'button', class: 'btn-primario grande sorteio-botao', onclick: rodar },
      icone('dado', 22), jaSorteou ? 'SORTEAR DE NOVO' : 'SORTEAR ALEATÓRIO');

    const fonte = (id, titulo, texto, ico) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': escolha.fonte === id ? 'true' : 'false', class: 'fonte-card' + (escolha.fonte === id ? ' ligada' : ''),
      onclick: () => {
        if (escolha.fonte === id) return;
        escolha.fonte = id; escolha.genero = ''; escolha.quem = 'qualquer'; fila = [];
        desenhar();
      }
    }, h('span', { class: 'fonte-ico' }, icone(ico, 26)), h('span', { class: 'fonte-txt' }, h('strong', null, titulo), h('small', null, texto)));

    const chipCat = (c) => h('button', {
      type: 'button', class: 'chip sort-cat' + (escolha.categoria === c ? ' ligado' : ''), 'aria-pressed': escolha.categoria === c ? 'true' : 'false',
      onclick: () => { escolha.categoria = c; escolha.genero = ''; fila = []; if (!noCatalogo) generosTmdb = []; desenhar(); }
    }, icone(ICONE_CAT[c], 17), PLURAL[c]);

    const campo = (rotulo, el) => h('div', { class: 'sort-campo' }, h('span', { class: 'rotulo' }, rotulo), el);
    const opAnos = [['', 'Qualquer'], ...anos.map((a) => [String(a), String(a)])];
    const selGenero = dropdown({ rotulo: 'Gêneros', valor: escolha.genero, opcoes: [['', 'Todos os gêneros'], ...generos],
      aoMudar: (e) => { escolha.genero = e.target.value; fila = []; atualizar(); } });
    const selDe = dropdown({ rotulo: 'Ano de lançamento, a partir de', valor: escolha.anoDe, opcoes: opAnos, aoMudar: (e) => { escolha.anoDe = e.target.value; fila = []; atualizar(); } });
    const selAte = dropdown({ rotulo: 'Ano de lançamento, até', valor: escolha.anoAte, opcoes: opAnos, aoMudar: (e) => { escolha.anoAte = e.target.value; fila = []; atualizar(); } });
    const selQuem = dropdown({ rotulo: 'Status', valor: escolha.quem, aoMudar: (e) => { escolha.quem = e.target.value; atualizar(); },
      opcoes: [['qualquer', 'Qualquer status'], ['nao_vi', 'Que eu ainda não vi'], ['quero_ver', 'Da minha lista “quero ver”'], ['ninguem', 'Que ninguém da comunidade viu']] });
    const estrelas = estrelasMinimas(escolha.nota, (n) => { escolha.nota = n; fila = []; atualizar(); });
    const semVistos = h('input', { type: 'checkbox', checked: escolha.semVistos, onchange: (e) => { escolha.semVistos = e.target.checked; atualizar(); } });

    const filtros = h('div', { class: 'sort-filtros' },
      campo('Gêneros', selGenero),
      campo('Ano de lançamento', h('div', { class: 'sort-ano' }, selDe, h('span', { class: 'suave' }, 'até'), selAte)),
      campo('Avaliação mínima', estrelas.el),
      noCatalogo ? campo('Status', selQuem) : null,
      noCatalogo ? h('div', { class: 'sort-campo sort-vistos' },
        h('label', { class: 'interruptor' }, semVistos, h('span', null, 'Excluir títulos já assistidos')),
        h('small', { class: 'suave' }, 'Recomendado')) : null);

    const limpar = h('button', { type: 'button', class: 'sort-limpar', onclick: () => {
      Object.assign(escolha, { categoria: 'todos', genero: '', anoDe: '', anoAte: '', nota: 0, quem: 'qualquer', semVistos: false }); fila = []; desenhar();
    } }, icone('fechar', 16), 'Limpar filtros');

    montar(painel,
      h('div', { class: 'sort-topo' },
        h('div', { class: 'sort-passo' },
          h('h2', { class: 'sort-titulo' }, '1. Escolha a fonte'),
          h('div', { class: 'fonte-grade', role: 'radiogroup', 'aria-label': 'Fonte do sorteio' },
            fonte('catalogo', 'Nosso catálogo', `Sorteie entre os ${titulos.length} títulos cadastrados`, 'marcador'),
            fonte('tmdb', 'TMDB', 'Sorteie entre milhões de títulos do The Movie Database', 'busca'))),
        h('div', { class: 'sort-passo' },
          h('h2', { class: 'sort-titulo' }, '2. O que você quer sortear?'),
          h('div', { class: 'sort-cats' }, ['todos', ...cats].map(chipCat)))),
      h('div', { class: 'sort-passo sort-passo-filtros' },
        h('div', { class: 'sort-cabeca' }, h('h2', { class: 'sort-titulo' }, '3. Filtros ', h('span', { class: 'suave' }, '(opcionais)')), limpar),
        filtros),
      h('div', { class: 'sort-acao' }, botao, aviso));

    function atualizar() {
      if (noCatalogo) {
        const n = filtrarCatalogo().length;
        aviso.textContent = n ? `${n} ${n === 1 ? 'título possível' : 'títulos possíveis'} com esses filtros.` : 'Nenhum título com esses filtros.';
        botao.disabled = ocupado || n === 0;
      } else {
        aviso.textContent = gostos.length ? textoGostos() : 'Vamos buscar no TMDB títulos novos que ainda não estão no catálogo.';
        botao.disabled = ocupado;
      }
    }
    atualizar();
    if (!noCatalogo && !generosTmdb.length && !desenhar.pedido) { desenhar.pedido = true; carregarGenerosTmdb().finally(() => { desenhar.pedido = false; }); }

    async function rodar() {
      if (ocupado) return;
      ocupado = true; botao.disabled = true;
      resultado.hidden = false;
      montar(resultado, h('div', { class: 'sorteio-girando', role: 'status' }, h('span', { class: 'sorteio-dado girando' }, icone('dado', 64)), h('p', null, 'Sorteando…')));
      resultado.scrollIntoView({ behavior: reduzido() ? 'auto' : 'smooth', block: 'center' });
      try {
        let t, acoes;
        if (noCatalogo) {
          const lista = filtrarCatalogo();
          const candidatos = lista.length > 1 ? lista.filter((x) => x.id !== ultimoId) : lista;
          t = sortear(candidatos);
          acoes = [h('a', { class: 'btn-sec', href: '#/titulo/' + t.id }, 'Ver detalhes')];
          await pausa(reduzido() ? 0 : 1100);
        } else {
          const ass = assinatura();
          if (!fila.length || ass !== assinaturaFila) {
            const d = await chamar('sortear_tmdb', paramsTmdb());
            if (!ativa()) return;
            fila = d.resultados; gostos = d.gostos; personalizado = d.personalizado; assinaturaFila = ass;
            if (!generosTmdb.length) generosTmdb = d.generos_disponiveis;
          } else await pausa(reduzido() ? 0 : 900);
          if (!fila.length) { montar(resultado, h('p', { class: 'suave sorteio-nada' }, 'Não achamos nada novo com esses critérios. Tente afrouxar um filtro.')); return; }
          t = fila.shift();
          acoes = [adicionar(t)];
        }
        if (!ativa()) return;
        ultimoId = t.id || null;
        jaSorteou = true;
        revelar(t, acoes);
        botao.replaceChildren(icone('dado', 22), 'SORTEAR DE NOVO');
      } catch (e) {
        if (ativa()) montar(resultado, h('p', { class: 'erro', role: 'alert' }, e.message));
      } finally {
        ocupado = false;
        if (ativa()) atualizar();
      }
    }
  }

  const textoGostos = () => personalizado
    ? 'Baseado no que a comunidade mais curte: ' + gostos.join(', ') + '.'
    : (gostos.length ? 'Gênero escolhido: ' + gostos.join(', ') + '.' : 'Mostrando os mais populares.');

  function adicionar(t) {
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
    return add;
  }

  function revelar(t, acoes) {
    const url = seguro(t.capa_url);
    resultado.style.setProperty('--res-bg', url ? `url("${url}")` : 'none');
    montar(resultado,
      h('div', { class: 'sorteio-res-conteudo' },
        h('div', { class: 'palco' }, capa(t, true)),
        h('article', { class: 'sorteado entrou' },
          h('div', { class: 'linha-pills' },
            h('span', { class: 'pill-tipo fixo' }, rotuloCategoria(t)),
            t.ano ? h('span', { class: 'meta-chip' }, t.ano) : null,
            t.nota_tmdb ? h('span', { class: 'meta-chip' }, '★ ' + Number(t.nota_tmdb).toFixed(1)) : null),
          h('h2', null, t.nome),
          t.generos && t.generos.length ? h('div', { class: 'generos' }, t.generos.map((g) => h('span', { class: 'genero' }, g))) : null,
          t.sinopse ? h('p', { class: 'sinopse-curta' }, t.sinopse) : null,
          h('div', { class: 'acoes-linha' }, acoes))));
    confete(resultado);
  }

  desenhar();
}
