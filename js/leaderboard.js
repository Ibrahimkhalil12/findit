/**
 * FindIt - Lost & Found Portal
 * Campus Recognition & Leaderboard Controller
 *
 * Team: Group 3 | MAWTS Institute of Technology
 * Supervisor: Joy Debnath
 * Author: Akash Biswas (Dashboard & Gamification Developer)
 */

(function (window) {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. Fetch & Render Leaderboard
  // --------------------------------------------------------------------------
  async function loadLeaderboard() {
    const podiumContainer = document.getElementById('leaderboard-podium');
    const tableBody = document.getElementById('leaderboard-table-body');
    if (!podiumContainer || !tableBody) return;

    try {
      let leaders = [];

      if (window.FindItDB && window.FindItDB.client && window.FindItDB.isConfigured()) {
        const { data, error } = await window.FindItDB.client
          .from('public_leaderboard')
          .select('*')
          .limit(20);

        if (error) throw error;
        leaders = data || [];
      }

      if (!leaders || leaders.length === 0) {
        leaders = getFallbackLeaderboard();
      }

      renderPodium(leaders.slice(0, 3));
      renderTable(leaders.slice(3));

    } catch (err) {
      console.warn('[FindIt Leaderboard Notice]', err);
      const fallback = getFallbackLeaderboard();
      renderPodium(fallback.slice(0, 3));
      renderTable(fallback.slice(3));
    }
  }

  // --------------------------------------------------------------------------
  // 2. Render Top 3 Podium
  // --------------------------------------------------------------------------
  function renderPodium(topThree) {
    const podiumContainer = document.getElementById('leaderboard-podium');
    if (!podiumContainer) return;

    podiumContainer.innerHTML = '';

    if (!topThree || topThree.length === 0) return;

    // Display order: 2nd (Silver, left), 1st (Gold, center), 3rd (Bronze, right)
    const orderIndices = [1, 0, 2];

    orderIndices.forEach(idx => {
      const user = topThree[idx];
      if (!user) return;

      const rankNumber = idx + 1;
      const card = document.createElement('div');
      card.className = `podium-card podium-${rankNumber}`;

      // Rank badge
      const rankBadge = document.createElement('div');
      rankBadge.className = 'podium-rank-badge';
      rankBadge.textContent = rankNumber;

      // Avatar
      const avatar = document.createElement('div');
      avatar.className = 'podium-avatar';
      const initials = getInitials(user.full_name);
      avatar.textContent = initials;

      // Name
      const name = document.createElement('h3');
      name.style.cssText = 'font-size: 1.125rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-primary);';
      name.textContent = user.full_name;

      // Badge Tier
      const badge = document.createElement('span');
      badge.className = 'badge badge-category';
      badge.style.marginBottom = '0.75rem';
      badge.textContent = user.badge_tier || getBadgeTitle(user.points);

      // Points
      const points = document.createElement('div');
      points.style.cssText = 'font-size: 1.5rem; font-weight: 800; color: var(--primary-600); line-height: 1; margin-bottom: 0.35rem;';
      points.textContent = `${user.points} pts`;

      // Returns count
      const returns = document.createElement('div');
      returns.style.cssText = 'font-size: 0.8125rem; color: var(--text-secondary);';
      returns.textContent = `${user.items_returned_count || 0} Belongs Returned`;

      card.appendChild(rankBadge);
      card.appendChild(avatar);
      card.appendChild(name);
      card.appendChild(badge);
      card.appendChild(points);
      card.appendChild(returns);

      podiumContainer.appendChild(card);
    });
  }

  // --------------------------------------------------------------------------
  // 3. Render Leaderboard Table
  // --------------------------------------------------------------------------
  function renderTable(remainingUsers) {
    const tableBody = document.getElementById('leaderboard-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (!remainingUsers || remainingUsers.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No additional rankings yet.</td>';
      tableBody.appendChild(tr);
      return;
    }

    remainingUsers.forEach((user, index) => {
      const tr = document.createElement('tr');
      const rank = index + 4;

      // Rank column
      const tdRank = document.createElement('td');
      tdRank.style.fontWeight = '700';
      tdRank.textContent = `#${rank}`;

      // Student Name
      const tdName = document.createElement('td');
      tdName.style.fontWeight = '600';
      tdName.textContent = user.full_name;

      // Badge
      const tdBadge = document.createElement('td');
      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'badge badge-category';
      badgeSpan.textContent = user.badge_tier || getBadgeTitle(user.points);
      tdBadge.appendChild(badgeSpan);

      // Returns count
      const tdReturns = document.createElement('td');
      tdReturns.textContent = `${user.items_returned_count || 0} returned`;

      // Points
      const tdPoints = document.createElement('td');
      tdPoints.style.fontWeight = '700';
      tdPoints.style.color = 'var(--primary-600)';
      tdPoints.textContent = `${user.points} pts`;

      tr.appendChild(tdRank);
      tr.appendChild(tdName);
      tr.appendChild(tdBadge);
      tr.appendChild(tdReturns);
      tr.appendChild(tdPoints);

      tableBody.appendChild(tr);
    });
  }

  function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  function getBadgeTitle(points) {
    if (points >= 300) return 'Campus Guardian Gold';
    if (points >= 150) return 'Silver Returner';
    if (points >= 50) return 'Campus Helper';
    return 'Good Citizen';
  }

  function getFallbackLeaderboard() {
    return [
      {
        id: 'user-1',
        full_name: 'Tanvir Hasan (Demo)',
        points: 350,
        items_returned_count: 7,
        badge_tier: 'Campus Guardian Gold'
      },
      {
        id: 'user-2',
        full_name: 'Nusrat Jahan (Demo)',
        points: 150,
        items_returned_count: 3,
        badge_tier: 'Silver Returner'
      },
      {
        id: 'user-3',
        full_name: 'Shahriar Kabir (Demo)',
        points: 100,
        items_returned_count: 2,
        badge_tier: 'Campus Helper'
      },
      {
        id: 'user-4',
        full_name: 'Anika Tabassum (Demo)',
        points: 50,
        items_returned_count: 1,
        badge_tier: 'Campus Helper'
      },
      {
        id: 'user-5',
        full_name: 'MD Ibrahim Khalil (Group 3)',
        points: 50,
        items_returned_count: 1,
        badge_tier: 'Campus Helper'
      },
      {
        id: 'user-6',
        full_name: 'Adib Akanda (Group 3)',
        points: 50,
        items_returned_count: 1,
        badge_tier: 'Campus Helper'
      }
    ];
  }

  // Lifecycle
  document.addEventListener('DOMContentLoaded', () => {
    loadLeaderboard();
  });

})(window);
