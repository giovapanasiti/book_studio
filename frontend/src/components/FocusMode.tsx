import { useEffect, useMemo, useRef, useState } from 'react';
import { playKey, warmUp, getSoundTheme, setSoundTheme, getSoundVolume, setSoundVolume, SOUND_THEMES } from '../lib/typewriter';
import type { SoundTheme } from '../lib/typewriter';

interface Props {
  title: string;
  value: string;
  onChange: (v: string) => void;
  onExit: () => void;
}

// FocusMode is the distraction-free writing surface: only the text, with a
// word count, optional typewriter sounds, and Esc to leave.
export function FocusMode({ title, value, onChange, onExit }: Props) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [soundTheme, setThemeState] = useState<SoundTheme>(getSoundTheme());
  const [volume, setVolumeState] = useState(getSoundVolume());
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = ta.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.scrollTop = el.scrollHeight;
    }
    warmUp(); // audio ready before the first stroke
  }, []);

  // The controls fade away while writing and come back on mouse move.
  useEffect(() => {
    const wake = () => {
      setChromeVisible(true);
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setChromeVisible(false), 2500);
    };
    wake();
    window.addEventListener('mousemove', wake);
    return () => {
      window.removeEventListener('mousemove', wake);
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  const words = useMemo(() => (value.match(/\S+/g) || []).length, [value]);

  return (
    <div className="focus-overlay">
      <div className={'focus-chrome focus-top' + (chromeVisible ? '' : ' hidden')}>
        <span className="focus-title">{title}</span>
        <button className="btn btn-sm btn-ghost" onClick={onExit} title="Leave focus mode (Esc)">
          ✕ Esc
        </button>
      </div>

      <textarea
        ref={ta}
        className="focus-input"
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onExit();
            return;
          }
          if (!e.ctrlKey && !e.metaKey && !e.altKey) playKey(e.key, e.repeat);
        }}
      />

      <div className={'focus-chrome focus-bottom' + (chromeVisible ? '' : ' hidden')}>
        <span className="word-count">{words.toLocaleString()} words</span>
        <div className="focus-sound">
          <span style={{ color: 'var(--faint)', fontSize: 11 }}>Keys</span>
          <select
            className="select-input"
            style={{ width: 150, padding: '3px 8px', fontSize: 12 }}
            value={soundTheme}
            onChange={(e) => {
              const t = e.target.value as SoundTheme;
              setSoundTheme(t);
              setThemeState(t);
              playKey('a', false);
            }}
          >
            {SOUND_THEMES.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          {soundTheme !== 'off' && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              style={{ width: 90 }}
              value={volume}
              title="Sound volume"
              onChange={(e) => {
                const v = Number(e.target.value);
                setSoundVolume(v);
                setVolumeState(v);
                playKey('a', false);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
