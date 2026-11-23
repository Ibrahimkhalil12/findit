/**
 * FindIt - Lost & Found Portal
 * Item Details & Secure Ownership Verification Controller
 *
 * Team: Group 3 | MAWTS Institute of Technology
 * Supervisor: Joy Debnath
 * Authors: Christopher Mack Dcosta & MD Ibrahim Khalil
 */

(function (window) {
  'use strict';

  let currentItem = null;
  let currentUser = null;

  // --------------------------------------------------------------------------
  // 1. Initialization & Data Fetching
  // --------------------------------------------------------------------------
  async function initItemPage() {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('id');

    if (!itemId) {
      renderNotFound('No item ID provided in URL.');
      return;
    }

    if (window.FindItDB) {
      currentUser = await window.FindItDB.getUser();
    }

    initShareButton();
    await fetchItemDetails(itemId);
  }

  async function fetchItemDetails(itemId) {
    const container = document.getElementById('item-details-container');
    const loadingState = document.getElementById('item-loading-state');
    if (!container) return;

    try {
      let item = null;

      if (window.FindItDB && window.FindItDB.client && window.FindItDB.isConfigured()) {
        const { data, error } = await window.FindItDB.client
          .from('public_items')
          .select('*')
          .eq('id', itemId)
          .single();

        if (error) {
          console.warn('[FindIt Item Query Notice]', error);
        } else {
          item = data;
        }
      }

      // If not found in live DB, check fallback demo items
      if (!item) {
        item = getFallbackItem(itemId);
      }

      if (!item) {
        renderNotFound('The requested Lost & Found report was not found or has been removed.');
        return;
      }

      currentItem = item;
      if (loadingState) loadingState.style.display = 'none';
      container.style.display = 'block';

      renderItemDetails(item);

    } catch (err) {
      console.error('[FindIt Item Error]', err);
      renderNotFound('Unable to retrieve item information. Please try again.');
    }
  }

  // --------------------------------------------------------------------------
  // 2. Safe Details Rendering
  // --------------------------------------------------------------------------
  function renderItemDetails(item) {
    // Media
    const imgEl = document.getElementById('item-detail-img');
    if (imgEl) {
      imgEl.src = item.image_url || 'assets/images/placeholder.svg';
      imgEl.onerror = () => { imgEl.src = 'assets/images/placeholder.svg'; };
    }

    // Title & Badges
    const titleEl = document.getElementById('item-detail-title');
    if (titleEl) titleEl.textContent = item.title;

    const typeBadgeContainer = document.getElementById('item-type-badge');
    if (typeBadgeContainer) {
      typeBadgeContainer.innerHTML = '';
      typeBadgeContainer.appendChild(window.FindIt.createBadge(item.type, item.type));
    }

    const catBadgeContainer = document.getElementById('item-category-badge');
    if (catBadgeContainer) {
      catBadgeContainer.textContent = item.category;
    }

    const statusBadgeContainer = document.getElementById('item-status-badge');
    if (statusBadgeContainer) {
      statusBadgeContainer.innerHTML = '';
      statusBadgeContainer.appendChild(window.FindIt.createBadge(item.status, item.status));
    }

    // Dates & Meta
    const dateEl = document.getElementById('item-detail-date');
    if (dateEl) dateEl.textContent = window.FindIt.formatDate(item.item_date);

    const postedEl = document.getElementById('item-detail-posted');
    if (postedEl) postedEl.textContent = window.FindIt.timeAgo(item.created_at);

    const locEl = document.getElementById('item-detail-location');
    if (locEl) locEl.textContent = item.location;

    const posterEl = document.getElementById('item-detail-poster');
    if (posterEl) posterEl.textContent = item.poster_name || 'Campus Student';

    // Description
    const descEl = document.getElementById('item-detail-description');
    if (descEl) descEl.textContent = item.description;

    // Timeline
    renderStatusTimeline(item.type, item.status);

    // Verification Section for Found Items
    renderVerificationSection(item);
  }

  // --------------------------------------------------------------------------
  // 3. Status Timeline Rendering
  // --------------------------------------------------------------------------
  function renderStatusTimeline(type, status) {
    const timelineEl = document.getElementById('item-status-timeline');
    if (!timelineEl) return;

    const steps = [
      { id: 'open', label: type === 'lost' ? 'Reported Lost' : 'Reported Found' },
      { id: 'claimed', label: 'Claim Verified' },
      { id: 'returned', label: 'Safely Returned' }
    ];

    let activeIndex = 0;
    if (status === 'claimed') activeIndex = 1;
    if (status === 'returned') activeIndex = 2;
    if (status === 'archived') activeIndex = 0;

    timelineEl.innerHTML = '';

    // Track
    const track = document.createElement('div');
    track.className = 'timeline-track';
    timelineEl.appendChild(track);

    // Progress
    const progress = document.createElement('div');
    progress.className = 'timeline-progress';
    const percent = activeIndex === 0 ? 0 : (activeIndex === 1 ? 50 : 100);
    progress.style.width = `calc(${percent}% - 2rem)`;
    timelineEl.appendChild(progress);

    // Nodes
    steps.forEach((step, idx) => {
      const stepDiv = document.createElement('div');
      stepDiv.className = 'timeline-step';
      if (idx < activeIndex) stepDiv.classList.add('completed');
      if (idx === activeIndex) stepDiv.classList.add('active');

      const node = document.createElement('div');
      node.className = 'step-node';
      node.textContent = (idx < activeIndex) ? '✓' : (idx + 1);

      const label = document.createElement('span');
      label.className = 'step-label';
      label.textContent = step.label;

      stepDiv.appendChild(node);
      stepDiv.appendChild(label);
      timelineEl.appendChild(stepDiv);
    });
  }

  // --------------------------------------------------------------------------
  // 4. Secret Verification Challenge Section
  // --------------------------------------------------------------------------
  function renderVerificationSection(item) {
    const verifyCard = document.getElementById('verification-challenge-card');
    if (!verifyCard) return;

    // Only applicable to found items
    if (item.type !== 'found') {
      verifyCard.style.display = 'none';
      return;
    }

    verifyCard.style.display = 'block';

    const questionTextEl = document.getElementById('verify-question-text');
    const formSection = document.getElementById('verify-form-section');
    const contactRevealedSection = document.getElementById('contact-revealed-section');
    const authRequiredNotice = document.getElementById('verify-auth-required');
    const finderSelfNotice = document.getElementById('verify-self-notice');
    const returnedNotice = document.getElementById('verify-returned-notice');

    // Display question safely
    if (questionTextEl) {
      questionTextEl.textContent = item.verify_question || 'What is a specific unique identifier or hidden feature of this item?';
    }

    // Hide all sub-sections initially
    if (formSection) formSection.style.display = 'none';
    if (contactRevealedSection) contactRevealedSection.style.display = 'none';
    if (authRequiredNotice) authRequiredNotice.style.display = 'none';
    if (finderSelfNotice) finderSelfNotice.style.display = 'none';
    if (returnedNotice) returnedNotice.style.display = 'none';

    // State 1: Item is already returned
    if (item.status === 'returned') {
      if (returnedNotice) returnedNotice.style.display = 'block';
      return;
    }

    // State 2: Current user is the finder of this item
    if (currentUser && item.user_id === currentUser.id) {
      if (finderSelfNotice) finderSelfNotice.style.display = 'block';
      return;
    }

    // State 3: User is not logged in
    if (!currentUser) {
      if (authRequiredNotice) {
        authRequiredNotice.style.display = 'block';
        const loginLink = authRequiredNotice.querySelector('a');
        if (loginLink) {
          const currentUrl = encodeURIComponent(`item.html?id=${item.id}`);
          loginLink.href = `login.html?redirect=${currentUrl}`;
        }
      }
      return;
    }

    // State 4: Authenticated user can submit answer
    if (formSection) {
      formSection.style.display = 'block';
      bindVerificationSubmit(item.id);
    }
  }

  function bindVerificationSubmit(itemId) {
    const form = document.getElementById('verify-answer-form');
    if (!form) return;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const answerInput = document.getElementById('verify-answer-input');
      const submitBtn = form.querySelector('button[type="submit"]');
      const alertEl = document.getElementById('verify-result-alert');

      const answer = answerInput ? answerInput.value.trim() : '';
      if (!answer) {
        showVerificationAlert(alertEl, 'Please enter your verification answer.', 'error');
        return;
      }

      setLoading(submitBtn, true, 'Verifying Answer...');
      hideAlert(alertEl);

      try {
        if (!currentUser) {
          throw new Error('Please sign in to verify ownership.');
        }

        let result = null;

        if (window.FindItDB && window.FindItDB.client && window.FindItDB.isConfigured()) {
          // Call Secure RPC: verify_and_get_contact
          const { data, error } = await window.FindItDB.client.rpc('verify_and_get_contact', {
            p_item_id: itemId,
            p_answer: answer
          });

          if (error) throw error;
          result = data;
        } else {
          // Fallback simulation for demo environment
          if (answer.toLowerCase() === 'algorithms' || 
              answer.toLowerCase() === '0084' || 
              answer.toLowerCase().includes('hydro flask') ||
              answer.toLowerCase() === 'demo') {
            result = {
              success: true,
              message: 'Verification successful! Ownership confirmed.',
              finder: {
                full_name: 'Nusrat Jahan (Demo)',
                phone: '+8801811000002',
                email: 'demo.nusrat@mawts.edu.bd'
              }
            };
          } else {
            result = {
              success: false,
              message: 'The answer provided does not match. Please verify secret details.',
              remaining_attempts: 4
            };
          }
        }

        if (result && result.success) {
          // Ownership proven! Reveal contact card
          window.FindIt.showToast('Verification Successful! Ownership confirmed.', 'success');
          revealFinderContact(result.finder);
        } else {
          // Incorrect answer
          const msg = result ? result.message : 'Incorrect verification answer.';
          const rem = result && typeof result.remaining_attempts === 'number' 
            ? ` (${result.remaining_attempts} attempts remaining)` 
            : '';
          showVerificationAlert(alertEl, `${msg}${rem}`, 'error');
          window.FindIt.showToast('Incorrect verification answer. Try again.', 'error');
        }

      } catch (err) {
        console.error('[FindIt Verify Error]', err);
        showVerificationAlert(alertEl, err.message || 'Verification failed. Please try again.', 'error');
      } finally {
        setLoading(submitBtn, false, 'Verify & Unlock Contact Info');
      }
    };
  }

  function revealFinderContact(finder) {
    const formSection = document.getElementById('verify-form-section');
    const contactSection = document.getElementById('contact-revealed-section');

    if (formSection) formSection.style.display = 'none';
    if (contactSection) {
      contactSection.style.display = 'block';

      const nameEl = document.getElementById('finder-name');
      const phoneEl = document.getElementById('finder-phone');
      const emailEl = document.getElementById('finder-email');

      if (nameEl) nameEl.textContent = finder.full_name || 'Campus Student';
      if (phoneEl) {
        phoneEl.textContent = finder.phone || 'Available via university portal';
        if (finder.phone && finder.phone.startsWith('+')) {
          phoneEl.href = `tel:${finder.phone}`;
        }
      }
      if (emailEl) {
        emailEl.textContent = finder.email || 'N/A';
        if (finder.email) {
          emailEl.href = `mailto:${finder.email}`;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. Helpers & UI Feedback
  // --------------------------------------------------------------------------
  function initShareButton() {
    const shareBtn = document.getElementById('btn-share-item');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          window.FindIt.showToast('Item link copied to clipboard!', 'info');
        } catch (e) {
          window.FindIt.showToast('Link: ' + window.location.href, 'info');
        }
      });
    }
  }

  function renderNotFound(msg) {
    const container = document.getElementById('item-details-container');
    const loadingState = document.getElementById('item-loading-state');
    if (loadingState) loadingState.style.display = 'none';
    if (container) {
      container.style.display = 'block';
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${window.FindIt.icons.alertCircle}</div>
          <h2 class="empty-state-title">Item Not Found</h2>
          <p class="empty-state-desc">${msg || 'The item you are looking for does not exist.'}</p>
          <a href="items.html" class="btn btn-primary btn-sm">Return to Listings</a>
        </div>
      `;
    }
  }

  function setLoading(btn, isLoading, text) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = text;
  }

  function showVerificationAlert(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = `alert alert-${type}`;
    el.style.display = 'block';
  }

  function hideAlert(el) {
    if (!el) return;
    el.style.display = 'none';
  }

  function getFallbackItem(id) {
    const fallbacks = [
      {
        id: 'demo-1',
        title: '[DEMO] Lost Black Arctic Hunter Backpack',
        type: 'lost',
        category: 'Bag',
        description: 'Black waterproof backpack with red zipper. Contains lecture notebook and umbrella. Left near study desk.',
        location: 'Central Library - 2nd Floor Study Hall',
        item_date: '2026-11-21',
        created_at: '2026-11-21T10:00:00Z',
        image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
        status: 'open',
        poster_name: 'Tanvir Hasan (Demo)',
        user_id: '00000000-0000-0000-0000-000000000001'
      },
      {
        id: 'demo-2',
        title: '[DEMO] Found MAWTS Student Identity Card',
        type: 'found',
        category: 'ID Card',
        description: 'Found an official student smart card in Computer Lab 3 near Terminal 14. Surrendered to proctor desk.',
        location: 'Computer Lab 3 (Ground Floor)',
        item_date: '2026-11-22',
        created_at: '2026-11-22T14:30:00Z',
        image_url: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=800&q=80',
        status: 'open',
        verify_question: 'What is the last 4 digits of the Student Roll Number on this card?',
        poster_name: 'Nusrat Jahan (Demo)',
        user_id: '00000000-0000-0000-0000-000000000002'
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
        status: 'open',
        verify_question: 'What subject or course title is written on the first header line?',
        poster_name: 'Anika Tabassum (Demo)',
        user_id: '00000000-0000-0000-0000-000000000004'
      }
    ];

    return fallbacks.find(x => x.id === id) || fallbacks[0];
  }

  // Lifecycle
  document.addEventListener('DOMContentLoaded', () => {
    initItemPage();
  });

})(window);
