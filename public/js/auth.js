/* ===========================
   CNTRD – Auth Page JS
   =========================== */

// Redirect if already logged in
if (localStorage.getItem('cntrd_token')) {
  window.location.href = '/feed.html';
}

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

document.getElementById('show-register').addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.remove('active');
  registerForm.classList.add('active');
  loginError.textContent = '';
});

document.getElementById('show-login').addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.classList.remove('active');
  loginForm.classList.add('active');
  registerError.textContent = '';
});

// Allow Enter key to submit
document.getElementById('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});
document.getElementById('reg-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleRegister();
});

document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('register-btn').addEventListener('click', handleRegister);

async function handleLogin() {
  const btn = document.getElementById('login-btn');
  const login = document.getElementById('login-field').value.trim();
  const password = document.getElementById('login-password').value;
  loginError.textContent = '';

  if (!login || !password) {
    loginError.textContent = 'Please fill in all fields.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    });
    const data = await res.json();
    if (!res.ok) {
      loginError.textContent = data.error || 'Login failed.';
    } else {
      localStorage.setItem('cntrd_token', data.token);
      localStorage.setItem('cntrd_user', JSON.stringify(data.user));
      window.location.href = '/feed.html';
    }
  } catch {
    loginError.textContent = 'Network error. Please try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
}

async function handleRegister() {
  const btn = document.getElementById('register-btn');
  const display_name = document.getElementById('reg-display-name').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  registerError.textContent = '';

  if (!username || !email || !password) {
    registerError.textContent = 'Username, email, and password are required.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating account…';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, display_name })
    });
    const data = await res.json();
    if (!res.ok) {
      registerError.textContent = data.error || 'Registration failed.';
    } else {
      localStorage.setItem('cntrd_token', data.token);
      localStorage.setItem('cntrd_user', JSON.stringify(data.user));
      window.location.href = '/feed.html';
    }
  } catch {
    registerError.textContent = 'Network error. Please try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create account';
  }
}
