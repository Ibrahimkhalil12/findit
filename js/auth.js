/**
 * FindIt - Lost & Found Portal
 * Authentication, Session Guards & User Verification
 *
 * Team: Group 3 | MAWTS Institute of Technology
 * Supervisor: Joy Debnath
 * Author: Konika Tripura (Auth & Forms Developer)
 */

(function (window) {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. Password Visibility Toggle
  // --------------------------------------------------------------------------
  function initPasswordToggles() {
    document.querySelectorAll('.password-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const inputId = btn.getAttribute('data-target');
        const input = document.getElementById(inputId);
        if (!input) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.innerHTML = isPassword ? window.FindIt.icons.eyeOff : window.FindIt.icons.eye;
        btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      });
    });
  }

  // --------------------------------------------------------------------------
  // 2. Route Protection Guards
  // --------------------------------------------------------------------------
  async function requireAuth() {
    if (!window.FindItDB) return;
    const session = await window.FindItDB.getSession();
    if (!session) {
      const currentPath = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
      window.location.href = `login.html?redirect=${currentPath}`;
      return null;
    }
    return session.user;
  }

  async function redirectIfAuth(destination = 'dashboard.html') {
    if (!window.FindItDB) return;
    const session = await window.FindItDB.getSession();
    if (session) {
      if (destination === 'dashboard.html') {
        const isAdmin = await window.FindItDB.isAdmin();
        if (isAdmin) {
          window.location.href = 'admin.html';
          return;
        }
      }
      window.location.href = destination;
    }
  }

  async function requireAdmin() {
    if (!window.FindItDB) return null;
    const session = await window.FindItDB.getSession();
    if (!session || !session.user) {
      window.location.href = 'admin-login.html';
      return null;
    }

    const isAdmin = await window.FindItDB.isAdmin();
    if (!isAdmin) {
      if (window.FindIt) {
        window.FindIt.showToast('Access Denied: Admin privileges are required.', 'error');
      }
      window.location.href = 'admin-login.html?denied=1';
      return null;
    }

    return session.user;
  }

  // --------------------------------------------------------------------------
  // 3. Login Controller
  // --------------------------------------------------------------------------
  function initLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = form.email.value.trim();
      const password = form.password.value;
      const submitBtn = form.querySelector('button[type="submit"]');
      const errorAlert = document.getElementById('auth-error-alert');

      if (!email || !password) {
        showError(errorAlert, 'Please enter both email and password.');
        return;
      }

      setLoading(submitBtn, true, 'Signing in...');
      hideError(errorAlert);

      try {
        if (!window.FindItDB || !window.FindItDB.client) {
          throw new Error('Supabase client not initialized. Please verify config.js.');
        }

        const { data, error } = await window.FindItDB.client.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          throw error;
        }

        window.FindIt.showToast('Login successful! Welcome back.', 'success');
        
        // Check redirect query param (admins default to admin.html if no explicit redirect)
        const urlParams = new URLSearchParams(window.location.search);
        let redirect = urlParams.get('redirect');
        if (!redirect) {
          const isAdmin = await window.FindItDB.isAdmin();
          redirect = isAdmin ? 'admin.html' : 'dashboard.html';
        }
        
        setTimeout(() => {
          window.location.href = decodeURIComponent(redirect);
        }, 600);

      } catch (err) {
        console.error('[FindIt Auth Error]', err);
        let msg = 'Failed to sign in. Please verify your credentials.';
        if (err.message && err.message.toLowerCase().includes('invalid login credentials')) {
          msg = 'Invalid email or password. Please try again.';
        } else if (err.message && err.message.toLowerCase().includes('email not confirmed')) {
          msg = 'Please check your inbox and confirm your email address before logging in.';
        }
        showError(errorAlert, msg);
        window.FindIt.showToast(msg, 'error');
      } finally {
        setLoading(submitBtn, false, 'Sign In');
      }
    });
  }

  // --------------------------------------------------------------------------
  // 4. Signup Controller
  // --------------------------------------------------------------------------
  function initSignupForm() {
    const form = document.getElementById('signup-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fullName = form.full_name.value.trim();
      const email = form.email.value.trim();
      const phone = form.phone.value.trim();
      const password = form.password.value;
      const confirmPassword = form.confirm_password.value;
      const submitBtn = form.querySelector('button[type="submit"]');
      const errorAlert = document.getElementById('auth-error-alert');

      // Validation
      if (fullName.length < 2) {
        showError(errorAlert, 'Please enter your full name (at least 2 characters).');
        return;
      }

      if (!isValidEmail(email)) {
        showError(errorAlert, 'Please enter a valid email address.');
        return;
      }

      if (phone && phone.length < 7) {
        showError(errorAlert, 'Please enter a valid phone number (at least 7 digits).');
        return;
      }

      if (password.length < 6) {
        showError(errorAlert, 'Password must be at least 6 characters long.');
        return;
      }

      if (password !== confirmPassword) {
        showError(errorAlert, 'Passwords do not match. Please re-enter.');
        return;
      }

      setLoading(submitBtn, true, 'Creating Account...');
      hideError(errorAlert);

      try {
        if (!window.FindItDB || !window.FindItDB.client) {
          throw new Error('Supabase client not initialized. Please verify config.js.');
        }

        const { data, error } = await window.FindItDB.client.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone || null
            }
          }
        });

        if (error) {
          throw error;
        }

        // If email confirmation is enabled on Supabase project
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          showError(errorAlert, 'An account with this email already exists. Please sign in instead.');
          return;
        }

        window.FindIt.showToast('Account created successfully!', 'success');

        const successAlert = document.getElementById('auth-success-alert');
        if (successAlert) {
          successAlert.textContent = 'Account created! If email confirmation is required, please check your inbox. Redirecting to dashboard...';
          successAlert.style.display = 'block';
        }

        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1500);

      } catch (err) {
        console.error('[FindIt Signup Error]', err);
        showError(errorAlert, err.message || 'An error occurred during registration.');
        window.FindIt.showToast(err.message || 'Signup failed.', 'error');
      } finally {
        setLoading(submitBtn, false, 'Create Student Account');
      }
    });
  }

  // --------------------------------------------------------------------------
  // 5. Helpers
  // --------------------------------------------------------------------------
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function setLoading(button, isLoading, text) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = text;
  }

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  function hideError(el) {
    if (!el) return;
    el.style.display = 'none';
  }

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', () => {
    initPasswordToggles();
    initLoginForm();
    initSignupForm();
  });

  window.FindItAuth = {
    requireAuth,
    redirectIfAuth,
    requireAdmin
  };

})(window);
