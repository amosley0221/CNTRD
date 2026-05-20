import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImgIcon, X } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Eyebrow, Avatar } from '../components';
import { posts as postsApi, uploads } from '../api';
import { useAuth } from '../auth/AuthContext';

const MAX_CHARS = 280;

export default function Composer() {
  const { me } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef(null);

  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(null); // { url, file }
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const remaining = MAX_CHARS - content.length;
  const initial = (me?.display_name?.[0] || me?.username?.[0] || '?').toUpperCase();

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Pick a still image, not a video.'); return; }
    setErr(null);
    setPreview({ url: URL.createObjectURL(file), file });
  };

  const dropImage = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const submit = async () => {
    const trimmed = content.trim();
    if (!trimmed && !preview) { setErr('Add some text or attach a photo.'); return; }
    if (trimmed.length > MAX_CHARS) { setErr(`Posts are ${MAX_CHARS} characters max.`); return; }
    setSubmitting(true);
    setErr(null);
    try {
      let image = null;
      if (preview?.file) {
        const up = await uploads.media(preview.file);
        image = up.url;
      }
      await postsApi.create({ content: trimmed, image });
      nav('/feed');
    } catch (e) {
      setErr(e.message || 'Could not post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Eyebrow>New post</Eyebrow>

      <div className="flex gap-3" style={{ maxWidth: 640 }}>
        <Avatar initial={initial} />
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What’s the take?"
            maxLength={MAX_CHARS + 40}
            rows={5}
            autoFocus
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              resize: 'none',
              fontFamily: fonts.display,
              fontSize: 20,
              lineHeight: 1.35,
              fontWeight: 300,
              color: c.ink,
              padding: 0,
              marginBottom: 12,
            }}
          />

          {preview && (
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <img
                src={preview.url}
                alt="preview"
                style={{ width: '100%', maxHeight: 480, objectFit: 'cover', borderRadius: 4, border: `1px solid ${c.line}` }}
              />
              <button
                onClick={dropImage}
                aria-label="Remove image"
                style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 30, height: 30, borderRadius: 999,
                  background: 'rgba(0,0,0,0.6)', color: '#fff',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {err && (
            <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert, letterSpacing: '0.05em', marginBottom: 8 }}>{err}</div>
          )}

          <div className="flex items-center justify-between" style={{ borderTop: `1px solid ${c.line}`, paddingTop: 12 }}>
            <button
              onClick={() => fileRef.current?.click()}
              type="button"
              aria-label="Add image"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: c.accent, display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
              }}
            >
              <ImgIcon size={16} /> Photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />

            <div className="flex items-center gap-4">
              <span
                style={{
                  fontFamily: fonts.mono, fontSize: 11,
                  color: remaining < 0 ? c.alert : remaining <= 20 ? c.accent : c.inkDim,
                  letterSpacing: '0.05em',
                }}
              >
                {remaining}
              </span>
              <button
                onClick={submit}
                disabled={submitting || (!content.trim() && !preview) || remaining < 0}
                style={{
                  padding: '10px 18px',
                  background: c.accent, color: c.paper, border: 'none',
                  cursor: submitting ? 'wait' : 'pointer',
                  fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
                  opacity: submitting || (!content.trim() && !preview) || remaining < 0 ? 0.5 : 1,
                }}
              >
                {submitting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
