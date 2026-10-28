/* Cinema dos Amigos — front-end v2 */

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const IMG = 'https://image.tmdb.org/t/p/w342';
const IMG_GRANDE = 'https://image.tmdb.org/t/p/w1280';
const TMDB = 'https://api.themoviedb.org/3';
const COR_PADRAO = '#E6B85C';
const CORES = ['#E6B85C', '#FF6B81', '#4FD18B', '#5DA9FF', '#B38CFF', '#FF9A4D', '#4FD6D6', '#F1F1F4'];

const hexOk = (c) => /^#[0-9a-fA-F]{6}$/.test(String(c || ''));
const pathOk = (p) => /^\/[\w.\-]+$/.test(String(p || ''));
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem storage */ } };
const ler = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const apagar = (k) => { try { localStorage.removeItem(k); } catch (e) { /* sem storage */ } };

let DATA = { usuarios: [], admins: [], filmes: [], status: [] };
let ME = null; // { nome, pin }
try { ME = JSON.parse(ler('me') || 'null'); } catch (e) { ME = null; }

let filtroTipo = '';
let filtroGenero = '';
let filtroBusca = '';
let filtroStatus = '';
let sugerirTipo = 'filme';
let perfilAba = 'vi';
let destaqueId = null;

/* ---------- Utilidades ---------- */

function toast(msg, erro = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (erro ? ' erro-t' : '');
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 3200);
}

// Cada pessoa escolhe a sua cor de destaque; o fundo é sempre o mesmo.
function aplicarCor(cor) {
  if (!hexOk(cor)) cor = COR_PADRAO;
  const r = parseInt(cor.slice(1, 3), 16);
  const g = parseInt(cor.slice(3, 5), 16);
  const b = parseInt(cor.slice(5, 7), 16);
  const claro = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
  const css = document.documentElement.style;
  css.setProperty('--destaque', cor);
  css.setProperty('--sobre-destaque', claro ? '#101116' : '#ffffff');
  guardar('cor', cor);
}

async function carregar() {
  const r = await fetch(CONFIG.API_URL);
  const j = await r.json();
  if (!j.filmes) throw new Error('Resposta inesperada do servidor.');
  DATA = j;
}

async function enviar(action, payload = {}) {
  const r = await fetch(CONFIG.API_URL, {
    method: 'POST',
    // text/plain evita o "preflight" de CORS, que o Apps Script não suporta
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, nome: ME?.nome, pin: ME?.pin, ...payload }),
  });
  const j = await r.json();
  if (j.erro) {
    if (/PIN incorretos/.test(j.erro) && ME && action !== 'login' && action !== 'cadastrar') {
      sair(true);
      throw new Error('Seu PIN foi alterado. Entre novamente.');
    }
    throw new Error(j.erro);
  }
  return j;
}

async function tmdb(caminho, params = {}) {
  const qs = new URLSearchParams({ api_key: CONFIG.TMDB_KEY, language: 'pt-BR', ...params });
  const r = await fetch(`${TMDB}${caminho}?${qs}`);
  if (!r.ok) throw new Error('Erro ao consultar o TMDB. Confira a chave no config.js.');
  return r.json();
}

const ehAdmin = () => !!ME && (DATA.admins || []).some((n) => String(n).toLowerCase() === ME.nome.toLowerCase());
const ehSerie = (f) => f.tipo === 'serie';
const statusDe = (usuario, id) =>
  DATA.status.find((s) => s.usuario === usuario && String(s.tmdb_id) === String(id));
const filmePorId = (id) => DATA.filmes.find((f) => String(f.tmdb_id) === String(id));
const generosDe = (f) => String(f.generos || '').split(', ').filter(Boolean);
const usuarioPorNome = (n) => DATA.usuarios.find((u) => u.nome === n);
const corDe = (u) => (u && hexOk(u.cor) ? u.cor : COR_PADRAO);

function notasDe(id) {
  return DATA.status
    .filter((s) => String(s.tmdb_id) === String(id) && s.status === 'vi' && s.nota !== '' && s.nota != null && !isNaN(Number(s.nota)))
    .map((s) => Number(s.nota));
}
function mediaGrupo(id) {
  const n = notasDe(id);
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null;
}

function rotuloStatus(s) {
  if (s.status === 'vi') return '✓ Vi' + (s.nota !== '' && s.nota != null ? ' · ' + s.nota : '');
  if (s.status === 'assistindo') return '▶ Assistindo';
  return '★ Quero ver';
}

