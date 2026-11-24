import { h, icone } from './dom.js';

let contador = 0;

/**
 * Lista suspensa única do site (no lugar do <select> nativo), com o mesmo visual em qualquer navegador.
 *   dropdown({ opcoes: [['valor', 'Texto'], ...], valor, rotulo, id, mini, aoMudar })
 * Funciona como um campo: `.value` lê/define a escolha, `.disabled` desliga, e o evento "change"
 * dispara quando a pessoa escolhe. `.definirOpcoes([...])` troca a lista inteira.
 * Teclado: setas, Home/End, Enter/Espaço, Esc e digitar a primeira letra.
 */
export function dropdown({ opcoes = [], valor = '', rotulo = '', id = null, mini = false, aoMudar = null } = {}) {
  const uid = 'dd' + (++contador);
  let lista = [];
  let atual = valor;
  let ativo = -1;
  let aberto = false;

  const texto = h('span', { class: 'dd-texto' });
  const botao = h('button', { type: 'button', class: 'dd-botao', id, 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': rotulo || null }, texto, icone('seta', 16));
  const ul = h('ul', { class: 'dd-lista', role: 'listbox', tabindex: '-1', id: uid + '-lista', hidden: true });
  const el = h('div', { class: 'dd' + (mini ? ' mini' : '') }, botao, ul);

  function pintarBotao() {
    const o = lista.find(([v]) => v === atual);
    texto.textContent = o ? o[1] : '';
    texto.classList.toggle('vazio', !o);
  }
  function pintarLista() {
    ul.replaceChildren(...lista.map(([v, t], i) => h('li', {
      class: 'dd-op', role: 'option', id: `${uid}-${i}`, 'aria-selected': v === atual ? 'true' : 'false',
      onclick: () => escolher(i),
      onmousemove: () => marcar(i, false)
    }, t)));
  }
  function marcar(i, rolar = true) {
    ativo = Math.max(0, Math.min(lista.length - 1, i));
    [...ul.children].forEach((li, k) => li.classList.toggle('ativo', k === ativo));
    ul.setAttribute('aria-activedescendant', `${uid}-${ativo}`);
    if (rolar && ul.children[ativo]) ul.children[ativo].scrollIntoView({ block: 'nearest' });
  }
  function posicionar() {
    const r = botao.getBoundingClientRect();
    ul.style.minWidth = r.width + 'px';
    ul.style.left = r.left + 'px';
    const altura = Math.min(ul.scrollHeight, 280);
    const cabeEmbaixo = window.innerHeight - r.bottom >= altura + 12 || r.top < altura + 12;
    ul.style.top = cabeEmbaixo ? r.bottom + 6 + 'px' : r.top - altura - 6 + 'px';
    ul.style.maxHeight = Math.max(120, Math.min(280, (cabeEmbaixo ? window.innerHeight - r.bottom : r.top) - 16)) + 'px';
  }
  const fora = (e) => { const rot = e.target.closest && e.target.closest('label'); if (!el.contains(e.target) && !ul.contains(e.target) && !(rot && rot.contains(el))) fechar(false); };
  const rolou = (e) => { if (!ul.contains(e.target)) posicionar(); };   // a lista acompanha o botão quando a página rola

  const sair = () => fechar(false);

  function abrir() {
    if (aberto || botao.disabled || !lista.length) return;
    aberto = true;
    document.body.append(ul);   // fora de qualquer área com transformação, para o "fixed" valer em relação à janela
    ul.hidden = false; el.classList.add('aberto'); botao.setAttribute('aria-expanded', 'true');
    posicionar();
    marcar(Math.max(0, lista.findIndex(([v]) => v === atual)));
    ul.focus({ preventScroll: true });
    document.addEventListener('pointerdown', fora, true);
    window.addEventListener('scroll', rolou, true);
    window.addEventListener('resize', rolou);
    window.addEventListener('hashchange', sair);
  }
  function fechar(voltarFoco = true) {
    if (!aberto) return;
    aberto = false;
    ul.hidden = true; el.classList.remove('aberto'); botao.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', fora, true);
    window.removeEventListener('scroll', rolou, true);
    window.removeEventListener('resize', rolou);
    window.removeEventListener('hashchange', sair);
    el.append(ul);
    if (voltarFoco) botao.focus({ preventScroll: true });
  }
  function escolher(i) {
    const [v] = lista[i];
    const mudou = v !== atual;
    atual = v; pintarBotao(); pintarLista(); fechar();
    if (mudou) el.dispatchEvent(new Event('change'));
  }

  botao.addEventListener('click', () => (aberto ? fechar() : abrir()));
  botao.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir(); }
  });
  ul.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowDown') { e.preventDefault(); marcar(ativo + 1); }
    else if (k === 'ArrowUp') { e.preventDefault(); marcar(ativo - 1); }
    else if (k === 'Home') { e.preventDefault(); marcar(0); }
    else if (k === 'End') { e.preventDefault(); marcar(lista.length - 1); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); escolher(ativo); }
    else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); }
    else if (k === 'Tab') fechar(false);
    else if (k.length === 1 && /\S/.test(k)) {
      const a = k.toLocaleLowerCase('pt-BR');
      const i = lista.findIndex(([, t], n) => n > ativo && t.toLocaleLowerCase('pt-BR').startsWith(a));
      const j = i >= 0 ? i : lista.findIndex(([, t]) => t.toLocaleLowerCase('pt-BR').startsWith(a));
      if (j >= 0) marcar(j);
    }
  });
  ul.addEventListener('blur', () => { setTimeout(() => { if (aberto && !el.contains(document.activeElement) && !ul.contains(document.activeElement)) fechar(false); }, 0); });

  Object.defineProperties(el, {
    value: { get: () => atual, set: (v) => { atual = String(v); pintarBotao(); pintarLista(); } },
    disabled: { get: () => botao.disabled, set: (v) => { botao.disabled = !!v; if (v) fechar(false); } }
  });
  el.definirOpcoes = (novas) => {
    lista = novas.map((o) => (Array.isArray(o) ? [String(o[0]), String(o[1])] : [String(o), String(o)]));
    if (!lista.some(([v]) => v === atual) && lista.length && valor === '') atual = lista[0][0];
    pintarBotao(); pintarLista();
  };
  atual = String(valor);
  el.definirOpcoes(opcoes);
  if (aoMudar) el.addEventListener('change', aoMudar);
  return el;
}
