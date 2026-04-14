/* ===========================
   CNTRD – Profile Page JS
   =========================== */

const params = new URLSearchParams(window.location.search);
const profileUsername = params.get('u');
const currentUser = getUser();
let profileUser = null;
let postCursor = null;
let isLoadingPosts = false;
let isOwnProfile = false;
let currentTags = [];

initSidebar();

if (!profileUsername) {
  // No username param — redirect to own profile
  if (currentUser) {
    window.location.href = `/profile.html?u=${currentUser.username}`;
  } else {
    window.location.href = '/';
  }
} else {
  loadProfile();
}

async function loadProfile() {
  try {
    const { ok, data } = await apiFetch(`/api/users/${profileUsername}`);
    if (!ok) {
      document.querySelector('.main-content').innerHTML = '<div class="feed-empty">User not found.</div>';
      return;
    }

    profileUser = data;
    isOwnProfile = currentUser && currentUser.id === data.id;

    renderProfileHeader(data);
    loadProfilePosts();

    if (isOwnProfile) {
      showEditControls(data);
    } else {
      const followBtn = document.getElementById('follow-btn');
      followBtn.style.display = 'inline-flex';
      followBtn.textContent = data.is_following ? 'Unfollow' : 'Follow';
      followBtn.className = data.is_following ? 'btn btn-outline' : 'btn btn-primary';
      followBtn.addEventListener('click', () => handleFollow(data.username));
    }
  } catch (err) {
    console.error(err);
  }
}

