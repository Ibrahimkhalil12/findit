/**
 * FindIt - Lost & Found Portal
 * User Dashboard Controller: Profile, Post Management, Status Workflow & Badges
 *
 * Team: Group 3 | MAWTS Institute of Technology
 * Supervisor: Joy Debnath
 * Author: Akash Biswas (Dashboard & Gamification Developer)
 */

(function (window) {
  'use strict';

  let currentUser = null;
  let userProfile = null;
  let userItems = [];
  let userClaims = [];
  let activeTab = 'all'; // 'all', 'lost', 'found'

  // Item currently being edited or deleted
  let selectedItemAction = null;

  // --------------------------------------------------------------------------
  // 1. Initialization
  // --------------------------------------------------------------------------
  async function initDashboard() {
    currentUser = await window.FindItAuth.requireAuth();
    if (!currentUser) return; // Will redirect to login

    initTabs();
    initModals();
    await loadUserProfile();
    await loadUserItems();
    await loadUserClaims();
  }

  // --------------------------------------------------------------------------
  // 2. User Profile & Badges
  // --------------------------------------------------------------------------
  async function loadUserProfile() {
    const nameEl = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    const phoneEl = document.getElementById('profile-phone');
    const pointsEl = document.getElementById('profile-points');
    const badgeEl = document.getElementById('profile-badge');
    const returnsEl = document.getElementById('profile-returns');

    try {
      let profile = null;

      if (window.FindItDB && window.FindItDB.client && window.FindItDB.isConfigured()) {
        const { data, error } = await window.FindItDB.client
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (!error && data) {
          profile = data;
        }
      }

      if (!profile) {
        // Fallback or newly registered user defaults
        profile = {
          full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Campus Member',
          phone: currentUser.user_metadata?.phone || '+880 1711-000000',
          points: 50,
          items_returned_count: 1
        };
      }

      userProfile = profile;

      if (nameEl) nameEl.textContent = profile.full_name;
      if (emailEl) emailEl.textContent = currentUser.email || 'N/A';
      if (phoneEl) phoneEl.textContent = profile.phone || 'No phone set';
      if (pointsEl) pointsEl.textContent = `${profile.points || 0} pts`;
      if (returnsEl) returnsEl.textContent = profile.items_returned_count || 0;

      // Calculate Badge Tier
      const points = profile.points || 0;
      let badgeName = 'Good Citizen';
      let badgeColor = 'badge-category';

      if (points >= 300) {
        badgeName = 'Campus Guardian Gold';
        badgeColor = 'badge-claimed';
      } else if (points >= 150) {
        badgeName = 'Silver Returner';
        badgeColor = 'badge-returned';
      } else if (points >= 50) {
        badgeName = 'Campus Helper';
        badgeColor = 'badge-open';
      }

      if (badgeEl) {
        badgeEl.textContent = badgeName;
      }

    } catch (err) {
      console.warn('[FindIt Profile Notice]', err);
    }
  }

  // --------------------------------------------------------------------------
  // 3. User Posted Items
  // --------------------------------------------------------------------------
  async function loadUserItems() {
    const listContainer = document.getElementById('my-items-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const skel = document.createElement('div');
      skel.className = 'skeleton';
      skel.style.height = '90px';
      skel.style.marginBottom = '1rem';
      listContainer.appendChild(skel);
    }

    try {
      let items = [];

      if (window.FindItDB && window.FindItDB.client && window.FindItDB.isConfigured()) {
        const { data, error } = await window.FindItDB.client
          .from('items')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        items = data || [];
      } else {
        // Fallback user items for preview
        items = [
          {
            id: 'my-item-1',
            title: 'MAWTS Student Identity Card (Found near Lab 3)',
            type: 'found',
            category: 'ID Card',
            location: 'Computer Lab 3 (Ground Floor)',
            status: 'open',
            item_date: '2026-11-22',
            description: 'Found smart card. Question: Last 4 digits of roll number.'
          },
          {
            id: 'my-item-2',
            title: 'Lost Casio fx-991EX Calculator',
            type: 'lost',
            category: 'Other',
            location: 'Physics Lab 201',
            status: 'open',
            item_date: '2026-11-18',
            description: 'Lost calculator with silver TH monogram.'
          }
        ];
      }

      userItems = items;
      renderFilteredUserItems();

    } catch (err) {
      console.error('[FindIt User Items Error]', err);
      listContainer.innerHTML = '';
      listContainer.appendChild(createEmptyState('Failed to load your reports.'));
    }
  }

  function renderFilteredUserItems() {
    const listContainer = document.getElementById('my-items-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    const filtered = userItems.filter(item => {
      if (activeTab === 'lost') return item.type === 'lost';
      if (activeTab === 'found') return item.type === 'found';
      return true;
    });

    if (filtered.length === 0) {
      listContainer.appendChild(createEmptyState('You have not posted any reports in this category.'));
      return;
    }

    filtered.forEach(item => {
      listContainer.appendChild(renderDashboardItemRow(item));
    });
  }

  function renderDashboardItemRow(item) {
    const row = document.createElement('div');
    row.className = 'dashboard-item-row';
    row.style.cssText = 'background-color: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;';

    // Left info
    const leftDiv = document.createElement('div');
    leftDiv.style.cssText = 'display: flex; flex-direction: column; gap: 0.35rem; max-width: 60%;';

    const badgesDiv = document.createElement('div');
    badgesDiv.style.cssText = 'display: flex; gap: 0.5rem; align-items: center;';
    badgesDiv.appendChild(window.FindIt.createBadge(item.type, item.type));
    badgesDiv.appendChild(window.FindIt.createBadge(item.status, item.status));

    const titleEl = document.createElement('h4');
    titleEl.style.cssText = 'font-size: 1rem; font-weight: 700; color: var(--text-primary); margin: 0;';
    titleEl.textContent = item.title;

    const metaEl = document.createElement('div');
    metaEl.style.cssText = 'font-size: 0.8125rem; color: var(--text-secondary); display: flex; gap: 1rem; flex-wrap: wrap;';
    metaEl.textContent = `Location: ${item.location} • Date: ${window.FindIt.formatDate(item.item_date)}`;

    leftDiv.appendChild(badgesDiv);
    leftDiv.appendChild(titleEl);
    leftDiv.appendChild(metaEl);

    // Right action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = 'display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;';

    // View Details link
    const viewBtn = document.createElement('a');
    viewBtn.className = 'btn btn-outline btn-sm';
    viewBtn.href = `item.html?id=${encodeURIComponent(item.id)}`;
    viewBtn.textContent = 'View';

    // Status Selector Button
    const statusBtn = document.createElement('button');
    statusBtn.className = 'btn btn-secondary btn-sm';
    statusBtn.textContent = 'Change Status';
    statusBtn.onclick = () => openStatusModal(item);

    // Edit Button
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-outline btn-sm';
    editBtn.innerHTML = `${window.FindIt.icons.edit}`;
    editBtn.title = 'Edit Report';
    editBtn.onclick = () => openEditModal(item);

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-outline btn-sm';
    delBtn.style.color = 'var(--danger-btn)';
    delBtn.innerHTML = `${window.FindIt.icons.trash}`;
    delBtn.title = 'Delete Report';
    delBtn.onclick = () => openDeleteModal(item);

    actionsDiv.appendChild(viewBtn);
    actionsDiv.appendChild(statusBtn);
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(delBtn);

    row.appendChild(leftDiv);
    row.appendChild(actionsDiv);

    return row;
  }

  // --------------------------------------------------------------------------
  // 4. Claims Activity
  // --------------------------------------------------------------------------
  async function loadUserClaims() {
    const claimsContainer = document.getElementById('my-claims-list');
    if (!claimsContainer) return;

    try {
      let claims = [];

      if (window.FindItDB && window.FindItDB.client && window.FindItDB.isConfigured()) {
        const { data, error } = await window.FindItDB.client
          .from('claims')
          .select('*, items(title, type, location)')
          .eq('claimer_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          claims = data;
        }
      } else {
        // Fallback demo claim
        claims = [
          {
            id: 'claim-1',
            status: 'verified',
            verified_at: '2026-11-23T11:00:00Z',
            items: {
              title: '[DEMO] Found MAWTS Student Identity Card',
              type: 'found',
              location: 'Computer Lab 3'
            }
          }
        ];
      }

      userClaims = claims;
      claimsContainer.innerHTML = '';

      if (claims.length === 0) {
        claimsContainer.appendChild(createEmptyState('No claim activities recorded yet. When you verify ownership of a found item, it will show up here.'));
        return;
      }

      claims.forEach(c => {
        const row = document.createElement('div');
        row.style.cssText = 'background-color: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem 1.25rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;';

        const info = document.createElement('div');
        const itemTitle = c.items?.title || 'Reported Belonging';
        const dateStr = window.FindIt.formatDate(c.verified_at || c.created_at);

        info.innerHTML = `<strong>${escapeText(itemTitle)}</strong><div style="font-size:0.8125rem; color:var(--text-muted); margin-top:2px;">Claimed on: ${dateStr}</div>`;

        const badge = window.FindIt.createBadge(c.status, c.status);

        row.appendChild(info);
        row.appendChild(badge);
        claimsContainer.appendChild(row);
      });

    } catch (err) {
      console.warn('[FindIt Claims Notice]', err);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Status Workflow Transition
  // --------------------------------------------------------------------------
  function openStatusModal(item) {
    selectedItemAction = item;
    const titleEl = document.getElementById('status-modal-item-title');
    const selectEl = document.getElementById('item-new-status-select');

    if (titleEl) titleEl.textContent = item.title;
    if (selectEl) selectEl.value = item.status;

    window.FindIt.openModal('modal-status-change');
  }

  async function handleStatusChangeSubmit() {
    if (!selectedItemAction) return;

    const selectEl = document.getElementById('item-new-status-select');
    const newStatus = selectEl.value;

    try {
      if (window.FindItDB && window.FindItDB.client && window.FindItDB.isConfigured()) {
        const { error } = await window.FindItDB.client
          .from('items')
          .update({ status: newStatus })
          .eq('id', selectedItemAction.id)
          .eq('user_id', currentUser.id);

        if (error) throw error;
      }

      // Update in local state
      selectedItemAction.status = newStatus;
      window.FindIt.closeModal('modal-status-change');

      if (newStatus === 'returned' && selectedItemAction.type === 'found') {
        window.FindIt.showToast('Status marked as Returned! Finder recognition points awarded (+50 pts)!', 'success');
        await loadUserProfile(); // Refresh points
      } else {
        window.FindIt.showToast('Item status updated successfully.', 'success');
      }

      renderFilteredUserItems();

    } catch (err) {
      console.error('[FindIt Status Update Error]', err);
      window.FindIt.showToast(err.message || 'Failed to update status', 'error');
    }
  }

  // --------------------------------------------------------------------------
  // 6. Edit Post
  // --------------------------------------------------------------------------
  function openEditModal(item) {
    selectedItemAction = item;
    const form = document.getElementById('edit-item-form');
    if (!form) return;

    form.edit_title.value = item.title || '';
    form.edit_category.value = item.category || 'Other';
    form.edit_location.value = item.location || '';
    form.edit_description.value = item.description || '';

    window.FindIt.openModal('modal-edit-item');
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!selectedItemAction) return;

    const form = document.getElementById('edit-item-form');
    const title = form.edit_title.value.trim();
    const category = form.edit_category.value;
    const location = form.edit_location.value.trim();
    const description = form.edit_description.value.trim();

    try {
      if (window.FindItDB && window.FindItDB.client && window.FindItDB.isConfigured()) {
        const { error } = await window.FindItDB.client
          .from('items')
          .update({
            title,
            category,
            location,
            description
          })
          .eq('id', selectedItemAction.id)
          .eq('user_id', currentUser.id);

        if (error) throw error;
      }

      selectedItemAction.title = title;
      selectedItemAction.category = category;
      selectedItemAction.location = location;
      selectedItemAction.description = description;

      window.FindIt.closeModal('modal-edit-item');
      window.FindIt.showToast('Report updated successfully.', 'success');
      renderFilteredUserItems();

    } catch (err) {
      console.error('[FindIt Edit Error]', err);
      window.FindIt.showToast(err.message || 'Failed to update item', 'error');
    }
  }

  // --------------------------------------------------------------------------
  // 7. Delete Post
  // --------------------------------------------------------------------------
  function openDeleteModal(item) {
    selectedItemAction = item;
    const titleEl = document.getElementById('delete-modal-item-title');
    if (titleEl) titleEl.textContent = item.title;
    window.FindIt.openModal('modal-delete-confirm');
  }

  async function handleDeleteConfirm() {
    if (!selectedItemAction) return;

    try {
      if (window.FindItDB && window.FindItDB.client && window.FindItDB.isConfigured()) {
        const { error } = await window.FindItDB.client
          .from('items')
          .delete()
          .eq('id', selectedItemAction.id)
          .eq('user_id', currentUser.id);

        if (error) throw error;
      }

      userItems = userItems.filter(x => x.id !== selectedItemAction.id);
      window.FindIt.closeModal('modal-delete-confirm');
      window.FindIt.showToast('Report deleted successfully.', 'info');
      renderFilteredUserItems();

    } catch (err) {
      console.error('[FindIt Delete Error]', err);
      window.FindIt.showToast(err.message || 'Failed to delete report', 'error');
    }
  }

  // --------------------------------------------------------------------------
  // 8. Tabs & Modals Binding
  // --------------------------------------------------------------------------
  function initTabs() {
    document.querySelectorAll('.dash-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dash-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.getAttribute('data-tab');
        renderFilteredUserItems();
      });
    });
  }

  function initModals() {
    // Status modal submit
    const statusSaveBtn = document.getElementById('btn-save-status');
    if (statusSaveBtn) {
      statusSaveBtn.addEventListener('click', handleStatusChangeSubmit);
    }

    // Edit modal form submit
    const editForm = document.getElementById('edit-item-form');
    if (editForm) {
      editForm.addEventListener('submit', handleEditSubmit);
    }

    // Delete modal confirm button
    const deleteConfirmBtn = document.getElementById('btn-confirm-delete');
    if (deleteConfirmBtn) {
      deleteConfirmBtn.addEventListener('click', handleDeleteConfirm);
    }

    // Close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        window.FindIt.closeModal(modalId);
      });
    });
  }

  function createEmptyState(msg) {
    const el = document.createElement('div');
    el.className = 'empty-state';
    el.innerHTML = `
      <div class="empty-state-icon">${window.FindIt.icons.alertCircle}</div>
      <h4 class="empty-state-title">No Reports Found</h4>
      <p class="empty-state-desc">${msg}</p>
      <a href="post.html" class="btn btn-primary btn-sm">Create New Report</a>
    `;
    return el;
  }

  function escapeText(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Lifecycle
  document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
  });

})(window);
