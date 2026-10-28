/* Cinema dos Amigos — front-end */

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const IMG = 'https://image.tmdb.org/t/p/w342';
const TMDB = 'https://api.themoviedb.org/3';

let DATA = { usuarios: [], filmes: [], status: [] };
let ME = JSON.parse(localStorage.getItem('me') || 'null'); // { nome, pin }
let filtroGenero = '';
let filtroBusca = '';
let filtroStatus = '';

/* ---------- Utilidades ---------- */

function toast(msg, erro = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (erro ? ' erro-t' : '');
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 3000);
}

async function carregar() {
  const r = await fetch(CONFIG.API_URL);
  DATA = await r.json();
}

async function enviar(action, payload = {}) {
  const r = await fetch(CONFIG.API_URL, {
    method: 'POST',
    // text/plain evita o "preflight" de CORS, que o Apps Script não suporta
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, nome: ME?.nome, pin: ME?.pin, ...payload }),
  });
  const j = await r.json();
  if (j.erro) throw new Error(j.erro);
  return j;
}

async function tmdb(caminho, params = {}) {
  const qs = new URLSearchParams({ api_key: CONFIG.TMDB_KEY, language: 'pt-BR', ...params });
  const r = await fetch(`${TMDB}${caminho}?${qs}`);
  if (!r.ok) throw new Error('Erro ao consultar o TMDB. Confira a chave no config.js.');
  return r.json();
}

const statusDe = (usuario, id) =>
  DATA.status.find((s) => s.usuario === usuario && String(s.tmdb_id) === String(id));
const filmePorId = (id) => DATA.filmes.find((f) => String(f.tmdb_id) === String(id));
const generosDe = (f) => String(f.generos || '').split(', ').filter(Boolean);

function posterHtml(f, classe = '') {
  return f.poster
    ? `<img class="${classe}" src="${IMG}${esc(f.poster)}" alt="Pôster de ${esc(f.titulo)}" loading="lazy">`
    : `<div class="sem-poster ${classe}">🎞️</div>`;
}

/* ---------- Login ---------- */

