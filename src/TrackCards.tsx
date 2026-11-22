import { Disc3, Play, UserRound } from 'lucide-react';
import { sourceName } from './CollectionManager';
import { Cover } from './Cover';
import type { Track } from './model';

type TrackCardsProps = {
  tracks: Track[];
  onPlay: (track: Track, queue: Track[]) => void;
  onOpenEntity: (track: Track, kind: 'artist' | 'album') => void;
};

export function TrackCards({ tracks, onPlay, onOpenEntity }: TrackCardsProps) {
  return (
    <div className="cards">
      {tracks.map((t) => (
        <article className="music-card" key={t.id}>
          <button
            className="art-button"
            onClick={() => onPlay(t, tracks)}
            aria-label={'Слушать ' + t.title}
          >
            <Cover track={t} />
            <span className="card-play">
              <Play size={23} fill="currentColor" />
            </span>
          </button>
          <button className="card-title" onClick={() => onPlay(t, tracks)}>
            {t.title}
          </button>
          <p>{t.artist}</p>
          <span className={'source-badge ' + t.source}>{sourceName(t)}</span>
          {t.license && (
            <div className="track-credits">
              <a href={t.link} target="_blank" rel="noreferrer">
                Source
              </a>{' '}
              ·{' '}
              <a href={t.licenseUrl} target="_blank" rel="noreferrer">
                {t.license}
              </a>
            </div>
          )}
          <div className="card-entity-links">
            <button
              onClick={() => void onOpenEntity(t, 'artist')}
              aria-label={'Открыть исполнителя ' + t.artist}
            >
              <UserRound size={14} />
              Исполнитель
            </button>
            {t.albumId && (
              <button
                aria-label={'Открыть альбом ' + t.album}
                onClick={() => void onOpenEntity(t, 'album')}
              >
                <Disc3 size={14} />
                Альбом
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
