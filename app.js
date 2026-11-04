/* Cinema dos Amigos — front v4 */
const API_ESPERADA = 4;
const PAGINA = 48;
const STATUS = { vi: 'Vi', quero: 'Quero ver', assistindo: 'Assistindo' };
const IMG = 'https://image.tmdb.org/t/p/';
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const S = { nome: '', pin: '', admin: false, dados: null, agenda: null, filtro: { tipo: '', genero: '', status: '', q: '', ordem: 'recente', pag: 1 }, tmdb: [], erro: null };

/* ---------- Armazenamento ---------- */
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* sem armazenamento */ } },
};

/* ---------- Erros ---------- */
function mostrarErro(msg, detalhe) {
  S.erro = msg + (detalhe ? '\n' + detalhe : '');
  const p = $('#erro-painel');
  p.hidden = false;
  p.innerHTML = `${esc(msg)} <button class="btn sec peq" data-acao="copiar-erro">Copiar detalhes</button> <button class="btn sec peq" data-acao="fechar-erro">×</button>`;
}
window.addEventListener('error', (e) => mostrarErro('Erro no site: ' + e.message, (e.filename || '') + ':' + e.lineno));
window.addEventListener('unhandledrejection', (e) => mostrarErro('Erro: ' + (e.reason && e.reason.message || e.reason)));

function toast(m) {
  const t = $('#toast');
  t.textContent = m; t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ---------- API ---------- */
function configOk() {
  const c = window.CONFIG || {};
  return /^https:\/\/script\.google\.com\//.test(c.API_URL || '');
}

async function chamar(action, extra, semLogin) {
  if (!configOk()) throw new Error('config.js sem a URL do Apps Script.');
  const corpo = Object.assign({ action }, semLogin ? {} : { nome: S.nome, pin: S.pin }, extra || {});
  let res;
  try {
    res = await fetch(window.CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo) });
  } catch (e) {
    throw new Error('Sem conexão com o servidor (URL errada, implantação sem acesso "Qualquer pessoa" ou internet fora).');
  }
  let r;
  try { r = await res.json(); } catch (e) {
    throw new Error('O servidor não respondeu JSON. Confira se a implantação do Apps Script está com acesso "Qualquer pessoa".');
  }
  if (r.api !== API_ESPERADA) throw new Error('Versão do servidor (' + (r.api || 'antiga') + ') diferente do site (' + API_ESPERADA + '). Atualize o Code.gs e publique uma nova versão da implantação.');
  if (r.erro) {
    if (!semLogin && S.dados && /Nome ou PIN incorretos/.test(r.erro)) { sair(true); throw new Error('Seu PIN foi alterado. Entre novamente.'); }
    throw new Error(r.erro);
  }
  return r;
}

async function carregarDados() {
  const c = ls.get('cda_dados');
  const r = await chamar('dados', { v: c && c.versao });
  if (r.igual) S.dados = c;
  else { S.dados = r.d; ls.set('cda_dados', r.d); }
  S.semana = r.semana;
  indexar();
}

async function carregarAgenda() {
  const r = await chamar('agenda', { v: S.agenda && S.agenda.versao });
  if (!r.igual) S.agenda = r;
}

function indexar() {
  S.porChave = {};
  S.dados.titulos.forEach((t) => { S.porChave[t.chave] = t; });
  S.porUsuario = {};
  S.dados.usuarios.forEach((u) => { S.porUsuario[u.nome] = u; });
  S.marcas = {};
  S.dados.marcacoes.forEach((m) => { (S.marcas[m.chave] = S.marcas[m.chave] || []).push(m); });
}

async function atualizar(tudo) {
  await carregarDados();
  if (tudo !== 'dados') await carregarAgenda();
  render();
}

