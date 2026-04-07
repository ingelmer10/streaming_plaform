// ============================================
// Auth — Login page
// ============================================

function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <span class="login-logo-icon">🎬</span>
          <h1>StreamVault</h1>
          <p>Gestión de cuentas de streaming</p>
        </div>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="login-username">Usuario</label>
            <input type="text" id="login-username" class="form-input" placeholder="Ingresa tu usuario" autocomplete="username" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="login-password">Contraseña</label>
            <div class="form-input-wrapper">
              <input type="password" id="login-password" class="form-input" placeholder="Ingresa tu contraseña" autocomplete="current-password" required>
              <button type="button" class="toggle-password" onclick="toggleLoginPassword()">👁️</button>
            </div>
          </div>
          <div id="login-error" class="form-error hidden"></div>
          <button type="submit" class="btn btn-primary btn-full btn-lg mt-md" id="login-btn">Iniciar Sesión</button>
        </form>
      </div>
    </div>
  `;
  document.getElementById('login-form').addEventListener('submit', handleLogin);
}

function toggleLoginPassword() {
  const inp = document.getElementById('login-password');
  const btn = inp.nextElementSibling;
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🔒'; }
  else { inp.type = 'password'; btn.textContent = '👁️'; }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  if (!username || !password) {
    errorEl.textContent = '⚠️ Completa todos los campos';
    errorEl.classList.remove('hidden');
    return;
  }
  btn.textContent = 'Ingresando...';
  btn.disabled = true;
  errorEl.classList.add('hidden');
  try {
    await apiLogin(username, password);
    showToast('¡Bienvenido a StreamVault!', 'success');
    navigateTo('dashboard');
  } catch (err) {
    errorEl.textContent = '⚠️ ' + err.message;
    errorEl.classList.remove('hidden');
    btn.textContent = 'Iniciar Sesión';
    btn.disabled = false;
  }
}

function logout() {
  removeToken();
  navigateTo('login');
  showToast('Sesión cerrada', 'info');
}
