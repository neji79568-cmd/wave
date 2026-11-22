import { AudioLines, ChevronRight, Heart, Music2, Play } from 'lucide-react';
import * as api from './api';
import { Cover } from './Cover';
import type { Track } from './model';
import { TrackCards } from './TrackCards';
import { AmbientVideo } from './Visualizer';

type HomePageProps = {
  trends: Track[];
  picks: Track[];
  artistShelves: api.Discovery[];
  discover: api.Discovery[];
  openMusic: api.Discovery[];
  onNavigate: (view: string) => void;
  onSearch: (query: string) => void;
  onSourceChange: (source: api.CatalogSource) => void;
  onImport: () => void;
  onHelp: () => void;
  onPlay: (track: Track, queue: Track[]) => void;
  onOpenEntity: (track: Track, kind: 'artist' | 'album') => void;
};

/** Discovery screen. Playback and collection state stay in App. */
export function HomePage({
  trends,
  picks,
  artistShelves,
  discover,
  openMusic,
  onNavigate,
  onSearch,
  onSourceChange,
  onImport,
  onHelp,
  onPlay,
  onOpenEntity,
}: HomePageProps) {
  const heroCover = picks.find((track) => track.artist === 'Miyagi') || picks[0];
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">НАСТРОЙСЯ НА СВОЮ ВОЛНУ</span>
          <h1>
            Звучит как ты<span>.</span>
          </h1>
        </div>
        <span className="intro-note">Музыка для любого момента</span>
      </div>
      <div className="home-chips">
        <button className="pill chosen" onClick={() => onNavigate('home')}>
          Для тебя
        </button>
        <button className="pill" onClick={() => onSearch('Miyagi')}>
          Miyagi & Эндшпиль
        </button>
        <button
          className="pill"
          onClick={() => {
            onSourceChange('itunes');
            onSearch('Драгни');
          }}
        >
          Драгни
        </button>
        <button
          className="pill"
          onClick={() => {
            onSourceChange('itunes');
            onSearch('batrip23');
          }}
        >
          batrip23
        </button>
        <button
          className="pill"
          onClick={() => {
            onSourceChange('audius');
            onSearch('Hip-Hop');
          }}
        >
          Хип-хоп
        </button>
        <button
          className="pill"
          onClick={() => {
            onSourceChange('audius');
            onSearch('Electronic');
          }}
        >
          Электроника
        </button>
        <button
          className="pill"
          onClick={() => {
            onSourceChange('audius');
            onSearch('Chill');
          }}
        >
          Чилл
        </button>
      </div>
      <section className="hero">
        <AmbientVideo />
        <div className="hero-grain" />
        <div className="hero-copy">
          <span className="hero-tag">
            <span />
            ТВОЙ СЛЕДУЮЩИЙ ЛЮБИМЫЙ ТРЕК
          </span>
          <h2>
            Твоя частота.
            <br />
            Твой мир.
          </h2>
          <p>
            Знакомые голоса. Новые открытия.
            <br />
            Музыка, которую чувствуешь.
          </p>
          <button
            className="primary"
            onClick={() => {
              onSourceChange('audius');
              onSearch('Miyagi');
            }}
          >
            <Play size={19} fill="currentColor" />
            Найти Miyagi
          </button>
          <span className="hero-caption">Полные треки — по доступности источника</span>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="album-back">
            <Cover track={picks[1]} />
          </div>
          <div className="vinyl">
            <div className="vinyl-label">
              <AudioLines />
            </div>
          </div>
          <div className="album-front">
            <Cover track={heroCover} />
            <div className="album-caption">
              <span>НА ПОВТОРЕ</span>
              <strong>Miyagi</strong>
            </div>
          </div>
          <div className="floating-note">
            <AudioLines size={20} />
            <span>Почувствуй музыку</span>
          </div>
        </div>
      </section>
      <div className="quick-grid">
        <button onClick={() => onNavigate('liked')}>
          <span className="liked-tile">
            <Heart fill="white" />
          </span>
          Любимые треки
          <Play size={18} />
        </button>
        <button
          onClick={() => {
            onSourceChange('audius');
            onSearch('Miyagi');
          }}
        >
          <Cover track={heroCover} />
          <span>
            Miyagi mix<small>Найти доступные треки</small>
          </span>
          <Play size={18} />
        </button>
        <button onClick={() => onNavigate('files')}>
          <span className="files-tile">
            <Music2 />
          </span>
          Моя музыка
          <Play size={18} />
        </button>
      </div>
      <section className="artist-strip">
        <div className="section-title">
          <div>
            <span className="eyebrow">НА ТВОЕЙ ЧАСТОТЕ</span>
            <h2>Твои исполнители</h2>
          </div>
          <span className="shelf-count">Найди свой голос</span>
        </div>
        <div className="artist-buttons">
          {api.artists.map((artist, i) => {
            const shelf = artistShelves.find((a) => a.id === artist.id);
            const cover = shelf?.tracks[0] || (artist.id === 'miyagi' ? heroCover : undefined);
            return (
              <button
                key={artist.id}
                className={'artist-button artist-' + i}
                onClick={() => {
                  if (shelf?.tracks.length) onNavigate('discovery:' + artist.id);
                  else {
                    onSourceChange('itunes');
                    onSearch(artist.query);
                  }
                }}
              >
                <Cover track={cover} />
                <span>
                  <strong>{artist.name}</strong>
                  <small>{artist.handle || 'Твои исполнители'}</small>
                </span>
                <Play size={18} />
              </button>
            );
          })}
        </div>
      </section>
      <section className="music-section">
        <div className="section-title">
          <div>
            <h2>На волне сейчас</h2>
            <p>Полные треки из открытого каталога Audius</p>
          </div>
          <button
            onClick={() => {
              onSourceChange('audius');
              onSearch('');
              onNavigate('trending');
            }}
          >
            Все треки
            <ChevronRight size={17} />
          </button>
        </div>
        {trends.length ? (
          <TrackCards tracks={trends.slice(0, 12)} onPlay={onPlay} onOpenEntity={onOpenEntity} />
        ) : (
          <div className="empty compact">
            <AudioLines />
            <p>Загружаем музыку. Если источник недоступен, попробуй поиск или добавь свои файлы.</p>
            <button className="secondary" onClick={() => onImport()}>
              Добавить музыку
            </button>
          </div>
        )}
      </section>
      <section className="music-section">
        <div className="section-title">
          <div>
            <h2>Ближе к твоему вкусу</h2>
            <p>Miyagi и знакомые голоса · фрагменты из iTunes</p>
          </div>
          <button
            onClick={() => {
              onSourceChange('itunes');
              onSearch('Miyagi');
            }}
          >
            Показать все
            <ChevronRight size={17} />
          </button>
        </div>
        {picks.length ? (
          <TrackCards tracks={picks.slice(0, 6)} onPlay={onPlay} onOpenEntity={onOpenEntity} />
        ) : (
          <div className="empty compact">
            Для поиска мировых исполнителей открой «Каталог · фрагменты».
          </div>
        )}
      </section>
      {[...artistShelves, ...discover, ...openMusic].map((shelf) => (
        <section className="music-section discovery-section" key={shelf.id}>
          <div className="section-title">
            <div>
              <span className="eyebrow">
                {shelf.genre === 'artist' ? 'ТВОИ ИСПОЛНИТЕЛИ' : 'ОТКРОЙ НОВОЕ'}
              </span>
              <h2>{shelf.title}</h2>
              <p>
                {shelf.genre === 'artist'
                  ? (shelf.id === 'dragni' ? '@dragni86 · ' : '') + 'Фрагменты из iTunes'
                  : shelf.subtitle + ' · полные треки'}
              </p>
            </div>
            <button onClick={() => onNavigate('discovery:' + shelf.id)}>
              Все треки {shelf.tracks.length}
              <ChevronRight size={17} />
            </button>
          </div>
          {shelf.tracks.length ? (
            <TrackCards
              tracks={shelf.tracks.slice(0, 12)}
              onPlay={onPlay}
              onOpenEntity={onOpenEntity}
            />
          ) : (
            <div className="empty compact">
              <p>В подключённом каталоге пока нет доступных треков этого исполнителя.</p>
              <button
                className="secondary"
                onClick={() => {
                  onSourceChange('audius');
                  onSearch(shelf.title);
                }}
              >
                Искать полные треки
              </button>
            </div>
          )}
        </section>
      ))}
      <footer className="page-footer">
        <AudioLines size={17} />
        <span>Своя музыка. Своя волна.</span>
        <button onClick={() => onHelp()}>Об источниках и установке</button>
      </footer>
    </>
  );
}
