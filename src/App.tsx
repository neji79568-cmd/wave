import {
  AudioLines,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  Globe,
  Headphones,
  Heart,
  Home,
  Library,
  ListMusic,
  Maximize2,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  Search,
  Settings2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as api from './api';
import { Atmosphere } from './Atmosphere';
import { BulkPlaylistDialog } from './BulkPlaylistDialog';
import { CollectionManager } from './CollectionManager';
import { Cover } from './Cover';
import { deleteFiles, getFile, putFile } from './files';
import { HomePage } from './HomePage';
import { LibraryHub } from './LibraryHub';
import { LogoMark } from './Logo';
import {
  type Playlist,
  type Track,
  cleanTrack,
  fmt,
  readStore,
  trackCount,
  writeStore,
} from './model';
import { useMotion } from './motion';
import {
  positionWithinDuration,
  readPlaybackSession,
  savePlaybackSession,
} from './playback-session';
import { ProductSettings } from './ProductSettings';
import { usePwaUpdates } from './pwa';
import { Equalizer, type VisualMode, Visualizer } from './Visualizer';

const sourceLabel = (t: Track) =>
  t.source === 'itunes' ? 'Фрагмент' : t.source === 'local' ? 'На устройстве' : 'Полный трек';
export default function App() {
  // Navigation and discovery preferences. Persistent audio is kept outside page components.
  const [view, setView] = useState('home');
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<api.CatalogSource>('audius');
  const [discover, setDiscover] = useState<api.Discovery[]>(() => readStore('discovery', []));
  const [artistShelves, setArtistShelves] = useState<api.Discovery[]>(() =>
    readStore('artists', []),
  );
  const [visualMode, setVisualMode] = useState<VisualMode>('waves');
  const [showVisual, setShowVisual] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  useMotion(view);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');
  const [bulkTracks, setBulkTracks] = useState<Track[] | null>(null);
  const [energy, setEnergy] = useState(() => readStore('energy', false));
  const [detail, setDetail] = useState<{
    title: string;
    subtitle: string;
    tracks: Track[];
    loading: boolean;
  } | null>(null);
  const [openMusic, setOpenMusic] = useState<api.Discovery[]>(() => readStore('open-music', []));
  const pwa = usePwaUpdates();
  const detailSeq = useRef(0);
  useEffect(() => {
    document.documentElement.dataset.energy = String(energy);
    writeStore('energy', energy);
    window.dispatchEvent(new Event('wave-energy-change'));
  }, [energy]);
  useEffect(() => {
    const c = new AbortController();
    api
      .openverseDiscovery(c.signal)
      .then((t) => {
        if (t.length) {
          setOpenMusic(t);
          writeStore('open-music', t);
        }
      })
      .catch(() => {});
    return () => c.abort();
  }, []);
  function openSettings(tab = 'general') {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }
  async function openEntity(t: Track, kind: 'artist' | 'album') {
    const id = ++detailSeq.current;
    setDetail({
      title: kind === 'album' ? t.album || 'Альбом' : t.artist,
      subtitle: kind === 'album' ? 'Альбом · ' + t.artist : 'Исполнитель',
      tracks: [],
      loading: true,
    });
    setView('entity');
    window.scrollTo({ top: 0 });
    try {
      const tracks = await (kind === 'album' ? api.fetchAlbum(t) : api.fetchArtist(t));
      if (id === detailSeq.current) setDetail((d) => (d ? { ...d, tracks, loading: false } : d));
    } catch {
      if (id === detailSeq.current) {
        setDetail((d) => (d ? { ...d, loading: false } : d));
        notify('Источник не ответил. Попробуй открыть исполнителя позже.');
      }
    }
  }
  async function removeMany(tracks: Track[]) {
    const ids = new Set(tracks.map((t) => t.id));
    await deleteFiles([...ids]);
    if (latest.current.current && ids.has(latest.current.current.id)) {
      pausePlayback();
      seq.current++;
      preparedLocalFile.current = null;
      latest.current = {
        ...latest.current,
        current: null,
        queue: latest.current.queue.filter((t: Track) => !ids.has(t.id)),
        time: 0,
        duration: 0,
      };
      setCurrent(null);
      setTime(0);
      setDuration(0);
      if (blobUrl.current) {
        URL.revokeObjectURL(blobUrl.current);
        blobUrl.current = '';
      }
    }
    setLocal((s) => s.filter((t) => !ids.has(t.id)));
    setLikes((s) => s.filter((t) => !ids.has(t.id)));
    setLists((s) => s.map((l) => ({ ...l, tracks: l.tracks.filter((t) => !ids.has(t.id)) })));
    setQueue((s) => s.filter((t) => !ids.has(t.id)));
    setHistory((s) => s.filter((t) => !ids.has(t.id)));
    notify('Удалено файлов: ' + tracks.length);
  }
  function removeFromCollection(tracks: Track[]) {
    const ids = new Set(tracks.map((t) => t.id));
    if (view === 'files') return removeMany(tracks);
    if (selectedList)
      setLists((s) =>
        s.map((l) =>
          l.id === selectedList.id ? { ...l, tracks: l.tracks.filter((t) => !ids.has(t.id)) } : l,
        ),
      );
    else if (view === 'liked') setLikes((s) => s.filter((t) => !ids.has(t.id)));
    else if (view === 'history') setHistory((s) => s.filter((t) => !ids.has(t.id)));
  }
  function renderCollection(
    tracks: Track[],
    title: string,
    subtitle: string,
    kind: 'files' | 'playlist' | 'liked' | 'history' | 'catalog' = 'catalog',
    list?: Playlist,
    loading = false,
  ) {
    return (
      <CollectionManager
        key={view}
        title={title}
        subtitle={subtitle}
        tracks={tracks}
        kind={kind}
        loading={loading}
        current={current}
        playing={playing}
        liked={likes}
        onPlay={(t, q) => void playTrack(t, q)}
        onLike={like}
        onAdd={setBulkTracks}
        onBulkLike={(ts) => {
          setLikes((s) => api.unique([...s, ...ts.map(cleanTrack)]));
          notify('Добавлено в избранное: ' + ts.length);
        }}
        onRemove={kind === 'catalog' ? undefined : removeFromCollection}
        onRename={
          list
            ? (name) => setLists((s) => s.map((l) => (l.id === list.id ? { ...l, name } : l)))
            : undefined
        }
        onReorder={
          list
            ? (tracks) => setLists((s) => s.map((l) => (l.id === list.id ? { ...l, tracks } : l)))
            : undefined
        }
        onDelete={
          list
            ? () => {
                setLists((s) => s.filter((l) => l.id !== list.id));
                setView('library');
                notify('Плейлист удалён');
              }
            : undefined
        }
        onImport={kind === 'files' ? () => input.current?.click() : undefined}
        onStorage={kind === 'files' ? () => openSettings('storage') : undefined}
        onFind={() => setView('search')}
        onArtist={(t) => void openEntity(t, 'artist')}
        onAlbum={(t) => void openEntity(t, 'album')}
      />
    );
  }

  const [trends, setTrends] = useState<Track[]>(() => readStore('trending', []));
  const [picks, setPicks] = useState<Track[]>(() => readStore('picks', []));
  const [results, setResults] = useState<Track[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [likes, setLikes] = useState<Track[]>(() => readStore('likes', []));
  const [lists, setLists] = useState<Playlist[]>(() => readStore('playlists', []));
  const [local, setLocal] = useState<Track[]>(() => readStore('local', []));
  const [history, setHistory] = useState<Track[]>(() => readStore('history', []));
  // Restore and control the single audio element; async loads are guarded by seq.
  const [savedSession] = useState(readPlaybackSession);
  const [sessionReady, setSessionReady] = useState(savedSession.current?.source !== 'local');
  const [current, setCurrent] = useState<Track | null>(
    savedSession.current?.source === 'local' ? null : savedSession.current,
  );
  const [queue, setQueue] = useState<Track[]>(savedSession.queue);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(savedSession.position);
  const [duration, setDuration] = useState(savedSession.duration);
  const [shuffle, setShuffle] = useState(savedSession.shuffle);
  const [repeat, setRepeat] = useState(savedSession.repeat);
  const [volume, setVolume] = useState(savedSession.volume);
  const [expanded, setExpanded] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [dialog, setDialog] = useState<'help' | 'playlist' | 'add' | null>(null);
  const [listName, setListName] = useState('');
  const [target, setTarget] = useState<Track | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [importing, setImporting] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const blobUrl = useRef('');
  const latest = useRef<any>(null);
  const searchSeq = useRef(0);
  const pendingSeek = useRef<{ trackId: string; seq: number; position: number } | null>(null);
  const loadedTrackId = useRef('');
  const playIntent = useRef(false);
  const preparedLocalFile = useRef<{ id: string; file: Blob } | null>(null);
  const searchOffset = useRef(0);
  const stableSince = useRef(0);
  const importLock = useRef(false);
  const moreLock = useRef(false);
  const recovery = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    attempts: number;
    waiting: boolean;
    trackId: string;
  }>({ timer: null, attempts: 0, waiting: false, trackId: '' });
  const saveWarning = useRef(false);
  latest.current = {
    current,
    queue,
    shuffle,
    repeat,
    time,
    duration,
    volume,
    playing,
    loading,
    sessionReady,
  };
  function notify(text: string) {
    setToast(text);
  }
  function stopRecovery() {
    if (recovery.current.timer) clearTimeout(recovery.current.timer);
    recovery.current.timer = null;
    recovery.current.waiting = false;
  }
  // Save on meaningful events and periodic checkpoints, not every animation frame.
  function persistPlayer() {
    const s = latest.current;
    if (!s?.sessionReady) return;
    let position = s.time;
    if (s.current && loadedTrackId.current === s.current.id && audio.current?.src)
      position =
        pendingSeek.current?.position ??
        (audio.current.error && audio.current.currentTime === 0
          ? s.time
          : audio.current.currentTime);
    const ok = savePlaybackSession({
      version: 1,
      current: s.current,
      queue: s.queue,
      position,
      duration: s.duration,
      shuffle: s.shuffle,
      repeat: s.repeat,
      volume: s.volume,
    });
    if (!ok && !saveWarning.current) {
      saveWarning.current = true;
      notify('Не удалось сохранить позицию плеера. Проверь свободное место.');
    }
    if (ok) saveWarning.current = false;
  }
  function applyPendingPosition() {
    const a = audio.current;
    const p = pendingSeek.current;
    if (
      !a ||
      a.readyState < 1 ||
      !p ||
      p.seq !== seq.current ||
      p.trackId !== loadedTrackId.current ||
      !Number.isFinite(a.duration) ||
      a.duration <= 0
    )
      return;
    const position = positionWithinDuration(p.position, a.duration);
    try {
      a.currentTime = position;
      setTime(position);
      pendingSeek.current = null;
    } catch {}
  }
  function recoverPlayback() {
    const r = recovery.current;
    const s = latest.current;
    if (
      !r.waiting ||
      !playIntent.current ||
      !navigator.onLine ||
      !s.current ||
      s.current.source === 'local' ||
      r.trackId !== s.current.id ||
      r.attempts >= 3
    )
      return;
    if (r.timer) clearTimeout(r.timer);
    r.timer = null;
    r.waiting = false;
    r.attempts++;
    const position =
      pendingSeek.current?.position ??
      ((audio.current?.currentTime || 0) > 0 ? audio.current!.currentTime : s.time);
    void playTrack(s.current, undefined, { position, recovery: true });
  }
  function scheduleRecovery() {
    const s = latest.current;
    const r = recovery.current;
    if (!playIntent.current || !s.current || s.current.source === 'local' || r.attempts >= 3)
      return;
    r.waiting = true;
    r.trackId = s.current.id;
    if (r.timer) clearTimeout(r.timer);
    r.timer = null;
    if (navigator.onLine) r.timer = setTimeout(recoverPlayback, [800, 1800, 4000][r.attempts]);
  }
  useEffect(() => {
    let cancelled = false;
    const restored = savedSession.current;
    if (restored?.source !== 'local') return;
    const started = seq.current;
    getFile(restored.id)
      .then((file) => {
        if (cancelled) return;
        if (seq.current === started) {
          if (file) {
            preparedLocalFile.current = { id: restored.id, file };
            setCurrent(restored);
            setTime(savedSession.position);
            setDuration(savedSession.duration);
          } else {
            setQueue((q) => q.filter((t) => t.id !== restored.id));
            setTime(0);
            setDuration(0);
            notify('Прошлый аудиофайл больше не хранится на устройстве. Добавь его снова.');
          }
        }
        setSessionReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        if (seq.current === started) {
          setQueue((q) => q.filter((t) => t.id !== restored.id));
          setTime(0);
          setDuration(0);
          notify('Не удалось восстановить локальный файл. Его можно добавить заново.');
        }
        setSessionReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [savedSession]);
  useEffect(() => {
    persistPlayer();
  }, [current, queue, shuffle, repeat, volume, playing, sessionReady]);
  useEffect(() => {
    const flush = () => persistPlayer();
    const visibility = () => {
      if (document.hidden) flush();
    };
    const timer = setInterval(() => {
      if (latest.current?.playing) flush();
    }, 5000);
    window.addEventListener('pagehide', flush);
    window.addEventListener('wave-before-update', flush);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      flush();
      clearInterval(timer);
      stopRecovery();
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('wave-before-update', flush);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    for (const [key, value] of [
      ['likes', likes],
      ['playlists', lists],
      ['local', local],
      ['history', history],
    ] as const)
      if (!writeStore(key, value))
        notify('Не удалось сохранить библиотеку. Проверь свободное место.');
  }, [likes, lists, local, history]);
  useEffect(() => {
    const on = () => {
      setOnline(navigator.onLine);
      const s = latest.current;
      if (!navigator.onLine && playIntent.current && s.current && s.current.source !== 'local') {
        stopRecovery();
        recovery.current.waiting = true;
        recovery.current.trackId = s.current.id;
      }
      if (navigator.onLine && recovery.current.waiting) {
        if (audio.current?.error || audio.current?.paused || (audio.current?.readyState || 0) < 3)
          recoverPlayback();
        else stopRecovery();
      }
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);
  useEffect(() => {
    const c = new AbortController();
    api
      .trending(c.signal)
      .then((t) => {
        setTrends(t);
        writeStore('trending', t);
      })
      .catch(() => {});
    api
      .artistTracks(c.signal)
      .then((t) => {
        if (t.length) {
          setArtistShelves(t);
          writeStore('artists', t);
        }
      })
      .catch(() => {});
    api
      .discovery(c.signal)
      .then((t) => {
        if (t.length) {
          setDiscover(t);
          writeStore('discovery', t);
        }
      })
      .catch(() => {});
    api
      .search('Miyagi', 'itunes', c.signal)
      .then((t) => {
        const selected = t.filter((x) => /miyagi/i.test(x.artist));
        setPicks(selected);
        writeStore('picks', selected);
      })
      .catch(() => {});
    return () => c.abort();
  }, []);
  useEffect(() => {
    const id = ++searchSeq.current;
    searchOffset.current = 0;
    moreLock.current = false;
    setHasMore(false);
    setMoreBusy(false);
    if (view !== 'search' || !query.trim()) {
      setResults([]);
      setBusy(false);
      return;
    }
    const c = new AbortController();
    setBusy(true);
    setError('');
    setResults([]);
    const timer = setTimeout(
      () =>
        api
          .search(query, provider, c.signal)
          .then((t) => {
            if (id === searchSeq.current) {
              setResults(t);
              setHasMore(provider !== 'itunes' && t.length > 0);
            }
          })
          .catch((e) => {
            if (!c.signal.aborted && id === searchSeq.current)
              setError(e.message || 'Не удалось выполнить поиск');
          })
          .finally(() => {
            if (id === searchSeq.current && !c.signal.aborted) setBusy(false);
          }),
      400,
    );
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [view, query, provider]);
  async function loadMore() {
    if (moreLock.current) return;
    moreLock.current = true;
    const id = searchSeq.current;
    const nextOffset = searchOffset.current + api.SEARCH_PAGE_SIZE[provider];
    setMoreBusy(true);
    try {
      const t = await api.search(query, provider, undefined, nextOffset);
      if (id !== searchSeq.current) return;
      searchOffset.current = nextOffset;
      setResults((s) => api.unique([...s, ...t]));
      setHasMore(t.length > 0);
    } catch {
      if (id === searchSeq.current)
        notify('Не удалось загрузить следующие треки. Попробуй ещё раз.');
    } finally {
      if (id === searchSeq.current) {
        moreLock.current = false;
        setMoreBusy(false);
      }
    }
  }
  // Only the latest requested track may finish loading or start playback.
  async function playTrack(
    track: Track,
    tracks?: Track[],
    options: { position?: number; recovery?: boolean } = {},
  ) {
    const a = audio.current;
    if (!a) return;
    const id = ++seq.current;
    const startPosition = positionWithinDuration(options.position || 0, 0);
    stopRecovery();
    if (!options.recovery) recovery.current.attempts = 0;
    playIntent.current = true;
    pendingSeek.current = { trackId: track.id, seq: id, position: startPosition };
    loadedTrackId.current = '';
    latest.current = {
      ...latest.current,
      current: track,
      queue: tracks || latest.current.queue,
      time: startPosition,
      loading: true,
      playing: false,
    };
    if (tracks) setQueue(tracks);
    setCurrent(track);
    setLoading(true);
    setPlaying(false);
    setTime(startPosition);
    setDuration(
      options.position !== undefined && latest.current.current?.id === track.id
        ? latest.current.duration || track.duration
        : track.duration,
    );
    a.pause();
    a.removeAttribute('src');
    try {
      let url = track.url;
      if (track.source === 'local') {
        const file =
          preparedLocalFile.current?.id === track.id
            ? preparedLocalFile.current.file
            : await getFile(track.id);
        if (!file) throw new Error('Файл удалён из памяти браузера. Добавь его снова.');
        if (id !== seq.current) return;
        url = URL.createObjectURL(file);
      }
      if (id !== seq.current) return;
      preparedLocalFile.current = null;
      if (blobUrl.current) {
        URL.revokeObjectURL(blobUrl.current);
        blobUrl.current = '';
      }
      if (track.source === 'local') blobUrl.current = url;
      if (!url) throw new Error('У этого трека нет доступного аудио');
      loadedTrackId.current = track.id;
      a.src = url;
      a.load();
      applyPendingPosition();
      await a.play();
      if (id !== seq.current) return;
      setHistory((h) => [cleanTrack(track), ...h.filter((t) => t.id !== track.id)].slice(0, 30));
    } catch (e) {
      if (id === seq.current) {
        setLoading(false);
        setPlaying(false);
        if (a.error?.code === 2 && playIntent.current) {
          scheduleRecovery();
          if (!options.recovery)
            notify('Соединение прервалось. Попробуем восстановить воспроизведение.');
        } else {
          playIntent.current = false;
          notify(e instanceof Error ? e.message : 'Не удалось включить трек');
        }
      }
    }
  }
  function pausePlayback() {
    const a = audio.current;
    const s = latest.current;
    playIntent.current = false;
    stopRecovery();
    if (s?.loading) {
      const position =
        pendingSeek.current?.position ?? ((a?.currentTime || 0) > 0 ? a!.currentTime : s.time);
      seq.current++;
      pendingSeek.current = null;
      loadedTrackId.current = '';
      a?.removeAttribute('src');
      a?.load();
      setTime(position);
      setDuration(s.duration);
    }
    a?.pause();
    setLoading(false);
    persistPlayer();
  }
  function resumePlayback() {
    const a = audio.current;
    const s = latest.current;
    if (!a || !s.current) return;
    playIntent.current = true;
    stopRecovery();
    recovery.current.attempts = 0;
    if (!a.src || loadedTrackId.current !== s.current.id || a.error) {
      void playTrack(s.current, undefined, { position: s.time });
      return;
    }
    void a.play().catch(() => {
      playIntent.current = false;
      setLoading(false);
      setPlaying(false);
      notify('Нажми воспроизведение ещё раз или выбери другой трек');
    });
  }
  function togglePlayback() {
    const a = audio.current;
    if (!a) return;
    if (!current) {
      const t = trends[0] || picks[0];
      if (t) void playTrack(t, trends.length ? trends : picks);
      else notify('Найди песню или добавь аудиофайл');
      return;
    }
    if ((loading && playIntent.current) || !a.paused) pausePlayback();
    else resumePlayback();
  }
  function changeTrack(direction = 1, ended = false) {
    const s = latest.current;
    if (!s.current || !s.queue.length) {
      if (ended) playIntent.current = false;
      return;
    }
    if (ended && s.repeat) {
      audio.current!.currentTime = 0;
      void audio.current!.play().catch(() => {
        playIntent.current = false;
        notify('Нажми воспроизведение для продолжения');
      });
      return;
    }
    if (direction < 0 && audio.current!.currentTime > 3) {
      audio.current!.currentTime = 0;
      return;
    }
    const i = s.queue.findIndex((t: Track) => t.id === s.current.id);
    let n = i + direction;
    if (s.shuffle && s.queue.length > 1) {
      do {
        n = Math.floor(Math.random() * s.queue.length);
      } while (n === i);
    }
    if (n >= s.queue.length) {
      if (ended) {
        playIntent.current = false;
        setPlaying(false);
        persistPlayer();
        return;
      }
      n = 0;
    }
    if (n < 0) n = s.queue.length - 1;
    void playTrack(s.queue[n]);
  }
  useEffect(() => {
    const a = audio.current!;
    const onTime = () => {
      if (!a.src || a.readyState < 1) return;
      if (stableSince.current && Date.now() - stableSince.current > 15000 && !a.paused)
        recovery.current.attempts = 0;
      setTime(
        pendingSeek.current?.position ??
          (a.error && a.currentTime === 0 ? latest.current.time : a.currentTime),
      );
      if ('mediaSession' in navigator && Number.isFinite(a.duration) && a.duration > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: a.duration,
            playbackRate: 1,
            position: Math.min(a.currentTime, a.duration),
          });
        } catch {}
      }
    };
    const onDuration = () => {
      if (!a.src || a.readyState < 1) return;
      setDuration(Number.isFinite(a.duration) ? a.duration : 0);
      applyPendingPosition();
    };
    const onPlaying = () => {
      stopRecovery();
      stableSince.current = Date.now();
      setPlaying(true);
      setLoading(false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    };
    const onPause = () => {
      setPlaying(false);
      persistPlayer();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    };
    const onError = () => {
      if (!a.src || a.error?.code === 1) return;
      setLoading(false);
      setPlaying(false);
      if (
        a.error?.code === 2 &&
        playIntent.current &&
        latest.current?.current?.source !== 'local' &&
        recovery.current.attempts < 3
      ) {
        scheduleRecovery();
        notify(
          navigator.onLine
            ? 'Поток прервался. Восстанавливаем воспроизведение…'
            : 'Нет соединения. Продолжим, когда интернет появится.',
        );
        return;
      }
      stopRecovery();
      playIntent.current = false;
      if (a.error?.code === 4)
        notify('Источник не отдал аудио или формат не поддерживается. Попробуй другой трек.');
      else notify('Не удалось загрузить аудио. Проверь интернет и попробуй ещё раз.');
    };
    const ended = () => changeTrack(1, true);
    const waiting = () => {
      setLoading(true);
      const s = latest.current;
      const r = recovery.current;
      if (!playIntent.current || !s?.current || s.current.source === 'local') return;
      r.waiting = true;
      r.trackId = s.current.id;
      if (!r.timer && navigator.onLine)
        r.timer = setTimeout(() => {
          if (a.readyState < 3) recoverPlayback();
          else stopRecovery();
        }, 8000);
    };
    const canplay = () => {
      setLoading(false);
      applyPendingPosition();
      stopRecovery();
    };
    const listeners = {
      timeupdate: onTime,
      durationchange: onDuration,
      loadedmetadata: onDuration,
      playing: onPlaying,
      pause: onPause,
      error: onError,
      ended,
      waiting,
      stalled: waiting,
      canplay,
    };
    for (const [e, f] of Object.entries(listeners)) a.addEventListener(e, f);
    try {
      if ((navigator as any).audioSession) (navigator as any).audioSession.type = 'playback';
    } catch {}
    return () => {
      for (const [e, f] of Object.entries(listeners)) a.removeEventListener(e, f);
    };
  }, []);
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.source === 'itunes' ? 'Фрагмент · wave' : 'wave',
      artwork: current.artwork
        ? [{ src: current.artwork, sizes: '600x600', type: 'image/jpeg' }]
        : [],
    });
    const handlers: any = {
      play: resumePlayback,
      pause: pausePlayback,
      previoustrack: () => changeTrack(-1),
      nexttrack: () => changeTrack(1),
      seekto: (d: any) => {
        if (d.seekTime !== undefined) {
          const position = positionWithinDuration(d.seekTime, audio.current!.duration);
          setTime(position);
          if (!audio.current!.src) persistPlayer();
          else audio.current!.currentTime = position;
        }
      },
      seekbackward: (d: any) => {
        audio.current!.currentTime = Math.max(0, audio.current!.currentTime - (d.seekOffset || 10));
      },
      seekforward: (d: any) => {
        audio.current!.currentTime = Math.min(
          audio.current!.duration || 0,
          audio.current!.currentTime + (d.seekOffset || 10),
        );
      },
    };
    for (const [action, handler] of Object.entries(handlers))
      try {
        navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler as any);
      } catch {}
  }, [current]);
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,button,[role="dialog"]')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      }
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  });
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpanded(false);
        setDialog(null);
        setQueueOpen(false);
      }
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, []);
  function like(t: Track) {
    setLikes((s) =>
      s.some((x) => x.id === t.id) ? s.filter((x) => x.id !== t.id) : [cleanTrack(t), ...s],
    );
  }
  function searchMusic(text: string) {
    setQuery(text);
    setView('search');
    setTimeout(() => searchInput.current?.focus(), 40);
  }
  // Local audio is stored in IndexedDB; collection metadata stays in localStorage.
  async function importFiles(files: FileList | null) {
    if (!files || importLock.current) return;
    importLock.current = true;
    setImporting(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name))
        continue;
      const id = 'local:' + crypto.randomUUID();
      try {
        await putFile(id, file);
        const title = file.name.replace(/\.[^.]+$/, '');
        const split = title.split(' - ');
        const t: Track = {
          id,
          title: split.length > 1 ? split.slice(1).join(' - ') : title,
          artist: split.length > 1 ? split[0] : 'Мой аудиофайл',
          artwork: '',
          duration: 0,
          source: 'local',
          url: '',
          available: true,
          sizeBytes: file.size,
          fileName: file.name,
        };
        setLocal((s) => [t, ...s]);
        ok++;
      } catch {
        notify('Не удалось сохранить файл: проверь свободное место и доступ к хранилищу');
      }
    }
    if (ok) {
      notify(`Добавлено: ${ok}. Файлы доступны на этом устройстве без интернета.`);
      setView('files');
    } else notify('Не добавлено ни одного аудиофайла');
    importLock.current = false;
    setImporting(false);
    if (input.current) input.current.value = '';
  }

  useEffect(() => {
    if (!dialog && !expanded) return;
    const previous = document.activeElement as HTMLElement;
    const panels = document.querySelectorAll<HTMLElement>('[role="dialog"]');
    const panel = panels[panels.length - 1];
    if (!panel) return;
    const selector = 'button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]';
    if (!panel.contains(document.activeElement))
      panel.querySelector<HTMLElement>(selector)?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(selector));
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [dialog, expanded]);
  const isLiked = (t: Track) => likes.some((x) => x.id === t.id);
  const selectedList = lists.find((l) => 'playlist:' + l.id === view);
  const selectedDiscovery = [...discover, ...artistShelves, ...openMusic].find(
    (d) => 'discovery:' + d.id === view,
  );
  const visible =
    view === 'liked'
      ? likes
      : view === 'files'
        ? local
        : view === 'history'
          ? history
          : selectedDiscovery?.tracks || selectedList?.tracks || [];
  const viewTitle =
    view === 'liked'
      ? 'Любимые треки'
      : view === 'files'
        ? 'Мои файлы'
        : view === 'history'
          ? 'Недавно слушал'
          : selectedDiscovery?.title || selectedList?.name || 'Моя библиотека';
  // Audio remains mounted while the active screen changes.
  return (
    <div className={'app-shell ' + (playing ? 'is-playing' : '')} data-theme="purple">
      <Atmosphere />
      <audio ref={audio} preload="metadata" playsInline />
      <input
        aria-label="Audio files"
        ref={input}
        className="visually-hidden"
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.wav,.flac"
        multiple
        onChange={(e) => importFiles(e.target.files)}
      />
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView('home');
          }}
        >
          <span>
            <LogoMark />
          </span>
          wave<span className="brand-dot">.</span>
        </a>
        <div className="sidebar-label">ТВОЙ МУЗЫКАЛЬНЫЙ МИР</div>
        <nav>
          {[
            [Home, 'Главная', 'home'],
            [Search, 'Поиск', 'search'],
            [Library, 'Моя библиотека', 'library'],
          ].map(([Icon, label, id]: any) => (
            <button
              key={id}
              className={view === id ? 'selected' : ''}
              onClick={() => {
                setView(id);
                if (id === 'search') setTimeout(() => searchInput.current?.focus(), 50);
              }}
            >
              <Icon size={21} />
              {label}
            </button>
          ))}
        </nav>
        <div className="library-label">
          <span>Твоя коллекция</span>
          <button
            aria-label="Создать плейлист"
            onClick={() => {
              setTarget(null);
              setDialog('playlist');
            }}
          >
            <Plus size={19} />
          </button>
        </div>
        <button
          className={'collection ' + (view === 'liked' ? 'selected' : '')}
          onClick={() => setView('liked')}
        >
          <span className="liked-tile">
            <Heart size={19} fill="white" />
          </span>
          <span>
            Любимые треки<small>{trackCount(likes.length)}</small>
          </span>
        </button>
        <button
          className={'collection ' + (view === 'files' ? 'selected' : '')}
          onClick={() => setView('files')}
        >
          <span className="files-tile">
            <Music2 size={20} />
          </span>
          <span>
            Мои файлы<small>Музыка на устройстве</small>
          </span>
        </button>
        {lists.map((l) => (
          <button
            className={'collection ' + (selectedList?.id === l.id ? 'selected' : '')}
            key={l.id}
            onClick={() => setView('playlist:' + l.id)}
          >
            <span className="playlist-tile">
              <ListMusic size={20} />
            </span>
            <span>
              {l.name}
              <small>{trackCount(l.tracks.length)}</small>
            </span>
          </button>
        ))}
        <div className="sidebar-bottom">
          <button className="settings-link" onClick={() => openSettings()}>
            <Settings2 size={19} />
            Настройки
          </button>
          <div className="little-wave">
            <AudioLines />
            <span>
              Только ты и музыка.<small>Без аккаунта. В твоём ритме.</small>
            </span>
          </div>
          <button className="install-link" onClick={() => setDialog('help')}>
            <Download size={17} />
            Приложение на iPhone
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <Headphones size={19} />
            <span>Твоя музыка. Твои правила.</span>
          </div>
          <div className="header-search">
            <Search size={20} />
            <input
              ref={searchInput}
              aria-label="Поиск музыки"
              placeholder="Что хочешь послушать?"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setView('search');
              }}
              onFocus={() => {
                if (query) setView('search');
              }}
            />
            {query && (
              <button aria-label="Очистить поиск" onClick={() => setQuery('')}>
                <X size={17} />
              </button>
            )}
          </div>
          <button className="avatar" aria-label="Настройки wave" onClick={() => openSettings()}>
            <LogoMark />
          </button>
        </header>
        <main>
          {!online && (
            <div className="offline">
              <WifiOff size={16} />
              Ты без интернета. Сохранённые аудиофайлы доступны в «Мои файлы».
            </div>
          )}
          {view === 'home' ? (
            <HomePage
              trends={trends}
              picks={picks}
              artistShelves={artistShelves}
              discover={discover}
              openMusic={openMusic}
              onNavigate={setView}
              onSearch={searchMusic}
              onSourceChange={setProvider}
              onImport={() => input.current?.click()}
              onHelp={() => setDialog('help')}
              onPlay={playTrack}
              onOpenEntity={openEntity}
            />
          ) : view === 'search' ? (
            <>
              <div className="page-intro">
                <div>
                  <span className="eyebrow">НАЙДИ СВОЙ ЗВУК</span>
                  <h1>{query ? 'Результаты поиска' : 'Что включим?'}</h1>
                </div>
              </div>
              <div className="source-tabs">
                <button
                  className={provider === 'audius' ? 'chosen' : ''}
                  onClick={() => setProvider('audius')}
                >
                  <AudioLines size={17} />
                  Полные треки · Audius
                </button>
                <button
                  className={provider === 'openverse' ? 'chosen' : ''}
                  onClick={() => setProvider('openverse')}
                >
                  <Globe size={17} />
                  Полные треки · Openverse
                </button>
                <button
                  className={provider === 'itunes' ? 'chosen' : ''}
                  onClick={() => setProvider('itunes')}
                >
                  <Globe size={17} />
                  Каталог · фрагменты
                </button>
              </div>
              <p className="source-description">
                {provider === 'audius'
                  ? 'Полные доступные записи Audius. В каталоге есть пользовательские загрузки.'
                  : provider === 'openverse'
                    ? 'Полные записи с открытыми лицензиями. У каждой песни указан исполнитель и источник.'
                    : 'Мировой каталог iTunes. Доступны ознакомительные фрагменты.'}
              </p>
              {!query ? (
                <div className="browse-grid">
                  {[
                    ['Драгни', '@DRAGNI86'],
                    ['batrip23', 'ТВОЙ ВЫБОР'],
                    ['Miyagi', 'ТВОЙ ВЫБОР'],
                    ['Hip-Hop', 'БОЛЬШЕ РИТМА'],
                    ['Electronic', 'ЭЛЕКТРОНИКА'],
                    ['Chill', 'ВЫДОХНИ'],
                    ['Jazz', 'БЕЗ СПЕШКИ'],
                    ['Rock', 'ПОГРОМЧЕ'],
                  ].map(([s, sub], i) => (
                    <button
                      key={s}
                      className={'browse-card mood-' + i}
                      onClick={() => searchMusic(s)}
                    >
                      <small>{sub}</small>
                      <strong>{s}</strong>
                      <AudioLines />
                    </button>
                  ))}
                </div>
              ) : busy ? (
                <div className="empty">
                  <span className="spinner" />
                  <h2>Ищем «{query}»</h2>
                </div>
              ) : error ? (
                <div className="empty">
                  <WifiOff />
                  <h2>Источник не ответил</h2>
                  <p>{error}. Попробуй другой каталог или повтори поиск.</p>
                  <button className="secondary" onClick={() => setQuery((q) => q + ' ')}>
                    Повторить
                  </button>
                </div>
              ) : results.length ? (
                <>
                  <div className="result-count">Найдено треков: {results.length}</div>
                  {renderCollection(
                    results,
                    'Найденные треки',
                    provider === 'itunes' ? 'Ознакомительные фрагменты' : 'Полные доступные записи',
                  )}
                  {hasMore && (
                    <button className="secondary load-more" disabled={moreBusy} onClick={loadMore}>
                      {moreBusy ? 'Загружаем…' : 'Загрузить ещё треки'}
                    </button>
                  )}
                </>
              ) : (
                <div className="empty">
                  <Search />
                  <h2>Ничего не найдено</h2>
                  <p>Попробуй имя исполнителя без названия песни или другой каталог.</p>
                  <div className="search-suggestions">
                    {api.suggestQuery(query).map((q) => (
                      <button className="secondary" key={q} onClick={() => searchMusic(q)}>
                        Возможно, {q}?
                      </button>
                    ))}
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      setProvider(provider === 'audius' ? 'itunes' : 'audius');
                    }}
                  >
                    Искать в другом каталоге
                  </button>
                </div>
              )}
            </>
          ) : view === 'trending' ? (
            renderCollection(trends, 'На волне сейчас', 'Популярное в Audius')
          ) : view === 'entity' && detail ? (
            renderCollection(
              detail.tracks,
              detail.title,
              detail.subtitle,
              'catalog',
              undefined,
              detail.loading,
            )
          ) : view === 'library' ? (
            <LibraryHub
              likes={likes}
              files={local}
              history={history}
              playlists={lists}
              current={current}
              importing={importing}
              onOpen={setView}
              onSearch={() => setView('search')}
              onCreate={() => {
                setTarget(null);
                setDialog('playlist');
              }}
              onImport={() => input.current?.click()}
              onDrop={(files) => {
                void importFiles(files);
              }}
              onPlay={(t, q) => {
                void playTrack(t, q);
              }}
            />
          ) : (
            renderCollection(
              visible,
              viewTitle,
              selectedDiscovery
                ? selectedDiscovery.genre === 'artist'
                  ? 'Фрагменты iTunes'
                  : 'Полные доступные записи'
                : 'На этом устройстве',
              view === 'files'
                ? 'files'
                : view === 'liked'
                  ? 'liked'
                  : view === 'history'
                    ? 'history'
                    : selectedList
                      ? 'playlist'
                      : 'catalog',
              selectedList,
            )
          )}
        </main>
      </div>
      {queueOpen && (
        <aside className="queue-panel">
          <div className="section-title">
            <h2>Очередь</h2>
            <button aria-label="Закрыть очередь" onClick={() => setQueueOpen(false)}>
              <X />
            </button>
          </div>
          {queue.length ? (
            queue.map((t) => (
              <button
                key={t.id}
                className={'queue-track ' + (current?.id === t.id ? 'active' : '')}
                onClick={() => playTrack(t)}
              >
                <Cover track={t} />
                <span>
                  <strong>{t.title}</strong>
                  <small>{t.artist}</small>
                </span>
                {current?.id === t.id && <AudioLines size={17} />}
              </button>
            ))
          ) : (
            <p>Включи песню, чтобы начать очередь.</p>
          )}
        </aside>
      )}
      <div className="player">
        <Equalizer playing={playing} />
        <button
          className="now-playing"
          onClick={() => (current ? setExpanded(true) : setView('search'))}
        >
          <Cover track={current || undefined} />
          <span>
            <strong>{current?.title || 'Поймай свою волну'}</strong>
            <small>{current ? current.artist : 'Найди песню и нажми play'}</small>
          </span>
        </button>
        {current && (
          <button
            className={'player-like ' + (isLiked(current) ? 'liked' : '')}
            aria-label="Избранное"
            onClick={() => like(current)}
          >
            <Heart size={20} fill={isLiked(current) ? 'currentColor' : 'none'} />
          </button>
        )}
        <div className="player-center">
          <div className="playback-controls">
            <button
              className={shuffle ? 'enabled' : ''}
              aria-label="Случайный порядок"
              aria-pressed={shuffle}
              onClick={() => setShuffle((s) => !s)}
            >
              <Shuffle size={18} />
            </button>
            <button
              aria-label="Предыдущий трек"
              onClick={() => changeTrack(-1)}
              disabled={!current}
            >
              <SkipBack size={20} fill="currentColor" />
            </button>
            <button
              className={'main-play ' + (loading ? 'loading' : '')}
              aria-label={playing ? 'Пауза' : 'Воспроизвести'}
              onClick={togglePlayback}
            >
              {loading ? (
                <span className="spinner" />
              ) : playing ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" />
              )}
            </button>
            <button aria-label="Следующий трек" onClick={() => changeTrack(1)} disabled={!current}>
              <SkipForward size={20} fill="currentColor" />
            </button>
            <button
              className={repeat ? 'enabled' : ''}
              aria-label="Повтор трека"
              aria-pressed={repeat}
              onClick={() => setRepeat((s) => !s)}
            >
              <Repeat size={18} />
            </button>
          </div>
          <div className="progress">
            <span>{fmt(time)}</span>
            <input
              aria-label="Позиция воспроизведения"
              type="range"
              min="0"
              max={duration || 1}
              step="0.1"
              value={Math.min(time, duration || 1)}
              disabled={!current || !duration}
              style={{ '--progress': `${duration ? (time / duration) * 100 : 0}%` } as any}
              onChange={(e) => {
                if (audio.current) audio.current.currentTime = +e.target.value;
                setTime(+e.target.value);
              }}
            />
            <span>{fmt(duration)}</span>
          </div>
        </div>
        <div className="player-right">
          {current && <span className={'source ' + current.source}>{sourceLabel(current)}</span>}
          <button
            aria-label="Открыть очередь"
            className={queueOpen ? 'enabled' : ''}
            onClick={() => setQueueOpen((s) => !s)}
          >
            <ListMusic size={20} />
          </button>
          <button
            aria-label={volume ? 'Выключить звук' : 'Включить звук'}
            onClick={() => setVolume((v) => (v ? 0 : 0.8))}
          >
            {volume ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
          <input
            aria-label="Громкость"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(+e.target.value)}
          />
          <button aria-label="Развернуть плеер" onClick={() => current && setExpanded(true)}>
            <Maximize2 size={18} />
          </button>
        </div>
      </div>
      <nav className="mobile-nav">
        {[
          [Home, 'Главная', 'home'],
          [Search, 'Поиск', 'search'],
          [Library, 'Библиотека', 'library'],
        ].map(([Icon, label, id]: any) => (
          <button
            key={id}
            className={
              view === id ||
              (id === 'library' && ['liked', 'files', 'history'].includes(view)) ||
              (id === 'library' && view.startsWith('playlist:'))
                ? 'selected'
                : ''
            }
            onClick={() => setView(id)}
          >
            <Icon size={23} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {expanded && current && (
        <div className="full-player" role="dialog" aria-modal="true" aria-label="Сейчас играет">
          <header>
            <button aria-label="Свернуть плеер" onClick={() => setExpanded(false)}>
              <ChevronDown />
            </button>
            <span>СЕЙЧАС ИГРАЕТ · {sourceLabel(current).toUpperCase()}</span>
            <button
              aria-label="Добавить в плейлист"
              onClick={() => {
                setTarget(current);
                setDialog('add');
              }}
            >
              <Plus />
            </button>
          </header>
          <div className={'player-stage ' + (showVisual ? 'show-vj' : 'show-art')}>
            <Visualizer active={playing} mode={visualMode} />
            <Cover track={current} className="big-cover" />
            <div className="stage-caption">
              <Equalizer playing={playing} />
              <span>
                {showVisual
                  ? 'VJ / ' +
                    (visualMode === 'waves'
                      ? 'WAVES'
                      : visualMode === 'orbit'
                        ? 'ORBIT'
                        : 'SPECTRUM')
                  : 'wave / ON REPEAT'}
              </span>
            </div>
          </div>
          <div className="visual-tabs" aria-label="Вид плеера">
            <button
              aria-pressed={!showVisual}
              className={!showVisual ? 'chosen' : ''}
              onClick={() => setShowVisual(false)}
            >
              Обложка
            </button>
            {(
              [
                ['waves', 'Волны'],
                ['orbit', 'Орбита'],
                ['spectrum', 'Спектр'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                aria-pressed={showVisual && visualMode === mode}
                className={showVisual && visualMode === mode ? 'chosen' : ''}
                onClick={() => {
                  setShowVisual(true);
                  setVisualMode(mode);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="full-title">
            <div>
              <h2>{current.title}</h2>
              <p>{current.artist}</p>
            </div>
            <button
              className={isLiked(current) ? 'liked' : ''}
              aria-label="В избранное"
              onClick={() => like(current)}
            >
              <Heart size={27} fill={isLiked(current) ? 'currentColor' : 'none'} />
            </button>
          </div>
          <div className="full-progress">
            <input
              aria-label="Позиция в полном плеере"
              type="range"
              min="0"
              max={duration || 1}
              step="0.1"
              value={Math.min(time, duration || 1)}
              disabled={!duration}
              onChange={(e) => {
                audio.current!.currentTime = +e.target.value;
              }}
            />
            <div>
              <span>{fmt(time)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>
          <div className="full-controls">
            <button
              className={shuffle ? 'enabled' : ''}
              aria-label="Случайный порядок"
              onClick={() => setShuffle((s) => !s)}
            >
              <Shuffle />
            </button>
            <button aria-label="Предыдущая песня" onClick={() => changeTrack(-1)}>
              <SkipBack size={30} fill="currentColor" />
            </button>
            <button
              className="round-play"
              aria-label={playing ? 'Пауза' : 'Включить'}
              onClick={togglePlayback}
            >
              {playing ? (
                <Pause size={30} fill="currentColor" />
              ) : (
                <Play size={30} fill="currentColor" />
              )}
            </button>
            <button aria-label="Следующая песня" onClick={() => changeTrack(1)}>
              <SkipForward size={30} fill="currentColor" />
            </button>
            <button
              className={repeat ? 'enabled' : ''}
              aria-label="Повторять трек"
              onClick={() => setRepeat((s) => !s)}
            >
              <Repeat />
            </button>
          </div>
          <div className="full-footer">
            <span>
              <AudioLines size={18} />В твоём ритме
            </span>
            <button
              aria-label="Очередь воспроизведения"
              onClick={() => {
                setExpanded(false);
                setQueueOpen(true);
              }}
            >
              <ListMusic />
            </button>
            {current.link && (
              <a href={current.link} target="_blank" rel="noreferrer" aria-label="Открыть источник">
                <ExternalLink size={21} />
              </a>
            )}
          </div>
        </div>
      )}
      {dialog && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label={dialog === 'help' ? 'О приложении' : 'Плейлист'}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close-dialog" aria-label="Закрыть" onClick={() => setDialog(null)}>
              <X />
            </button>
            {dialog === 'help' ? (
              <>
                <span className="dialog-icon">
                  <AudioLines />
                </span>
                <h2>Твоя музыка. Твоя волна.</h2>
                <p>Без аккаунта внутри приложения и подписок.</p>
                <h3>На главный экран iPhone</h3>
                <ol>
                  <li>Открой HTTPS-ссылку приложения в Safari.</li>
                  <li>Нажми «Поделиться» → «На экран Домой».</li>
                  <li>Запусти wave и включи песню нажатием.</li>
                </ol>
                <h3>Что можно слушать</h3>
                <p>
                  <b>Audius</b> — доступные полные треки. Это открытый каталог загрузок; он не
                  содержит все мировые релизы, а имя загрузившего не подтверждает официальность
                  записи.
                </p>
                <p>
                  <b>iTunes</b> — поиск известных исполнителей и только ознакомительные фрагменты.
                </p>
                <p>
                  <b>Мои файлы</b> — полные аудиофайлы с твоего устройства, в том числе офлайн. Сайт
                  не скачивает треки из каталогов.
                </p>
                <h3>Музыка на фоне</h3>
                <p>
                  Плеер поддерживает Media Session и системное управление там, где их предоставляет
                  iOS. Блокировку экрана и переход к следующей песне нужно проверить на твоей версии
                  iOS; одинаковая с нативным приложением стабильность не гарантируется.
                </p>
                <p className="small-note">
                  Библиотека хранится в этом браузере. Очистка данных сайта удалит её. Для
                  офлайн-режима сначала открой приложение через HTTPS.
                </p>
              </>
            ) : dialog === 'playlist' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!listName.trim()) return;
                  const id = crypto.randomUUID();
                  setLists((s) => [
                    ...s,
                    { id, name: listName.trim(), tracks: target ? [cleanTrack(target)] : [] },
                  ]);
                  setListName('');
                  setTarget(null);
                  setDialog(null);
                  setView('playlist:' + id);
                  notify('Плейлист создан');
                }}
              >
                <span className="dialog-icon">
                  <ListMusic />
                </span>
                <h2>Новая волна</h2>
                <p>Собери песни под своё настроение.</p>
                <label htmlFor="playlist-name">Название плейлиста</label>
                <input
                  id="playlist-name"
                  autoFocus
                  maxLength={70}
                  placeholder="Например, Ночной город"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                />
                <button className="primary" type="submit" disabled={!listName.trim()}>
                  Создать плейлист
                </button>
              </form>
            ) : (
              <>
                <h2>Добавить в плейлист</h2>
                <p>{target?.title}</p>
                {lists.map((l) => (
                  <button
                    className="playlist-option"
                    key={l.id}
                    onClick={() => {
                      if (target)
                        setLists((s) =>
                          s.map((x) =>
                            x.id === l.id
                              ? {
                                  ...x,
                                  tracks: [
                                    ...x.tracks.filter((t) => t.id !== target.id),
                                    cleanTrack(target),
                                  ],
                                }
                              : x,
                          ),
                        );
                      setDialog(null);
                      notify('Трек добавлен в «' + l.name + '»');
                    }}
                  >
                    <ListMusic />
                    {l.name}
                    {l.tracks.some((t) => t.id === target?.id) && <Check size={18} />}
                  </button>
                ))}
                <button className="secondary" onClick={() => setDialog('playlist')}>
                  <Plus size={18} />
                  Создать плейлист
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {bulkTracks && (
        <BulkPlaylistDialog
          tracks={bulkTracks}
          playlists={lists}
          onChange={setLists}
          onClose={() => setBulkTracks(null)}
        />
      )}
      {settingsOpen && (
        <ProductSettings
          initialTab={settingsTab}
          snapshot={{ likes, playlists: lists, local, history }}
          energy={energy}
          onEnergy={setEnergy}
          onImport={(s) => {
            setLikes(s.likes);
            setLists(s.playlists);
            setLocal(s.local);
            setHistory(s.history);
          }}
          onRemove={removeMany}
          onClose={() => setSettingsOpen(false)}
          pwa={pwa}
          notify={notify}
        />
      )}
      {pwa.available && (
        <div className="update-banner" role="status">
          <span>Новая версия wave готова</span>
          <button onClick={pwa.apply}>Обновить</button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Закрыть уведомление" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
