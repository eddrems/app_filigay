import Alpine from './alpine-core.js';
import { logout, requireAuth } from './guard.js';
import { ROLES } from './roles.js';

const NAV = [
  { id: 'admin', label: 'Administración', href: 'admin.html', icon: 'admin_panel_settings', roles: [ROLES.admin] },
  { id: 'teacher', label: 'Portal docente', href: 'docente.html', icon: 'history_edu', roles: [ROLES.admin, ROLES.teacher] },
  { id: 'student', label: 'Portal estudiante', href: 'estudiante.html', icon: 'person_book', roles: [ROLES.admin, ROLES.teacher, ROLES.student] },
];

document.addEventListener('alpine:init', () => {
  Alpine.data('zaoLayout', (activeId, allowedRoles = null) => ({
    session: null,
    loading: true,
    mobileNav: false,
    activeId,
    search: '',

    get navItems() {
      if (!this.session) return [];
      const role = this.session.role;
      return NAV.filter((item) => item.roles.includes(role));
    },

    get displayName() {
      return this.session?.name?.split(' ')[0] || 'Usuario';
    },

    isActive(id) {
      return this.activeId === id;
    },

    async init() {
      this.session = await requireAuth(allowedRoles);
      this.loading = false;
    },

    async signOut() {
      await logout();
    },

    toggleMobileNav() {
      this.mobileNav = !this.mobileNav;
    },
  }));
});
