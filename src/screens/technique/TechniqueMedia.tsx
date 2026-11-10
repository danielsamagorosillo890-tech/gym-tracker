import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../../data/db';
import { framesFor } from '../../data/technique';
import type { UserMedia } from '../../data/types';

/** Object URL for a stored blob, revoked on unmount. */
function useBlobUrl(media: UserMedia | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!media) return setUrl(null);
    const u = URL.createObjectURL(media.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [media]);
  return url;
}

export function useUserMedia(exerciseId: string) {
  return useLiveQuery(() => db.userMedia.where({ exerciseId }).first(), [exerciseId]);
}

/**
 * The exercise's visual: the user's own upload first, else the two bundled photos
 * cross-fading (start ↔ end of the movement), else an empty placeholder.
 */
export function TechniqueMedia({ exerciseId, name, size }: { exerciseId: string; name: string; size: 'thumb' | 'large' }) {
  const own = useUserMedia(exerciseId);
  const url = useBlobUrl(own ?? undefined);
  const frames = framesFor(exerciseId);
  const base = import.meta.env.BASE_URL;

  if (own && url) {
    return (
      <div className={`tech-media ${size}`}>
        {own.kind === 'video' ? (
          <video src={url} autoPlay loop muted playsInline aria-label={`Video de técnica de ${name}`} />
        ) : (
          <img src={url} alt={`Técnica de ${name}`} />
        )}
      </div>
    );
  }
  if (frames) {
    return (
      <div className={`tech-media ${size} fade`} role="img" aria-label={`Técnica de ${name}: inicio y final del movimiento`}>
        <img src={`${base}${frames.frames[0]}`} alt="" loading="lazy" />
        <img src={`${base}${frames.frames[1]}`} alt="" loading="lazy" className="second" />
      </div>
    );
  }
  return (
    <div className={`tech-media ${size} empty`}>
      <span>Sin visual</span>
    </div>
  );
}
