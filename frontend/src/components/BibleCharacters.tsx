import { useState } from 'react';
import type { Bible, Character } from '../types';
import { CHARACTER_ROLES, defaultCharacter } from '../types';
import { imageURLStable } from '../api';
import { useCtxMenu } from './ContextMenu';

interface Props {
  bible: Bible;
  images: string[];
  onBible: (patch: Partial<Bible>) => void;
}

export function BibleCharacters({ bible, images, onBible }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(bible.characters[0]?.id ?? null);
  const ctx = useCtxMenu();
  const chars = bible.characters;
  const sel = chars.find((c) => c.id === selectedId) ?? null;

  const setChars = (characters: Character[]) => onBible({ characters });

  const patch = (id: string, p: Partial<Character>) =>
    setChars(chars.map((c) => (c.id === id ? { ...c, ...p } : c)));

  const add = () => {
    const c = defaultCharacter();
    setChars([...chars, c]);
    setSelectedId(c.id);
  };

  const remove = (id: string) => {
    // Also drop relationships that point at the removed character.
    const characters = chars
      .filter((c) => c.id !== id)
      .map((c) => ({ ...c, relationships: c.relationships.filter((r) => r.withId !== id) }));
    onBible({ characters });
    if (selectedId === id) setSelectedId(characters[0]?.id ?? null);
  };

  const duplicate = (id: string) => {
    const src = chars.find((c) => c.id === id);
    if (!src) return;
    const copy = { ...src, id: crypto.randomUUID(), name: src.name + ' copy' };
    setChars([...chars, copy]);
    setSelectedId(copy.id);
  };

  const roleLabel = (role: string) => CHARACTER_ROLES.find(([k]) => k === role)?.[1] ?? role;

  const text = (label: string, key: keyof Character, placeholder = '') =>
    sel && (
      <div className="field-row" key={key}>
        <label>{label}</label>
        <input
          className="text-input grow"
          value={(sel[key] as string) ?? ''}
          placeholder={placeholder}
          onChange={(e) => patch(sel.id, { [key]: e.target.value } as Partial<Character>)}
        />
      </div>
    );

  const area = (label: string, key: keyof Character, placeholder: string) =>
    sel && (
      <div className="field-row" key={key} style={{ alignItems: 'flex-start' }}>
        <label style={{ paddingTop: 6 }}>{label}</label>
        <textarea
          className="text-input grow"
          value={(sel[key] as string) ?? ''}
          placeholder={placeholder}
          onChange={(e) => patch(sel.id, { [key]: e.target.value } as Partial<Character>)}
        />
      </div>
    );

  return (
    <div className="bible-two-cols">
      <div className="bible-list">
        {chars.length === 0 && (
          <div className="empty-hint">
            No characters yet.
            <br />
            The cast of your book lives here.
          </div>
        )}
        {chars.map((c) => (
          <button
            key={c.id}
            className={'card-item' + (c.id === selectedId ? ' active' : '')}
            onClick={() => setSelectedId(c.id)}
            onContextMenu={(e) =>
              ctx(e, [
                { header: c.name },
                { label: 'Duplicate', onClick: () => duplicate(c.id) },
                { sep: true },
                { label: 'Delete character', danger: true, onClick: () => remove(c.id) },
              ])
            }
          >
            <span className="portrait">
              {c.portrait ? <img src={imageURLStable(c.portrait)} alt="" /> : <span className="initial">{(c.name || '?')[0]}</span>}
            </span>
            <span className="card-item-main">
              <span className="card-item-title">{c.name || 'Unnamed'}</span>
              <span className={'pill role-' + c.role}>{roleLabel(c.role)}</span>
            </span>
          </button>
        ))}
        <button className="sidebar-add" style={{ margin: '8px 0 0' }} onClick={add}>
          + New character
        </button>
      </div>

      <div className="bible-detail">
        {!sel && <div className="empty-hint">Select a character, or create one.</div>}
        {sel && (
          <>
            <div className="panel-section">
              <div className="panel-title">Identity</div>
              {text('Name', 'name')}
              <div className="field-row">
                <label>Role</label>
                <select
                  className="select-input grow"
                  value={sel.role}
                  onChange={(e) => patch(sel.id, { role: e.target.value })}
                >
                  {CHARACTER_ROLES.map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-grid-2">
                {text('Age', 'age')}
                {text('Pronouns', 'pronouns', 'she/her, he/him, they/them…')}
              </div>
              {text('Occupation', 'occupation')}
              <div className="field-row">
                <label>Portrait</label>
                <select
                  className="select-input grow"
                  value={sel.portrait}
                  onChange={(e) => patch(sel.id, { portrait: e.target.value })}
                >
                  <option value="">None</option>
                  {images.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                {sel.portrait && (
                  <img
                    src={imageURLStable(sel.portrait)}
                    alt=""
                    style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }}
                  />
                )}
              </div>
            </div>

            <div className="panel-section">
              <div className="panel-title">On the page</div>
              {area('Appearance', 'appearance', 'What the reader sees: build, face, clothes, one telling detail.')}
              {area('Personality', 'personality', 'Temperament, habits, contradictions.')}
              {area('Voice', 'voice', 'How they speak: rhythm, vocabulary, what they never say.')}
            </div>

            <div className="panel-section">
              <div className="panel-title">Under the surface</div>
              {area('Motivation', 'motivation', 'What they want, and what they need instead.')}
              {area('Wound', 'wound', 'The fear or old hurt that holds them back.')}
              {area('Secret', 'secret', 'What they hide — from others, or from themselves.')}
              {area('Arc', 'arc', 'Who they are at the start, and who they become.')}
              {area('Backstory', 'backstory', 'Only what presses on the present story.')}
            </div>

            <div className="panel-section">
              <div className="panel-title">Relationships</div>
              {sel.relationships.map((r, i) => {
                const other = chars.find((c) => c.id === r.withId);
                return (
                  <div className="field-row" key={i}>
                    <select
                      className="select-input"
                      style={{ flex: '0 0 160px' }}
                      value={r.withId}
                      onChange={(e) =>
                        patch(sel.id, {
                          relationships: sel.relationships.map((x, j) => (j === i ? { ...x, withId: e.target.value } : x)),
                        })
                      }
                    >
                      {!other && <option value={r.withId}>?</option>}
                      {chars
                        .filter((c) => c.id !== sel.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                    <input
                      className="text-input grow"
                      value={r.label}
                      placeholder="sister · rival · first love…"
                      onChange={(e) =>
                        patch(sel.id, {
                          relationships: sel.relationships.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                        })
                      }
                    />
                    <button
                      className="btn btn-sm btn-ghost"
                      title="Remove relationship"
                      onClick={() => patch(sel.id, { relationships: sel.relationships.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              <button
                className="btn btn-sm"
                disabled={chars.length < 2}
                onClick={() => {
                  const other = chars.find((c) => c.id !== sel.id);
                  if (other) patch(sel.id, { relationships: [...sel.relationships, { withId: other.id, label: '' }] });
                }}
              >
                + Add relationship
              </button>
            </div>

            <div className="panel-section">
              <div className="panel-title">Notes</div>
              {area('Anything else', 'notes', 'Casting ideas, research links, loose thoughts.')}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