function posterHtml(f) {
  return pathOk(f.poster)
    ? `<img src="${IMG}${esc(f.poster)}" alt="Pôster de ${esc(f.titulo)}" loading="lazy">`
    : '<div class="sem-poster">🎞️</div>';
}

function cardFilme(f, s = statusDe(ME.nome, f.tmdb_id)) {
  const media = mediaGrupo(f.tmdb_id);
  const selo = s ? `<span class="selo ${esc(s.status)}">${esc(rotuloStatus(s))}</span>` : '';
  const generos = generosDe(f).slice(0, 2).join(', ');
  return `
    <div class="filme" data-filme="${esc(f.tmdb_id)}" tabindex="0" role="button" aria-label="${esc(f.titulo)}">
      <div class="capa">
        ${posterHtml(f)}
        ${ehSerie(f) ? '<span class="tag-tipo">Série</span>' : ''}
        ${media !== null ? `<span class="nota-grupo">★ ${media.toFixed(1)}</span>` : ''}
      </div>
      <div class="info">
        <div class="titulo">${esc(f.titulo)}</div>
        <div class="meta">${esc(f.ano)}${generos ? ' · ' + esc(generos) : ''}</div>
        ${selo}
      </div>
    </div>`;
}

function mostrarLogin() {
  $('#layout').hidden = true;
  $('#login-area').hidden = false;
}
function mostrarApp() {
  $('#login-area').hidden = true;
  $('#layout').hidden = false;
}

function atualizarTopo() {
  const u = usuarioPorNome(ME.nome);
  $('#chip-usuario').innerHTML =
    `<span class="mini-avatar">${esc(u?.avatar || '🎬')}</span><span class="nome-usuario">${esc(ME.nome)}</span>`;
  $('#nav-admin').hidden = !ehAdmin();
}

function sair(expirou) {
  apagar('me');
  ME = null;
  fecharModal();
  telaLogin();
  if (expirou) toast('Seu PIN foi alterado. Entre novamente.', true);
}

/* ---------- Login ---------- */

function telaLogin(modo = 'entrar') {
  mostrarLogin();
  $('#login-area').innerHTML = `
    <form class="caixa login" id="form-login">
      <h1>🎬 Cinema dos Amigos</h1>
      <div class="abas-pill">
        <button type="button" class="chip ${modo === 'entrar' ? 'ativo' : ''}" data-modo="entrar">Entrar</button>
        <button type="button" class="chip ${modo === 'cadastrar' ? 'ativo' : ''}" data-modo="cadastrar">Criar conta</button>
      </div>
      <input name="nome" placeholder="Seu nome" required autocomplete="username" maxlength="30">
      <input name="pin" type="password" inputmode="numeric" placeholder="PIN (só números, mín. 4)" required autocomplete="current-password">
      ${modo === 'cadastrar' ? '<input name="convite" placeholder="Código de convite" required>' : ''}
      <div class="erro" id="erro-login"></div>
      <button class="principal" type="submit">${modo === 'entrar' ? 'Entrar' : 'Criar conta'}</button>
    </form>`;

  $('#form-login').addEventListener('click', (e) => {
    const b = e.target.closest('[data-modo]');
    if (b) telaLogin(b.dataset.modo);
  });

  $('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    $('#erro-login').textContent = '';
    try {
      ME = { nome: f.nome.trim(), pin: f.pin.trim() };
      if (modo === 'cadastrar') await enviar('cadastrar', { convite: f.convite.trim() });
      const r = await enviar('login');
      ME.nome = r.nome;
      guardar('me', JSON.stringify(ME));
      await iniciar();
    } catch (err) {
      ME = null;
      $('#erro-login').textContent = err.message;
      btn.disabled = false;
    }
  });
}

/* ---------- Início ---------- */

function fila(titulo, itens, vazio, link) {
  return `
    <section class="secao">
      <div class="secao-topo"><h2>${titulo}</h2>${link ? `<a href="${link}">Ver todos →</a>` : ''}</div>
      ${itens.length ? `<div class="fila">${itens.map((f) => cardFilme(f)).join('')}</div>` : `<p class="vazio">${vazio}</p>`}
    </section>`;
}

