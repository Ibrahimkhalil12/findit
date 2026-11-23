/**
 * FindIt - Lost & Found Portal
 * Items Explorer Controller: Search, Multi-Filter, Pagination & Cards
 *
 * Team: Group 3 | MAWTS Institute of Technology
 * Supervisor: Joy Debnath
 * Author: Christopher Mack Dcosta (Search & Filter Developer)
 */

(function (window) {
  'use strict';

  let currentItems = [];
  let currentPage = 1;
  const itemsPerPage = (window.CONFIG && window.CONFIG.ITEMS_PER_PAGE) || 9;
  let hasMoreItems = false;

  // Filter state
  const filters = {
    search: '',
    type: 'all',      // 'all', 'lost', 'found'
    category: 'all',  // 'all', 'Bag', 'Phone', 'ID Card', 'Books', 'Keys', 'Other'
    location: '',
    date: '',
    sort: 'newest'    // 'newest', 'oldest'
  };

  // --------------------------------------------------------------------------
  // 1. Initialize Filters from URL Parameters & DOM
  // --------------------------------------------------------------------------
  function initFiltersFromUrl() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('q')) {
      filters.search = params.get('q').trim();
      const searchInput = document.getElementById('filter-search');
      if (searchInput) searchInput.value = filters.search;
    }

    if (params.has('type')) {
      filters.type = params.get('type').toLowerCase();
      updateTypeTabActiveState(filters.type);
    }

    if (params.has('category')) {
      filters.category = params.get('category');
      const catSelect = document.getElementById('filter-category');
      if (catSelect) catSelect.value = filters.category;
    }
  }

  function updateTypeTabActiveState(type) {
    document.querySelectorAll('.filter-type-btn').forEach(btn => {
      const btnType = btn.getAttribute('data-type');
      if (btnType === type) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function bindFilterEvents() {
    // Search input (with debounce)
    const searchInput = document.getElementById('filter-search');
    let debounceTimer;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          filters.search = e.target.value.trim();
          currentPage = 1;
          fetchAndRenderItems();
        }, 300);
      });
    }

    // Type Tabs (All, Lost, Found)
    document.querySelectorAll('.filter-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        filters.type = type;
        updateTypeTabActiveState(type);
        currentPage = 1;
        fetchAndRenderItems();
      });
    });

    // Category Select
    const catSelect = document.getElementById('filter-category');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        filters.category = e.target.value;
        currentPage = 1;
        fetchAndRenderItems();
      });
    }

    // Location Filter
    const locInput = document.getElementById('filter-location');
    if (locInput) {
      locInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          filters.location = e.target.value.trim();
          currentPage = 1;
          fetchAndRenderItems();
        }, 300);
      });
    }

    // Date Filter
    const dateInput = document.getElementById('filter-date');
    if (dateInput) {
      dateInput.addEventListener('change', (e) => {
        filters.date = e.target.value;
        currentPage = 1;
        fetchAndRenderItems();
      });
    }

    // Sort Select
    const sortSelect = document.getElementById('filter-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        filters.sort = e.target.value;
        currentPage = 1;
        fetchAndRenderItems();
      });
    }

    // Clear Filters Button
    const clearBtn = document.getElementById('btn-clear-filters');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        filters.search = '';
        filters.type = 'all';
        filters.category = 'all';
        filters.location = '';
        filters.date = '';
        filters.sort = 'newest';

        if (searchInput) searchInput.value = '';
        if (catSelect) catSelect.value = 'all';
        if (locInput) locInput.value = '';
        if (dateInput) dateInput.value = '';
        if (sortSelect) sortSelect.value = 'newest';
        updateTypeTabActiveState('all');

        currentPage = 1;
        fetchAndRenderItems();
      });
    }

    // Load More Button
    const loadMoreBtn = document.getElementById('btn-load-more');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        fetchAndRenderItems(true);
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. Fetch Items from Supabase (or Fallback Mock)
  // --------------------------------------------------------------------------
  async function fetchAndRenderItems(append = false) {
    const grid = document.getElementById('items-container');
    const countLabel = document.getElementById('results-count');
    const loadMoreContainer = document.getElementById('load-more-container');
    if (!grid) return;

    if (!append) {
      grid.innerHTML = '';
      for (let i = 0; i < 6; i++) {
        grid.appendChild(createSkeletonCard());
      }
    }

    try {
      let items = [];
      let totalCount = 0;

      if (window.FindItDB && window.FindItDB.client && window.FindItDB.isConfigured()) {
        const client = window.FindItDB.client;
        
        // Base query from safe public_items view (status = open)
        let query = client
          .from('public_items')
          .select('*', { count: 'exact' })
          .eq('status', 'open');

        // Apply filters
        if (filters.type !== 'all') {
          query = query.eq('type', filters.type);
        }

        if (filters.category !== 'all') {
          query = query.eq('category', filters.category);
        }

        if (filters.location) {
          query = query.ilike('location', `%${filters.location}%`);
        }

        if (filters.date) {
          query = query.eq('item_date', filters.date);
        }

        if (filters.search) {
          query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,location.ilike.%${filters.search}%`);
        }

        // Sorting
        query = query.order('created_at', { ascending: filters.sort === 'oldest' });

        // Pagination
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;

        items = data || [];
        totalCount = count || items.length;

      } else {
        // Fallback demo mock for immediate review
        const allFallback = getFallbackCatalog();
        let filtered = allFallback.filter(item => {
          if (filters.type !== 'all' && item.type !== filters.type) return false;
          if (filters.category !== 'all' && item.category !== filters.category) return false;
          if (filters.location && !item.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
          if (filters.date && item.item_date !== filters.date) return false;
          if (filters.search) {
            const term = filters.search.toLowerCase();
            const match = item.title.toLowerCase().includes(term) ||
                          item.description.toLowerCase().includes(term) ||
                          item.location.toLowerCase().includes(term);
            if (!match) return false;
          }
          return true;
        });

        if (filters.sort === 'oldest') {
          filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        } else {
          filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        totalCount = filtered.length;
        const from = (currentPage - 1) * itemsPerPage;
        items = filtered.slice(from, from + itemsPerPage);
      }

      if (!append) {
        grid.innerHTML = '';
        currentItems = items;
      } else {
        currentItems = currentItems.concat(items);
      }

      // Update count label safely
      if (countLabel) {
        countLabel.textContent = `Showing ${currentItems.length} of ${totalCount} items`;
      }

      // Render cards
      if (currentItems.length === 0) {
        grid.appendChild(createEmptyState());
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';
        return;
      }

      if (!append) {
        currentItems.forEach(item => grid.appendChild(renderItemCard(item)));
      } else {
        items.forEach(item => grid.appendChild(renderItemCard(item)));
      }

      // Pagination control visibility
      hasMoreItems = currentItems.length < totalCount;
      if (loadMoreContainer) {
        loadMoreContainer.style.display = hasMoreItems ? 'block' : 'none';
      }

    } catch (err) {
      console.error('[FindIt Items Error]', err);
      grid.innerHTML = '';
      grid.appendChild(createEmptyState('Unable to load listings. Please check network connection or configuration.'));
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';
    }
  }

  // --------------------------------------------------------------------------
  // 3. Card Renderer
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

    // Meta
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

  function createEmptyState(message) {
    const el = document.createElement('div');
    el.className = 'empty-state';
    el.style.gridColumn = '1 / -1';
    el.innerHTML = `
      <div class="empty-state-icon">${window.FindIt.icons.alertCircle}</div>
      <h3 class="empty-state-title">No Matching Items Found</h3>
      <p class="empty-state-desc">${message || 'Try adjusting your search query, clearing filters, or checking back later.'}</p>
    `;
    return el;
  }

  function getFallbackCatalog() {
    return [
      {
        id: 'demo-1',
        title: '[DEMO] Lost Black Arctic Hunter Backpack',
        type: 'lost',
        category: 'Bag',
        description: 'Black waterproof backpack with red zipper. Left near Central Library 2nd floor study desk.',
        location: 'Central Library - 2nd Floor',
        item_date: '2026-11-21',
        created_at: '2026-11-21T10:00:00Z',
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
        created_at: '2026-11-22T14:30:00Z',
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
        created_at: '2026-11-20T12:00:00Z',
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
        created_at: '2026-11-19T09:15:00Z',
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
        created_at: '2026-11-18T16:45:00Z',
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
        created_at: '2026-11-23T08:20:00Z',
        image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80',
        status: 'open'
      },
      {
        id: 'demo-7',
        title: '[DEMO] Found University Dormitory Keys on Lanyard',
        type: 'found',
        category: 'Keys',
        description: 'Set of two Yale brass keys attached to a blue MAWTS embroidered lanyard. Found on the pathway to Hall 2.',
        location: 'North Walkway between Hall 1 & 2',
        item_date: '2026-11-22',
        created_at: '2026-11-22T17:10:00Z',
        image_url: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=800&q=80',
        status: 'open'
      }
    ];
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initFiltersFromUrl();
    bindFilterEvents();
    fetchAndRenderItems();
  });

})(window);
