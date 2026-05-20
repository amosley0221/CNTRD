import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Image as ImgIcon, RefreshCw, X } from 'lucide-react';
import { c, fonts } from '../tokens';
import { Eyebrow, Pill } from '../components';
import { plays as playsApi, uploads } from '../api';
import { useAuth } from '../auth/AuthContext';

const PLAY_VIDEO_MAX_SEC = 30;

export default function PlayCreator() {
  const { me, loading } = useAuth();
  const nav = useNavigate();

  // Sign-in gate. Layout's RequireAuth doesn't wrap this route so we
  // can show camera permission UI cleanly even mid-flow; check here.
  if (!loading && !me) {
    nav('/login', { replace: true, state: { from: '/plays/new' } });
    return null;
  }

  const [mode, setMode] = useState('camera');           // 'camera' | 'library' | 'preview'
  const [facing, setFacing] = useState('environment'); // back camera first
  const [camState, setCamState] = useState('idle');   // 'idle' | 'pending' | 'ok' | 'denied' | 'unavailable'
  const [camErr, setCamErr] = useState(null);
  const [preview, setPreview] = useState(null);       // { url, kind: 'image'|'video', file }
  const [label, setLabel] = useState('');
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const captureCanvasRef = useRef(null);

  // Tear down the active stream when leaving camera mode or unmounting.
  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (s) s.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    const md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) {
      setCamState('unavailable');
      setCamErr('Your browser does not expose a camera.');
      return;
    }
    setCamState('pending');
    setCamErr(null);
    try {
      stopStream();
      const stream = await md
        .getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false })
        .catch(() => md.getUserMedia({ video: true, audio: false }));
      streamRef.current = stream;
      // Flip state first so the <video> mounts, then attach in the
      // effect below — assigning srcObject here would no-op because
      // the ref is still null until React commits the next render.
      setCamState('ok');
    } catch (e) {
      const name = e?.name;
      const msg = name === 'NotAllowedError' ? 'Camera permission denied.'
                : name === 'NotFoundError'  ? 'No camera detected on this device.'
                : (e?.message || 'Camera unavailable.');
      setCamState(name === 'NotAllowedError' ? 'denied' : 'unavailable');
      setCamErr(msg);
    }
  }, [facing, stopStream]);

  // Auto-start camera when entering camera mode, restart on facing flip.
  useEffect(() => {
    if (mode === 'camera') startCamera();
    else stopStream();
    return stopStream;
  }, [mode, facing]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Attach the active stream after the <video> element commits.
  useEffect(() => {
    if (camState !== 'ok') return;
    const v = videoRef.current;
    const s = streamRef.current;
    if (!v || !s) return;
    v.srcObject = s;
    v.play().catch(() => {});
  }, [camState, facing]);

  const flip = () => setFacing((f) => (f === 'user' ? 'environment' : 'user'));

  const snap = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = captureCanvasRef.current || document.createElement('canvas');
    captureCanvasRef.current = canvas;
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `snap-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = URL.createObjectURL(file);
      stopStream();
      setPreview({ url, kind: 'image', file });
      setMode('preview');
    }, 'image/jpeg', 0.92);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSubmitErr(null);
    if (file.type.startsWith('video/')) {
      const dur = await getVideoDuration(file);
      if (Number.isFinite(dur) && dur > PLAY_VIDEO_MAX_SEC + 0.5) {
        setSubmitErr(`Video must be ${PLAY_VIDEO_MAX_SEC}s or shorter (this one is ${dur.toFixed(1)}s).`);
        return;
      }
    }
    const url = URL.createObjectURL(file);
    setPreview({ url, kind: file.type.startsWith('video/') ? 'video' : 'image', file });
    setMode('preview');
  };

  const reset = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setLabel('');
    setCaption('');
    setSubmitErr(null);
    setMode('camera');
  };

  const submit = async () => {
    if (!label.trim()) { setSubmitErr('Add a label first.'); return; }
    setSubmitErr(null);
    setSubmitting(true);
    try {
      let media_url = null;
      let media_kind = null;
      if (preview?.file) {
        const up = await uploads.media(preview.file);
        media_url = up.url;
        media_kind = up.kind;
      }
      await playsApi.create({
        label: label.trim(),
        caption: caption.trim() || undefined,
        media_url,
        media_kind,
      });
      reset();
      nav('/plays');
    } catch (e) {
      setSubmitErr(e.message || 'Could not publish.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Eyebrow>New play · expires in 24h</Eyebrow>

      <div className="flex items-center gap-2 mb-5">
        <Pill active={mode === 'camera'}  onClick={() => setMode('camera')}>Camera</Pill>
        <Pill active={mode === 'library'} onClick={() => fileInputRef.current?.click()}>Library</Pill>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={onFile}
          style={{ display: 'none' }}
        />
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%', maxWidth: 460, margin: '0 auto',
          aspectRatio: '9 / 16',
          background: '#0f0d0a',
          border: `1px solid ${c.line}`,
          overflow: 'hidden',
        }}
      >
        {mode === 'preview' && preview && (
          preview.kind === 'video' ? (
            <video src={preview.url} autoPlay loop muted playsInline style={fillStyle} />
          ) : (
            <img src={preview.url} alt="preview" style={fillStyle} />
          )
        )}

        {mode === 'camera' && camState === 'ok' && (
          <video
            ref={videoRef}
            autoPlay muted playsInline
            style={{ ...fillStyle, transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
          />
        )}

        {mode === 'camera' && camState !== 'ok' && (
          <CameraEmpty state={camState} err={camErr} onRetry={startCamera} onLibrary={() => fileInputRef.current?.click()} />
        )}

        {mode === 'camera' && camState === 'ok' && (
          <>
            <button onClick={flip} aria-label="Flip camera" style={fab({ top: 14, right: 14 })}>
              <RefreshCw size={18} color="#fff" />
            </button>
            <button
              onClick={snap}
              aria-label="Take photo"
              style={{
                position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)',
                width: 72, height: 72, borderRadius: 999,
                background: 'transparent',
                border: '4px solid #fff', cursor: 'pointer',
              }}
            >
              <span style={{ display: 'block', width: 56, height: 56, borderRadius: 999, background: '#fff', margin: '4px auto' }} />
            </button>
          </>
        )}
      </div>

      <div className="mt-6" style={{ maxWidth: 460, margin: '24px auto 0' }}>
        <FieldRow label="LABEL · REQUIRED" value={label} onChange={setLabel} placeholder="e.g. Tatum from 30" max={80} />
        <FieldRow label="CAPTION · OPTIONAL" value={caption} onChange={setCaption} placeholder="A line of context" max={140} />

        {submitErr && (
          <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.alert, letterSpacing: '0.05em', marginTop: 8 }}>{submitErr}</div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={reset}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'transparent',
              border: `1px solid ${c.inkFaint}`,
              color: c.ink, cursor: 'pointer',
              fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
            }}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !label.trim()}
            style={{
              flex: 2,
              padding: '12px 16px',
              background: c.accent, color: c.paper,
              border: 'none', cursor: submitting ? 'wait' : 'pointer',
              fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
              opacity: submitting || !label.trim() ? 0.55 : 1,
            }}
          >
            {submitting ? 'Publishing…' : 'Publish play'}
          </button>
        </div>
      </div>
    </>
  );
}

const fillStyle = {
  position: 'absolute', inset: 0,
  width: '100%', height: '100%',
  objectFit: 'cover', background: '#000',
};

function fab(extra) {
  return {
    position: 'absolute',
    width: 38, height: 38, borderRadius: 999,
    background: 'rgba(0,0,0,0.55)',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    ...extra,
  };
}

function CameraEmpty({ state, err, onRetry, onLibrary }) {
  const title =
    state === 'pending'     ? 'Starting camera…'
    : state === 'denied'    ? 'Camera permission denied'
    : state === 'unavailable' ? 'Camera unavailable'
    : 'Tap to enable camera';
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#fff', padding: 20, textAlign: 'center' }}>
      <Camera size={28} />
      <div style={{ fontFamily: fonts.display, fontSize: 18 }}>{title}</div>
      {err && <div style={{ fontFamily: fonts.mono, fontSize: 11, opacity: 0.8 }}>{err}</div>}
      <div className="flex gap-3 mt-2">
        {state !== 'pending' && (
          <button onClick={onRetry} style={btnDark}>Try again</button>
        )}
        <button onClick={onLibrary} style={btnDark}><ImgIcon size={14} style={{ marginRight: 6 }} />Library</button>
      </div>
    </div>
  );
}

const btnDark = {
  padding: '8px 14px',
  background: 'transparent', border: '1px solid rgba(255,255,255,0.6)', color: '#fff',
  fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
};

function FieldRow({ label, value, onChange, placeholder, max }) {
  return (
    <label className="block mb-4">
      <div style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim, letterSpacing: '0.2em', marginBottom: 6 }}>{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={max}
        style={{
          width: '100%', padding: '10px 12px',
          background: 'transparent', border: `1px solid ${c.inkFaint}`,
          color: c.ink, fontFamily: fonts.body, fontSize: 15, outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = c.accent)}
        onBlur={(e) => (e.currentTarget.style.borderColor = c.inkFaint)}
      />
    </label>
  );
}

function getVideoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(NaN); };
    v.src = url;
  });
}