function renderProfileHeader(user) {
  document.title = `${user.display_name || user.username} (@${user.username}) – CNTRD`;

  // Banner
  const bannerEl = document.getElementById('profile-banner');
  if (user.banner) {
    bannerEl.innerHTML = `<img src="${avatarUrl(user.banner)}" alt="banner" onerror="this.style.display='none'" />`;
    if (isOwnProfile) bannerEl.insertAdjacentHTML('beforeend', `
      <label class="banner-upload-btn" id="banner-upload-label" title="Change banner">
        <svg viewBox="0 0 24 24"><path d="M12 15.2l-4.24-4.24 1.41-1.41L11 11.38V4h2v7.38l1.83-1.83 1.41 1.41L12 15.2zM20 18H4v-3H2v3c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-3h-2v3z"/></svg>
        <input type="file" id="banner-upload" accept="image/*" style="display:none" />
      </label>
    `);
  } else if (isOwnProfile) {
    bannerEl.innerHTML = `
      <div class="banner-placeholder"></div>
      <label class="banner-upload-btn" id="banner-upload-label" title="Add banner">
        <svg viewBox="0 0 24 24"><path d="M12 15.2l-4.24-4.24 1.41-1.41L11 11.38V4h2v7.38l1.83-1.83 1.41 1.41L12 15.2zM20 18H4v-3H2v3c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-3h-2v3z"/></svg>
        <input type="file" id="banner-upload" accept="image/*" style="display:none" />
      </label>
    `;
  }

  // Avatar
  const avatarEl = document.getElementById('profile-avatar');
  avatarEl.src = avatarUrl(user.avatar);
  avatarEl.onerror = () => { avatarEl.src = DEFAULT_AVATAR; };

  if (isOwnProfile) {
    document.getElementById('avatar-upload-label').style.display = 'flex';
  }

  // Details
  document.getElementById('profile-display-name').textContent = user.display_name || user.username;
  document.getElementById('profile-username').textContent = `@${user.username}`;

  const tagsEl = document.getElementById('profile-tags');
  tagsEl.innerHTML = renderTeamTags(user.team_tags);

  document.getElementById('profile-bio').textContent = user.bio || '';

  const joined = new Date(user.created_at + (user.created_at?.includes('Z') ? '' : 'Z'));
  document.getElementById('profile-joined').textContent = `Joined ${joined.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

  document.getElementById('following-count').textContent = formatNumber(user.following_count || 0);
  document.getElementById('followers-count').textContent = formatNumber(user.follower_count || 0);

  // Follow/Following links
  document.getElementById('following-link').addEventListener('click', (e) => {
    e.preventDefault();
    // Could expand to a modal; for now navigate to profile
  });
}

async function loadProfilePosts() {
  if (isLoadingPosts) return;
  isLoadingPosts = true;

  try {
    const url = postCursor
      ? `/api/users/${profileUsername}/posts?cursor=${encodeURIComponent(postCursor)}`
      : `/api/users/${profileUsername}/posts`;

    const { ok, data } = await apiFetch(url);
    const feed = document.getElementById('profile-feed');
    const loading = document.getElementById('profile-feed-loading');
    if (loading) loading.remove();

    if (!ok) return;

    if (data.length === 0 && !postCursor) {
      feed.innerHTML = '<div class="feed-empty">No posts yet.</div>';
      return;
    }

    data.forEach(post => {
      feed.insertAdjacentHTML('beforeend', renderPost(post, currentUser?.id));
    });

    if (data.length === 20) {
      postCursor = data[data.length - 1].created_at;
      document.getElementById('profile-load-more').style.display = 'block';
    } else {
      document.getElementById('profile-load-more').style.display = 'none';
    }

    attachPostNavigation();
  } catch (err) {
    console.error(err);
  } finally {
    isLoadingPosts = false;
  }
}

function attachPostNavigation() {
  document.querySelectorAll('.post-card').forEach(card => {
    if (card.dataset.navAttached) return;
    card.dataset.navAttached = '1';
    card.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('button')) return;
    });
  });
}

document.getElementById('profile-load-more')?.addEventListener('click', loadProfilePosts);

async function handleFollow(username) {
  const btn = document.getElementById('follow-btn');
  btn.disabled = true;
  const { ok, data } = await apiFetch(`/api/users/${username}/follow`, { method: 'POST' });
  btn.disabled = false;
  if (ok) {
    btn.textContent = data.following ? 'Unfollow' : 'Follow';
    btn.className = data.following ? 'btn btn-outline' : 'btn btn-primary';
    const countEl = document.getElementById('followers-count');
    const current = parseInt(countEl.textContent.replace(/[KM]/, '')) || 0;
    // Re-fetch profile to get accurate counts
    const { ok: ok2, data: updated } = await apiFetch(`/api/users/${username}`);
    if (ok2) {
      document.getElementById('followers-count').textContent = formatNumber(updated.follower_count || 0);
    }
  }
}

// ===========================
// Edit Profile (own profile)
// ===========================
function showEditControls(user) {
  document.getElementById('edit-profile-btn').style.display = 'inline-flex';
  document.getElementById('avatar-upload-label').style.display = 'flex';

  const widget = document.getElementById('edit-profile-widget');
  const editBtn = document.getElementById('edit-profile-btn');

  editBtn.addEventListener('click', () => {
    if (widget.style.display === 'none') {
      widget.style.display = 'block';
      populateEditForm(user);
    } else {
      widget.style.display = 'none';
    }
  });

  document.getElementById('save-profile-btn')?.addEventListener('click', saveProfile);

  // Avatar upload
  const avatarInput = document.getElementById('avatar-upload');
  avatarInput?.addEventListener('change', () => uploadAvatar(avatarInput.files[0]));

  // Banner upload (attached after render since it's dynamically inserted)
  document.getElementById('profile-banner').addEventListener('change', (e) => {
    if (e.target.id === 'banner-upload') uploadBanner(e.target.files[0]);
  });

  // Bio char count
  const bioInput = document.getElementById('edit-bio');
  const bioCount = document.getElementById('bio-count');
  bioInput?.addEventListener('input', () => {
    bioCount.textContent = 160 - bioInput.value.length;
  });

  // Tag input
  const tagInput = document.getElementById('tag-input');
  tagInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput.value.trim().replace(/,/g, ''));
      tagInput.value = '';
    }
  });
}

function populateEditForm(user) {
  document.getElementById('edit-display-name').value = user.display_name || '';
  document.getElementById('edit-bio').value = user.bio || '';
  document.getElementById('bio-count').textContent = 160 - (user.bio || '').length;

  currentTags = [...(user.team_tags || [])];
  renderTagChips();
}

function addTag(tag) {
  tag = tag.toUpperCase().replace(/[^A-Z0-9\s\-\.]/g, '').trim();
  if (!tag || currentTags.length >= 5 || currentTags.includes(tag)) return;
  currentTags.push(tag);
  renderTagChips();
}

function removeTag(tag) {
  currentTags = currentTags.filter(t => t !== tag);
  renderTagChips();
}

function renderTagChips() {
  const preview = document.getElementById('tags-preview');
  preview.innerHTML = currentTags.map(t => `
    <span class="tag-chip">
      ${escapeHtml(t)}
      <button class="tag-chip-remove" onclick="removeTag('${escapeHtml(t)}')">&times;</button>
    </span>
  `).join('');
}

async function saveProfile() {
  const btn = document.getElementById('save-profile-btn');
  const errorEl = document.getElementById('edit-error');
  errorEl.textContent = '';

  const display_name = document.getElementById('edit-display-name').value.trim();
  const bio = document.getElementById('edit-bio').value.trim();

  btn.disabled = true;
  btn.textContent = 'Saving…';

  const { ok, data } = await apiFetch('/api/users/me/profile', {
    method: 'PATCH',
    body: JSON.stringify({ display_name, bio, team_tags: currentTags })
  });

  btn.disabled = false;
  btn.textContent = 'Save changes';

  if (ok) {
    profileUser = { ...profileUser, ...data };
    saveUser({ ...getUser(), ...data });

    document.getElementById('profile-display-name').textContent = data.display_name || data.username;
    document.getElementById('profile-bio').textContent = data.bio || '';
    document.getElementById('profile-tags').innerHTML = renderTeamTags(data.team_tags);
    updateSidebarUser(data);

    document.getElementById('edit-profile-widget').style.display = 'none';
  } else {
    errorEl.textContent = data.error || 'Failed to save.';
  }
}

async function uploadAvatar(file) {
  if (!file) return;
  const formData = new FormData();
  formData.append('avatar', file);

  const token = getToken();
  try {
    const res = await fetch('/api/upload/avatar', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('profile-avatar').src = data.avatar;
      const user = getUser();
      if (user) { user.avatar = data.avatar; saveUser(user); }
      updateSidebarUser({ ...getUser(), avatar: data.avatar });
    } else {
      alert(data.error || 'Upload failed.');
    }
  } catch (err) {
    console.error(err);
  }
}

async function uploadBanner(file) {
  if (!file) return;
  const formData = new FormData();
  formData.append('banner', file);

  const token = getToken();
  try {
    const res = await fetch('/api/upload/banner', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      const bannerEl = document.getElementById('profile-banner');
      let img = bannerEl.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.alt = 'banner';
        bannerEl.prepend(img);
      }
      img.src = data.banner;
    } else {
      alert(data.error || 'Upload failed.');
    }
  } catch (err) {
    console.error(err);
  }
}

// Modal post handler for profile page
document.getElementById('modal-post-btn')?.addEventListener('click', async () => {
  const textarea = document.getElementById('modal-compose-text');
  const content = textarea?.value.trim();
  if (!content) return;

  const btn = document.getElementById('modal-post-btn');
  btn.disabled = true;
  btn.textContent = 'Posting…';

  try {
    const { ok, data } = await apiFetch('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    if (ok) {
      textarea.value = '';
      document.getElementById('modal-compose-count').textContent = '280';
      document.getElementById('compose-modal').style.display = 'none';

      // If viewing own profile, prepend to feed
      if (isOwnProfile) {
        const feed = document.getElementById('profile-feed');
        const emptyEl = feed.querySelector('.feed-empty');
        if (emptyEl) emptyEl.remove();
        feed.insertAdjacentHTML('afterbegin', renderPost(data, currentUser?.id));
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
});