function telaLogin(modo = 'entrar') {
  $('#topo').hidden = true;
  $('#app').innerHTML = `
    <form class="caixa login" id="form-login">
      <h1>🎬 Cinema dos Amigos</h1>
      <div class="abas">
        <button type="button" class="chip ${modo === 'entrar' ? 'ativo' : ''}" data-modo="entrar">Entrar</button>
        <button type="button" class="chip ${modo === 'cadastrar' ? 'ativo' : ''}" data-modo="cadastrar">Criar conta</button>
      </div>
      <input name="nome" placeholder="Seu nome" required autocomplete="username">
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
      localStorage.setItem('me', JSON.stringify(ME));
      await iniciar();
    } catch (err) {
      ME = null;
      $('#erro-login').textContent = err.message;
      btn.disabled = false;
    }
  });
}

/* ---------- Catálogo ---------- */

function viewCatalogo() {
  const todosGeneros = [...new Set(DATA.filmes.flatMap(generosDe))].sort();
  $('#app').innerHTML = `
    <h1>Catálogo</h1>
    <div class="filtros">
      <input type="search" id="busca" placeholder="Buscar título…" value="${esc(filtroBusca)}">
      <select id="f-status">
        <option value="">Todos</option>
        <option value="vi" ${filtroStatus === 'vi' ? 'selected' : ''}>Que eu vi</option>
        <option value="quero" ${filtroStatus === 'quero' ? 'selected' : ''}>Que quero ver</option>
        <option value="nada" ${filtroStatus === 'nada' ? 'selected' : ''}>Que ainda não marquei</option>
      </select>
    </div>
    <div class="filtros" id="chips">
      <button class="chip ${filtroGenero === '' ? 'ativo' : ''}" data-genero="">Todos os gêneros</button>
      ${todosGeneros.map((g) => `<button class="chip ${filtroGenero === g ? 'ativo' : ''}" data-genero="${esc(g)}">${esc(g)}</button>`).join('')}
    </div>
    <div class="grade" id="grade"></div>`;

  $('#busca').addEventListener('input', (e) => { filtroBusca = e.target.value; desenharGrade(); });
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
  const q = filtroBusca.trim().toLowerCase();
  const lista = DATA.filmes
    .filter((f) => !q || String(f.titulo).toLowerCase().includes(q))
    .filter((f) => !filtroGenero || generosDe(f).includes(filtroGenero))
    .filter((f) => {
      const s = statusDe(ME.nome, f.tmdb_id);
      if (!filtroStatus) return true;
      if (filtroStatus === 'nada') return !s;
      return s && s.status === filtroStatus;
    })
    .reverse();

  $('#grade').innerHTML = lista.length
    ? lista.map(cardFilme).join('')
    : '<p class="aviso" style="grid-column:1/-1">Nenhum filme por aqui ainda. Que tal <a href="#/sugerir"><u>sugerir um</u></a>?</p>';
}

function cardFilme(f) {
  const s = statusDe(ME.nome, f.tmdb_id);
  const selo = s ? `<span class="selo ${s.status}">${s.status === 'vi' ? '✓ Vi' + (s.nota !== '' ? ' · ' + s.nota : '') : '★ Quero ver'}</span>` : '';
  return `
    <div class="filme" data-filme="${esc(f.tmdb_id)}">
      ${posterHtml(f)}
      <div class="info">
        <div class="titulo">${esc(f.titulo)}</div>
        <div class="meta">${esc(f.ano)} · ${esc(generosDe(f).slice(0, 2).join(', '))}</div>
        ${selo}
      </div>
    </div>`;
}

/* ---------- Modal do filme ---------- */

function abrirFilme(id) {
  const f = filmePorId(id);
  if (!f) return;
  const meu = statusDe(ME.nome, id);
  const outros = DATA.status.filter((s) => String(s.tmdb_id) === String(id) && s.usuario !== ME.nome);

  $('#modal-conteudo').innerHTML = `
    <button class="fechar" data-fechar aria-label="Fechar">×</button>
    <div class="detalhe">
      ${posterHtml(f)}
      <div class="corpo">
        <h2>${esc(f.titulo)} <small style="color:var(--suave)">(${esc(f.ano)})</small></h2>
        <p class="meta" style="color:var(--suave)">${esc(f.generos)}</p>
        <p>${esc(f.sinopse) || 'Sem sinopse.'}</p>
        <p style="color:var(--suave);font-size:.85rem">Sugerido por <a href="#/perfil/${encodeURIComponent(f.sugerido_por)}" data-fechar><u>${esc(f.sugerido_por)}</u></a></p>
      </div>
    </div>

    <h3 style="margin-top:1rem">Sua marcação</h3>
    <div class="form-vi" data-filme-id="${esc(id)}">
      <div class="linha">
        <label>Nota (0–10):</label>
        <input type="number" id="nota" min="0" max="10" step="0.5" value="${meu && meu.status === 'vi' ? esc(meu.nota) : ''}">
      </div>
      <textarea id="comentario" rows="2" placeholder="Comentário (opcional)">${meu ? esc(meu.comentario) : ''}</textarea>
      <div class="acoes">
        <button data-marcar="vi" class="${meu?.status === 'vi' ? 'ativo' : ''}">✓ Já vi</button>
        <button data-marcar="quero" class="${meu?.status === 'quero' ? 'ativo' : ''}">★ Quero ver</button>
        ${meu ? '<button data-marcar="remover" class="link">Remover marcação</button>' : ''}
      </div>
    </div>

    <h3>Os amigos</h3>
    ${outros.length ? outros.map((s) => `
      <div class="amigo-status">
        <a href="#/perfil/${encodeURIComponent(s.usuario)}" data-fechar><b>${esc(s.usuario)}</b></a>
        ${s.status === 'vi' ? `viu${s.nota !== '' ? ' e deu nota <b>' + esc(s.nota) + '</b>' : ''}` : 'quer ver'}
        ${s.comentario ? `<div class="com">“${esc(s.comentario)}”</div>` : ''}
      </div>`).join('') : '<p style="color:var(--suave)">Ninguém marcou ainda.</p>'}
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

/* ---------- Sugerir ---------- */

function viewSugerir() {
  $('#app').innerHTML = `
    <h1>Sugerir um filme</h1>
    <p style="color:var(--suave)">Busque pelo nome. Pôster, sinopse e gêneros vêm automaticamente do TMDB.</p>
    <form class="filtros" id="form-busca">
      <input type="search" id="q" placeholder="Ex.: Interestelar" required style="flex:1">
      <button class="principal" type="submit">Buscar</button>
    </form>
    <div class="resultados" id="resultados"></div>`;

  $('#form-busca').addEventListener('submit', async (e) => {
    e.preventDefault();
    const box = $('#resultados');
    box.innerHTML = '<p class="aviso">Buscando…</p>';
    try {
      const r = await tmdb('/search/movie', { query: $('#q').value.trim() });
      box.innerHTML = r.results.length
        ? r.results.slice(0, 10).map(resultadoHtml).join('')
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
      const d = await tmdb(`/movie/${b.dataset.add}`);
      await enviar('filme', {
        filme: {
          tmdb_id: d.id,
          titulo: d.title,
          ano: (d.release_date || '').slice(0, 4),
          generos: (d.genres || []).map((g) => g.name).join(', '),
          poster: d.poster_path || '',
          sinopse: d.overview || '',
        },
      });
      await carregar();
      toast('Filme adicionado ao catálogo!');
      b.textContent = '✓ Adicionado';
    } catch (err) {
      toast(err.message, true);
      b.disabled = false;
      b.textContent = 'Adicionar';
    }
  });
}

function resultadoHtml(m) {
  const jaTem = !!filmePorId(m.id);
  return `
    <div class="resultado">
      ${m.poster_path ? `<img src="${IMG}${esc(m.poster_path)}" alt="">` : '<div class="sem-poster">🎞️</div>'}
      <div class="txt">
        <b>${esc(m.title)}</b> <small style="color:var(--suave)">${esc((m.release_date || '').slice(0, 4))}</small>
        <div class="sin">${esc(m.overview) || 'Sem sinopse.'}</div>
      </div>
      ${jaTem ? '<span class="selo">Já no catálogo</span>' : `<button class="principal" data-add="${m.id}">Adicionar</button>`}
    </div>`;
}

/* ---------- Perfis ---------- */

function viewAmigos() {
  $('#app').innerHTML = `
    <h1>Amigos</h1>
    <div class="amigos">
      ${DATA.usuarios.map((u) => {
        const vi = DATA.status.filter((s) => s.usuario === u.nome && s.status === 'vi').length;
        const quero = DATA.status.filter((s) => s.usuario === u.nome && s.status === 'quero').length;
        return `
          <a class="amigo" href="#/perfil/${encodeURIComponent(u.nome)}">
            <div class="avatar">${esc(u.avatar || '🎬')}</div>
            <div><b>${esc(u.nome)}</b><br><small>${vi} vistos · ${quero} na lista</small></div>
          </a>`;
      }).join('')}
    </div>`;
}

function viewPerfil(nome) {
  const u = DATA.usuarios.find((x) => x.nome === nome);
  if (!u) { $('#app').innerHTML = '<p class="aviso">Usuário não encontrado.</p>'; return; }
  const meuPerfil = u.nome === ME.nome;
  const meus = DATA.status.filter((s) => s.usuario === u.nome);
  const vistos = meus.filter((s) => s.status === 'vi');
  const quero = meus.filter((s) => s.status === 'quero');
  const sugeridos = DATA.filmes.filter((f) => f.sugerido_por === u.nome);

  const lista = (itens, vazio) => itens.length
    ? `<div class="grade">${itens.map((s) => {
        const f = filmePorId(s.tmdb_id);
        return f ? cardFilmeSimples(f, s) : '';
      }).join('')}</div>`
    : `<p style="color:var(--suave)">${vazio}</p>`;

  $('#app').innerHTML = `
    <div class="perfil-topo">
      <div class="avatar">${esc(u.avatar || '🎬')}</div>
      <div>
        <h1 style="margin:0">${esc(u.nome)}</h1>
        <div style="color:var(--suave)">${esc(u.bio) || (meuPerfil ? 'Escreva algo sobre você!' : 'Sem bio ainda.')}</div>
        ${meuPerfil ? '<button class="link" id="editar">✏️ Editar perfil</button>' : ''}
      </div>
    </div>
    <div id="editor"></div>
    <h2>✓ Já viu (${vistos.length})</h2>
    ${lista(vistos, 'Nada marcado como visto.')}
    <h2 style="margin-top:1.5rem">★ Quer ver (${quero.length})</h2>
    ${lista(quero, 'A lista está vazia.')}
    <h2 style="margin-top:1.5rem">💡 Sugeriu (${sugeridos.length})</h2>
    ${sugeridos.length ? `<div class="grade">${sugeridos.map((f) => cardFilmeSimples(f)).join('')}</div>` : '<p style="color:var(--suave)">Nenhuma sugestão ainda.</p>'}`;

  if (meuPerfil) {
    $('#editar').addEventListener('click', () => {
      $('#editor').innerHTML = `
        <form class="caixa" id="form-perfil" style="display:grid;gap:.6rem;margin-bottom:1rem">
          <label>Avatar (um emoji)</label>
          <input name="avatar" maxlength="4" value="${esc(u.avatar || '🎬')}" style="width:90px">
          <label>Bio</label>
          <textarea name="bio" rows="2" maxlength="300">${esc(u.bio)}</textarea>
          <div><button class="principal" type="submit">Salvar</button></div>
        </form>`;
      $('#form-perfil').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        try {
          await enviar('perfil', f);
          await carregar();
          toast('Perfil atualizado!');
          viewPerfil(nome);
        } catch (err) { toast(err.message, true); }
      });
    });
  }
}

