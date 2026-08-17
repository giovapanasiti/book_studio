import type { Bible, PlotThread, TimelineEvent } from '../types';
import { THREAD_KINDS } from '../types';
import { useCtxMenu } from './ContextMenu';

interface Props {
  bible: Bible;
  onBible: (patch: Partial<Bible>) => void;
}

export function BibleThreads({ bible, onBible }: Props) {
  const ctx = useCtxMenu();
  const threads = bible.threads;

  const patch = (id: string, p: Partial<PlotThread>) =>
    onBible({ threads: threads.map((t) => (t.id === id ? { ...t, ...p } : t)) });

  const area = (t: PlotThread, label: string, key: keyof PlotThread, placeholder: string) => (
    <div className="field-row" style={{ alignItems: 'flex-start' }}>
      <label style={{ paddingTop: 6 }}>{label}</label>
      <textarea
        className="text-input grow"
        rows={2}
        value={(t[key] as string) ?? ''}
        placeholder={placeholder}
        onChange={(e) => patch(t.id, { [key]: e.target.value } as Partial<PlotThread>)}
      />
    </div>
  );

  return (
    <div className="bible-stack">
      {threads.length === 0 && (
        <div className="empty-hint">
          No plot threads yet. The main plot, the romance, each subplot — give every thread a card so
          none is left unresolved.
        </div>
      )}
      {threads.map((t) => (
        <div
          className="thread-card"
          key={t.id}
          onContextMenu={(e) =>
            ctx(e, [
              { header: t.title || 'Thread' },
              { label: 'Delete thread', danger: true, onClick: () => onBible({ threads: threads.filter((x) => x.id !== t.id) }) },
            ])
          }
        >
          <div className="field-row">
            <input
              className="text-input grow"
              style={{ fontFamily: 'var(--serif)', fontSize: 14 }}
              value={t.title}
              placeholder="Thread title"
              onChange={(e) => patch(t.id, { title: e.target.value })}
            />
            <select className="select-input" style={{ flex: '0 0 130px' }} value={t.kind} onChange={(e) => patch(t.id, { kind: e.target.value })}>
              {THREAD_KINDS.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <div className="seg-group">
              {(['planned', 'active', 'resolved'] as const).map((s) => (
                <button key={s} className={'seg-btn' + (t.status === s ? ' active' : '')} onClick={() => patch(t.id, { status: s })}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {area(t, 'Premise', 'premise', 'Who wants what, and what stands in the way.')}
          {area(t, 'Stakes', 'stakes', 'What is lost if this thread fails.')}
          {area(t, 'Resolution', 'resolution', 'How it ends — or the options you are weighing.')}
        </div>
      ))}
      <button
        className="sidebar-add"
        style={{ margin: 0 }}
        onClick={() =>
          onBible({
            threads: [
              ...threads,
              {
                id: crypto.randomUUID(),
                title: '',
                kind: threads.length === 0 ? 'main' : 'subplot',
                premise: '',
                stakes: '',
                resolution: '',
                status: 'planned',
              },
            ],
          })
        }
      >
        + New thread
      </button>
    </div>
  );
}

export function BibleTimeline({ bible, onBible }: Props) {
  const ctx = useCtxMenu();
  const events = bible.timeline;

  const patch = (id: string, p: Partial<TimelineEvent>) =>
    onBible({ timeline: events.map((t) => (t.id === id ? { ...t, ...p } : t)) });

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= events.length) return;
    const timeline = [...events];
    [timeline[i], timeline[j]] = [timeline[j], timeline[i]];
    onBible({ timeline });
  };

  return (
    <div className="bible-stack">
      {events.length === 0 && (
        <div className="empty-hint">
          No events yet. Keep the order of what happens — story time, not chapter order — so
          continuity never slips.
        </div>
      )}
      <div className="timeline">
        {events.map((ev, i) => (
          <div
            className="timeline-row"
            key={ev.id}
            onContextMenu={(e) =>
              ctx(e, [
                { header: ev.title || 'Event' },
                { label: 'Move up', disabled: i === 0, onClick: () => move(i, -1) },
                { label: 'Move down', disabled: i === events.length - 1, onClick: () => move(i, 1) },
                { sep: true },
                { label: 'Delete event', danger: true, onClick: () => onBible({ timeline: events.filter((x) => x.id !== ev.id) }) },
              ])
            }
          >
            <span className="timeline-dot" />
            <input
              className="text-input"
              style={{ flex: '0 0 130px' }}
              value={ev.when}
              placeholder="When"
              onChange={(e) => patch(ev.id, { when: e.target.value })}
            />
            <input
              className="text-input"
              style={{ flex: '0 0 220px' }}
              value={ev.title}
              placeholder="What happens"
              onChange={(e) => patch(ev.id, { title: e.target.value })}
            />
            <input
              className="text-input grow"
              value={ev.description}
              placeholder="Details, who is there, what changes"
              onChange={(e) => patch(ev.id, { description: e.target.value })}
            />
          </div>
        ))}
      </div>
      <button
        className="sidebar-add"
        style={{ margin: 0 }}
        onClick={() =>
          onBible({ timeline: [...events, { id: crypto.randomUUID(), when: '', title: '', description: '' }] })
        }
      >
        + New event
      </button>
    </div>
  );
}
