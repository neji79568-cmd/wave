import { AudioLines } from 'lucide-react';
import type { Track } from './model';

export function Cover({ track, className = '' }: { track?: Track; className?: string }) {
  return (
    <div className={'cover ' + className}>
      <AudioLines />
      {track?.artwork && (
        <img
          src={track.artwork}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
    </div>
  );
}
