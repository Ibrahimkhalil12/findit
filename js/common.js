/**
 * FindIt - Lost & Found Portal
 * Shared Common Utilities, UI System & Security Helpers
 *
 * Team: Group 3 | MAWTS Institute of Technology
 * Supervisor: Joy Debnath
 * Authors: Adib Akanda (UI/UX) & MD Ibrahim Khalil (Security)
 */

(function (window) {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. Scalable Inline SVG Icon System (No Emojis for UI Elements)
  // --------------------------------------------------------------------------
  const ICONS = {
    search: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    filter: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>',
    calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    mapPin: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    tag: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>',
    plus: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
    checkCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    alertCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    shield: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
    shieldCheck: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>',
    award: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>',
    star: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
    user: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    userCheck: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>',
    lock: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
    eye: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    eyeOff: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>',
    trash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
    edit: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    sun: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
    moon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
    arrowRight: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
    x: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    logout: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
    upload: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>'
  };

  // --------------------------------------------------------------------------
  // 2. Theme Management (Light / Dark with localStorage persistence)
  // --------------------------------------------------------------------------
  function initTheme() {
    const savedTheme = localStorage.getItem('findit_theme') || 
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);

    const toggleButtons = document.querySelectorAll('.theme-toggle-btn');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
      });
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('findit_theme', theme);
    const toggleButtons = document.querySelectorAll('.theme-toggle-btn');
    toggleButtons.forEach(btn => {
      btn.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
      btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
      btn.setAttribute('title', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    });
  }

  // --------------------------------------------------------------------------
  // 3. Dynamic Institution & Campus Branding
  // --------------------------------------------------------------------------
  function applyBranding() {
    if (!window.CONFIG) return;
    const instName = window.CONFIG.INSTITUTION_NAME || 'University Portal';
    const instShort = window.CONFIG.INSTITUTION_SHORT || 'Campus';

    document.querySelectorAll('.institution-name').forEach(el => {
      el.textContent = instName;
    });

    document.querySelectorAll('.institution-short').forEach(el => {
      el.textContent = instShort;
    });

    // Update supervisor and group credits in footer if present
    document.querySelectorAll('.footer-supervisor').forEach(el => {
      el.textContent = window.CONFIG.SUPERVISOR || 'Faculty Supervisor';
    });
    document.querySelectorAll('.footer-team-group').forEach(el => {
      el.textContent = window.CONFIG.TEAM_GROUP || 'Group 3';
    });
  }

  // --------------------------------------------------------------------------
  // 4. Toast Notification System
  // --------------------------------------------------------------------------
  function getToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type = 'info', duration = 4000) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconHtml = ICONS.alertCircle;
    if (type === 'success') iconHtml = ICONS.checkCircle;
    if (type === 'info') iconHtml = ICONS.shield;
    if (type === 'warning') iconHtml = ICONS.alertCircle;

    const iconSpan = document.createElement('span');
    iconSpan.innerHTML = iconHtml;

    const textSpan = document.createElement('span');
    textSpan.style.flex = '1';
    textSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close-btn';
    closeBtn.innerHTML = ICONS.x;
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.onclick = () => removeToast(toast);

    toast.appendChild(iconSpan);
    toast.appendChild(textSpan);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    const timer = setTimeout(() => {
      removeToast(toast);
    }, duration);

    toast._timer = timer;
  }

  function removeToast(toast) {
    if (!toast) return;
    if (toast._timer) clearTimeout(toast._timer);
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 200);
  }

  // --------------------------------------------------------------------------
  // 5. Modal Dialog Management
  // --------------------------------------------------------------------------
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // --------------------------------------------------------------------------
  // 6. Safe DOM Helpers & XSS Prevention
  // --------------------------------------------------------------------------
  function createElementSafe(tag, attributes = {}, textContent = null) {
    const el = document.createElement(tag);
    for (const [key, val] of Object.entries(attributes)) {
      if (key === 'className') {
        el.className = val;
      } else if (key === 'dataset') {
        for (const [dKey, dVal] of Object.entries(val)) {
          el.dataset[dKey] = dVal;
        }
      } else {
        el.setAttribute(key, val);
      }
    }
    if (textContent !== null && textContent !== undefined) {
      el.textContent = textContent;
    }
    return el;
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    try {
      const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
      if (seconds < 60) return 'Just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days}d ago`;
      return formatDate(dateStr);
    } catch (e) {
      return '';
    }
  }

  function createBadge(type, text) {
    const span = document.createElement('span');
    span.className = `badge badge-${type.toLowerCase()}`;
    span.textContent = text;
    return span;
  }

  // --------------------------------------------------------------------------
  // 7. Navigation & Dynamic Auth State
  // --------------------------------------------------------------------------
  async function updateNavbarAuthState() {
    const authActionsContainer = document.getElementById('nav-auth-actions');
    if (!authActionsContainer) return;

    // Clear container safely
    while (authActionsContainer.firstChild) {
      authActionsContainer.removeChild(authActionsContainer.firstChild);
    }

    const session = window.FindItDB ? await window.FindItDB.getSession() : null;

    if (session && session.user) {
      // User is logged in
      const displayName = 
        session.user.user_metadata?.full_name || 
        session.user.email?.split('@')[0] || 
        'My Account';

      // Post Item CTA
      const postBtn = createElementSafe('a', {
        href: 'post.html',
        className: 'btn btn-primary btn-sm'
      });
      postBtn.innerHTML = `${ICONS.plus} <span>Report Item</span>`;
      authActionsContainer.appendChild(postBtn);

      // Dashboard Link
      const dashBtn = createElementSafe('a', {
        href: 'dashboard.html',
        className: 'btn btn-secondary btn-sm'
      });
      dashBtn.innerHTML = `${ICONS.user} <span>${escapeText(displayName)}</span>`;
      authActionsContainer.appendChild(dashBtn);

      // Logout Button
      const logoutBtn = createElementSafe('button', {
        className: 'btn btn-outline btn-sm',
        'aria-label': 'Sign out'
      });
      logoutBtn.innerHTML = `${ICONS.logout}`;
      logoutBtn.title = 'Sign Out';
      logoutBtn.onclick = async () => {
        if (window.FindItDB && window.FindItDB.client) {
          await window.FindItDB.client.auth.signOut();
        }
        showToast('You have been signed out.', 'info');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 600);
      };
      authActionsContainer.appendChild(logoutBtn);

    } else {
      // User is logged out
      const loginBtn = createElementSafe('a', {
        href: 'login.html',
        className: 'btn btn-outline btn-sm'
      }, 'Sign In');

      const signupBtn = createElementSafe('a', {
        href: 'signup.html',
        className: 'btn btn-primary btn-sm'
      }, 'Sign Up');

      authActionsContainer.appendChild(loginBtn);
      authActionsContainer.appendChild(signupBtn);
    }
  }

  function escapeText(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function initMobileMenu() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const menu = document.querySelector('.nav-menu');
    if (toggle && menu) {
      toggle.addEventListener('click', () => {
        menu.classList.toggle('open');
      });
    }
  }

  // --------------------------------------------------------------------------
  // 8. Lifecycle Bootstrapper
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    applyBranding();
    initMobileMenu();
    updateNavbarAuthState();
  });

  // Expose API to window.FindIt
  window.FindIt = {
    icons: ICONS,
    showToast,
    openModal,
    closeModal,
    createElementSafe,
    formatDate,
    timeAgo,
    createBadge,
    updateNavbarAuthState
  };

})(window);