function viewInicio() {
  const recentes = DATA.filmes.slice().reverse();
  if (!recentes.length) {
    $('#app').innerHTML = `
      <div class="caixa boas-vindas">
        <div class="grande">🍿</div>
        <h1>O catálogo ainda está vazio</h1>
        <p class="vazio">Seja o primeiro a sugerir um filme ou uma série para o grupo.</p>
        <p><a href="#/sugerir"><button class="principal" type="button">Sugerir o primeiro</button></a></p>
      </div>`;
    return;
  }

  if (!destaqueId || !filmePorId(destaqueId)) {
    const pool = recentes.slice(0, 6);
    destaqueId = pool[Math.floor(Math.random() * pool.length)].tmdb_id;
  }
  const d = filmePorId(destaqueId);
  const media = mediaGrupo(d.tmdb_id);
  const meu = statusDe(ME.nome, d.tmdb_id);
  const comFundo = pathOk(d.backdrop);
  const fundo = comFundo ? `${IMG_GRANDE}${d.backdrop}` : pathOk(d.poster) ? `${IMG}${d.poster}` : '';
  const quem = usuarioPorNome(d.sugerido_por);
  const meta = [
    media !== null ? `<span class="estrela">★ ${media.toFixed(1)}</span>` : '',
    d.ano ? `<span>${esc(d.ano)}</span>` : '',
    ehSerie(d) ? `<span>Série${d.temporadas ? ' · ' + esc(d.temporadas) + (Number(d.temporadas) === 1 ? ' temporada' : ' temporadas') : ''}</span>` : '<span>Filme</span>',
    generosDe(d).length ? `<span>${esc(generosDe(d).slice(0, 3).join(' · '))}</span>` : '',
  ].join('');

  const meus = DATA.status.filter((s) => s.usuario === ME.nome);
  const naLista = meus.filter((s) => s.status === 'assistindo' || s.status === 'quero').map((s) => filmePorId(s.tmdb_id)).filter(Boolean);
  const melhores = recentes
    .filter((f) => mediaGrupo(f.tmdb_id) !== null)
    .sort((a, b) => mediaGrupo(b.tmdb_id) - mediaGrupo(a.tmdb_id))
    .slice(0, 14);
  const naoMarcados = recentes.filter((f) => !statusDe(ME.nome, f.tmdb_id)).slice(0, 14);

  $('#app').innerHTML = `
    <section class="hero ${comFundo ? '' : 'sem-fundo'}" ${fundo ? `style="--bg-img:url('${esc(fundo)}')"` : ''}>
      <div class="hero-conteudo">
        <div class="hero-rotulo">EM DESTAQUE${quem ? ` · SUGERIDO POR ${esc(String(d.sugerido_por).toUpperCase())}` : ''}</div>
        <h1>${esc(d.titulo)}</h1>
        <div class="hero-meta">${meta}</div>
        <p class="sin">${esc(d.sinopse) || 'Sem sinopse.'}</p>
        <div class="hero-acoes">
          <button class="principal" type="button" data-filme="${esc(d.tmdb_id)}">Ver detalhes</button>
          ${meu ? `<span class="selo ${esc(meu.status)}" style="align-self:center">${esc(rotuloStatus(meu))}</span>`
            : `<button type="button" data-rapido="${esc(d.tmdb_id)}">＋ Quero ver</button>`}
        </div>
      </div>
    </section>
    ${fila('Adicionados recentemente', recentes.slice(0, 14), '', '#/catalogo')}
    ${melhores.length ? fila('Mais bem avaliados pelo grupo', melhores, '') : ''}
    ${naLista.length ? fila('Na sua lista', naLista.slice(0, 14), '') : ''}
    ${naoMarcados.length ? fila('Você ainda não marcou', naoMarcados, '') : ''}`;
}

async function rapido(id, btn) {
  btn.disabled = true;
  try {
    await enviar('status', { tmdb_id: id, status: 'quero', nota: '', comentario: '' });
    await carregar();
    toast('Adicionado à sua lista!');
    rota(true);
  } catch (err) {
    toast(err.message, true);
    btn.disabled = false;
  }
}

/* ---------- Catálogo ---------- */

