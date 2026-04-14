/* ===========================
   CNTRD – Shared App Utilities
   =========================== */

const DEFAULT_AVATAR = '/css/default-avatar.svg';

// Redirect to login if not authenticated
function requireLogin() {
  const token = localStorage.getItem('cntrd_token');
  if (!token) {
    window.location.href = '/';
    return null;
  }
  return token;
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('cntrd_user'));
  } catch {
    return null;
  }
}

function saveUser(user) {
  localStorage.setItem('cntrd_user', JSON.stringify(user));
}

function getToken() {
  return localStorage.getItem('cntrd_token');
}

function logout() {
  localStorage.removeItem('cntrd_token');
  localStorage.removeItem('cntrd_user');
  window.location.href = '/';
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json();
  if (res.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }
  return { ok: res.ok, status: res.status, data };
}

function avatarUrl(url) {
  return url || DEFAULT_AVATAR;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTeamTags(tags) {
  if (!tags || !tags.length) return '';
  return tags.map(t => `<span class="team-tag">${escapeHtml(t)}</span>`).join('');
}

function renderPost(post, currentUserId) {
  const isOwn = currentUserId && post.user_id === currentUserId;
  const tags = renderTeamTags(post.team_tags);

  return `
    <div class="post-card" data-post-id="${escapeHtml(post.id)}" data-author="${escapeHtml(post.username)}">
      <div class="post-avatar-wrap">
        <a href="/profile.html?u=${escapeHtml(post.username)}" onclick="event.stopPropagation()">
          <img class="post-avatar" src="${avatarUrl(post.avatar)}" alt="${escapeHtml(post.display_name)}" onerror="this.src='${DEFAULT_AVATAR}'" />
        </a>
      </div>
      <div class="post-body">
        <div class="post-header">
          <a class="post-display-name" href="/profile.html?u=${escapeHtml(post.username)}" onclick="event.stopPropagation()">${escapeHtml(post.display_name || post.username)}</a>
          <span class="post-username">@${escapeHtml(post.username)}</span>
          <span class="post-time">${formatDate(post.created_at)}</span>
        </div>
        ${tags ? `<div class="post-team-tags">${tags}</div>` : ''}
        <div class="post-content">${escapeHtml(post.content)}</div>
        <div class="post-actions">
          <button class="action-btn reply-btn" title="Reply" onclick="event.stopPropagation(); openReply('${escapeHtml(post.id)}')">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
            <span class="reply-count-${escapeHtml(post.id)}">${formatNumber(post.reply_count || 0)}</span>
          </button>
          <button class="action-btn repost-btn ${post.reposted ? 'reposted' : ''}" title="Repost" onclick="event.stopPropagation(); toggleRepost('${escapeHtml(post.id)}', this)">
            <svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
            <span class="repost-count-${escapeHtml(post.id)}">${formatNumber(post.repost_count || 0)}</span>
          </button>
          <button class="action-btn like-btn ${post.liked ? 'liked' : ''}" title="Like" onclick="event.stopPropagation(); toggleLike('${escapeHtml(post.id)}', this)">
            <svg viewBox="0 0 24 24"><path d="${post.liked
              ? 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
              : 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z'
            }"/></svg>
            <span class="like-count-${escapeHtml(post.id)}">${formatNumber(post.like_count || 0)}</span>
          </button>
          ${isOwn ? `
          <button class="action-btn delete-btn" title="Delete" onclick="event.stopPropagation(); deletePost('${escapeHtml(post.id)}', this)">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>` : ''}
        </div>
      </div>
    </div>
  `;
}

// Initialize sidebar for all app pages
function initSidebar() {
  const token = requireLogin();
  if (!token) return;

  const user = getUser();
  if (user) updateSidebarUser(user);

  // Refresh from server
  apiFetch('/api/auth/me').then(({ ok, data }) => {
    if (ok) {
      saveUser(data);
      updateSidebarUser(data);
    }
  }).catch(() => {});

  document.getElementById('logout-btn')?.addEventListener('click', logout);

  const profileLink = document.getElementById('nav-profile-link');
  if (profileLink && user) {
    profileLink.href = `/profile.html?u=${user.username}`;
  }

  // Compose modal
  const composeBtn = document.getElementById('compose-btn');
  const composeModal = document.getElementById('compose-modal');
  const closeComposeModal = document.getElementById('close-compose-modal');

  composeBtn?.addEventListener('click', () => {
    composeModal.style.display = 'flex';
    document.getElementById('modal-compose-text')?.focus();
  });

  closeComposeModal?.addEventListener('click', () => {
    composeModal.style.display = 'none';
  });

  composeModal?.addEventListener('click', (e) => {
    if (e.target === composeModal) composeModal.style.display = 'none';
  });

  // Modal compose count
  const modalText = document.getElementById('modal-compose-text');
  const modalCount = document.getElementById('modal-compose-count');
  modalText?.addEventListener('input', () => {
    const remaining = 280 - modalText.value.length;
    modalCount.textContent = remaining;
    modalCount.className = 'compose-count' + (remaining < 20 ? ' danger' : remaining < 50 ? ' warn' : '');
  });

  // Set modal avatar
  const modalAvatar = document.getElementById('modal-compose-avatar');
  if (modalAvatar && user?.avatar) {
    modalAvatar.src = avatarUrl(user.avatar);
  }
}

function updateSidebarUser(user) {
  const displayName = document.getElementById('sidebar-display-name');
  const username = document.getElementById('sidebar-username');
  const avatar = document.getElementById('sidebar-avatar');
  const profileLink = document.getElementById('nav-profile-link');

  if (displayName) displayName.textContent = user.display_name || user.username;
  if (username) username.textContent = `@${user.username}`;
  if (avatar) {
    avatar.src = avatarUrl(user.avatar);
    avatar.onerror = () => { avatar.src = DEFAULT_AVATAR; };
  }
  if (profileLink) profileLink.href = `/profile.html?u=${user.username}`;

  const composeAvatar = document.getElementById('compose-avatar');
  if (composeAvatar) {
    composeAvatar.src = avatarUrl(user.avatar);
    composeAvatar.onerror = () => { composeAvatar.src = DEFAULT_AVATAR; };
  }
  const modalAvatar = document.getElementById('modal-compose-avatar');
  if (modalAvatar) {
    modalAvatar.src = avatarUrl(user.avatar);
    modalAvatar.onerror = () => { modalAvatar.src = DEFAULT_AVATAR; };
  }
}

// Shared action handlers
async function toggleLike(postId, btn) {
  const token = getToken();
  if (!token) { window.location.href = '/'; return; }

  const { ok, data } = await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' });
  if (ok) {
    btn.classList.toggle('liked', data.liked);
    const countEl = document.querySelector(`.like-count-${postId}`);
    if (countEl) countEl.textContent = formatNumber(data.like_count);
    // Update heart icon
    const path = btn.querySelector('path');
    if (path) {
      path.setAttribute('d', data.liked
        ? 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
        : 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z'
      );
    }
  }
}

async function toggleRepost(postId, btn) {
  const token = getToken();
  if (!token) { window.location.href = '/'; return; }

  const { ok, data } = await apiFetch(`/api/posts/${postId}/repost`, { method: 'POST' });
  if (ok) {
    btn.classList.toggle('reposted', data.reposted);
    const countEl = document.querySelector(`.repost-count-${postId}`);
    if (countEl) countEl.textContent = formatNumber(data.repost_count);
  }
}

async function deletePost(postId, btn) {
  if (!confirm('Delete this post?')) return;
  const { ok } = await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
  if (ok) {
    const card = document.querySelector(`[data-post-id="${postId}"]`);
    if (card) card.remove();
  }
}

function openReply(postId) {
  // For simplicity, open compose modal pre-tagged; full reply thread handled via post page
  const modal = document.getElementById('compose-modal');
  if (modal) {
    modal.style.display = 'flex';
    const textarea = document.getElementById('modal-compose-text');
    if (textarea) textarea.dataset.replyTo = postId;
    textarea?.focus();
  }
}
