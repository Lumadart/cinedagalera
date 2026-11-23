import { h, montar, icone } from '../dom.js';
import { chamar } from '../api.js';
import { estado } from '../estado.js';
import { guardarToken } from '../sessao.js';
import { NOME_DO_GRUPO } from '../config.js';
import { marcaLogo } from '../ui.js';
import { fundoAparencia } from '../aparencia.js';

/** Campo com ícone à esquerda (e, opcionalmente, um botão à direita, como o olhinho do PIN). */
function campo(ico, input, direita = null) {
  return h('div', { class: 'campo-icone' }, h('span', { class: 'campo-ico' }, icone(ico, 20)), input, direita);
}

const DESTAQUES = [
  ['amigos', 'Catálogo da comunidade', 'Nossos filmes e séries, num só lugar.'],
  ['calendario', 'Eventos e maratonas', 'Programação, votações e presença.'],
  ['estrela', 'Notas e conquistas', 'Avalie, comente e junte medalhas.']
];

export function telaLogin({ raiz, params }) {
  let modo = params && params.convite !== undefined ? 'convite' : 'entrar'; // 'entrar', 'esqueci' ou 'convite'
  let emailDigitado = '';
  let codigoDigitado = (params && params.convite) || '';

  function desenhar() {
    // A imagem da esquerda é escolhida no Admin > Aparência. Sem ela, fica o degradê.
    const arte = fundoAparencia(h('div', { class: 'login-foto', 'aria-hidden': 'true' }), 'login');
    montar(raiz, h('div', { class: 'login' },
      h('section', { class: 'login-marca' },
        arte,
        h('div', { class: 'login-marca-texto' },
          h('div', { class: 'marca-grande' }, marcaLogo(), NOME_DO_GRUPO),
          h('span', { class: 'login-traco' }),
          h('h1', null, 'Nosso catálogo.', h('br'), 'Nossa comunidade.', h('br'), 'Nossas histórias.'),
          h('ul', { class: 'login-destaques' }, DESTAQUES.map(([ico, t, d]) => h('li', null, h('span', { class: 'ouro' }, icone(ico, 28)), h('strong', null, t), h('span', { class: 'suave' }, d)))))),
      h('section', { class: 'login-form' },
        h('div', { class: 'login-topo' }, modo === 'convite'
          ? h('button', { type: 'button', class: 'link-topo', onclick: () => { modo = 'entrar'; desenhar(); } }, 'Voltar ao login')
          : h('button', { type: 'button', class: 'link-topo', onclick: () => { modo = 'convite'; desenhar(); } }, 'Tenho um convite')),
        h('div', { class: 'login-cartao' }, modo === 'entrar' ? formEntrar() : modo === 'esqueci' ? formEsqueci() : formConvite()),
        h('p', { class: 'login-rodape' }, '© ' + new Date().getFullYear() + ' ' + NOME_DO_GRUPO + ' · acesso só para quem foi convidado'))
    ));
    const primeiro = raiz.querySelector('input');
    if (primeiro) primeiro.focus();
  }

  function formEntrar() {
    const erro = h('p', { class: 'erro', role: 'alert' });
    const email = h('input', { id: 'email', type: 'email', name: 'email', autocomplete: 'username', required: true, value: emailDigitado, placeholder: 'voce@email.com' });
    const pin = h('input', { id: 'pin', type: 'password', name: 'pin', autocomplete: 'current-password', required: true, maxlength: '12', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'Seu PIN' });
    const mostrar = h('button', { type: 'button', class: 'campo-olho', 'aria-label': 'Mostrar o PIN', 'aria-pressed': 'false', onclick: () => {
      const ver = pin.type === 'password';
      pin.type = ver ? 'text' : 'password';
      mostrar.setAttribute('aria-pressed', String(ver)); mostrar.setAttribute('aria-label', ver ? 'Ocultar o PIN' : 'Mostrar o PIN');
    } }, icone('olho', 20));
    const rotuloBotao = () => [h('span', null, 'Entrar'), icone('voltar', 18)];
    const botao = h('button', { type: 'submit', class: 'btn-primario cheio btn-entrar' }, ...rotuloBotao());

    return h('form', {
      class: 'form-login', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        erro.textContent = '';
        emailDigitado = email.value.trim();
        if (!emailDigitado || !pin.value.trim()) { erro.textContent = 'Informe o e-mail e o PIN.'; return; }
        botao.disabled = true; botao.textContent = 'Entrando…';
        try {
          const d = await chamar('login', { email: emailDigitado, pin: pin.value.trim() });
          guardarToken(d.token);
          estado.membro = d.membro;
          location.hash = '#/';
        } catch (err) {
          erro.textContent = err.message;
          botao.disabled = false; botao.replaceChildren(...rotuloBotao());
          pin.select();
        }
      }
    },
      h('h2', { class: 'login-titulo' }, 'Bem-vindo de volta!'),
      h('p', { class: 'login-sub' }, 'Entre com o e-mail e o PIN que você recebeu.'),
      h('label', { for: 'email' }, 'E-mail'), campo('email', email),
      h('div', { class: 'rotulo-linha' }, h('label', { for: 'pin' }, 'PIN'),
        h('button', { type: 'button', class: 'link-ouro', onclick: () => { emailDigitado = email.value.trim(); modo = 'esqueci'; desenhar(); } }, 'Esqueci meu PIN')),
      campo('cadeado', pin, mostrar),
      erro, botao,
      h('p', { class: 'login-ou' }, 'Ainda não tem acesso? ',
        h('button', { type: 'button', class: 'link-ouro', onclick: () => { emailDigitado = email.value.trim(); modo = 'convite'; desenhar(); } }, 'Tenho um convite'))
    );
  }

  function formEsqueci() {
    const msg = h('p', { class: 'ok-msg', role: 'status' });
    const erro = h('p', { class: 'erro', role: 'alert' });
    const email = h('input', { id: 'email2', type: 'email', autocomplete: 'email', required: true, value: emailDigitado, placeholder: 'voce@email.com' });
    const botao = h('button', { type: 'submit', class: 'btn-primario cheio' }, 'Enviar novo PIN');

    return h('form', {
      class: 'form-login', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        erro.textContent = ''; msg.textContent = '';
        const valor = email.value.trim();
        if (!valor) { erro.textContent = 'Informe o seu e-mail.'; return; }
        botao.disabled = true; botao.textContent = 'Enviando…';
        try {
          const d = await chamar('esqueci_pin', { email: valor });
          msg.textContent = d.mensagem;
        } catch (err) {
          erro.textContent = err.message;
        }
        botao.disabled = false; botao.textContent = 'Enviar novo PIN';
      }
    },
      h('h2', { class: 'login-titulo' }, 'Esqueci meu PIN'),
      h('p', { class: 'login-sub' }, 'Digite o e-mail em que você foi cadastrado. Enviaremos um PIN novo para lá, e o antigo deixa de valer.'),
      h('label', { for: 'email2' }, 'E-mail'), campo('email', email),
      msg, erro, botao,
      h('p', { class: 'suave pequeno' }, 'Se o e-mail não chegar, confira o spam. Se você não tem mais acesso a ele, peça a um admin para gerar um novo PIN.'),
      h('button', { type: 'button', class: 'link-discreto centro', onclick: () => { emailDigitado = email.value.trim(); modo = 'entrar'; desenhar(); } }, 'Voltar para o login')
    );
  }

  function formConvite() {
    const msg = h('p', { class: 'ok-msg', role: 'status' });
    const erro = h('p', { class: 'erro', role: 'alert' });
    const codigo = h('input', { id: 'convite-codigo', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '9', required: true, value: codigoDigitado, placeholder: 'XXXX-XXXX' });
    // coloca o hífen sozinho: K7MQ4XPA → K7MQ-4XPA
    codigo.addEventListener('input', () => {
      const limpo = codigo.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      codigo.value = limpo.length > 4 ? limpo.slice(0, 4) + '-' + limpo.slice(4) : limpo;
    });
    codigo.value = codigoDigitado.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8).replace(/^(.{4})(.+)$/, '$1-$2');
    const nome = h('input', { id: 'convite-nome', maxlength: '40', autocomplete: 'name', required: true, placeholder: 'Como a comunidade te chama' });
    const email = h('input', { id: 'convite-email', type: 'email', autocomplete: 'email', required: true, value: emailDigitado, placeholder: 'voce@email.com' });
    const botao = h('button', { type: 'submit', class: 'btn-primario cheio' }, 'Entrar no grupo');
    return h('form', {
      class: 'form-login', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault(); erro.textContent = ''; msg.textContent = '';
        if (codigo.value.length < 9 || nome.value.trim().length < 2 || !email.value.trim()) { erro.textContent = 'Preencha o código, o nome e o e-mail.'; return; }
        botao.disabled = true; botao.textContent = 'Enviando…';
        try {
          const d = await chamar('aceitar_convite', { codigo: codigo.value, nome: nome.value.trim(), email: email.value.trim() });
          emailDigitado = email.value.trim();
          msg.textContent = d.mensagem;
          botao.replaceWith(h('button', { type: 'button', class: 'btn-primario cheio', onclick: () => { modo = 'entrar'; desenhar(); } }, 'Ir para o login'));
        } catch (err) { erro.textContent = err.message; botao.disabled = false; botao.textContent = 'Entrar no grupo'; }
      }
    },
      h('h2', { class: 'login-titulo' }, 'Tenho um convite'),
      h('p', { class: 'login-sub' }, 'Use o código que um admin te passou. O seu PIN de acesso chega por e-mail.'),
      h('label', { for: 'convite-codigo' }, 'Código do convite'), campo('chave', codigo),
      h('label', { for: 'convite-nome' }, 'Nome'), campo('usuario', nome),
      h('label', { for: 'convite-email' }, 'E-mail'), campo('email', email),
      msg, erro, botao,
      h('button', { type: 'button', class: 'link-discreto centro', onclick: () => { modo = 'entrar'; desenhar(); } }, 'Voltar para o login'));
  }

  desenhar();
}
