import {
  Battery,
  Check,
  Download,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  backupFilename,
  exportBackup,
  importBackup,
  inspectBackup,
  type BackupSummary,
  type LibrarySnapshot,
} from './backup';
import { Modal } from './Modal';
import { bytes, readStore, writeStore, type Track } from './model';
import { getStorageUsage, requestPersistentStorage, type StorageUsage } from './storage-manager';
type Props = {
  snapshot: LibrarySnapshot;
  energy: boolean;
  onEnergy: (enabled: boolean) => void;
  onImport: (snapshot: LibrarySnapshot) => void;
  onRemove: (tracks: Track[]) => Promise<void>;
  onClose: () => void;
  initialTab?: string;
  pwa: {
    available: boolean;
    checking: boolean;
    message: string;
    check: () => Promise<void>;
    apply: () => void;
  };
  notify: (text: string) => void;
};
const phoneTests = [
  'Песня играет 10 минут при заблокированном экране',
  'Следующая песня включается без разблокировки',
  'Пауза и переключение работают с экрана блокировки',
  'Кнопки наушников и Bluetooth работают',
  'После звонка можно продолжить с прежнего места',
  'После потери и возвращения сети музыка восстанавливается',
];
export function ProductSettings(p: Props) {
  const [tab, setTab] = useState(p.initialTab || 'general');
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [checked, setChecked] = useState<number[]>(readStore('iphone-checks', []));
  const fileInput = useRef<HTMLInputElement>(null);
  const backupFile = useRef<File | null>(null);
  const [error, setError] = useState('');
  async function refresh() {
    try {
      setUsage(await getStorageUsage(p.snapshot.local));
    } catch {
      setError('Не удалось прочитать хранилище браузера.');
    }
  }
  useEffect(() => {
    void refresh();
  }, [p.snapshot.local]);
  async function exportCopy() {
    setBusy(true);
    setError('');
    try {
      const blob = await exportBackup(p.snapshot);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFilename();
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      p.notify('Копия подготовлена. Сохрани ZIP в «Файлы» на iPhone.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать копию');
    } finally {
      setBusy(false);
    }
  }
  async function inspect(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError('');
    setSummary(null);
    backupFile.current = null;
    try {
      const s = await inspectBackup(file);
      backupFile.current = file;
      setSummary(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось прочитать копию');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  async function restore() {
    if (!backupFile.current) return;
    setBusy(true);
    setError('');
    try {
      const result = await importBackup(backupFile.current, p.snapshot);
      p.onImport(result.library);
      setSummary(null);
      backupFile.current = null;
      p.notify(
        `Коллекция восстановлена. Добавлено файлов: ${result.importedFiles}.${result.warnings.length ? ' ' + result.warnings.join(' ') : ''}`,
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось восстановить копию');
    } finally {
      setBusy(false);
    }
  }
  const totalSelected = (usage?.files || [])
    .filter((f) => selected.has(f.id))
    .reduce((n, f) => n + f.size, 0);
  return (
    <Modal wide title="Настройки wave" onClose={p.onClose}>
      <nav className="settings-tabs" aria-label="Разделы настроек">
        {[
          ['general', 'Приложение'],
          ['backup', 'Резервная копия'],
          ['storage', 'Память'],
          ['iphone', 'iPhone'],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            className={tab === id ? 'chosen' : ''}
            onClick={() => {
              setTab(id);
              setError('');
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
      {tab === 'general' ? (
        <>
          <div className="setting-row">
            <span className="setting-icon">
              <Battery />
            </span>
            <div>
              <h3>Экономия энергии</h3>
              <p>Статичный фон и визуализации, без фонового видео.</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                aria-label="Экономия энергии"
                checked={p.energy}
                onChange={(e) => p.onEnergy(e.target.checked)}
              />
              <span />
            </label>
          </div>
          <div className="setting-row">
            <span className="setting-icon">
              <RefreshCw />
            </span>
            <div>
              <h3>Обновления</h3>
              <p>
                {p.pwa.available
                  ? 'Новая версия готова к установке.'
                  : 'Обновления сохраняют коллекцию и файлы на этом устройстве.'}
              </p>
            </div>
          </div>
          <div className="setting-actions">
            <button
              className="secondary"
              disabled={p.pwa.checking}
              onClick={() => void p.pwa.check()}
            >
              {p.pwa.checking ? 'Проверяем…' : 'Проверить обновления'}
            </button>
            {p.pwa.available && (
              <button className="primary" onClick={p.pwa.apply}>
                Обновить приложение
              </button>
            )}
          </div>
          {p.pwa.message && (
            <p className="setting-note" role="status">
              {p.pwa.message}
            </p>
          )}
          <div className="setting-row">
            <span className="setting-icon">
              <ShieldCheck />
            </span>
            <div>
              <h3>Без аккаунта внутри wave</h3>
              <p>
                Коллекция хранится в этом браузере. Для переноса на другой телефон используй
                резервную копию.
              </p>
            </div>
          </div>
          <div className="catalog-legend">
            <h3>Что можно слушать</h3>
            <p>
              <b>Полностью</b> — доступные записи Audius и открытых каталогов. <b>Фрагмент</b> —
              ознакомительная запись iTunes. <b>Офлайн</b> — твои файлы на этом устройстве.
            </p>
            <p>
              Для записей с открытой лицензией исполнитель, источник и лицензия указаны рядом с
              песней.
            </p>
          </div>
        </>
      ) : tab === 'backup' ? (
        <>
          <div className="settings-intro">
            <Download />
            <div>
              <h3>Коллекция, которую можно забрать с собой</h3>
              <p>
                ZIP содержит плейлисты, избранное, историю и собственные аудиофайлы. Внешние песни в
                архив не скачиваются.
              </p>
            </div>
          </div>
          <div className="setting-actions">
            <button className="primary" disabled={busy} onClick={() => void exportCopy()}>
              <Download size={17} />
              {busy ? 'Подготавливаем…' : 'Скачать резервную копию'}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={17} />
              Выбрать копию
            </button>
          </div>
          <input
            aria-label="Backup ZIP file"
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => void inspect(e.target.files?.[0])}
          />
          <p className="setting-note">
            До 256 МБ на архив и до 128 МБ на аудиофайл. Сохрани копию отдельно от данных сайта.
          </p>
          {summary && (
            <div className="backup-summary">
              <h3>Готово к восстановлению</h3>
              <p>
                {summary.playlists} плейлистов · {summary.likes} избранных · {summary.files} файлов
                · {bytes(summary.totalBytes)}
              </p>
              <p>Копия объединится с текущей коллекцией. Существующие записи сохранятся.</p>
              <button className="primary" disabled={busy} onClick={() => void restore()}>
                {busy ? 'Восстанавливаем…' : 'Объединить с библиотекой'}
              </button>
            </div>
          )}
        </>
      ) : tab === 'storage' ? (
        <>
          <div className="storage-summary">
            <HardDrive />
            <div>
              <h3>{usage ? bytes(usage.audioBytes) : 'Читаем хранилище…'}</h3>
              <p>Собственные аудиофайлы · {usage?.audioFiles || 0} файлов</p>
            </div>
          </div>
          {usage && (
            <>
              <div className="storage-meter">
                <span
                  style={{
                    width: `${usage.quotaBytes ? Math.min(100, (usage.usageBytes / usage.quotaBytes) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="setting-note">
                Данные сайта: {bytes(usage.usageBytes)}
                {usage.quotaBytes ? ' · квота браузера: ' + bytes(usage.quotaBytes) : ''}. Это не
                свободное место всего телефона.
              </p>
              <div className="persistence-row">
                <ShieldCheck size={18} />
                <p>
                  {usage.persisted
                    ? 'Постоянное хранение разрешено браузером.'
                    : 'Хранилище может очищаться браузером. Сохраняй резервные копии.'}
                </p>
                {!usage.persisted && (
                  <button
                    className="secondary"
                    onClick={async () => {
                      const granted = await requestPersistentStorage();
                      p.notify(
                        granted
                          ? 'Браузер разрешил постоянное хранение.'
                          : 'Браузер не разрешил постоянное хранение. Резервные копии остаются важны.',
                      );
                      await refresh();
                    }}
                  >
                    Защитить данные
                  </button>
                )}
              </div>
            </>
          )}
          <div className="storage-files">
            {p.snapshot.local.length > 0 ? (
              <>
                <label className="storage-select-all">
                  <input
                    type="checkbox"
                    checked={selected.size === p.snapshot.local.length}
                    aria-label="Выбрать все офлайн-файлы"
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? new Set(p.snapshot.local.map((t) => t.id)) : new Set(),
                      )
                    }
                  />
                  Выбрать все
                </label>
                {p.snapshot.local.map((t) => {
                  const file = usage?.files.find((f) => f.id === t.id);
                  return (
                    <label className="storage-file" key={t.id}>
                      <input
                        type="checkbox"
                        aria-label={'Выбрать файл ' + t.title}
                        checked={selected.has(t.id)}
                        onChange={(e) =>
                          setSelected((s) => {
                            const next = new Set(s);
                            e.target.checked ? next.add(t.id) : next.delete(t.id);
                            return next;
                          })
                        }
                      />
                      <span>
                        <strong>{t.title}</strong>
                        <small>{file ? 'Доступен офлайн' : 'Файл не найден в хранилище'}</small>
                      </span>
                      <span>{bytes(file?.size || 0)}</span>
                    </label>
                  );
                })}
                <button
                  className="secondary danger"
                  disabled={!selected.size || busy}
                  onClick={() => setConfirm(true)}
                >
                  <Trash2 size={16} />
                  Освободить {bytes(totalSelected)}
                </button>
                {confirm && (
                  <div className="confirm-strip">
                    <p>Удалить выбранные файлы из приложения? Сделай копию, если они нужны.</p>
                    <button
                      className="secondary danger"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await p.onRemove(p.snapshot.local.filter((t) => selected.has(t.id)));
                          setSelected(new Set());
                          setConfirm(false);
                        } catch (e) {
                          setError(e instanceof Error ? e.message : 'Не удалось удалить файлы');
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Удалить файлы
                    </button>
                    <button className="secondary" onClick={() => setConfirm(false)}>
                      Отмена
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="setting-note">
                Пока нет своих аудиофайлов. Добавь музыку в разделе «Мои файлы».
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="settings-intro">
            <Smartphone />
            <div>
              <h3>Установить на iPhone</h3>
              <p>
                Открой ссылку в Safari → «Поделиться» → «На экран Домой». Первый запуск и загрузку
                файлов выполни с интернетом.
              </p>
            </div>
          </div>
          <h3>Проверка на твоём устройстве</h3>
          <p className="setting-note">
            Эти проверки требуют настоящего iPhone. Отмечай только после успешного теста.
            Автоматические тесты компьютера их не заменяют.
          </p>
          <div className="iphone-checks">
            {phoneTests.map((text, i) => (
              <label key={text}>
                <input
                  type="checkbox"
                  checked={checked.includes(i)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...checked, i]
                      : checked.filter((x) => x !== i);
                    setChecked(next);
                    writeStore('iphone-checks', next);
                  }}
                />
                <span>{text}</span>
                {checked.includes(i) && <Check size={17} />}
              </label>
            ))}
          </div>
          <p className="setting-note">
            При звонке или звуке другого приложения iOS может поставить музыку на паузу. После
            звонка нажми Play для продолжения.
          </p>
        </>
      )}
    </Modal>
  );
}