/* ---------- Sessão ---------- */
function aplicarCor(cor) {
  const c = /^#[0-9a-fA-F]{6}$/.test(cor || '') ? cor : '#e6b85c';
  const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
  document.documentElement.style.setProperty('--destaque', c);
  document.documentElement.style.setProperty('--sobre-destaque', (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#101116' : '#ffffff');
}

function sair(silencioso) {
  S.nome = ''; S.pin = ''; S.admin = false; S.dados = null; S.agenda = null;
  ls.del('cda_sessao'); ls.del('cda_dados');
  fecharModal();
  history.replaceState(null, '', '#/inicio');
  aplicarCor();
  if (!silencioso) toast('Você saiu.');
  render();
}

async function entrar(nome, pin) {
  S.nome = nome; S.pin = pin;
  try {
    const r = await chamar('login');
    S.admin = r.admin;
    ls.set('cda_sessao', { nome, pin });
    await atualizar();
    const eu = S.porUsuario[S.nome];
    if (eu) aplicarCor(eu.cor);
    render();
  } catch (e) { S.nome = ''; S.pin = ''; throw e; }
}

/* ---------- Modal ---------- */
function abrirModal(html) { $('#caixa').innerHTML = html; $('#modal').hidden = false; }
function fecharModal() { $('#modal').hidden = true; $('#caixa').innerHTML = ''; }

/* ---------- Auxiliares de dados ---------- */
function posterHtml(t, selo) {
  const img = t.poster ? `<img loading="lazy" src="${IMG}w342${esc(t.poster)}" alt="">` : `<div class="sem">${esc(t.titulo)}</div>`;
  return `<div class="poster" data-acao="titulo" data-chave="${esc(t.chave)}">${selo ? `<span class="selo">${esc(selo)}</span>` : ''}${img}<div class="info"><b>${esc(t.titulo)}</b><span class="mudo">${esc(t.ano)} · ${t.tipo === 'serie' ? 'Série' : 'Filme'}</span></div></div>`;
}

function minhaMarca(chave, nome) {
  return (S.marcas[chave] || []).find((m) => m.usuario === (nome || S.nome));
}

function contagem(status) {
  const n = {};
  S.dados.marcacoes.forEach((m) => { if (m.status === status) n[m.chave] = (n[m.chave] || 0) + 1; });
  return Object.keys(n).sort((a, b) => n[b] - n[a]).filter((k) => S.porChave[k]).map((k) => ({ t: S.porChave[k], n: n[k] }));
}

function generosDe(lista) {
  const n = {};
  lista.forEach((t) => String(t.generos || '').split(',').map((g) => g.trim()).filter(Boolean).forEach((g) => { n[g] = (n[g] || 0) + 1; }));
  return Object.keys(n).sort((a, b) => n[b] - n[a]);
}

function avatarHtml(u, grande) {
  return `<div class="avatar${grande ? ' g' : ''}">${esc(u && u.avatar || '🎬')}</div>`;
}

function dataBr(d) {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : esc(d);
}

function hoje() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------- Páginas ---------- */
function paginaLogin(modo) {
  const cad = modo === 'cadastro';
  return `<div class="card centro"><h1>🎬 Cinema dos Amigos</h1>
  <form id="f-login"><label>Nome de usuário</label><input id="l-nome" autocomplete="username" required>
  ${cad ? '<label>Código de convite</label><input id="l-convite" required>' : '<label>PIN (6 dígitos)</label><input id="l-pin" inputmode="numeric" autocomplete="current-password" required>'}
  <p class="mudo pequeno">${cad ? 'O PIN é gerado pelo sistema e aparece uma única vez.' : ''}</p>
  <button class="btn" style="width:100%">${cad ? 'Criar conta' : 'Entrar'}</button></form>
  <p class="pequeno"><a href="#/${cad ? 'inicio' : 'cadastro'}" style="color:var(--destaque)">${cad ? 'Já tenho conta' : 'Tenho um código de convite'}</a> · <a href="#/diag" style="color:var(--mudo)">Diagnóstico</a></p></div>`;
}

async function paginaDiag() {
  const itens = [];
  const add = (ok, m) => itens.push(`<li class="${ok ? 'ok' : 'nok'}">${ok ? '✔' : '✖'} ${esc(m)}</li>`);
  add(!!document.querySelector('meta[name=versao]'), 'Site carregado (versão ' + (document.querySelector('meta[name=versao]') || {}).content + ')');
  add(getComputedStyle(document.documentElement).getPropertyValue('--versao').trim() === '4', 'style.css na versão certa');
  add(configOk(), 'config.js com URL do Apps Script');
  add(!!(window.CONFIG && /^[0-9a-f]{32}$/i.test(window.CONFIG.TMDB_KEY || '')), 'config.js com chave do TMDB');
  if (configOk()) {
    try {
      const r = await (await fetch(window.CONFIG.API_URL)).json();
      add(r.api === API_ESPERADA, 'Servidor respondeu (versão da API: ' + r.api + (r.api === API_ESPERADA ? ')' : ', esperado ' + API_ESPERADA + ' — publique uma nova versão da implantação)'));
    } catch (e) { add(false, 'Servidor não respondeu: confira a URL e o acesso "Qualquer pessoa".'); }
  }
  return `<div class="card centro" style="max-width:640px"><h2>Diagnóstico</h2><ul class="diag">${itens.join('')}</ul><a class="btn sec" href="#/inicio">Voltar</a></div>`;
}

function paginaInicio() {
  const D = S.dados;
  const vistos = D.marcacoes.filter((m) => m.usuario === S.nome && m.status === 'vi').length;
  const querem = contagem('quero').slice(0, 12), vistosTop = contagem('vi').slice(0, 12);
  const assistindo = D.marcacoes.filter((m) => m.usuario === S.nome && m.status === 'assistindo' && S.porChave[m.chave]);
  const recentes = D.titulos.slice().reverse().slice(0, 12);
  const futuras = ((S.agenda && S.agenda.programacao) || []).filter((s) => s.data >= hoje()).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)).slice(0, 3);
  const abertas = ((S.agenda && S.agenda.votacoes) || []).filter((v) => v.status === 'aberta');
  const bloco = (t, l) => l.length ? `<h2>${t}</h2><div class="grade">${l.join('')}</div><br>` : '';
  return `<div class="hero"><div class="num"><b>${D.titulos.length}</b>títulos</div><div class="num"><b>${D.usuarios.length}</b>amigos</div><div class="num"><b>${vistos}</b>vistos por você</div><div class="num"><b>${abertas.length}</b>votações abertas</div></div><br>
  ${futuras.length ? `<div class="card"><h2>Próximas sessões</h2>${futuras.map(sessaoHtml).join('')}</div>` : ''}
  ${abertas.length ? `<div class="card"><a href="#/agenda" style="color:var(--destaque)">🗳️ ${abertas.length} votação(ões) aberta(s) — vote agora</a></div>` : ''}
  ${bloco('Você está assistindo', assistindo.map((m) => posterHtml(S.porChave[m.chave], m.temporada ? `T${m.temporada}E${m.episodio || 0}` : '')))}
  ${bloco('Mais marcados para ver', querem.map((x) => posterHtml(x.t, x.n + '×')))}
  ${bloco('Mais vistos', vistosTop.map((x) => posterHtml(x.t, x.n + '×')))}
  ${bloco('Adicionados recentemente', recentes.map((t) => posterHtml(t)))}
  ${D.titulos.length ? '' : '<div class="card">O catálogo está vazio. Clique em “＋ Sugerir” para adicionar o primeiro título.</div>'}`;
}

