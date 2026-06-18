/**
 * KAS IT Dashboard v2 — Shared Vue Components
 * Header, Nav, and Toast components used across all pages.
 */

/**
 * <app-header>
 */
const AppHeader = {
  template: `
    <div class="header">
      <h1>💰 KAS IT</h1>
      <div class="header-right">
        <span v-if="loggedInName" style="font-size:12px;opacity:0.9;">👤 {{ loggedInName }}</span>
        <button class="btn btn-logout header-logout-btn" @click="logout">🚪 Logout</button>
        <button class="hamburger-btn" @click="$emit('toggle-nav')">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  `,
  emits: ['toggle-nav'],
  computed: {
    loggedInName() {
      return sessionStorage.getItem('kas-it-member-name') || '';
    }
  },
  methods: {
    logout() {
      doLogout();
    }
  }
};

/**
 * <app-nav>
 * Props: active (String) — current page name: 'index'|'transactions'|'inbox'|'events'|'members'
 *        pendingCount (Number) — inbox pending badge count
 *        open (Boolean) — mobile drawer open state
 * Events: close
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
    <nav :class="{ open: open }">
      <div class="nav-drawer-header">
        <div class="nav-drawer-logo">💰</div>
        <div class="nav-drawer-title">KAS IT</div>
        <button class="nav-close-btn" @click="$emit('close')">✕</button>
      </div>
      <div class="nav-drawer-user" v-if="userName">
        <div class="nav-user-avatar">{{ userName.charAt(0) }}</div>
        <div class="nav-user-info">
          <div class="nav-user-name">{{ userName }}</div>
          <div class="nav-user-role">{{ isAdmin ? 'Admin' : 'Member' }}</div>
        </div>
      </div>
      <div class="nav-divider"></div>
      <div class="nav-links">
        <a href="index.html" :class="{ active: active === 'index' }"><span class="nav-icon">🏠</span> Dashboard</a>
        <a href="transactions.html" :class="{ active: active === 'transactions' }"><span class="nav-icon">📋</span> Transaksi</a>
        <a v-if="isAdmin" href="inbox.html" :class="{ active: active === 'inbox' }" style="position:relative;"><span class="nav-icon">📬</span> Inbox<span v-if="pendingCount > 0" class="inbox-badge-nav"></span></a>
        <a v-if="isAdmin" href="events.html" :class="{ active: active === 'events' }"><span class="nav-icon">📅</span> Events</a>
        <a v-if="isAdmin" href="members.html" :class="{ active: active === 'members' }"><span class="nav-icon">⚙️</span> Anggota</a>
      </div>
      <div class="nav-drawer-footer">
        <div class="nav-divider"></div>
        <button class="nav-logout-btn" @click="doLogout()">🚪 Logout</button>
      </div>
    </nav>
  `,
  computed: {
    isAdmin() {
      return sessionStorage.getItem('kas-it-is-admin') === 'true';
    },
    userName() {
      return sessionStorage.getItem('kas-it-member-name') || '';
    }
  }
};

/**
 * <app-toast>
 * Props: show (Boolean), message (String), success (Boolean)
 * Events: close
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
 * Usage: registerComponents(app)
 */
function registerComponents(app) {
  app.component('app-header', AppHeader);
  app.component('app-nav', AppNav);
  app.component('app-toast', AppToast);
}
