import { useState } from 'react';
import type { Bible, Location } from '../types';
import { imageURLStable } from '../api';
import { useCtxMenu } from './ContextMenu';

interface Props {
  bible: Bible;
  images: string[];
  onBible: (patch: Partial<Bible>) => void;
}

function newLocation(): Location {
  return {
    id: crypto.randomUUID(),
    name: 'New place',
    kind: '',
    description: '',
    significance: '',
    image: '',
    notes: '',
  };
}

export function BibleWorld({ bible, images, onBible }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(bible.locations[0]?.id ?? null);
  const ctx = useCtxMenu();
  const locs = bible.locations;
  const sel = locs.find((l) => l.id === selectedId) ?? null;

  const patch = (id: string, p: Partial<Location>) =>
    onBible({ locations: locs.map((l) => (l.id === id ? { ...l, ...p } : l)) });

  const area = (label: string, key: keyof Location, placeholder: string) =>
    sel && (
      <div className="field-row" key={key} style={{ alignItems: 'flex-start' }}>
        <label style={{ paddingTop: 6 }}>{label}</label>
        <textarea
          className="text-input grow"
          value={(sel[key] as string) ?? ''}
          placeholder={placeholder}
          onChange={(e) => patch(sel.id, { [key]: e.target.value } as Partial<Location>)}
        />
      </div>
    );

  return (
    <div className="bible-two-cols">
      <div className="bible-list">
        {locs.length === 0 && (
          <div className="empty-hint">
            No places yet.
            <br />
            Settings, rooms, towns and worlds live here.
          </div>
        )}
        {locs.map((l) => (
          <button
            key={l.id}
            className={'card-item' + (l.id === selectedId ? ' active' : '')}
            onClick={() => setSelectedId(l.id)}
            onContextMenu={(e) =>
              ctx(e, [
                { header: l.name },
                {
                  label: 'Delete place',
                  danger: true,
                  onClick: () => {
                    const locations = locs.filter((x) => x.id !== l.id);
                    onBible({ locations });
                    if (selectedId === l.id) setSelectedId(locations[0]?.id ?? null);
                  },
                },
              ])
            }
          >
            <span className="portrait">
              {l.image ? <img src={imageURLStable(l.image)} alt="" /> : <span className="initial">⌂</span>}
            </span>
            <span className="card-item-main">
              <span className="card-item-title">{l.name || 'Unnamed'}</span>
              {l.kind && <span className="pill">{l.kind}</span>}
            </span>
          </button>
        ))}
        <button
          className="sidebar-add"
          style={{ margin: '8px 0 0' }}
          onClick={() => {
            const l = newLocation();
            onBible({ locations: [...locs, l] });
            setSelectedId(l.id);
          }}
        >
          + New place
        </button>
      </div>

      <div className="bible-detail">
        {!sel && <div className="empty-hint">Select a place, or create one.</div>}
        {sel && (
          <>
            <div className="panel-section">
              <div className="panel-title">Place</div>
              <div className="field-row">
                <label>Name</label>
                <input className="text-input grow" value={sel.name} onChange={(e) => patch(sel.id, { name: e.target.value })} />
              </div>
              <div className="field-row">
                <label>Kind</label>
                <input
                  className="text-input grow"
                  value={sel.kind}
                  placeholder="lighthouse · café · city · kingdom…"
                  onChange={(e) => patch(sel.id, { kind: e.target.value })}
                />
              </div>
              <div className="field-row">
                <label>Image</label>
                <select className="select-input grow" value={sel.image} onChange={(e) => patch(sel.id, { image: e.target.value })}>
                  <option value="">None</option>
                  {images.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              {sel.image && (
                <img
                  src={imageURLStable(sel.image)}
                  alt=""
                  style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, border: '1px solid var(--line)', marginBottom: 12 }}
                />
              )}
              {area('Description', 'description', 'Sights, sounds, smells — what a scene set here feels like.')}
              {area('Significance', 'significance', 'Why the story needs this place. What happened, or will happen, here.')}
              {area('Notes', 'notes', 'Research, maps, floor plans, continuity details.')}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
