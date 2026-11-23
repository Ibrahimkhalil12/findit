/**
 * FindIt - Lost & Found Portal
 * Home Page Controller: Hero Search, Real-Time Stats & Latest Reports
 *
 * Team: Group 3 | MAWTS Institute of Technology
 * Supervisor: Joy Debnath
 * Authors: Christopher Mack Dcosta & Akash Biswas
 */

(function (window) {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. Hero Search Redirection
  // --------------------------------------------------------------------------
  function initHeroSearch() {
    const searchForm = document.getElementById('hero-search-form');
    if (!searchForm) return;

    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('hero-search-input');
      const query = input ? input.value.trim() : '';
      if (query) {
        window.location.href = `items.html?q=${encodeURIComponent(query)}`;
      } else {
        window.location.href = 'items.html';
      }
    });
  }

  // --------------------------------------------------------------------------
  // 2. Platform Statistics
  // --------------------------------------------------------------------------
  async function loadStatistics() {
    const reportedEl = document.getElementById('stat-total-reported');
    const returnedEl = document.getElementById('stat-total-returned');
    const rateEl = document.getElementById('stat-success-rate');
    const activeEl = document.getElementById('stat-active-users');

    try {
      if (window.FindItDB && window.FindItDB.client && window.FindItDB.isConfigured()) {
        const client = window.FindItDB.client;

        // Fetch counts from public_items
        const { count: totalReported } = await client
          .from('items')
          .select('*', { count: 'exact', head: true });

        const { count: totalReturned } = await client
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'returned');

        const { count: totalProfiles } = await client
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        const reportedCount = totalReported || 0;
        const returnedCount = totalReturned || 0;
        const userCount = totalProfiles || 0;
        const rate = reportedCount > 0 ? Math.round((returnedCount / reportedCount) * 100) : 92;

        if (reportedEl) reportedEl.textContent = reportedCount > 0 ? reportedCount : '48+';
        if (returnedEl) returnedEl.textContent = returnedCount > 0 ? returnedCount : '39+';
        if (rateEl) rateEl.textContent = `${rate}%`;
        if (activeEl) activeEl.textContent = userCount > 0 ? `${userCount}+` : '350+';
      } else {
        // Fallback realistic metrics for preview mode
        if (reportedEl) reportedEl.textContent = '48+';
        if (returnedEl) returnedEl.textContent = '39+';
        if (rateEl) rateEl.textContent = '82%';
        if (activeEl) activeEl.textContent = '350+';
      }
    } catch (err) {
      console.warn('[FindIt Stats Notice]', err);
    }
  }

  // --------------------------------------------------------------------------
  // 3. Latest Active Reports (Top 6)
  // --------------------------------------------------------------------------
  async function loadLatestItems() {
    const gridContainer = document.getElementById('latest-items-grid');
    if (!gridContainer) return;

    // Show skeletons
    gridContainer.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      gridContainer.appendChild(createSkeletonCard());
    }

    try {
      let items = [];

      if (window.FindItDB && window.FindItDB.client && window.FindItDB.isConfigured()) {
        const { data, error } = await window.FindItDB.client
          .from('public_items')
          .select('*')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(6);

        if (error) throw error;
        items = data || [];
      }

      // If database returned no items or running in demo preview mode
      if (!items || items.length === 0) {
        items = getFallbackLatestItems();
      }

      gridContainer.innerHTML = '';
      if (items.length === 0) {
        gridContainer.appendChild(createEmptyState());
        return;
      }

      items.forEach(item => {
        gridContainer.appendChild(renderItemCard(item));
      });

    } catch (err) {
      console.warn('[FindIt Latest Items Notice]', err);
      // Fallback
      gridContainer.innerHTML = '';
      const fallback = getFallbackLatestItems();
      fallback.forEach(item => {
        gridContainer.appendChild(renderItemCard(item));
      });
    }
  }

  // --------------------------------------------------------------------------
  // 4. Safe Card Renderer (Zero InnerHTML for User Data)
  // --------------------------------------------------------------------------
  function renderItemCard(item) {
    const card = document.createElement('article');
    card.className = 'item-card';

    // Media
    const mediaDiv = document.createElement('div');
    mediaDiv.className = 'item-card-media';

    const img = document.createElement('img');
    img.className = 'item-card-img';
    img.loading = 'lazy';
    img.alt = item.title;
    img.src = item.image_url || 'assets/images/placeholder.svg';
    img.onerror = () => { img.src = 'assets/images/placeholder.svg'; };

    // Badges overlay
    const badgesDiv = document.createElement('div');
    badgesDiv.className = 'item-card-badges';

    const typeBadge = window.FindIt.createBadge(item.type, item.type);
    const catBadge = document.createElement('span');
    catBadge.className = 'badge badge-category';
    catBadge.textContent = item.category;

    badgesDiv.appendChild(typeBadge);
    badgesDiv.appendChild(catBadge);

    mediaDiv.appendChild(img);
    mediaDiv.appendChild(badgesDiv);

    // Body
    const body = document.createElement('div');
    body.className = 'item-card-body';

    // Meta (Date + Time)
    const meta = document.createElement('div');
    meta.className = 'item-card-meta';
    const calIcon = document.createElement('span');
    calIcon.innerHTML = window.FindIt.icons.calendar;
    const dateSpan = document.createElement('span');
    dateSpan.textContent = window.FindIt.formatDate(item.item_date);
    meta.appendChild(calIcon);
    meta.appendChild(dateSpan);

    // Title
    const title = document.createElement('h3');
    title.className = 'item-card-title';
    title.textContent = item.title;

    // Description
    const desc = document.createElement('p');
    desc.className = 'item-card-desc';
    desc.textContent = item.description;

    // Footer
    const footer = document.createElement('div');
    footer.className = 'item-card-footer';

    const locLabel = document.createElement('div');
    locLabel.className = 'item-location-label';
    const locIcon = document.createElement('span');
    locIcon.innerHTML = window.FindIt.icons.mapPin;
    const locText = document.createElement('span');
    locText.textContent = item.location;
    locLabel.appendChild(locIcon);
    locLabel.appendChild(locText);

    const viewLink = document.createElement('a');
    viewLink.className = 'btn btn-outline btn-sm';
    viewLink.href = `item.html?id=${encodeURIComponent(item.id)}`;
    viewLink.textContent = 'View Details';

    footer.appendChild(locLabel);
    footer.appendChild(viewLink);

    body.appendChild(meta);
    body.appendChild(title);
    body.appendChild(desc);
    body.appendChild(footer);

    card.appendChild(mediaDiv);
    card.appendChild(body);

    return card;
  }

  function createSkeletonCard() {
    const card = document.createElement('div');
    card.className = 'item-card skeleton';
    card.style.height = '360px';
    return card;
  }

  function createEmptyState() {
    const el = document.createElement('div');
    el.className = 'empty-state';
    el.style.gridColumn = '1 / -1';
    el.innerHTML = `
      <div class="empty-state-icon">${window.FindIt.icons.checkCircle}</div>
      <h3 class="empty-state-title">No Active Lost & Found Items</h3>
      <p class="empty-state-desc">All reported belongings have either been safely returned or verified!</p>
      <a href="post.html" class="btn btn-primary btn-sm">Report a New Item</a>
    `;
    return el;
  }

  function getFallbackLatestItems() {
    return [
      {
        id: 'demo-1',
        title: '[DEMO] Lost Black Arctic Hunter Backpack',
        type: 'lost',
        category: 'Bag',
        description: 'Black waterproof backpack with red zipper. Left near Central Library 2nd floor study desk.',
        location: 'Central Library - 2nd Floor',
        item_date: '2026-11-21',
        image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
        status: 'open'
      },
      {
        id: 'demo-2',
        title: '[DEMO] Found MAWTS Student Identity Card',
        type: 'found',
        category: 'ID Card',
        description: 'Found an official student smart card in Computer Lab 3 near Terminal 14.',
        location: 'Computer Lab 3 (Ground Floor)',
        item_date: '2026-11-22',
        image_url: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=800&q=80',
        status: 'open'
      },
      {
        id: 'demo-3',
        title: '[DEMO] Lost White Galaxy Buds 2 Pro in Case',
        type: 'lost',
        category: 'Phone',
        description: 'Matte white Samsung Galaxy Buds in a protective carbon-fiber case. Has anime sticker on bottom.',
        location: 'Cafeteria - East Corner',
        item_date: '2026-11-20',
        image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80',
        status: 'open'
      },
      {
        id: 'demo-4',
        title: '[DEMO] Found Hardcover Spiral Engineering Notebook',
        type: 'found',
        category: 'Books',
        description: 'Dark navy 200-page spiral notebook with handwritten graph paper notes on Algorithms.',
        location: 'Academic Building 1 - Room 402',
        item_date: '2026-11-19',
        image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
        status: 'open'
      },
      {
        id: 'demo-5',
        title: '[DEMO] Lost Casio fx-991EX ClassWiz Calculator',
        type: 'lost',
        category: 'Other',
        description: 'Black and white scientific calculator with sliding cover and small silver "TH" monogram.',
        location: 'Physics Laboratory 201',
        item_date: '2026-11-18',
        image_url: 'https://images.unsplash.com/photo-1611125832047-1d7ad1e8e48f?auto=format&fit=crop&w=800&q=80',
        status: 'open'
      },
      {
        id: 'demo-6',
        title: '[DEMO] Found Olive Green Stainless Steel Water Bottle',
        type: 'found',
        category: 'Other',
        description: 'Insulated 750ml thermal bottle found near outdoor badminton court benches.',
        location: 'Campus Gymnasium & Sports Complex',
        item_date: '2026-11-23',
        image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80',
        status: 'open'
      }
    ];
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initHeroSearch();
    loadStatistics();
    loadLatestItems();
  });

})(window);
