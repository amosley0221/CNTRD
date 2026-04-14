/* ===========================
   CNTRD – Feed Page JS
   =========================== */

let currentTab = 'home';
let feedCursor = null;
let isLoading = false;
let hasMore = true;
const currentUser = getUser();

initSidebar();
initFeedPage();

function initFeedPage() {
  // Determine starting tab from URL
  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'explore') {
    switchTab('explore');
  } else {
    switchTab('home');
  }

  // Tab buttons
  document.getElementById('tab-home').addEventListener('click', () => switchTab('home'));
  document.getElementById('tab-explore-btn').addEventListener('click', () => switchTab('explore'));
  document.getElementById('nav-explore').addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('explore');
  });

  // Compose box character count
  const composeText = document.getElementById('compose-text');
  const composeCount = document.getElementById('compose-count');
  composeText?.addEventListener('input', () => {
    const remaining = 280 - composeText.value.length;
    composeCount.textContent = remaining;
    composeCount.className = 'compose-count' + (remaining < 20 ? ' danger' : remaining < 50 ? ' warn' : '');
  });

  // Post button
  document.getElementById('post-btn')?.addEventListener('click', () => submitPost('compose-text'));
  document.getElementById('modal-post-btn')?.addEventListener('click', () => submitPost('modal-compose-text'));

  // Load more
  document.getElementById('load-more-btn')?.addEventListener('click', loadMorePosts);

  // Load who to follow
  loadWhoToFollow();
}

function switchTab(tab) {
  currentTab = tab;
  feedCursor = null;
  hasMore = true;

  const homeTab = document.getElementById('tab-home');
  const exploreTab = document.getElementById('tab-explore-btn');

  if (tab === 'home') {
    homeTab.classList.add('active');
    exploreTab.classList.remove('active');
    document.getElementById('compose-box').style.display = 'flex';
  } else {
    homeTab.classList.remove('active');
    exploreTab.classList.add('active');
    document.getElementById('compose-box').style.display = 'none';
  }

  const feed = document.getElementById('feed');
  feed.innerHTML = '<div class="feed-loading" id="feed-loading"><div class="spinner"></div></div>';
  document.getElementById('load-more-btn').style.display = 'none';

  loadPosts();
}

async function loadPosts() {
  if (isLoading) return;
  isLoading = true;

  try {
    const endpoint = currentTab === 'home' ? '/api/posts/feed' : '/api/posts/explore';
    const url = feedCursor ? `${endpoint}?cursor=${encodeURIComponent(feedCursor)}` : endpoint;

    const { ok, data } = await apiFetch(url);
    if (!ok) return;

    const feed = document.getElementById('feed');

    // Clear loading spinner on first load
    const loadingEl = document.getElementById('feed-loading');
    if (loadingEl) loadingEl.remove();

    if (data.length === 0 && !feedCursor) {
      feed.innerHTML = `<div class="feed-empty">${currentTab === 'home' ? "Follow people to see their posts here, or check out Explore." : "No posts yet. Be the first to post!"}</div>`;
      document.getElementById('load-more-btn').style.display = 'none';
      return;
    }

    data.forEach(post => {
      feed.insertAdjacentHTML('beforeend', renderPost(post, currentUser?.id));
    });

    if (data.length === 20) {
      feedCursor = data[data.length - 1].created_at;
      document.getElementById('load-more-btn').style.display = 'block';
    } else {
      document.getElementById('load-more-btn').style.display = 'none';
      hasMore = false;
    }

    // Attach post-click navigation
    attachPostNavigation();

  } catch (err) {
    console.error(err);
  } finally {
    isLoading = false;
  }
}

async function loadMorePosts() {
  if (isLoading || !hasMore) return;
  await loadPosts();
}

async function submitPost(textareaId) {
  const textarea = document.getElementById(textareaId);
  const content = textarea?.value.trim();
  if (!content) return;

  const replyTo = textarea.dataset.replyTo || null;

  const btn = textareaId === 'compose-text'
    ? document.getElementById('post-btn')
    : document.getElementById('modal-post-btn');

  btn.disabled = true;
  btn.textContent = 'Posting…';

  try {
    const body = { content };
    if (replyTo) body.reply_to = replyTo;

    const { ok, data } = await apiFetch('/api/posts', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (ok) {
      textarea.value = '';
      textarea.dataset.replyTo = '';
      const countEl = textareaId === 'compose-text'
        ? document.getElementById('compose-count')
        : document.getElementById('modal-compose-count');
      if (countEl) { countEl.textContent = '280'; countEl.className = 'compose-count'; }

      // Close modal if open
      document.getElementById('compose-modal').style.display = 'none';

      // If on home tab and no reply, prepend to feed
      if (currentTab === 'home' && !replyTo) {
        const feed = document.getElementById('feed');
        const emptyEl = feed.querySelector('.feed-empty');
        if (emptyEl) emptyEl.remove();
        feed.insertAdjacentHTML('afterbegin', renderPost(data, currentUser?.id));
        attachPostNavigation();
      }

      // Refresh user post count
      const user = getUser();
      if (user) {
        user.post_count = (user.post_count || 0) + 1;
        saveUser(user);
      }
    } else {
      alert(data.error || 'Failed to post.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Post';
  }
}

function attachPostNavigation() {
  document.querySelectorAll('.post-card').forEach(card => {
    if (card.dataset.navAttached) return;
    card.dataset.navAttached = '1';
    card.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('button')) return;
      const postId = card.dataset.postId;
      if (postId) window.location.href = `/post.html?id=${postId}`;
    });
  });
}

async function loadWhoToFollow() {
  const list = document.getElementById('who-to-follow-list');
  if (!list) return;

  try {
    const { ok, data } = await apiFetch('/api/posts/explore?limit=5');
    if (!ok) return;

    // Extract unique users from recent posts
    const seen = new Set();
    const users = [];
    data.forEach(p => {
      if (!seen.has(p.user_id) && p.user_id !== currentUser?.id) {
        seen.add(p.user_id);
        users.push({ id: p.user_id, username: p.username, display_name: p.display_name, avatar: p.avatar, team_tags: p.team_tags });
      }
    });

    if (users.length === 0) {
      list.innerHTML = '<p class="widget-empty">No suggestions yet.</p>';
      return;
    }

    list.innerHTML = users.slice(0, 4).map(u => `
      <div class="follow-card">
        <a href="/profile.html?u=${escapeHtml(u.username)}">
          <img class="follow-card-avatar" src="${avatarUrl(u.avatar)}" alt="${escapeHtml(u.display_name || u.username)}" onerror="this.src='${DEFAULT_AVATAR}'" />
        </a>
        <div class="follow-card-info">
          <a href="/profile.html?u=${escapeHtml(u.username)}" class="follow-card-name">${escapeHtml(u.display_name || u.username)}</a>
          <div class="follow-card-username">@${escapeHtml(u.username)}</div>
          <div class="follow-card-tags">${renderTeamTags(u.team_tags)}</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}