function cardFilmeSimples(f, s) {
  const extra = s && s.status === 'vi' && s.nota !== '' ? `<span class="selo vi">Nota ${esc(s.nota)}</span>` : '';
  return `
    <div class="filme" data-filme="${esc(f.tmdb_id)}">
      ${posterHtml(f)}
      <div class="info"><div class="titulo">${esc(f.titulo)}</div><div class="meta">${esc(f.ano)}</div>${extra}</div>
    </div>`;
}

/* ---------- Rotas ---------- */

function rota() {
  if (!ME) return;
  const h = decodeURIComponent(location.hash || '#/catalogo').replace(/^#\//, '');
  const [pagina, arg] = h.split('/');
  document.querySelectorAll('[data-nav]').forEach((a) =>
    a.classList.toggle('ativo', a.dataset.nav === (pagina === 'perfil' && arg && arg !== ME.nome ? 'amigos' : pagina)));

  if (pagina === 'sugerir') viewSugerir();
  else if (pagina === 'amigos') viewAmigos();
  else if (pagina === 'perfil') viewPerfil(arg || ME.nome);
  else viewCatalogo();
  window.scrollTo(0, 0);
}

/* ---------- Início ---------- */

async function iniciar() {
  if (!ME) return telaLogin();
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
  $('#topo').hidden = false;
  rota();
}

document.addEventListener('click', (e) => {
  const card = e.target.closest('[data-filme]');
  if (card) return abrirFilme(card.dataset.filme);

  const m = e.target.closest('[data-marcar]');
  if (m) return marcar(m.closest('[data-filme-id]').dataset.filmeId, m.dataset.marcar);

  if (e.target.closest('[data-fechar]') || e.target.id === 'modal') fecharModal();
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModal(); });
window.addEventListener('hashchange', rota);
$('#sair').addEventListener('click', () => {
  localStorage.removeItem('me');
  ME = null;
  telaLogin();
});

iniciar();
