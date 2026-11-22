import { Check, ListMusic, Plus } from 'lucide-react';
import { useState } from 'react';
import { Modal } from './Modal';
import { cleanTrack, type Playlist, type Track, trackCount } from './model';
export function BulkPlaylistDialog({
  tracks,
  playlists,
  onChange,
  onClose,
}: {
  tracks: Track[];
  playlists: Playlist[];
  onChange: (next: Playlist[]) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const add = (id: string) => {
    onChange(
      playlists.map((l) =>
        l.id === id
          ? {
              ...l,
              tracks: [
                ...l.tracks,
                ...tracks.filter((t) => !l.tracks.some((x) => x.id === t.id)).map(cleanTrack),
              ],
            }
          : l,
      ),
    );
    onClose();
  };
  return (
    <Modal title="Добавить в плейлист" onClose={onClose}>
      <p>{trackCount(tracks.length)} · выбери коллекцию</p>
      <div className="playlist-choices">
        {playlists.map((l) => (
          <button className="playlist-option" key={l.id} onClick={() => add(l.id)}>
            <ListMusic />
            {l.name}
            {tracks.every((t) => l.tracks.some((x) => x.id === t.id)) && <Check size={18} />}
          </button>
        ))}
      </div>
      <form
        className="new-playlist-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onChange([
            ...playlists,
            { id: crypto.randomUUID(), name: name.trim(), tracks: tracks.map(cleanTrack) },
          ]);
          onClose();
        }}
      >
        <label htmlFor="bulk-playlist-name">Или создай новый</label>
        <input
          id="bulk-playlist-name"
          placeholder="Название плейлиста"
          maxLength={70}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="primary" disabled={!name.trim()}>
          <Plus size={17} />
          Создать и добавить
        </button>
      </form>
    </Modal>
  );
}