function paginaCatalogo() {
  const f = S.filtro, D = S.dados;
  const generos = generosDe(D.titulos);
  let l = D.titulos.filter((t) => {
    if (f.tipo && t.tipo !== f.tipo) return false;
    if (f.genero && String(t.generos).split(',').map((g) => g.trim()).indexOf(f.genero) < 0) return false;
    if (f.status) { const m = minhaMarca(t.chave); if (f.status === 'nenhum' ? m : !m || m.status !== f.status) return false; }
    if (f.q && String(t.titulo).toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
    return true;
  });
  if (f.ordem === 'az') l.sort((a, b) => String(a.titulo).localeCompare(String(b.titulo)));
  else if (f.ordem === 'ano') l.sort((a, b) => Number(b.ano) - Number(a.ano));
  else l.reverse();
  const vis = l.slice(0, f.pag * PAGINA);
  const sel = (id, ops, v) => `<select id="${id}">${ops.map((o) => `<option value="${esc(o[0])}"${o[0] === v ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  return `<div class="card linha"><input id="c-q" placeholder="Buscar no catálogo" value="${esc(f.q)}">
  ${sel('c-tipo', [['', 'Tudo'], ['filme', 'Filmes'], ['serie', 'Séries']], f.tipo)}
  ${sel('c-genero', [['', 'Gêneros']].concat(generos.map((g) => [g, g])), f.genero)}
  ${sel('c-status', [['', 'Qualquer status'], ['vi', 'Vi'], ['quero', 'Quero ver'], ['assistindo', 'Assistindo'], ['nenhum', 'Sem marcação']], f.status)}
  ${sel('c-ordem', [['recente', 'Recentes'], ['az', 'A–Z'], ['ano', 'Ano']], f.ordem)}</div>
  <p class="mudo pequeno">${l.length} título(s)</p>
  <div class="grade">${vis.map((t) => { const m = minhaMarca(t.chave); return posterHtml(t, m ? STATUS[m.status] : ''); }).join('')}</div>
  ${vis.length < l.length ? '<p style="text-align:center"><button class="btn sec" data-acao="mais">Mostrar mais</button></p>' : ''}`;
}

function sessaoHtml(s) {
  const t = S.porChave[s.chave];
  return `<div class="cand">${t && t.poster ? `<img src="${IMG}w92${esc(t.poster)}" alt="">` : ''}<div class="corpo"><b>${esc(t ? t.titulo : s.rotulo)}</b>${t && s.rotulo ? ' — ' + esc(s.rotulo) : ''}<div class="mudo pequeno">${dataBr(s.data)} às ${esc(s.hora)}${s.local ? ' · ' + esc(s.local) : ''}</div></div>${S.admin ? `<button class="btn perigo peq" data-acao="sessao-apagar" data-id="${esc(s.id)}">Apagar</button>` : ''}</div>`;
}

function votacaoHtml(v) {
  const aberta = v.status === 'aberta';
  const total = v.votos ? v.votos.length : 0;
  const cont = {};
  (v.votos || []).forEach((x) => { cont[x.chave] = (cont[x.chave] || 0) + 1; });
  const linhas = v.candidatos.map((k) => {
    const t = S.porChave[k]; if (!t) return '';
    const n = cont[k] || 0;
    const pct = total ? Math.round(n * 100 / total) : 0;
    const tipo = v.max_votos > 1 ? 'checkbox' : 'radio';
    return `<div class="cand">${aberta ? `<input type="${tipo}" name="v-${esc(v.id)}" value="${esc(k)}"${v.meus.indexOf(k) >= 0 ? ' checked' : ''}>` : ''}${t.poster ? `<img src="${IMG}w92${esc(t.poster)}" alt="">` : ''}<div class="corpo"><b>${esc(t.titulo)}</b>${v.vencedor === k ? ' 🏆' : ''}${v.votos ? `<div class="barra"><i style="width:${pct}%"></i></div>` : ''}</div>${v.votos ? `<span class="mudo">${n}</span>` : ''}</div>`;
  }).join('');
  return `<div class="card" data-voto="${esc(v.id)}"><h3>${esc(v.titulo)} ${aberta ? '' : '<span class="tag">encerrada</span>'}</h3>
  <p class="mudo pequeno">${aberta ? `Até ${v.max_votos} voto(s)${v.prazo ? ' · prazo ' + dataBr(v.prazo) : ''}${v.ocultar ? ' · resultado oculto até encerrar' : ''} · ${v.votaram.length} pessoa(s) votaram` : 'Encerrada'}</p>
  ${linhas}
  ${aberta ? `<div class="linha" style="margin-top:10px"><button class="btn" data-acao="votar" data-id="${esc(v.id)}">Salvar meu voto</button>${S.admin ? `<button class="btn sec" data-acao="voto-encerrar" data-id="${esc(v.id)}">Encerrar</button>` : ''}</div>` : ''}
  ${S.admin && !aberta ? `<button class="btn perigo peq" data-acao="voto-apagar" data-id="${esc(v.id)}">Apagar</button>` : ''}</div>`;
}

function paginaAgenda() {
  const A = S.agenda || { votacoes: [], programacao: [] };
  const futuras = A.programacao.filter((s) => s.data >= hoje()).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  return `<h2>Programação</h2><div class="card">${futuras.length ? futuras.map(sessaoHtml).join('') : '<span class="mudo">Nenhuma sessão marcada.</span>'}
  ${S.admin ? '<p><button class="btn" data-acao="sessao-nova">＋ Nova sessão</button></p>' : ''}</div>
  <h2>Votações</h2>${S.admin ? '<p><button class="btn" data-acao="voto-nova">＋ Nova votação</button></p>' : ''}
  ${A.votacoes.length ? A.votacoes.map(votacaoHtml).join('') : '<div class="card mudo">Nenhuma votação.</div>'}`;
}

function paginaAmigos() {
  return `<div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${S.dados.usuarios.map((u) => {
    const m = S.dados.marcacoes.filter((x) => x.usuario === u.nome && x.status === 'vi').length;
    return `<div class="card pessoa" data-acao="perfil" data-nome="${esc(u.nome)}">${avatarHtml(u)}<div><b>${esc(u.nome)}</b>${S.dados.admins.indexOf(u.nome) >= 0 ? ' <span class="tag">admin</span>' : ''}<div class="mudo pequeno">${m} visto(s)</div></div></div>`;
  }).join('')}</div>`;
}

function paginaPerfil(nome) {
  nome = decodeURIComponent(nome || S.nome);
  const u = S.porUsuario[nome];
  if (!u) return '<div class="card">Perfil não encontrado.</div>';
  const meu = nome === S.nome;
  const ms = S.dados.marcacoes.filter((m) => m.usuario === nome && S.porChave[m.chave]);
  const favs = u.favoritos.map((k) => S.porChave[k]).filter(Boolean);
  const vistos = ms.filter((m) => m.status === 'vi').map((m) => S.porChave[m.chave]);
  const top = generosDe(vistos).slice(0, 5);
  const aba = S.abaPerfil || 'vi';
  const lista = ms.filter((m) => m.status === aba);
  return `<div class="card"><div class="linha"><div style="flex:0 0 auto">${avatarHtml(u, true)}</div><div style="flex:1 1 200px"><h1>${esc(u.nome)}</h1><p class="mudo">${esc(u.bio) || 'Sem bio.'}</p></div>${meu ? '<button class="btn sec" data-acao="editar-perfil">Editar perfil</button>' : ''}</div>
  ${top.length ? `<p class="tags">${top.map((g) => `<span class="tag on">${esc(g)}</span>`).join('')}</p>` : ''}</div>
  <h2>Favoritos</h2>${favs.length ? `<div class="grade">${favs.map((t) => posterHtml(t)).join('')}</div>` : '<p class="mudo">Nenhum favorito' + (meu ? ' — abra um título e toque em ★' : '') + '.</p>'}
  <br><div class="abas">${Object.keys(STATUS).map((k) => `<button class="btn ${k === aba ? '' : 'sec'}" data-acao="aba-perfil" data-aba="${k}" data-nome="${esc(nome)}">${STATUS[k]} (${ms.filter((m) => m.status === k).length})</button>`).join('')}</div>
  <div class="grade">${lista.map((m) => posterHtml(S.porChave[m.chave], m.nota !== '' && m.nota != null ? '★' + m.nota : (m.temporada ? `T${m.temporada}E${m.episodio || 0}` : ''))).join('') || '<span class="mudo">Nada aqui ainda.</span>'}</div>`;
}

function paginaAdmin() {
  if (!S.admin) return '<div class="card">Apenas administradores.</div>';
  return `<div class="card"><h2>Código de convite</h2><div class="linha"><input id="a-codigo" placeholder="Novo código"><button class="btn" data-acao="admin-codigo">Trocar</button></div></div>
  <div class="card"><h2>Gerar novo PIN</h2><div class="linha"><select id="a-user">${S.dados.usuarios.map((u) => `<option>${esc(u.nome)}</option>`).join('')}</select><button class="btn" data-acao="admin-pin">Gerar PIN</button></div></div>
  <div class="card"><h2>Diagnóstico do servidor</h2><button class="btn sec" data-acao="admin-diag">Verificar</button><ul class="diag" id="a-diag"></ul></div>`;
}

/* ---------- Render ---------- */
async function render() {
  const app = $('#app');
  const logado = !!S.nome && !!S.dados;
  $('#topo').hidden = !logado;
  const rota = (location.hash.replace(/^#\//, '') || 'inicio').split('/');
  if (!logado) {
    app.innerHTML = rota[0] === 'diag' ? await paginaDiag() : paginaLogin(rota[0] === 'cadastro' ? 'cadastro' : 'login');
    return;
  }
  $('#chip').textContent = S.nome;
  $('#menu-admin').hidden = !S.admin;
  document.querySelectorAll('#menu a').forEach((a) => a.classList.toggle('ativo', a.dataset.p === rota[0]));
  const paginas = {
    inicio: paginaInicio, catalogo: paginaCatalogo, agenda: paginaAgenda, amigos: paginaAmigos,
    perfil: () => paginaPerfil(rota[1]), admin: paginaAdmin,
  };
  app.innerHTML = (paginas[rota[0]] || paginaInicio)();
}

/* ---------- Modais ---------- */
function modalTitulo(chave) {
  const t = S.porChave[chave]; if (!t) return;
  const m = minhaMarca(chave) || {};
  const u = S.porUsuario[S.nome];
  const fav = u && u.favoritos.indexOf(chave) >= 0;
  const outros = (S.marcas[chave] || []).map((x) => `<span class="tag">${esc(x.usuario)}: ${STATUS[x.status]}${x.nota !== '' && x.nota != null ? ' ★' + esc(x.nota) : ''}</span>`).join('');
  abrirModal(`<div class="titulo-modal">${t.poster ? `<img src="${IMG}w342${esc(t.poster)}" alt="">` : ''}<div><h2>${esc(t.titulo)}</h2><p class="mudo pequeno">${esc(t.ano)} · ${t.tipo === 'serie' ? 'Série' + (t.temporadas ? ' · ' + esc(t.temporadas) + ' temp.' : '') : 'Filme'} · sugerido por ${esc(t.sugerido_por)}</p>
  <p class="tags">${String(t.generos).split(',').filter(Boolean).map((g) => `<span class="tag">${esc(g.trim())}</span>`).join('')}</p><p>${esc(t.sinopse)}</p></div></div>
  <p class="tags">${outros}</p>
  <form id="f-marca" data-chave="${esc(chave)}"><div class="linha"><div><label>Meu status</label><select id="m-status"><option value="remover">—</option>${Object.keys(STATUS).map((k) => `<option value="${k}"${m.status === k ? ' selected' : ''}>${STATUS[k]}</option>`).join('')}</select></div>
  <div><label>Nota (0–10)</label><input id="m-nota" type="number" min="0" max="10" step="0.5" value="${esc(m.nota)}"></div></div>
  ${t.tipo === 'serie' ? `<div class="linha"><div><label>Temporada</label><input id="m-temp" type="number" min="0" value="${esc(m.temporada)}"></div><div><label>Episódio</label><input id="m-ep" type="number" min="0" value="${esc(m.episodio)}"></div></div>` : ''}
  <label>Comentário</label><textarea id="m-com">${esc(m.comentario)}</textarea>
  <div class="linha" style="margin-top:10px"><button class="btn">Salvar</button><button type="button" class="btn sec" data-acao="favorito" data-chave="${esc(chave)}" data-valor="${fav ? 0 : 1}">${fav ? '★ Remover favorito' : '☆ Favoritar'}</button>${S.admin ? `<button type="button" class="btn perigo" data-acao="remover-titulo" data-chave="${esc(chave)}">Remover do catálogo</button>` : ''}<button type="button" class="btn sec" data-acao="fechar">Fechar</button></div></form>`);
}

function modalSugerir() {
  const lim = S.dados.limite;
  abrirModal(`<h2>Sugerir título</h2><p class="mudo pequeno">${S.admin ? 'Administradores não têm limite.' : `Limite de ${lim} títulos por semana.`}</p>
  <div class="linha"><select id="s-tipo" style="flex:0 0 110px"><option value="filme">Filme</option><option value="serie">Série</option></select><input id="s-q" placeholder="Buscar no TMDB"><button class="btn" data-acao="buscar-tmdb">Buscar</button></div>
  <div id="s-res" class="grade" style="margin-top:12px"></div><p><button class="btn sec" data-acao="fechar">Fechar</button></p>`);
}

async function buscarTmdb() {
  const q = $('#s-q').value.trim(), tipo = $('#s-tipo').value;
  if (!q) return;
  const chave = (window.CONFIG || {}).TMDB_KEY;
  const res = await fetch(`https://api.themoviedb.org/3/search/${tipo === 'serie' ? 'tv' : 'movie'}?api_key=${encodeURIComponent(chave)}&language=pt-BR&query=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('TMDB recusou a busca (confira a chave em config.js).');
  const j = await res.json();
  S.tmdb = (j.results || []).slice(0, 12);
  $('#s-res').innerHTML = S.tmdb.map((r, i) => `<div class="poster" data-acao="escolher-tmdb" data-i="${i}">${r.poster_path ? `<img src="${IMG}w342${esc(r.poster_path)}" alt="">` : `<div class="sem">${esc(r.title || r.name)}</div>`}<div class="info"><b>${esc(r.title || r.name)}</b><span class="mudo">${esc((r.release_date || r.first_air_date || '').slice(0, 4))}</span></div></div>`).join('') || '<span class="mudo">Nada encontrado.</span>';
}

async function escolherTmdb(i) {
  const r = S.tmdb[i], serie = $('#s-tipo').value === 'serie';
  const chave = window.CONFIG.TMDB_KEY;
  const res = await fetch(`https://api.themoviedb.org/3/${serie ? 'tv' : 'movie'}/${r.id}?api_key=${encodeURIComponent(chave)}&language=pt-BR`);
  if (!res.ok) throw new Error('TMDB recusou a consulta.');
  const d = await res.json();
  const item = {
    tipo: serie ? 'serie' : 'filme', tmdb_id: d.id, titulo: d.title || d.name,
    ano: (d.release_date || d.first_air_date || '').slice(0, 4), generos: (d.genres || []).map((g) => g.name).join(', '),
    poster: d.poster_path || '', backdrop: d.backdrop_path || '', sinopse: d.overview || '', temporadas: d.number_of_seasons || '',
  };
  const out = await chamar('titulo_add', { item });
  toast('Adicionado!' + (out.restantes != null ? ` Restam ${out.restantes} esta semana.` : ''));
  fecharModal();
  await atualizar('dados');
}

function modalVoto() {
  abrirModal(`<h2>Nova votação</h2><form id="f-voto"><label>Nome</label><input id="v-titulo" placeholder="Filme de sábado" required>
  <label>Candidatos (2 a 15)</label><div style="max-height:260px;overflow:auto">${S.dados.titulos.map((t) => `<label class="linha" style="margin:2px 0"><input type="checkbox" class="v-cand" value="${esc(t.chave)}"> ${esc(t.titulo)} <span class="mudo">(${esc(t.ano)})</span></label>`).join('')}</div>
  <div class="linha"><div><label>Votos por pessoa</label><input id="v-max" type="number" min="1" max="5" value="1"></div><div><label>Prazo (opcional)</label><input id="v-prazo" type="date"></div></div>
  <label class="linha"><input type="checkbox" id="v-ocultar"> Ocultar resultado até encerrar</label>
  <div class="linha" style="margin-top:10px"><button class="btn">Criar</button><button type="button" class="btn sec" data-acao="fechar">Cancelar</button></div></form>`);
}

function modalSessao() {
  abrirModal(`<h2>Nova sessão</h2><form id="f-sessao"><div class="linha"><div><label>Data</label><input id="ss-data" type="date" value="${hoje()}" required></div><div><label>Hora</label><input id="ss-hora" type="time" value="21:00" required></div></div>
  <label>Título</label><select id="ss-chave"><option value="">(nenhum)</option>${S.dados.titulos.map((t) => `<option value="${esc(t.chave)}">${esc(t.titulo)}</option>`).join('')}</select>
  <label>Nome da sessão (opcional)</label><input id="ss-rotulo"><label>Local / link da call (opcional)</label><input id="ss-local">
  <div class="linha" style="margin-top:10px"><button class="btn">Criar</button><button type="button" class="btn sec" data-acao="fechar">Cancelar</button></div></form>`);
}

function modalPerfil() {
  const u = S.porUsuario[S.nome];
  abrirModal(`<h2>Editar perfil</h2><form id="f-perfil"><label>Avatar (um emoji)</label><input id="p-avatar" maxlength="8" value="${esc(u.avatar)}">
  <label>Bio</label><textarea id="p-bio" maxlength="300">${esc(u.bio)}</textarea><label>Cor de destaque</label><input id="p-cor" type="color" value="${esc(u.cor || '#e6b85c')}">
  <div class="linha" style="margin-top:10px"><button class="btn">Salvar</button><button type="button" class="btn sec" data-acao="novo-pin">Gerar novo PIN</button><button type="button" class="btn sec" data-acao="fechar">Cancelar</button></div></form>`);
}

function modalPin(titulo, pin) {
  abrirModal(`<h2>${esc(titulo)}</h2><div class="pin">${esc(pin)}</div><p class="mudo">Anote agora: ele não será mostrado de novo.</p><button class="btn" data-acao="fechar">Anotei</button>`);
}

/* ---------- Execução protegida ---------- */
async function seguro(fn, botao) {
  if (botao) botao.disabled = true;
  try { await fn(); } catch (e) { mostrarErro(e.message); toast(e.message); } finally { if (botao) botao.disabled = false; }
}

/* ---------- Eventos ---------- */
document.addEventListener('click', (e) => {
  if (e.target.id === 'modal') return fecharModal();
  if (e.target.id === 'sugerir') return modalSugerir();
  if (e.target.id === 'sair') return sair();
  const el = e.target.closest('[data-acao]');
  if (!el) return;
  const d = el.dataset;
  const acao = d.acao;
  const dados = (a, extra, ok, tudo) => seguro(async () => { await chamar(a, extra); if (ok) toast(ok); await atualizar(tudo); }, el);
  if (acao === 'fechar') fecharModal();
  else if (acao === 'fechar-erro') $('#erro-painel').hidden = true;
  else if (acao === 'copiar-erro') { try { navigator.clipboard.writeText(S.erro || ''); toast('Copiado.'); } catch (x) { /* sem área de transferência */ } }
  else if (acao === 'titulo') modalTitulo(d.chave);
  else if (acao === 'mais') { S.filtro.pag++; render(); }
  else if (acao === 'perfil') location.hash = '#/perfil/' + encodeURIComponent(d.nome);
  else if (acao === 'aba-perfil') { S.abaPerfil = d.aba; render(); }
  else if (acao === 'editar-perfil') modalPerfil();
  else if (acao === 'buscar-tmdb') seguro(buscarTmdb, el);
  else if (acao === 'escolher-tmdb') seguro(() => escolherTmdb(Number(d.i)));
  else if (acao === 'favorito') seguro(async () => { await chamar('favorito', { chave: d.chave, valor: d.valor === '1' }); await atualizar('dados'); modalTitulo(d.chave); }, el);
  else if (acao === 'remover-titulo') { if (confirm('Remover este título do catálogo para todos?')) dados('admin_remover', { chave: d.chave }, 'Removido.', 'dados').then(fecharModal); }
  else if (acao === 'novo-pin') { if (confirm('Gerar um novo PIN? O atual deixa de valer.')) seguro(async () => { const r = await chamar('novo_pin'); S.pin = r.pin; ls.set('cda_sessao', { nome: S.nome, pin: r.pin }); modalPin('Seu novo PIN', r.pin); }, el); }
  else if (acao === 'votar') {
    const chaves = [...document.querySelectorAll(`[data-voto="${d.id}"] input:checked`)].map((i) => i.value);
    dados('votar', { id: d.id, chaves }, 'Voto salvo!', 'agenda');
  }
  else if (acao === 'voto-nova') modalVoto();
  else if (acao === 'voto-encerrar') seguro(async () => {
    let r = await chamar('voto_encerrar', { id: d.id });
    if (!r.fechada) {
      const nomes = r.empate.map((k) => S.porChave[k] ? S.porChave[k].titulo : k);
      const esc1 = prompt('Empate: ' + nomes.map((n, i) => (i + 1) + ') ' + n).join('  ') + '\nDigite o número do vencedor:');
      const i = Number(esc1) - 1;
      if (!(i >= 0 && i < r.empate.length)) return;
      r = await chamar('voto_encerrar', { id: d.id, vencedor: r.empate[i] });
    }
    toast('Votação encerrada.');
    await atualizar();
  }, el);
  else if (acao === 'voto-apagar') { if (confirm('Apagar esta votação?')) dados('voto_apagar', { id: d.id }, 'Apagada.'); }
  else if (acao === 'sessao-nova') modalSessao();
  else if (acao === 'sessao-apagar') { if (confirm('Apagar esta sessão?')) dados('sessao_apagar', { id: d.id }, 'Apagada.'); }
  else if (acao === 'admin-codigo') dados('admin_codigo', { codigo: $('#a-codigo').value }, 'Código trocado.', 'dados');
  else if (acao === 'admin-pin') seguro(async () => { const r = await chamar('admin_pin', { usuario: $('#a-user').value }); modalPin('Novo PIN de ' + r.usuario, r.pin); }, el);
  else if (acao === 'admin-diag') seguro(async () => { const r = await chamar('admin_diag'); $('#a-diag').innerHTML = r.itens.map((i) => `<li class="${i.ok ? 'ok' : 'nok'}">${i.ok ? '✔' : '✖'} ${esc(i.msg)}</li>`).join(''); }, el);
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = e.target.id;
  const botao = e.target.querySelector('button:not([type=button])');
  if (id === 'f-login') {
    const nome = $('#l-nome').value.trim();
    if ($('#l-convite')) {
      seguro(async () => {
        const r = await chamar('cadastrar', { nome, convite: $('#l-convite').value }, true);
        await entrar(r.nome, r.pin);
        modalPin('Seu PIN de acesso', r.pin);
      }, botao);
    } else seguro(() => entrar(nome, $('#l-pin').value.trim()), botao);
  } else if (id === 'f-marca') {
    const t = e.target.dataset.chave;
    seguro(async () => {
      await chamar('marcar', { chave: t, status: $('#m-status').value, nota: $('#m-nota').value, comentario: $('#m-com').value, temporada: $('#m-temp') ? $('#m-temp').value : '', episodio: $('#m-ep') ? $('#m-ep').value : '' });
      toast('Salvo!'); fecharModal(); await atualizar('dados');
    }, botao);
  } else if (id === 'f-perfil') {
    seguro(async () => {
      await chamar('perfil', { avatar: $('#p-avatar').value, bio: $('#p-bio').value, cor: $('#p-cor').value });
      aplicarCor($('#p-cor').value); toast('Perfil salvo!'); fecharModal(); await atualizar('dados');
    }, botao);
  } else if (id === 'f-voto') {
    seguro(async () => {
      await chamar('voto_criar', { titulo: $('#v-titulo').value, candidatos: [...document.querySelectorAll('.v-cand:checked')].map((i) => i.value), max_votos: $('#v-max').value, prazo: $('#v-prazo').value, ocultar: $('#v-ocultar').checked });
      toast('Votação criada!'); fecharModal(); await atualizar();
    }, botao);
  } else if (id === 'f-sessao') {
    seguro(async () => {
      await chamar('sessao_criar', { data: $('#ss-data').value, hora: $('#ss-hora').value, chave: $('#ss-chave').value, rotulo: $('#ss-rotulo').value, local: $('#ss-local').value });
      toast('Sessão criada!'); fecharModal(); await atualizar();
    }, botao);
  }
});

let tBusca;
document.addEventListener('input', (e) => {
  if (e.target.id !== 'c-q') return;
  clearTimeout(tBusca);
  tBusca = setTimeout(() => { S.filtro.q = e.target.value; S.filtro.pag = 1; render().then(() => { const i = $('#c-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 250);
});

document.addEventListener('change', (e) => {
  const m = { 'c-tipo': 'tipo', 'c-genero': 'genero', 'c-status': 'status', 'c-ordem': 'ordem' }[e.target.id];
  if (m) { S.filtro[m] = e.target.value; S.filtro.pag = 1; render(); }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 's-q') { e.preventDefault(); seguro(buscarTmdb); }
  if (e.key === 'Escape') fecharModal();
});

window.addEventListener('hashchange', () => { if (S.nome) { if (S.dados) render(); } else render(); });

/* ---------- Início ---------- */
(async function iniciar() {
  const s = ls.get('cda_sessao');
  if (s && s.nome && configOk()) {
    try { await entrar(s.nome, s.pin); return; } catch (e) {
      if (!/PIN|Nome|Muitas/.test(e.message)) mostrarErro(e.message);
      ls.del('cda_sessao');
    }
  }
  if (!configOk()) mostrarErro('config.js ainda não foi preenchido. Abra o Diagnóstico na tela de entrada.');
  render();
})();

setInterval(() => { if (S.nome && !document.hidden && $('#modal').hidden) atualizar().catch(() => {}); }, 60000);