function viewCatalogo() {
  const todosGeneros = [...new Set(DATA.filmes.flatMap(generosDe))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const tipos = [['', 'Tudo'], ['filme', 'Filmes'], ['serie', 'Séries']];
  $('#app').innerHTML = `
    <div class="titulo-pagina"><h1>Catálogo</h1><span class="contagem" id="contagem"></span></div>
    <div class="filtros">
      <div class="abas-pill" id="tipos">
        ${tipos.map(([v, t]) => `<button class="chip ${filtroTipo === v ? 'ativo' : ''}" data-tipo="${v}">${t}</button>`).join('')}
      </div>
      <select id="f-status" aria-label="Filtrar por minha marcação">
        <option value="">Todas as marcações</option>
        <option value="vi" ${filtroStatus === 'vi' ? 'selected' : ''}>Que eu vi</option>
        <option value="assistindo" ${filtroStatus === 'assistindo' ? 'selected' : ''}>Que estou assistindo</option>
        <option value="quero" ${filtroStatus === 'quero' ? 'selected' : ''}>Que quero ver</option>
        <option value="nada" ${filtroStatus === 'nada' ? 'selected' : ''}>Que ainda não marquei</option>
      </select>
    </div>
    <div class="filtros" id="chips">
      <button class="chip ${filtroGenero === '' ? 'ativo' : ''}" data-genero="">Todos os gêneros</button>
      ${todosGeneros.map((g) => `<button class="chip ${filtroGenero === g ? 'ativo' : ''}" data-genero="${esc(g)}">${esc(g)}</button>`).join('')}
    </div>
    <div class="grade" id="grade"></div>`;

  $('#tipos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tipo]');
    if (!b) return;
    filtroTipo = b.dataset.tipo;
    viewCatalogo();
  });
  $('#f-status').addEventListener('change', (e) => { filtroStatus = e.target.value; desenharGrade(); });
  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-genero]');
    if (!b) return;
    filtroGenero = b.dataset.genero;
    viewCatalogo();
  });
  desenharGrade();
}

function desenharGrade() {
  const grade = $('#grade');
  if (!grade) return;
  const q = filtroBusca.trim().toLowerCase();
  const lista = DATA.filmes
    .filter((f) => !q || String(f.titulo).toLowerCase().includes(q))
    .filter((f) => !filtroTipo || (filtroTipo === 'serie') === ehSerie(f))
    .filter((f) => !filtroGenero || generosDe(f).includes(filtroGenero))
    .filter((f) => {
      if (!filtroStatus) return true;
      const s = statusDe(ME.nome, f.tmdb_id);
      if (filtroStatus === 'nada') return !s;
      return s && s.status === filtroStatus;
    })
    .reverse();

  $('#contagem').textContent = `${lista.length} ${lista.length === 1 ? 'título' : 'títulos'}`;
  grade.innerHTML = lista.length
    ? lista.map((f) => cardFilme(f)).join('')
    : '<p class="aviso" style="grid-column:1/-1">Nada por aqui. Que tal <a href="#/sugerir"><u>sugerir um título</u></a>?</p>';
}

/* ---------- Modal do título ---------- */

function abrirFilme(id) {
  const f = filmePorId(id);
  if (!f) return;
  const meu = statusDe(ME.nome, id);
  const outros = DATA.status.filter((s) => String(s.tmdb_id) === String(id) && s.usuario !== ME.nome);
  const media = mediaGrupo(id);
  const serie = ehSerie(f);
  const tipoTxt = serie ? `Série${f.temporadas ? ' · ' + f.temporadas + (Number(f.temporadas) === 1 ? ' temporada' : ' temporadas') : ''}` : 'Filme';

  $('#modal-conteudo').innerHTML = `
    <button class="fechar" data-fechar aria-label="Fechar">×</button>
    <div class="detalhe">
      ${posterHtml(f)}
      <div class="corpo">
        <h2>${esc(f.titulo)} <small class="suave">(${esc(f.ano)})</small></h2>
        <p class="suave">${esc(tipoTxt)}${f.generos ? ' · ' + esc(f.generos) : ''}</p>
        ${media !== null ? `<p><b style="color:var(--destaque)">★ ${media.toFixed(1)}</b> <span class="suave">média do grupo (${notasDe(id).length} ${notasDe(id).length === 1 ? 'nota' : 'notas'})</span></p>` : ''}
        <p>${esc(f.sinopse) || 'Sem sinopse.'}</p>
        <p class="suave" style="font-size:.85rem">Sugerido por <a href="#/perfil/${encodeURIComponent(f.sugerido_por)}" data-fechar><u>${esc(f.sugerido_por)}</u></a></p>
      </div>
    </div>

    <h3 style="margin-top:1.1rem">Sua marcação</h3>
    <div class="form-vi" data-filme-id="${esc(id)}">
      <div class="linha">
        <label for="nota">Nota (0–10):</label>
        <input type="number" id="nota" min="0" max="10" step="0.5" value="${meu && meu.status === 'vi' ? esc(meu.nota) : ''}">
      </div>
      <textarea id="comentario" rows="2" placeholder="Comentário (opcional)">${meu ? esc(meu.comentario) : ''}</textarea>
      <div class="acoes">
        <button data-marcar="vi" class="${meu?.status === 'vi' ? 'ativo' : ''}">✓ Já vi</button>
        ${serie ? `<button data-marcar="assistindo" class="${meu?.status === 'assistindo' ? 'ativo' : ''}">▶ Assistindo</button>` : ''}
        <button data-marcar="quero" class="${meu?.status === 'quero' ? 'ativo' : ''}">★ Quero ver</button>
        ${meu ? '<button data-marcar="remover" class="link">Remover marcação</button>' : ''}
      </div>
    </div>

    <h3>Os amigos</h3>
    ${outros.length ? outros.map((s) => `
      <div class="amigo-status">
        <a href="#/perfil/${encodeURIComponent(s.usuario)}" data-fechar><b>${esc(s.usuario)}</b></a>
        ${s.status === 'vi' ? `viu${s.nota !== '' && s.nota != null ? ' e deu nota <b>' + esc(s.nota) + '</b>' : ''}` : s.status === 'assistindo' ? 'está assistindo' : 'quer ver'}
        ${s.comentario ? `<div class="com suave">“${esc(s.comentario)}”</div>` : ''}
      </div>`).join('') : '<p class="vazio">Ninguém marcou ainda.</p>'}
    ${ehAdmin() ? `<div style="margin-top:1.2rem"><button class="perigo" data-admin-remover="${esc(id)}">🗑 Remover do catálogo</button></div>` : ''}
  `;
  $('#modal').hidden = false;
}

