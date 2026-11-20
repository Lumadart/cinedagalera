import { h, montar } from '../dom.js';
import { chamar } from '../api.js';
import { estado } from '../estado.js';
import { guardarToken } from '../sessao.js';
import { NOME_DO_GRUPO } from '../config.js';
import { marcaLogo } from '../ui.js';

export function telaLogin({ raiz, params }) {
  let modo = params && params.convite !== undefined ? 'convite' : 'entrar'; // 'entrar', 'esqueci' ou 'convite'
  let emailDigitado = '';
  let codigoDigitado = (params && params.convite) || '';

  function desenhar() {
    montar(raiz, h('div', { class: 'login' },
      h('section', { class: 'login-marca' },
        h('div', { class: 'marca-grande' }, marcaLogo(), NOME_DO_GRUPO),
        h('h1', null, 'Nosso catálogo de filmes e séries, em um só lugar.'),
        h('p', null, 'Registre o que viu, acompanhe o que está assistindo e descubra o que a galera quer ver.')
      ),
      h('section', { class: 'login-form' }, modo === 'entrar' ? formEntrar() : modo === 'esqueci' ? formEsqueci() : formConvite())
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
      h('button', { type: 'button', class: 'link-discreto centro', onclick: () => { emailDigitado = email.value.trim(); modo = 'esqueci'; desenhar(); } }, 'Esqueci meu PIN'),
      h('button', { type: 'button', class: 'link-discreto centro', onclick: () => { emailDigitado = email.value.trim(); modo = 'convite'; desenhar(); } }, 'Tenho um convite')
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
    const nome = h('input', { id: 'convite-nome', maxlength: '40', autocomplete: 'name', required: true, placeholder: 'Como a galera te chama' });
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
      h('h2', null, 'Tenho um convite'),
      h('p', { class: 'suave' }, 'Use o código que um admin te passou. O seu PIN de acesso chega por e-mail.'),
      h('label', { for: 'convite-codigo' }, 'Código do convite'), codigo,
      h('label', { for: 'convite-nome' }, 'Nome'), nome,
      h('label', { for: 'convite-email' }, 'E-mail'), email,
      msg, erro, botao,
      h('button', { type: 'button', class: 'link-discreto centro', onclick: () => { modo = 'entrar'; desenhar(); } }, 'Voltar para o login'));
  }

  desenhar();
}
