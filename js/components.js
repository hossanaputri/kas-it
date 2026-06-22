/**
 * IT-Kas — Shared Vue Components
 * Sidebar Nav, Header (mobile), and Toast components.
 */

/**
 * <app-header>
 * Mobile-only top bar with hamburger + page title + theme toggle
 * On desktop this is hidden (sidebar handles everything)
 */
const AppHeader = {
  template: `
    <div class="header">
      <h1><img src="../icons/icon-192.png" alt="IT-Kas" style="height:28px;vertical-align:middle;margin-right:6px;">IT-Kas</h1>
      <div class="header-right">
        <button class="hamburger-btn" @click="$emit('toggle-nav')">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  `,
  emits: ['toggle-nav']
};

/**
 * <app-nav>
 * Desktop: fixed sidebar (left, full-height) with logo, links, user, theme, logout
 * Mobile: slide-in drawer from right (same as before)
 */
const AppNav = {
  props: {
    active: { type: String, default: '' },
    pendingCount: { type: Number, default: 0 },
    open: { type: Boolean, default: false }
  },
  emits: ['close'],
  template: `
    <div class="nav-overlay" :class="{ open: open }" @click="$emit('close')"></div>
    <aside class="sidebar" :class="{ open: open }">
      <div class="sidebar-header">
        <img src="../icons/icon-192.png" alt="IT-Kas" class="sidebar-logo">
        <span class="sidebar-title">IT-Kas</span>
        <button class="nav-close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="sidebar-links">
        <a href="index.html" :class="{ active: active === 'index' }"><span class="nav-icon">🏠</span> Dashboard</a>
        <a href="transactions.html" :class="{ active: active === 'transactions' }"><span class="nav-icon">📋</span> Transaksi</a>
        <a v-if="isAdmin" href="inbox.html" :class="{ active: active === 'inbox' }"><span class="nav-icon">📬</span> Inbox<span v-if="pendingCount > 0" class="inbox-badge-nav"></span></a>
        <a v-if="isAdmin" href="events.html" :class="{ active: active === 'events' }"><span class="nav-icon">📅</span> Events</a>
        <a v-if="isAdmin" href="members.html" :class="{ active: active === 'members' }"><span class="nav-icon">⚙️</span> Anggota</a>
      </div>

      <div class="sidebar-footer">
        <div class="sidebar-divider"></div>
        <div class="sidebar-user" v-if="userName">
          <div class="sidebar-user-avatar">{{ userName.charAt(0) }}</div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">{{ userName }}</div>
            <div class="sidebar-user-role">{{ isAdmin ? 'Admin' : 'Member' }}</div>
          </div>
          <button class="theme-toggle sidebar-theme" @click="toggleTheme" :title="isDark ? 'Light mode' : 'Dark mode'">{{ isDark ? '🌙' : '☀️' }}</button>
        </div>
        <button class="sidebar-logout-btn" @click="logout">🚪 Logout</button>
      </div>
    </aside>
  `,
  data() {
    return {
      isDark: (localStorage.getItem('kas-it-theme') || 'dark') === 'dark'
    };
  },
  computed: {
    isAdmin() {
      return sessionStorage.getItem('kas-it-is-admin') === 'true';
    },
    userName() {
      return sessionStorage.getItem('kas-it-member-name') || '';
    }
  },
  methods: {
    logout() {
      doLogout();
    },
    toggleTheme() {
      this.isDark = !this.isDark;
      const theme = this.isDark ? 'dark' : 'light';
      localStorage.setItem('kas-it-theme', theme);
      if (theme === 'light') {
        document.body.classList.add('light');
      } else {
        document.body.classList.remove('light');
      }
    }
  }
};

/**
 * <app-toast>
 */
const AppToast = {
  props: {
    show: { type: Boolean, default: false },
    message: { type: String, default: '' },
    success: { type: Boolean, default: true }
  },
  emits: ['close'],
  template: `
    <div class="toast-overlay" :class="{ show: show }" @click="$emit('close')">
      <div class="toast" @click.stop>
        <div class="toast-icon">{{ success ? '✅' : '❌' }}</div>
        <div class="toast-msg">{{ message }}</div>
        <button class="toast-btn" :class="{ error: !success }" @click="$emit('close')">OK</button>
      </div>
    </div>
  `
};

/**
 * Register all shared components on a Vue app instance.
 */
function registerComponents(app) {
  app.component('app-header', AppHeader);
  app.component('app-nav', AppNav);
  app.component('app-toast', AppToast);
}