function fecharModal() { $('#modal').hidden = true; }

async function marcar(id, status) {
  const btns = document.querySelectorAll('#modal button');
  btns.forEach((b) => (b.disabled = true));
  try {
    await enviar('status', {
      tmdb_id: id,
      status,
      nota: $('#nota')?.value ?? '',
      comentario: $('#comentario')?.value ?? '',
    });
    await carregar();
    toast('Salvo!');
    abrirFilme(id);
    rota(true);
  } catch (err) {
    toast(err.message, true);
    btns.forEach((b) => (b.disabled = false));
  }
}

async function removerDoCatalogo(id) {
  const f = filmePorId(id);
  if (!confirm(`Remover "${f?.titulo || 'este título'}" do catálogo? As marcações dos amigos nele também serão apagadas.`)) return;
  try {
    await enviar('admin_remover', { tmdb_id: id });
    await carregar();
    fecharModal();
    toast('Removido do catálogo.');
    rota(true);
  } catch (err) { toast(err.message, true); }
}

/* ---------- Sugerir ---------- */

function viewSugerir() {
  const serie = sugerirTipo === 'serie';
  $('#app').innerHTML = `
    <h1>Sugerir ${serie ? 'uma série' : 'um filme'}</h1>
    <p class="suave">Busque pelo nome. Pôster, sinopse e gêneros vêm automaticamente do TMDB.</p>
    <div class="abas-pill" id="tipos-sug" style="margin-bottom:.9rem">
      <button class="chip ${!serie ? 'ativo' : ''}" data-tipo="filme">🎬 Filme</button>
      <button class="chip ${serie ? 'ativo' : ''}" data-tipo="serie">📺 Série</button>
    </div>
    <form class="filtros" id="form-busca">
      <input type="search" id="q" placeholder="${serie ? 'Ex.: Dark' : 'Ex.: Interestelar'}" required style="flex:1">
      <button class="principal" type="submit">Buscar</button>
    </form>
    <div class="resultados" id="resultados"></div>`;

  $('#tipos-sug').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tipo]');
    if (!b) return;
    sugerirTipo = b.dataset.tipo;
    viewSugerir();
  });

  $('#form-busca').addEventListener('submit', async (e) => {
    e.preventDefault();
    const box = $('#resultados');
    box.innerHTML = '<p class="aviso">Buscando…</p>';
    try {
      const r = await tmdb(serie ? '/search/tv' : '/search/movie', { query: $('#q').value.trim() });
      box.innerHTML = r.results.length
        ? r.results.slice(0, 10).map((m) => resultadoHtml(m, serie)).join('')
        : '<p class="aviso">Nada encontrado.</p>';
    } catch (err) {
      box.innerHTML = `<p class="erro">${esc(err.message)}</p>`;
    }
  });

  $('#resultados').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    b.disabled = true;
    b.textContent = 'Adicionando…';
    try {
      const d = await tmdb(`/${serie ? 'tv' : 'movie'}/${b.dataset.add}`);
      await enviar('filme', {
        filme: {
          tipo: serie ? 'serie' : 'filme',
          tmdb_id: serie ? 'tv' + d.id : d.id,
          titulo: d.title || d.name,
          ano: (d.release_date || d.first_air_date || '').slice(0, 4),
          generos: (d.genres || []).map((g) => g.name).join(', '),
          poster: d.poster_path || '',
          backdrop: d.backdrop_path || '',
          sinopse: d.overview || '',
          temporadas: serie ? d.number_of_seasons || '' : '',
        },
      });
      await carregar();
      toast(serie ? 'Série adicionada ao catálogo!' : 'Filme adicionado ao catálogo!');
      b.textContent = '✓ Adicionado';
    } catch (err) {
      toast(err.message, true);
      b.disabled = false;
      b.textContent = 'Adicionar';
    }
  });
}

