/**
 * JS/AUTH.JS - Manejo de Sesiones, Autenticación y Permisos por Rol
 */

document.addEventListener('DOMContentLoaded', () => {
  checkSession();
});

/**
 * Verifica si existe una sesión activa almacenada en localStorage
 */
function checkSession() {
  const storedUser = localStorage.getItem('pos_user');
  const storedToken = localStorage.getItem('pos_token');

  if (storedUser && storedToken) {
    currentUser = JSON.parse(storedUser);
    document.getElementById('login-overlay').classList.add('hidden');
    setupUserUI();
    initPOSModule();
  } else {
    document.getElementById('login-overlay').classList.remove('hidden');
  }
}

/**
 * Procesa el formulario de Login enviando credenciales al Backend
 */
async function handleLogin(event) {
  event.preventDefault();
  const userVal = document.getElementById('login-user').value.trim();
  const passVal = document.getElementById('login-pass').value.trim();
  const errorDiv = document.getElementById('login-error');

  errorDiv.classList.add('hidden');

  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: userVal, password: passVal })
  });

  const data = await res.json();

  if (data.success) {
    localStorage.setItem('pos_token', data.token);
    localStorage.setItem('pos_user', JSON.stringify(data.user));
    currentUser = data.user;
    
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('login-form').reset();
    
    setupUserUI();
    initPOSModule();
  } else {
    errorDiv.innerText = data.message || 'Error al iniciar sesión';
    errorDiv.classList.remove('hidden');
  }
}

/**
 * Adapta la Interfaz de Usuario según el Rol (Cajero vs Admin)
 */
function setupUserUI() {
  if (!currentUser) return;

  document.getElementById('user-display-name').innerText = currentUser.nombre;
  document.getElementById('user-display-role').innerText = currentUser.rol;

  // Ocultar elementos exclusivos de Administrador si es Cajero
  const adminElements = document.querySelectorAll('.admin-only');
  adminElements.forEach(el => {
    if (currentUser.rol === 'ADMIN') {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

/**
 * Cierra la sesión activa y elimina tokens
 */
function logout() {
  localStorage.removeItem('pos_token');
  localStorage.removeItem('pos_user');
  currentUser = null;
  document.getElementById('login-overlay').classList.remove('hidden');
}