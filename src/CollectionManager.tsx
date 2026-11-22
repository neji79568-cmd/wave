import {
  ChevronDown,
  ChevronUp,
  Disc3,
  Download,
  Heart,
  Music2,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { type Track, bytes, fmt, trackCount } from './model';
type Props = {
  title: string;
  subtitle: string;
  tracks: Track[];
  kind: 'files' | 'playlist' | 'liked' | 'history' | 'catalog';
  liked: Track[];
  current: Track | null;
  playing: boolean;
  loading?: boolean;
  onPlay: (t: Track, q: Track[]) => void;
  onLike: (t: Track) => void;
  onAdd: (tracks: Track[]) => void;
  onBulkLike: (tracks: Track[]) => void;
  onRemove?: (tracks: Track[]) => Promise<void> | void;
  onRename?: (name: string) => void;
  onReorder?: (tracks: Track[]) => void;
  onDelete?: () => void;
  onImport?: () => void;
  onStorage?: () => void;
  onFind: () => void;
  onArtist: (t: Track) => void;
  onAlbum: (t: Track) => void;
};
export const sourceName = (t: Track) =>
  t.source === 'itunes'
    ? 'Фрагмент'
    : t.source === 'local'
      ? 'Доступен офлайн'
      : t.source === 'archive'
        ? 'Полностью · Archive'
        : t.source === 'openverse'
          ? 'Полностью · Openverse'
          : 'Полностью · Audius';
export function CollectionManager(p: Props) {
  const [operationError, setOperationError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(p.title);
  const [confirm, setConfirm] = useState<'tracks' | 'playlist' | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const shown = p.tracks.filter((t) =>
    (t.title + ' ' + t.artist + ' ' + (t.album || '')).toLowerCase().includes(query.toLowerCase()),
  );
  const chosen = p.tracks.filter((t) => selected.has(t.id));
  useEffect(() => {
    setSelected((s) => new Set([...s].filter((id) => p.tracks.some((t) => t.id === id))));
  }, [p.tracks]);
  function move(id: string, direction: number) {
    const next = [...p.tracks];
    const i = next.findIndex((t) => t.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    p.onReorder?.(next);
  }
  function drop(id: string) {
    if (!dragged || !p.onReorder || dragged === id) return;
    const next = p.tracks.filter((t) => t.id !== dragged);
    const track = p.tracks.find((t) => t.id === dragged);
    if (track) {
      next.splice(
        next.findIndex((t) => t.id === id),
        0,
        track,
      );
      p.onReorder(next);
    }
    setDragged(null);
  }
  return (
    <section className="collection-manager">
      {operationError && (
        <p className="settings-error" role="alert">
          {operationError}
        </p>
      )}
      <div className={'collection-banner collection-' + p.kind}>
        <div className="collection-emblem">
          {p.kind === 'liked' ? (
            <Heart fill="currentColor" />
          ) : p.kind === 'files' ? (
            <Download />
          ) : (
            <Disc3 />
          )}
        </div>
        <div>
          <span className="eyebrow">
            {p.kind === 'files'
              ? 'НА УСТРОЙСТВЕ'
              : p.kind === 'playlist'
                ? 'ТВОЙ ПЛЕЙЛИСТ'
                : 'ТВОЯ МУЗЫКА'}
          </span>
          {renaming ? (
            <form
              className="rename-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) {
                  p.onRename?.(name.trim());
                  setRenaming(false);
                }
              }}
            >
              <input
                aria-label="Новое название плейлиста"
                autoFocus
                value={name}
                maxLength={70}
                onChange={(e) => setName(e.target.value)}
              />
              <button type="submit" className="secondary" disabled={!name.trim()}>
                Сохранить
              </button>
              <button type="button" onClick={() => setRenaming(false)}>
                Отмена
              </button>
            </form>
          ) : (
            <h1>{p.title}</h1>
          )}
          <p>
            {p.subtitle} · {trackCount(p.tracks.length)}
            {p.kind === 'files'
              ? ' · ' + bytes(p.tracks.reduce((n, t) => n + (t.sizeBytes || 0), 0))
              : ''}
          </p>
        </div>
      </div>
      <div className="manager-toolbar">
        <button
          className="round-play"
          aria-label="Включить коллекцию"
          disabled={!p.tracks.length}
          onClick={() => p.onPlay(p.tracks[0], p.tracks)}
        >
          <Play fill="currentColor" />
        </button>
        {p.onImport && (
          <button className="secondary" onClick={p.onImport}>
            <Upload size={17} />
            Добавить музыку
          </button>
        )}
        {p.onRename && (
          <button
            className="secondary"
            onClick={() => {
              setName(p.title);
              setRenaming(true);
            }}
          >
            <Pencil size={16} />
            Переименовать
          </button>
        )}
        {p.onStorage && (
          <button className="secondary" onClick={p.onStorage}>
            Управление памятью
          </button>
        )}
        {p.onDelete && (
          <button
            className="icon-button"
            aria-label="Удалить плейлист"
            onClick={() => setConfirm('playlist')}
          >
            <Trash2 size={18} />
          </button>
        )}
        <label className="collection-search">
          <Search size={17} />
          <input
            aria-label="Поиск в списке песен"
            placeholder="Поиск по трекам"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {!!p.tracks.length && (
        <div className="selection-bar">
          <label>
            <input
              type="checkbox"
              aria-label="Выбрать все треки"
              checked={!!shown.length && shown.every((t) => selected.has(t.id))}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? new Set([...selected, ...shown.map((t) => t.id)])
                    : new Set([...selected].filter((id) => !shown.some((t) => t.id === id))),
                )
              }
            />
            Выбрать все
          </label>
          {chosen.length > 0 ? (
            <>
              <span>Выбрано: {chosen.length}</span>
              <button onClick={() => p.onAdd(chosen)}>
                <Plus size={16} />В плейлист
              </button>
              <button onClick={() => p.onBulkLike(chosen)}>
                <Heart size={16} />В избранное
              </button>
              {p.onRemove && (
                <button onClick={() => setConfirm('tracks')}>
                  <Trash2 size={16} />
                  {p.kind === 'files' ? 'Удалить файлы' : 'Убрать'}
                </button>
              )}
              <button onClick={() => setSelected(new Set())}>Снять выбор</button>
            </>
          ) : (
            <span>
              {p.onReorder
                ? 'Перетаскивай песни или используй кнопки порядка'
                : 'Выбирай песни для действий с коллекцией'}
            </span>
          )}
        </div>
      )}
      {confirm && (
        <div className="confirm-strip" role="alert">
          <div>
            <strong>
              {confirm === 'playlist'
                ? 'Удалить плейлист?'
                : p.kind === 'files'
                  ? 'Удалить выбранные файлы с этого устройства?'
                  : 'Убрать выбранные песни из коллекции?'}
            </strong>
            <p>
              {confirm === 'playlist'
                ? 'Аудиофайлы останутся на устройстве.'
                : p.kind === 'files'
                  ? 'Файлы исчезнут из коллекции и плейлистов. Сначала можно сделать резервную копию.'
                  : 'Сами аудиофайлы сохранятся.'}
            </p>
          </div>
          <button
            disabled={saving}
            className="secondary danger"
            onClick={async () => {
              setSaving(true);
              try {
                if (confirm === 'playlist') p.onDelete?.();
                else await p.onRemove?.(chosen);
                setSelected(new Set());
                setConfirm(null);
              } catch (error) {
                setOperationError(error instanceof Error ? error.message : 'Operation failed');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Удаляем…' : 'Удалить'}
          </button>
          <button disabled={saving} className="secondary" onClick={() => setConfirm(null)}>
            Отмена
          </button>
        </div>
      )}
      {p.loading ? (
        <div className="row-skeletons" aria-label="Загрузка треков">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="row-skeleton" key={i} />
          ))}
        </div>
      ) : shown.length ? (
        <div className="managed-tracks">
          {shown.map((t, i) => (
            <div
              className={
                'managed-row ' +
                (p.current?.id === t.id ? 'active' : '') +
                (selected.has(t.id) ? ' is-selected' : '')
              }
              key={t.id}
              onDragOver={p.onReorder ? (e) => e.preventDefault() : undefined}
              onDrop={() => drop(t.id)}
            >
              <label className="track-select">
                <input
                  type="checkbox"
                  aria-label={'Выбрать ' + t.title}
                  checked={selected.has(t.id)}
                  onChange={(e) =>
                    setSelected((s) => {
                      const next = new Set(s);
                      e.target.checked ? next.add(t.id) : next.delete(t.id);
                      return next;
                    })
                  }
                />
              </label>
              <button
                className="managed-main"
                draggable={!!p.onReorder}
                onDragStart={() => setDragged(t.id)}
                onDragEnd={() => setDragged(null)}
                onClick={() => p.onPlay(t, p.tracks)}
                aria-label={'Слушать ' + t.title}
              >
                <span className="cover">
                  <Music2 />
                  {t.artwork && (
                    <img
                      src={t.artwork}
                      loading="lazy"
                      alt=""
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                </span>
                <span>
                  <strong>{t.title}</strong>
                  <small>
                    {t.artist}
                    {t.album ? ' · ' + t.album : ''}
                  </small>
                </span>
              </button>
              <div>
                <span className={'source-badge ' + t.source}>{sourceName(t)}</span>
                {t.license && (
                  <div className="track-credits">
                    {t.artist} ·{' '}
                    <a href={t.link} target="_blank" rel="noreferrer">
                      Источник
                    </a>{' '}
                    ·{' '}
                    <a href={t.licenseUrl} target="_blank" rel="noreferrer">
                      {t.license}
                    </a>
                  </div>
                )}
              </div>
              <span className="managed-time">
                {t.duration ? fmt(t.duration) : '—'}
                {p.kind === 'files' && <small>{bytes(t.sizeBytes || 0)}</small>}
              </span>
              <div className="managed-actions">
                <button
                  aria-label={
                    p.liked.some((l) => l.id === t.id) ? 'Убрать из избранного' : 'В избранное'
                  }
                  className={p.liked.some((l) => l.id === t.id) ? 'liked' : ''}
                  onClick={() => p.onLike(t)}
                >
                  <Heart
                    size={18}
                    fill={p.liked.some((l) => l.id === t.id) ? 'currentColor' : 'none'}
                  />
                </button>
                <button aria-label={'Добавить в плейлист: ' + t.title} onClick={() => p.onAdd([t])}>
                  <Plus size={18} />
                </button>
                <button
                  aria-label={'Открыть исполнителя ' + t.artist}
                  disabled={t.source === 'local' && !t.artistId}
                  onClick={() => p.onArtist(t)}
                >
                  <UserRound size={17} />
                </button>
                {t.albumId && (
                  <button aria-label={'Открыть альбом ' + t.album} onClick={() => p.onAlbum(t)}>
                    <Disc3 size={17} />
                  </button>
                )}
                {p.onReorder && (
                  <>
                    <button
                      disabled={i === 0}
                      aria-label={'Поднять ' + t.title}
                      onClick={() => move(t.id, -1)}
                    >
                      <ChevronUp size={17} />
                    </button>
                    <button
                      disabled={i === shown.length - 1}
                      aria-label={'Опустить ' + t.title}
                      onClick={() => move(t.id, 1)}
                    >
                      <ChevronDown size={17} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          <Music2 />
          <h2>
            {query
              ? 'Совпадений нет'
              : p.kind === 'files'
                ? 'Музыка, которая всегда рядом'
                : 'Начни свою коллекцию'}
          </h2>
          <p>
            {query
              ? 'Попробуй другое название или имя исполнителя.'
              : p.kind === 'files'
                ? 'Добавь MP3, M4A или WAV. Они сохранятся на устройстве для прослушивания без сети.'
                : 'Найди любимую песню и добавь её в коллекцию.'}
          </p>
          <button className="primary" onClick={query ? () => setQuery('') : p.onImport || p.onFind}>
            {query ? 'Очистить поиск' : p.onImport ? 'Добавить музыку' : 'Найти музыку'}
          </button>
        </div>
      )}
    </section>
  );
}
