/**
 * FindIt - Lost & Found Portal
 * Supabase Client Initialization & Connectivity Helper
 *
 * Team: Group 3 | MAWTS Institute of Technology
 * Supervisor: Joy Debnath
 * Author: MD Ibrahim Khalil (Team Leader & Database Security Engineer)
 */

(function (window) {
  'use strict';

  // Check if Supabase JS SDK loaded via CDN
  if (typeof window.supabase === 'undefined') {
    console.error('[FindIt] Supabase JavaScript SDK is not loaded. Please verify the CDN script tag in HTML.');
  }

  // Validate configuration presence
  const isConfigured = 
    window.CONFIG &&
    window.CONFIG.SUPABASE_URL &&
    window.CONFIG.SUPABASE_ANON_KEY &&
    !window.CONFIG.SUPABASE_URL.includes('YOUR_SUPABASE_PROJECT_ID') &&
    !window.CONFIG.SUPABASE_URL.includes('xyzcompany');

  let supabaseClient = null;

  try {
    if (window.supabase && window.CONFIG) {
      supabaseClient = window.supabase.createClient(
        window.CONFIG.SUPABASE_URL,
        window.CONFIG.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );
    }
  } catch (err) {
    console.warn('[FindIt] Notice: Supabase client initialized in placeholder/demo mode.', err);
  }

  // Fallback demo mock if Supabase credentials have not yet been replaced
  const mockStorage = {
    getItem: (k) => localStorage.getItem('findit_mock_' + k),
    setItem: (k, v) => localStorage.setItem('findit_mock_' + k, v)
  };

  window.FindItDB = {
    client: supabaseClient,
    isConfigured: () => isConfigured,

    /**
     * Safe wrapper to obtain current active session
     */
    async getSession() {
      if (!supabaseClient) return null;
      try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) {
          console.warn('[FindIt] Session check notice:', error.message);
          return null;
        }
        return data.session;
      } catch (e) {
        return null;
      }
    },

    /**
     * Safe wrapper to obtain current user
     */
    async getUser() {
      if (!supabaseClient) return null;
      try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error || !user) return null;
        return user;
      } catch (e) {
        return null;
      }
    }
  };

})(window);
