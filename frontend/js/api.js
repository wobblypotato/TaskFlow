const API_BASE = (window.__APP_CONFIG__ && window.__APP_CONFIG__.API_BASE) || '/api';

const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('taskflow_token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      credentials: 'include',
      ...options,
      headers
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      // If unauthorized and not already retrying or requesting refresh, attempt refresh
      if (response.status === 401 && endpoint !== '/auth/refresh' && endpoint !== '/auth/login' && !options._isRetry) {
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData?.data?.token) {
              localStorage.setItem('taskflow_token', refreshData.data.token);
              if (refreshData.data.user) {
                localStorage.setItem('taskflow_user', JSON.stringify(refreshData.data.user));
              }
              // Retry original request with new token
              return this.request(endpoint, { ...options, _isRetry: true });
            }
          }
        } catch {
          // Fall through to session clear
        }

        localStorage.removeItem('taskflow_token');
        localStorage.removeItem('taskflow_user');
        const currentPath = window.location.pathname;
        if (!currentPath.includes('login.html') && !currentPath.includes('register.html')) {
          window.location.href = 'login.html';
        }
      }

      const error = new Error(data.error?.message || 'Something went wrong');
      error.code = data.error?.code || 'API_ERROR';
      error.status = response.status;
      throw error;
    }

    return data.data;
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const iconSvg = type === 'success'
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}
