import { useState } from 'react';
import { Heart, Repeat2, MessageCircle } from 'lucide-react';
import { c, fonts } from '../tokens';
import Avatar from './Avatar';

export default function Post({ author, handle, time, body, stats = { up: 0, repost: 0, reply: 0 } }) {
  const [liked, setLiked] = useState(false);

  return (
    <article className="py-6 flex flex-col gap-3" style={{ borderBottom: `1px solid ${c.line}` }}>
      <div className="flex items-center gap-2.5">
        <Avatar initial={author[0]} />
        <div className="flex-1">
          <div style={{ fontWeight: 600, fontSize: 13, color: c.ink }}>{author}</div>
          <div style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim }}>{handle}</div>
        </div>
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: c.inkDim }}>{time}</span>
      </div>

      <div style={{ fontFamily: fonts.display, fontSize: 19, lineHeight: 1.35, fontWeight: 300, color: c.ink }}>
        {body}
      </div>

      <div className="flex gap-6 mt-1" style={{ fontFamily: fonts.mono, fontSize: 11, color: c.inkDim, letterSpacing: '0.05em' }}>
        <button
          className="flex items-center gap-1.5 transition-colors duration-200"
          onClick={() => setLiked(!liked)}
          style={{ color: liked ? c.accent : c.inkDim }}
        >
          <Heart size={13} fill={liked ? c.accent : 'none'} />
          {(stats.up + (liked ? 1 : 0)).toLocaleString()}
        </button>
        <span className="flex items-center gap-1.5"><Repeat2 size={13} /> {stats.repost}</span>
        <span className="flex items-center gap-1.5"><MessageCircle size={13} /> {stats.reply}</span>
      </div>
    </article>
  );
}