function resultadoHtml(m, serie) {
  const titulo = m.title || m.name || '';
  const ano = (m.release_date || m.first_air_date || '').slice(0, 4);
  const jaTem = !!filmePorId(serie ? 'tv' + m.id : m.id);
  return `
    <div class="resultado">
      ${pathOk(m.poster_path) ? `<img src="${IMG}${esc(m.poster_path)}" alt="">` : '<div class="sem-poster">🎞️</div>'}
      <div class="txt">
        <b>${esc(titulo)}</b> <small class="suave">${esc(ano)}</small>
        <div class="sin">${esc(m.overview) || 'Sem sinopse.'}</div>
      </div>
      ${jaTem ? '<span class="selo">Já no catálogo</span>' : `<button class="principal" data-add="${esc(m.id)}">Adicionar</button>`}
    </div>`;
}

/* ---------- Amigos e perfis ---------- */

function contagemDe(nome, status) {
  return DATA.status.filter((s) => s.usuario === nome && s.status === status).length;
}

function viewAmigos() {
  $('#app').innerHTML = `
    <h1>Amigos</h1>
    <div class="amigos">
      ${DATA.usuarios.map((u) => `
        <a class="amigo" style="--perfil:${corDe(u)}" href="#/perfil/${encodeURIComponent(u.nome)}">
          <div class="avatar">${esc(u.avatar || '🎬')}</div>
          <div><b>${esc(u.nome)}</b><br><small>${contagemDe(u.nome, 'vi')} vistos · ${contagemDe(u.nome, 'quero')} na lista</small></div>
        </a>`).join('')}
    </div>`;
}

function viewPerfil(nome) {
  const u = DATA.usuarios.find((x) => x.nome === nome);
  if (!u) { $('#app').innerHTML = '<p class="aviso">Usuário não encontrado.</p>'; return; }
  const meuPerfil = u.nome === ME.nome;
  const meus = DATA.status.filter((s) => s.usuario === u.nome);
  const notas = meus.filter((s) => s.status === 'vi' && s.nota !== '' && s.nota != null).map((s) => Number(s.nota));
  const mediaDada = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : '–';
  const sugeridos = DATA.filmes.filter((f) => f.sugerido_por === u.nome);

  const abas = [
    ['vi', 'Já viu', contagemDe(u.nome, 'vi')],
    ['assistindo', 'Assistindo', contagemDe(u.nome, 'assistindo')],
    ['quero', 'Quer ver', contagemDe(u.nome, 'quero')],
    ['sugeriu', 'Sugeriu', sugeridos.length],
  ];
  if (!abas.some(([k]) => k === perfilAba)) perfilAba = 'vi';

  $('#app').innerHTML = `
    <div class="perfil-capa" style="--perfil:${corDe(u)}">
      <div class="avatar">${esc(u.avatar || '🎬')}</div>
      <div class="perfil-info">
        <h1>${esc(u.nome)}</h1>
        <div class="suave">${esc(u.bio) || (meuPerfil ? 'Escreva algo sobre você!' : 'Sem bio ainda.')}</div>
        ${meuPerfil ? '<button class="link" id="editar" type="button" style="padding-left:0">✏️ Editar perfil</button>' : ''}
        <div class="stats">
          <div class="stat"><b>${contagemDe(u.nome, 'vi')}</b><span>vistos</span></div>
          <div class="stat"><b>${contagemDe(u.nome, 'quero') + contagemDe(u.nome, 'assistindo')}</b><span>na lista</span></div>
          <div class="stat"><b>${sugeridos.length}</b><span>sugestões</span></div>
          <div class="stat"><b>${mediaDada}</b><span>nota média</span></div>
        </div>
      </div>
    </div>
    <div id="editor"></div>
    <div class="abas" id="abas" style="--perfil:${corDe(u)}">
      ${abas.map(([k, t, n]) => `<button class="aba ${perfilAba === k ? 'ativo' : ''}" data-aba="${k}">${t} (${n})</button>`).join('')}
    </div>
    <div id="perfil-lista"></div>`;

  const desenhar = () => {
    let itens;
    if (perfilAba === 'sugeriu') itens = sugeridos.slice().reverse().map((f) => cardFilme(f, null));
    else {
      itens = meus.filter((s) => s.status === perfilAba).reverse()
        .map((s) => { const f = filmePorId(s.tmdb_id); return f ? cardFilme(f, s) : ''; });
    }
    $('#perfil-lista').innerHTML = itens.length
      ? `<div class="grade">${itens.join('')}</div>`
      : '<p class="vazio">Nada por aqui ainda.</p>';
  };
  desenhar();

  $('#abas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-aba]');
    if (!b) return;
    perfilAba = b.dataset.aba;
    document.querySelectorAll('#abas .aba').forEach((x) => x.classList.toggle('ativo', x === b));
    desenhar();
  });

  if (meuPerfil) $('#editar').addEventListener('click', () => abrirEditor(u));
}

