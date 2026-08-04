/**
 * KAS IT Dashboard v2 — Auth Helpers
 * Shared authentication logic for all pages.
 */

// Apply saved theme immediately (prevent flash)
// Default: light mode (first visit). Use localStorage if already set.
(function() {
  const theme = localStorage.getItem('kas-it-theme') || 'light';
  if (theme === 'light') document.body.classList.add('light');
})();

const API_URL = atob('aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J6V2V6VkwwWl9uY01SZzM2TXI3R1hQWW1KUW11dnpsWHU1a2ppMVlITmphV2tfNmpfd1VLQ0hTYjB1enkxYkhMMElVdy9leGVj');

/**
 * Check if user is authenticated.
 * Redirects to login.html if not valid.
 * Returns true if auth check passes (or pending async verify).
 */
function checkAuth() {
  const token = sessionStorage.getItem('kas-it-token');
  const loginTime = sessionStorage.getItem('kas-it-login-time');
  if (!token || !loginTime) { window.location.href = 'login.html'; return false; }
  if (Date.now() - Number(loginTime) > 24 * 60 * 60 * 1000) {
    sessionStorage.removeItem('kas-it-token');
    sessionStorage.removeItem('kas-it-login-time');
    window.location.href = 'login.html?expired';
    return false;
  }
  // Async server-side verify + auto-refresh
  fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'verifyToken', token }) })
    .then(r => r.json())
    .then(result => {
      if (!result.valid) {
        sessionStorage.removeItem('kas-it-token');
        sessionStorage.removeItem('kas-it-login-time');
        window.location.href = 'login.html?expired';
      }
    }).catch(() => {});
  return true;
}

/**
 * Logout: invalidate token on server, clear session, redirect.
 */
function doLogout() {
  const token = sessionStorage.getItem('kas-it-token');
  if (token) {
    fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'logout', token }) });
  }
  sessionStorage.removeItem('kas-it-token');
  sessionStorage.removeItem('kas-it-login-time');
  sessionStorage.removeItem('kas-it-member-nik');
  sessionStorage.removeItem('kas-it-member-name');
  sessionStorage.removeItem('kas-it-is-admin');
  window.location.href = 'login.html';
}

/**
 * Get current session info.
 */
function getSession() {
  return {
    token: sessionStorage.getItem('kas-it-token') || '',
    nik: sessionStorage.getItem('kas-it-member-nik') || '',
    name: sessionStorage.getItem('kas-it-member-name') || '',
    isAdmin: sessionStorage.getItem('kas-it-is-admin') === 'true'
  };
}

/**
 * Auth-related computed properties mixin for Vue apps.
 */
const authMixin = {
  computed: {
    isLoggedIn() {
      const token = sessionStorage.getItem('kas-it-token');
      const loginTime = sessionStorage.getItem('kas-it-login-time');
      if (!token || !loginTime) return false;
      return Date.now() - Number(loginTime) < 24 * 60 * 60 * 1000;
    },
    isAdmin() {
      return this.isLoggedIn && sessionStorage.getItem('kas-it-is-admin') === 'true';
    },
    loggedInName() {
      return sessionStorage.getItem('kas-it-member-name') || '';
    },
    loggedInNik() {
      return sessionStorage.getItem('kas-it-member-nik') || '';
    }
  },
  methods: {
    logout() {
      doLogout();
    }
  }
};

/**
 * Notification count mixin — auto-fetches unread count for badge display.
 * Pages that include this get `notifCount` in data, loaded on mount.
 */
const notifMixin = {
  data() {
    return {
      notifCount: 0
    };
  },
  mounted() {
    this.loadNotifCount();
  },
  methods: {
    async loadNotifCount() {
      try {
        const token = sessionStorage.getItem('kas-it-token');
        if (!token) return;
        const res = await fetch(API_URL + '?action=notifCount&token=' + encodeURIComponent(token));
        const data = await res.json();
        this.notifCount = data.count || 0;
      } catch (e) { /* silent */ }
    }
  }
};
