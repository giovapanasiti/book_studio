import { useEffect, useState } from 'react';
import { api } from '../api';
import type { RecentProject } from '../types';
import { Modal } from './Modal';
import { useToast } from './Toast';

export function Welcome({ onOpened }: { onOpened: (dir: string) => void }) {
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [folder, setFolder] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.getRecentProjects().then(setRecents).catch(() => {});
  }, []);

  const openExisting = async () => {
    try {
      const dir = await api.openProjectDialog();
      if (dir) onOpened(dir);
    } catch (err) {
      toast('error', String(err));
    }
  };

  const create = async () => {
    if (!title.trim() || !folder) return;
    setBusy(true);
    try {
      const dir = await api.newProject(folder, title.trim(), author.trim());
      onOpened(dir);
    } catch (err) {
      toast('error', String(err));
      setBusy(false);
    }
  };

  return (
    <div className="welcome">
      <div className="welcome-left">
        <div className="welcome-mark">
          Book <em>Studio</em>
        </div>
        <p className="welcome-sub">
          Write chapters in markdown, design the page and the cover, then export a print-ready
          PDF and an ePub — all from one workshop.
        </p>
        <div className="welcome-actions">
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            New book
          </button>
          <button className="btn" onClick={openExisting}>
            Open project…
          </button>
        </div>
      </div>
      <div className="welcome-right">
        <div className="recent-title">Recent projects</div>
        {recents.length === 0 && (
          <div className="empty-hint">Projects you open show up here.</div>
        )}
        {recents.map((r) => (
          <button
            key={r.path}
            className="recent-item"
            onClick={() => api.openProject(r.path).then(() => onOpened(r.path)).catch((e) => toast('error', String(e)))}
          >
            <div className="rt">{r.title || 'Untitled'}</div>
            <div className="rp">{r.path}</div>
          </button>
        ))}
      </div>

      {showNew && (
        <Modal
          title="New book"
          onClose={() => setShowNew(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={!title.trim() || !folder || busy} onClick={create}>
                Create book
              </button>
            </>
          }
        >
          <div className="field-row">
            <label>Title</label>
            <input
              className="text-input grow"
              autoFocus
              value={title}
              placeholder="The name of your book"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="field-row">
            <label>Author</label>
            <input
              className="text-input grow"
              value={author}
              placeholder="Your name"
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>
          <div className="field-row">
            <label>Location</label>
            <input className="text-input grow" value={folder} readOnly placeholder="Choose a folder…" />
            <button
              className="btn btn-sm"
              onClick={() => api.chooseProjectFolder('Choose where to create the project').then((d) => d && setFolder(d))}
            >
              Browse
            </button>
          </div>
          <p className="empty-hint" style={{ textAlign: 'left', padding: '6px 0 0' }}>
            A folder named after the title is created there, with your chapters and images inside.
          </p>
        </Modal>
      )}
    </div>
  );
}
