/**
 * FindIt - Lost & Found Portal
 * Main Admin Portal Controller: Admin Login, All Reports CRUD & Claims Oversight
 *
 * Team: Group 3 | MAWTS Institute of Technology
 * Supervisor: Joy Debnath
 */

(function (window) {
  'use strict';

  let adminUser = null;
  let allItems = [];
  let allClaims = [];
  let selectedItem = null;

  const filters = {
    search: '',
    type: 'all',
    status: 'all',
    category: 'all'
  };

  // ==========================================================================
  // PART A: ADMIN LOGIN PAGE (admin-login.html)
  // ==========================================================================
  async function initAdminLoginPage() {
    const form = document.getElementById('admin-login-form');
    if (!form) return;

    const errorEl = document.getElementById('admin-auth-error');

    // Show denied message if redirected from admin.html
    const params = new URLSearchParams(window.location.search);
    if (params.get('denied') === '1') {
      showError(errorEl, 'Access Denied: You must sign in with an administrator account to access the Main Admin Portal.');
    }

    // If already signed in as admin, go directly to admin.html
    if (window.FindItDB && await window.FindItDB.isAdmin()) {
      window.location.href = 'admin.html';
      return;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = form.email.value.trim();
      const password = form.password.value;
      const submitBtn = form.querySelector('button[type="submit"]');

      if (!email || !password) {
        showError(errorEl, 'Please enter both administrator email and password.');
        return;
      }

      setLoading(submitBtn, true, 'Verifying Admin Credentials...');
      hideError(errorEl);

      try {
        if (!window.FindItDB || !window.FindItDB.client || !window.FindItDB.isConfigured()) {
          throw new Error('Supabase is not configured. Please check config.js.');
        }

        const { error } = await window.FindItDB.client.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        const isAdmin = await window.FindItDB.isAdmin();
        if (!isAdmin) {
          await window.FindItDB.client.auth.signOut();
          throw new Error('Access Denied: This account does not have administrator privileges.');
        }

        window.FindIt.showToast('Welcome to the Main Admin Portal!', 'success');
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 500);

      } catch (err) {
        console.error('[FindIt Admin Login Error]', err);
        let msg = err.message || 'Failed to sign in to Admin Portal.';
        if (msg.toLowerCase().includes('invalid login credentials')) {
          msg = 'Invalid administrator email or password.';
        }
        showError(errorEl, msg);
        window.FindIt.showToast(msg, 'error');
      } finally {
        setLoading(submitBtn, false, 'Sign In to Admin Portal');
      }
    });
  }

  // ==========================================================================
  // PART B: ADMIN DASHBOARD PAGE (admin.html)
  // ==========================================================================
  async function initAdminDashboardPage() {
    const tableBody = document.getElementById('admin-items-tbody');
    if (!tableBody) return;

    adminUser = await window.FindItAuth.requireAdmin();
    if (!adminUser) return;

    const labelEl = document.getElementById('admin-account-label');
    if (labelEl) {
      const profile = await window.FindItDB.getProfile();
      const name = (profile && profile.full_name) || adminUser.user_metadata?.full_name || 'Administrator';
      labelEl.textContent = `Signed in as ${name} (${adminUser.email})`;
    }

    bindSectionTabs();
    bindFilterEvents();
    bindModalEvents();

    const refreshBtn = document.getElementById('admin-btn-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => loadAllAdminData(true));
    }

    await loadAllAdminData(false);
  }

  async function loadAllAdminData(showFeedback) {
    await Promise.all([loadAdminItems(), loadAdminClaims()]);
    updateAdminStats();
    if (showFeedback) {
      window.FindIt.showToast('Admin data refreshed.', 'info');
    }
  }

  // --------------------------------------------------------------------------
  // 1. Fetch All Lost & Found Items (All Users)
  // --------------------------------------------------------------------------
  async function loadAdminItems() {
    const tbody = document.getElementById('admin-items-tbody');
    if (!tbody) return;

    try {
      const { data, error } = await window.FindItDB.client
        .from('items')
        .select('id, user_id, title, type, category, description, location, item_date, image_url, status, verify_question, contact_phone, contact_email, points_awarded, created_at, updated_at, profiles(full_name, email, phone)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      allItems = data || [];
      renderItemsTable();
    } catch (err) {
      console.error('[FindIt Admin Items Error]', err);
      tbody.innerHTML = '';
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.style.cssText = 'text-align: center; padding: 2rem; color: var(--danger-text);';
      td.textContent = `Failed to load reports: ${err.message || 'Check database migration & admin RLS policies.'}`;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  // --------------------------------------------------------------------------
  // 2. Fetch Verified Claims Log
  // --------------------------------------------------------------------------
  async function loadAdminClaims() {
    const tbody = document.getElementById('admin-claims-tbody');
    if (!tbody) return;

    try {
      const { data, error } = await window.FindItDB.client.rpc('get_admin_claims');
      if (error) throw error;
      allClaims = Array.isArray(data) ? data : [];
      renderClaimsTable();
    } catch (err) {
      console.warn('[FindIt Admin Claims Notice]', err);
      allClaims = [];
      tbody.innerHTML = '';
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.style.cssText = 'text-align: center; padding: 2rem; color: var(--text-muted);';
      td.textContent = 'No claim records available (ensure admin_and_contact_migration.sql has been applied).';
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  // --------------------------------------------------------------------------
  // 3. Stats & Rendering
  // --------------------------------------------------------------------------
  function updateAdminStats() {
    const totalEl = document.getElementById('admin-stat-total');
    const lostEl = document.getElementById('admin-stat-lost');
    const foundEl = document.getElementById('admin-stat-found');
    const returnedEl = document.getElementById('admin-stat-returned');
    const claimsEl = document.getElementById('admin-stat-claims');

    if (totalEl) totalEl.textContent = allItems.length;
    if (lostEl) lostEl.textContent = allItems.filter(i => i.type === 'lost').length;
    if (foundEl) foundEl.textContent = allItems.filter(i => i.type === 'found').length;
    if (returnedEl) returnedEl.textContent = allItems.filter(i => i.status === 'returned').length;
    if (claimsEl) claimsEl.textContent = allClaims.length;
  }

  function getFilteredItems() {
    return allItems.filter(item => {
      if (filters.type !== 'all' && item.type !== filters.type) return false;
      if (filters.status !== 'all' && item.status !== filters.status) return false;
      if (filters.category !== 'all' && item.category !== filters.category) return false;
      if (filters.search) {
        const term = filters.search.toLowerCase();
        const posterName = (item.profiles?.full_name || '').toLowerCase();
        const posterEmail = (item.profiles?.email || '').toLowerCase();
        const contactEmail = (item.contact_email || '').toLowerCase();
        const match =
          (item.title || '').toLowerCase().includes(term) ||
          (item.location || '').toLowerCase().includes(term) ||
          (item.description || '').toLowerCase().includes(term) ||
          posterName.includes(term) ||
          posterEmail.includes(term) ||
          contactEmail.includes(term);
        if (!match) return false;
      }
      return true;
    });
  }

  function renderItemsTable() {
    const tbody = document.getElementById('admin-items-tbody');
    const countEl = document.getElementById('admin-results-count');
    if (!tbody) return;

    const filtered = getFilteredItems();

    if (countEl) {
      countEl.textContent = `Showing ${filtered.length} of ${allItems.length} total reports`;
    }

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.style.cssText = 'text-align: center; padding: 2.5rem; color: var(--text-muted);';
      td.textContent = 'No reports match the current filters.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    filtered.forEach(item => {
      const tr = document.createElement('tr');

      // Col 1: Thumbnail + Title + Category
      const tdItem = document.createElement('td');
      const itemWrap = document.createElement('div');
      itemWrap.style.cssText = 'display: flex; align-items: center; gap: 0.75rem; min-width: 220px;';

      const img = document.createElement('img');
      img.className = 'admin-item-thumb';
      img.src = item.image_url || 'assets/images/placeholder.svg';
      img.alt = item.title;
      img.onerror = () => { img.src = 'assets/images/placeholder.svg'; };

      const textWrap = document.createElement('div');
      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-weight: 700; color: var(--text-primary); font-size: 0.9rem;';
      titleEl.textContent = item.title;

      const catEl = document.createElement('div');
      catEl.style.cssText = 'font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;';
      catEl.textContent = item.category;

      textWrap.appendChild(titleEl);
      textWrap.appendChild(catEl);
      itemWrap.appendChild(img);
      itemWrap.appendChild(textWrap);
      tdItem.appendChild(itemWrap);

      // Col 2: Type badge
      const tdType = document.createElement('td');
      tdType.appendChild(window.FindIt.createBadge(item.type, item.type));

      // Col 3: Location & Date
      const tdLoc = document.createElement('td');
      const locMain = document.createElement('div');
      locMain.style.cssText = 'font-weight: 600; font-size: 0.85rem; color: var(--text-primary);';
      locMain.textContent = item.location;

      const locDate = document.createElement('div');
      locDate.style.cssText = 'font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;';
      locDate.textContent = window.FindIt.formatDate(item.item_date);

      tdLoc.appendChild(locMain);
      tdLoc.appendChild(locDate);

      // Col 4: Poster & Contact
      const tdPoster = document.createElement('td');
      const posterName = document.createElement('div');
      posterName.style.cssText = 'font-weight: 600; font-size: 0.85rem; color: var(--text-primary);';
      posterName.textContent = item.profiles?.full_name || 'Campus Member';

      const effectivePhone = item.contact_phone || item.profiles?.phone || 'No phone';
      const effectiveEmail = item.contact_email || item.profiles?.email || 'No email';
      const posterContact = document.createElement('div');
      posterContact.style.cssText = 'font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;';
      posterContact.textContent = `${effectivePhone} • ${effectiveEmail}`;

      tdPoster.appendChild(posterName);
      tdPoster.appendChild(posterContact);

      // Col 5: Status badge
      const tdStatus = document.createElement('td');
      tdStatus.appendChild(window.FindIt.createBadge(item.status, item.status));

      // Col 6: Actions
      const tdActions = document.createElement('td');
      const actionsGroup = document.createElement('div');
      actionsGroup.className = 'admin-action-group';

      const viewLink = document.createElement('a');
      viewLink.className = 'btn btn-outline btn-sm';
      viewLink.href = `item.html?id=${encodeURIComponent(item.id)}`;
      viewLink.textContent = 'View';

      const statusBtn = document.createElement('button');
      statusBtn.type = 'button';
      statusBtn.className = 'btn btn-secondary btn-sm';
      statusBtn.textContent = 'Status';
      statusBtn.onclick = () => openStatusModal(item);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-outline btn-sm';
      editBtn.innerHTML = window.FindIt.icons.edit;
      editBtn.title = 'Edit Report';
      editBtn.setAttribute('aria-label', 'Edit Report');
      editBtn.onclick = () => openEditModal(item);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-outline btn-sm';
      delBtn.style.color = 'var(--danger-btn)';
      delBtn.innerHTML = window.FindIt.icons.trash;
      delBtn.title = 'Delete Report';
      delBtn.setAttribute('aria-label', 'Delete Report');
      delBtn.onclick = () => openDeleteModal(item);

      actionsGroup.appendChild(viewLink);
      actionsGroup.appendChild(statusBtn);
      actionsGroup.appendChild(editBtn);
      actionsGroup.appendChild(delBtn);
      tdActions.appendChild(actionsGroup);

      tr.appendChild(tdItem);
      tr.appendChild(tdType);
      tr.appendChild(tdLoc);
      tr.appendChild(tdPoster);
      tr.appendChild(tdStatus);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });
  }

  function renderClaimsTable() {
    const tbody = document.getElementById('admin-claims-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (allClaims.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.style.cssText = 'text-align: center; padding: 2.5rem; color: var(--text-muted);';
      td.textContent = 'No verified ownership claims recorded yet.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    allClaims.forEach(c => {
      const tr = document.createElement('tr');

      const tdItem = document.createElement('td');
      const link = document.createElement('a');
      link.href = `item.html?id=${encodeURIComponent(c.item_id)}`;
      link.style.cssText = 'font-weight: 700; color: var(--primary-600);';
      link.textContent = c.item_title || 'Reported Item';
      tdItem.appendChild(link);

      const tdFinder = document.createElement('td');
      const fName = document.createElement('div');
      fName.style.fontWeight = '600';
      fName.textContent = c.finder_name || 'Campus Member';
      const fEmail = document.createElement('div');
      fEmail.style.cssText = 'font-size: 0.78rem; color: var(--text-muted);';
      fEmail.textContent = c.finder_email || '';
      tdFinder.appendChild(fName);
      tdFinder.appendChild(fEmail);

      const tdClaimer = document.createElement('td');
      const cName = document.createElement('div');
      cName.style.fontWeight = '600';
      cName.textContent = c.claimer_name || 'Campus Member';
      const cMeta = document.createElement('div');
      cMeta.style.cssText = 'font-size: 0.78rem; color: var(--text-secondary);';
      cMeta.textContent = `${c.claimer_phone || 'No phone'} • ${c.claimer_email || 'No email'}`;
      tdClaimer.appendChild(cName);
      tdClaimer.appendChild(cMeta);

      const tdStatus = document.createElement('td');
      tdStatus.appendChild(window.FindIt.createBadge(c.claim_status || 'verified', c.claim_status || 'verified'));

      const tdDate = document.createElement('td');
      tdDate.style.cssText = 'font-size: 0.85rem; color: var(--text-secondary);';
      tdDate.textContent = window.FindIt.formatDate(c.verified_at || c.created_at);

      tr.appendChild(tdItem);
      tr.appendChild(tdFinder);
      tr.appendChild(tdClaimer);
      tr.appendChild(tdStatus);
      tr.appendChild(tdDate);
      tbody.appendChild(tr);
    });
  }

  // --------------------------------------------------------------------------
  // 4. Modals: Status, Full Edit & Delete
  // --------------------------------------------------------------------------
  function openStatusModal(item) {
    selectedItem = item;
    const titleEl = document.getElementById('admin-status-item-title');
    const selectEl = document.getElementById('admin-status-select');
    if (titleEl) titleEl.textContent = item.title;
    if (selectEl) selectEl.value = item.status;
    window.FindIt.openModal('admin-modal-status');
  }

  async function handleSaveStatus() {
    if (!selectedItem) return;
    const selectEl = document.getElementById('admin-status-select');
    const saveBtn = document.getElementById('admin-btn-save-status');
    const newStatus = selectEl.value;

    setLoading(saveBtn, true, 'Updating...');
    try {
      const { error } = await window.FindItDB.client
        .from('items')
        .update({ status: newStatus })
        .eq('id', selectedItem.id);

      if (error) throw error;

      selectedItem.status = newStatus;
      window.FindIt.closeModal('admin-modal-status');
      window.FindIt.showToast(`Status updated to "${newStatus}".`, 'success');
      updateAdminStats();
      renderItemsTable();
    } catch (err) {
      console.error('[FindIt Admin Status Error]', err);
      window.FindIt.showToast(err.message || 'Failed to update status.', 'error');
    } finally {
      setLoading(saveBtn, false, 'Save Status');
    }
  }

  function openEditModal(item) {
    selectedItem = item;
    const form = document.getElementById('admin-edit-form');
    const errEl = document.getElementById('admin-edit-error');
    if (!form) return;

    hideError(errEl);
    form.title.value = item.title || '';
    form.type.value = item.type || 'lost';
    form.category.value = item.category || 'Other';
    form.status.value = item.status || 'open';
    form.location.value = item.location || '';
    form.item_date.value = item.item_date || '';
    form.contact_phone.value = item.contact_phone || '';
    form.contact_email.value = item.contact_email || '';
    form.description.value = item.description || '';
    form.verify_question.value = item.verify_question || '';
    form.verify_answer.value = '';

    toggleEditVerifyFields(form.type.value);
    window.FindIt.openModal('admin-modal-edit');
  }

  function toggleEditVerifyFields(typeVal) {
    const group = document.getElementById('admin-edit-verify-group');
    if (group) {
      group.style.display = typeVal === 'found' ? 'block' : 'none';
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!selectedItem) return;

    const form = document.getElementById('admin-edit-form');
    const saveBtn = document.getElementById('admin-btn-save-edit');
    const errEl = document.getElementById('admin-edit-error');

    const payload = {
      p_item_id: selectedItem.id,
      p_title: form.title.value.trim(),
      p_type: form.type.value,
      p_category: form.category.value,
      p_description: form.description.value.trim(),
      p_location: form.location.value.trim(),
      p_item_date: form.item_date.value,
      p_status: form.status.value,
      p_contact_phone: form.contact_phone.value.trim() || null,
      p_contact_email: form.contact_email.value.trim() || null,
      p_verify_question: form.type.value === 'found' ? form.verify_question.value.trim() : null,
      p_verify_answer: form.type.value === 'found' ? (form.verify_answer.value.trim() || null) : null
    };

    if (payload.p_title.length < 3) {
      showError(errEl, 'Title must be at least 3 characters.');
      return;
    }
    if (payload.p_location.length < 2) {
      showError(errEl, 'Location must be at least 2 characters.');
      return;
    }
    if (payload.p_description.length < 5) {
      showError(errEl, 'Description must be at least 5 characters.');
      return;
    }
    if (payload.p_type === 'found' && !payload.p_verify_question) {
      showError(errEl, 'A secret verification question is required for Found items.');
      return;
    }

    setLoading(saveBtn, true, 'Saving...');
    hideError(errEl);

    try {
      const { error } = await window.FindItDB.client.rpc('admin_update_item', payload);
      if (error) throw error;

      window.FindIt.closeModal('admin-modal-edit');
      window.FindIt.showToast('Report updated successfully.', 'success');
      await loadAllAdminData(false);
    } catch (err) {
      console.error('[FindIt Admin Edit Error]', err);
      showError(errEl, err.message || 'Failed to update report.');
      window.FindIt.showToast(err.message || 'Failed to update report.', 'error');
    } finally {
      setLoading(saveBtn, false, 'Save Changes');
    }
  }

  function openDeleteModal(item) {
    selectedItem = item;
    const titleEl = document.getElementById('admin-delete-item-title');
    if (titleEl) titleEl.textContent = item.title;
    window.FindIt.openModal('admin-modal-delete');
  }

  function extractStoragePath(imageUrl) {
    if (!imageUrl || !window.CONFIG || !window.CONFIG.SUPABASE_URL) return null;
    const bucket = window.CONFIG.STORAGE_BUCKET_NAME || 'item-images';
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = imageUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(imageUrl.substring(idx + marker.length));
  }

  async function handleConfirmDelete() {
    if (!selectedItem) return;
    const delBtn = document.getElementById('admin-btn-confirm-delete');
    setLoading(delBtn, true, 'Deleting...');

    try {
      const storagePath = extractStoragePath(selectedItem.image_url);

      const { error } = await window.FindItDB.client
        .from('items')
        .delete()
        .eq('id', selectedItem.id);

      if (error) throw error;

      // Best-effort cleanup of uploaded image from Supabase Storage
      if (storagePath) {
        const bucket = (window.CONFIG && window.CONFIG.STORAGE_BUCKET_NAME) || 'item-images';
        await window.FindItDB.client.storage.from(bucket).remove([storagePath]);
      }

      allItems = allItems.filter(x => x.id !== selectedItem.id);
      window.FindIt.closeModal('admin-modal-delete');
      window.FindIt.showToast('Report permanently deleted.', 'info');
      updateAdminStats();
      renderItemsTable();
    } catch (err) {
      console.error('[FindIt Admin Delete Error]', err);
      window.FindIt.showToast(err.message || 'Failed to delete report.', 'error');
    } finally {
      setLoading(delBtn, false, 'Delete Permanently');
    }
  }

  // --------------------------------------------------------------------------
  // 5. Event Binding & Helpers
  // --------------------------------------------------------------------------
  function bindSectionTabs() {
    const tabs = document.querySelectorAll('.admin-section-tab');
    const itemsSec = document.getElementById('admin-section-items');
    const claimsSec = document.getElementById('admin-section-claims');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.getAttribute('data-section');
        if (itemsSec) itemsSec.style.display = target === 'items' ? 'block' : 'none';
        if (claimsSec) claimsSec.style.display = target === 'claims' ? 'block' : 'none';
      });
    });
  }

  function bindFilterEvents() {
    const searchEl = document.getElementById('admin-filter-search');
    const typeEl = document.getElementById('admin-filter-type');
    const statusEl = document.getElementById('admin-filter-status');
    const catEl = document.getElementById('admin-filter-category');
    const resetBtn = document.getElementById('admin-btn-reset');

    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        filters.search = e.target.value.trim();
        renderItemsTable();
      });
    }
    if (typeEl) {
      typeEl.addEventListener('change', (e) => {
        filters.type = e.target.value;
        renderItemsTable();
      });
    }
    if (statusEl) {
      statusEl.addEventListener('change', (e) => {
        filters.status = e.target.value;
        renderItemsTable();
      });
    }
    if (catEl) {
      catEl.addEventListener('change', (e) => {
        filters.category = e.target.value;
        renderItemsTable();
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        filters.search = '';
        filters.type = 'all';
        filters.status = 'all';
        filters.category = 'all';
        if (searchEl) searchEl.value = '';
        if (typeEl) typeEl.value = 'all';
        if (statusEl) statusEl.value = 'all';
        if (catEl) catEl.value = 'all';
        renderItemsTable();
      });
    }
  }

  function bindModalEvents() {
    const saveStatusBtn = document.getElementById('admin-btn-save-status');
    if (saveStatusBtn) saveStatusBtn.addEventListener('click', handleSaveStatus);

    const editForm = document.getElementById('admin-edit-form');
    if (editForm) editForm.addEventListener('submit', handleSaveEdit);

    const editTypeSelect = document.getElementById('admin-edit-type');
    if (editTypeSelect) {
      editTypeSelect.addEventListener('change', (e) => toggleEditVerifyFields(e.target.value));
    }

    const confirmDeleteBtn = document.getElementById('admin-btn-confirm-delete');
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleConfirmDelete);

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.FindIt.closeModal(btn.getAttribute('data-close-modal'));
      });
    });
  }

  function setLoading(btn, isLoading, text) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = text;
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

  // Lifecycle
  document.addEventListener('DOMContentLoaded', () => {
    initAdminLoginPage();
    initAdminDashboardPage();
  });

})(window);
