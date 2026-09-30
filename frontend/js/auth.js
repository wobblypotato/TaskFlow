const auth = {
  getToken() {
    return localStorage.getItem('taskflow_token');
  },

  getUser() {
    const userStr = localStorage.getItem('taskflow_user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  setSession(token, user) {
    localStorage.setItem('taskflow_token', token);
    localStorage.setItem('taskflow_user', JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem('taskflow_token');
    localStorage.removeItem('taskflow_user');
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
    }
  },

  redirectIfAuthenticated() {
    if (this.isAuthenticated()) {
      window.location.href = 'dashboard.html';
    }
  },

  logout() {
    this.clearSession();
    window.location.href = 'login.html';
  }
};

function initLoginForm() {
  const loginForm = document.getElementById('login-form');
  const errorAlert = document.getElementById('auth-error');

  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorAlert) errorAlert.style.display = 'none';

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Signing in...';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const data = await api.post('/auth/login', { email, password });
      auth.setSession(data.token, data.user);
      window.location.href = 'dashboard.html';
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;

      if (errorAlert) {
        errorAlert.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>${escapeHtml(err.message || 'Login failed. Please check your credentials.')}</span>
        `;
        errorAlert.style.display = 'flex';
      } else {
        alert(err.message || 'Login failed');
      }
    }
  });
}

function initRegisterForm() {
  const registerForm = document.getElementById('register-form');
  const errorAlert = document.getElementById('auth-error');

  if (!registerForm) return;

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorAlert) errorAlert.style.display = 'none';

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;

    if (confirmPassword && password !== confirmPassword) {
      if (errorAlert) {
        errorAlert.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>Passwords do not match</span>
        `;
        errorAlert.style.display = 'flex';
      }
      return;
    }

    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Creating account...';

    try {
      const data = await api.post('/auth/register', { name, email, password });
      auth.setSession(data.token, data.user);
      window.location.href = 'dashboard.html';
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;

      if (errorAlert) {
        errorAlert.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>${escapeHtml(err.message || 'Registration failed.')}</span>
        `;
        errorAlert.style.display = 'flex';
      } else {
        alert(err.message || 'Registration failed');
      }
    }
  });
}
