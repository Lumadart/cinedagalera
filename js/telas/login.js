import { h, montar } from '../dom.js';
import { chamar } from '../api.js';
import { estado } from '../estado.js';
import { guardarToken } from '../sessao.js';
import { NOME_DO_GRUPO } from '../config.js';

export function telaLogin({ raiz }) {
  let modo = 'entrar'; // 'entrar' ou 'esqueci'
  let emailDigitado = '';

  function desenhar() {
    montar(raiz, h('div', { class: 'login' },
      h('section', { class: 'login-marca' },
        h('div', { class: 'marca-grande' }, h('span', { class: 'logo', 'aria-hidden': 'true' }), NOME_DO_GRUPO),
        h('h1', null, 'Nosso catálogo de filmes e séries, em um só lugar.'),
        h('p', null, 'Registre o que viu, acompanhe o que está assistindo e descubra o que a galera quer ver.')
      ),
      h('section', { class: 'login-form' }, modo === 'entrar' ? formEntrar() : formEsqueci())
    ));
    const primeiro = raiz.querySelector('input');
    if (primeiro) primeiro.focus();
  }

  function formEntrar() {
    const erro = h('p', { class: 'erro', role: 'alert' });
    const email = h('input', { id: 'email', type: 'email', name: 'email', autocomplete: 'username', required: true, value: emailDigitado, placeholder: 'voce@email.com' });
    const pin = h('input', { id: 'pin', type: 'password', name: 'pin', autocomplete: 'current-password', required: true, maxlength: '12', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'Seu PIN' });
    const mostrar = h('button', { type: 'button', class: 'link-discreto', onclick: () => {
      const ver = pin.type === 'password';
      pin.type = ver ? 'text' : 'password';
      mostrar.textContent = ver ? 'Ocultar' : 'Mostrar';
    } }, 'Mostrar');
    const botao = h('button', { type: 'submit', class: 'btn-primario cheio' }, 'Entrar');

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
          botao.disabled = false; botao.textContent = 'Entrar';
          pin.select();
        }
      }
    },
      h('h2', null, 'Bem-vindo de volta'),
      h('p', { class: 'suave' }, 'Entre com o e-mail e o PIN que você recebeu.'),
      h('label', { for: 'email' }, 'E-mail'), email,
      h('div', { class: 'rotulo-linha' }, h('label', { for: 'pin' }, 'PIN'), mostrar), pin,
      erro, botao,
      h('button', { type: 'button', class: 'link-discreto centro', onclick: () => { emailDigitado = email.value.trim(); modo = 'esqueci'; desenhar(); } }, 'Esqueci meu PIN')
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
      h('h2', null, 'Esqueci meu PIN'),
      h('p', { class: 'suave' }, 'Digite o e-mail em que você foi cadastrado. Enviaremos um PIN novo para lá, e o antigo deixa de valer.'),
      h('label', { for: 'email2' }, 'E-mail'), email,
      msg, erro, botao,
      h('p', { class: 'suave pequeno' }, 'Se o e-mail não chegar, confira o spam. Se você não tem mais acesso a ele, peça a um admin para gerar um novo PIN.'),
      h('button', { type: 'button', class: 'link-discreto centro', onclick: () => { emailDigitado = email.value.trim(); modo = 'entrar'; desenhar(); } }, 'Voltar para o login')
    );
  }

  desenhar();
}
