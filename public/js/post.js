/* ===========================
   CNTRD – Post Detail Page JS
   =========================== */

const params = new URLSearchParams(window.location.search);
const postId = params.get('id');
const currentUser = getUser();

initSidebar();

if (!postId) {
  window.location.href = '/feed.html';
} else {
  loadPost();
}

async function loadPost() {
  const { ok, data } = await apiFetch(`/api/posts/${postId}`);
  const area = document.getElementById('post-area');

  if (!ok) {
    area.innerHTML = '<div class="feed-empty">Post not found.</div>';
    return;
  }

  const { post, replies } = data;

  area.innerHTML = renderPost(post, currentUser?.id);

  // Show reply compose
  document.getElementById('reply-compose').style.display = 'flex';
  const replyAvatar = document.getElementById('reply-avatar');
  if (replyAvatar && currentUser?.avatar) {
    replyAvatar.src = avatarUrl(currentUser.avatar);
  }

  // Reply count
  const replyText = document.getElementById('reply-text');
  const replyCount = document.getElementById('reply-count');
  replyText.addEventListener('input', () => {
    const remaining = 280 - replyText.value.length;
    replyCount.textContent = remaining;
    replyCount.className = 'compose-count' + (remaining < 20 ? ' danger' : remaining < 50 ? ' warn' : '');
  });

  document.getElementById('reply-btn').addEventListener('click', submitReply);

  // Render replies
  const repliesArea = document.getElementById('replies-area');
  if (replies.length) {
    repliesArea.innerHTML = replies.map(r => renderPost(r, currentUser?.id)).join('');
  } else {
    repliesArea.innerHTML = '<div class="feed-empty" style="padding:24px;">No replies yet.</div>';
  }

  // Modal post handler
  document.getElementById('modal-post-btn')?.addEventListener('click', async () => {
    const textarea = document.getElementById('modal-compose-text');
    const content = textarea?.value.trim();
    if (!content) return;
    const btn = document.getElementById('modal-post-btn');
    btn.disabled = true;
    btn.textContent = 'Posting…';
    try {
      const { ok: ok2, data: d2 } = await apiFetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      if (ok2) {
        textarea.value = '';
        document.getElementById('modal-compose-count').textContent = '280';
        document.getElementById('compose-modal').style.display = 'none';
      } else {
        alert(d2.error || 'Failed to post.');
      }
    } catch (e) { console.error(e); }
    finally { btn.disabled = false; btn.textContent = 'Post'; }
  });
}

async function submitReply() {
  const btn = document.getElementById('reply-btn');
  const content = document.getElementById('reply-text').value.trim();
  if (!content) return;

  btn.disabled = true;
  btn.textContent = 'Replying…';

  const { ok, data } = await apiFetch('/api/posts', {
    method: 'POST',
    body: JSON.stringify({ content, reply_to: postId })
  });

  btn.disabled = false;
  btn.textContent = 'Reply';

  if (ok) {
    document.getElementById('reply-text').value = '';
    document.getElementById('reply-count').textContent = '280';

    const repliesArea = document.getElementById('replies-area');
    const emptyEl = repliesArea.querySelector('.feed-empty');
    if (emptyEl) emptyEl.remove();

    repliesArea.insertAdjacentHTML('afterbegin', renderPost(data, currentUser?.id));

    // Update reply count on original post
    const replyCountEl = document.querySelector(`.reply-count-${postId}`);
    if (replyCountEl) {
      replyCountEl.textContent = formatNumber((parseInt(replyCountEl.textContent) || 0) + 1);
    }
  } else {
    alert(data.error || 'Failed to reply.');
  }
}
