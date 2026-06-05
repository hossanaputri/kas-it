/**
 * KAS IT Dashboard v2 — Shared Vue Components
 * Header, Nav, and Toast components used across all pages.
 */

/**
 * <app-header>
 * Props: clock (String) — formatted date string
 */
const AppHeader = {
  template: `
    <div class="header">
      <h1>💰 KAS IT Dashboard</h1>
      <div class="header-right">
        <span v-if="loggedInName" style="font-size:12px;opacity:0.9;">👤 {{ loggedInName }}</span>
        <button class="btn btn-logout" @click="logout">🚪 Logout</button>
      </div>
    </div>
  `,
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
 */
const AppNav = {
  props: {
    active: { type: String, default: '' },
    pendingCount: { type: Number, default: 0 }
  },
  template: `
    <nav>
      <a href="index.html" :class="{ active: active === 'index' }">🏠 Dashboard</a>
      <a href="transactions.html" :class="{ active: active === 'transactions' }">📋 Transaksi</a>
      <a v-if="isAdmin" href="inbox.html" :class="{ active: active === 'inbox' }" style="position:relative;">📬 Inbox<span v-if="pendingCount > 0" style="position:absolute;top:4px;right:4px;background:#e53935;border-radius:50%;width:10px;height:10px;"></span></a>
      <a v-if="isAdmin" href="events.html" :class="{ active: active === 'events' }">📅 Events</a>
      <a v-if="isAdmin" href="members.html" :class="{ active: active === 'members' }">⚙️ Anggota</a>
    </nav>
  `,
  computed: {
    isAdmin() {
      return sessionStorage.getItem('kas-it-is-admin') === 'true';
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