function abrirEditor(u) {
  const atual = corDe(u);
  const original = atual;
  $('#editor').innerHTML = `
    <form class="caixa editor" id="form-perfil">
      <label for="f-avatar">Avatar (um emoji)</label>
      <input id="f-avatar" name="avatar" maxlength="4" value="${esc(u.avatar || '🎬')}" style="width:90px">
      <label for="f-bio">Bio</label>
      <textarea id="f-bio" name="bio" rows="2" maxlength="300">${esc(u.bio)}</textarea>
      <label>Sua cor de destaque <span class="suave">(só muda o seu visual e o seu perfil)</span></label>
      <div class="cores" id="cores">
        ${CORES.map((c) => `<button type="button" class="cor-bolinha ${c.toLowerCase() === atual.toLowerCase() ? 'sel' : ''}" data-cor="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('')}
        <input type="color" id="cor-livre" value="${atual}" aria-label="Escolher outra cor">
      </div>
      <input type="hidden" name="cor" value="${atual}">
      <div class="acoes">
        <button class="principal" type="submit">Salvar</button>
        <button type="button" id="cancelar">Cancelar</button>
      </div>
    </form>`;

  const form = $('#form-perfil');
  const escolher = (c) => {
    form.elements.cor.value = c;
    $('#cor-livre').value = c;
    document.querySelectorAll('.cor-bolinha').forEach((b) => b.classList.toggle('sel', b.dataset.cor.toLowerCase() === c.toLowerCase()));
    aplicarCor(c); // prévia ao vivo
  };
  $('#cores').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cor]');
    if (b) escolher(b.dataset.cor);
  });
  $('#cor-livre').addEventListener('input', (e) => escolher(e.target.value));
  $('#cancelar').addEventListener('click', () => { aplicarCor(original); $('#editor').innerHTML = ''; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    try {
      await enviar('perfil', { avatar: f.avatar, bio: f.bio, cor: f.cor });
      await carregar();
      aplicarCor(f.cor);
      atualizarTopo();
      toast('Perfil atualizado!');
      viewPerfil(u.nome);
    } catch (err) { toast(err.message, true); }
  });
}

/* ---------- Admin ---------- */

async function viewAdmin() {
  if (!ehAdmin()) { $('#app').innerHTML = '<p class="aviso">Área restrita aos administradores.</p>'; return; }
  $('#app').innerHTML = '<p class="aviso">Carregando…</p>';
  let info;
  try { info = await enviar('admin_info'); } catch (err) { $('#app').innerHTML = `<p class="aviso">${esc(err.message)}</p>`; return; }

  $('#app').innerHTML = `
    <h1>Administração</h1>
    <p class="suave">Tudo aqui também pode ser feito direto na planilha (aba <b>Config</b>). Para adicionar outro administrador, escreva o nome dele em “Administradores” na aba Config.</p>
    <div class="admin-grade">
      <section class="caixa">
        <h2>Código de convite</h2>
        <p class="suave">Quem for criar conta precisa digitar este código.</p>
        <form class="linha-form" id="form-codigo">
          <input name="codigo" value="${esc(info.codigo)}" required minlength="3" aria-label="Código de convite">
          <button class="principal" type="submit">Salvar</button>
        </form>
      </section>
      <section class="caixa">
        <h2>Usuários</h2>
        <p class="suave">Esqueceram o PIN? Defina um novo e avise a pessoa.</p>
        ${info.usuarios.map((n) => `
          <div class="linha-usuario">
            <span>${esc(n)}</span>
            <button type="button" data-pin="${esc(n)}">Redefinir PIN</button>
          </div>`).join('')}
      </section>
    </div>`;

  $('#form-codigo').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await enviar('admin_codigo', { codigo: new FormData(e.target).get('codigo') });
      toast('Código atualizado!');
    } catch (err) { toast(err.message, true); }
  });

  $('#app').querySelectorAll('[data-pin]').forEach((b) => b.addEventListener('click', async () => {
    const alvo = b.dataset.pin;
    const novo = prompt(`Novo PIN para ${alvo} (só números, mínimo 4):`);
    if (!novo) return;
    try {
      await enviar('admin_pin', { usuario: alvo, novo_pin: novo.trim() });
      if (alvo.toLowerCase() === ME.nome.toLowerCase()) {
        ME.pin = novo.trim();
        guardar('me', JSON.stringify(ME));
      }
      toast(`PIN de ${alvo} redefinido.`);
    } catch (err) { toast(err.message, true); }
  }));
}

/* ---------- Rotas ---------- */

function rota(manterScroll) {
  if (!ME) return;
  const partes = (location.hash || '#/inicio').replace(/^#\/?/, '').split('/');
  const pagina = partes[0] || 'inicio';
  let arg = '';
  try { arg = decodeURIComponent(partes.slice(1).join('/')); } catch (e) { arg = ''; }

  const ativo = pagina === 'perfil' && arg && arg !== ME.nome ? 'amigos' : pagina;
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('ativo', a.dataset.nav === ativo));

  if (pagina === 'catalogo') viewCatalogo();
  else if (pagina === 'sugerir') viewSugerir();
  else if (pagina === 'amigos') viewAmigos();
  else if (pagina === 'perfil') viewPerfil(arg || ME.nome);
  else if (pagina === 'admin') viewAdmin();
  else viewInicio();
  if (manterScroll !== true) window.scrollTo(0, 0);
}

/* ---------- Início do app ---------- */

async function iniciar() {
  if (!ME) return telaLogin();
  mostrarApp();
  if (CONFIG.API_URL.startsWith('COLE_AQUI')) {
    $('#app').innerHTML = '<p class="aviso">Falta configurar o <b>config.js</b>. Siga o passo a passo do README.md.</p>';
    return;
  }
  $('#app').innerHTML = '<p class="aviso">Carregando…</p>';
  try {
    await carregar();
  } catch (err) {
    $('#app').innerHTML = '<p class="aviso">Não consegui carregar os dados. Confira a URL do Apps Script no config.js.</p>';
    return;
  }
  const eu = DATA.usuarios.find((u) => String(u.nome).toLowerCase() === ME.nome.toLowerCase());
  if (!eu) { sair(); return; }
  ME.nome = eu.nome;
  aplicarCor(eu.cor);
  atualizarTopo();
  rota();
}

document.addEventListener('click', (e) => {
  const q = e.target.closest('[data-rapido]');
  if (q) return rapido(q.dataset.rapido, q);

  const m = e.target.closest('[data-marcar]');
  if (m) return marcar(m.closest('[data-filme-id]').dataset.filmeId, m.dataset.marcar);

  const r = e.target.closest('[data-admin-remover]');
  if (r) return removerDoCatalogo(r.dataset.adminRemover);

  const card = e.target.closest('[data-filme]');
  if (card) return abrirFilme(card.dataset.filme);

  if (e.target.closest('[data-fechar]') || e.target.id === 'modal') fecharModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fecharModal();
  if (e.key === 'Enter' && e.target.matches?.('.filme[data-filme]')) abrirFilme(e.target.dataset.filme);
});

window.addEventListener('hashchange', () => { fecharModal(); rota(); });

$('#sair').addEventListener('click', () => sair());

$('#busca-global').addEventListener('input', (e) => {
  filtroBusca = e.target.value;
  if ((location.hash || '').startsWith('#/catalogo')) desenharGrade();
  else location.hash = '#/catalogo';
});

// Pinta a cor da última sessão já no primeiro frame, antes de carregar os dados
aplicarCor(ler('cor'));
iniciar();
