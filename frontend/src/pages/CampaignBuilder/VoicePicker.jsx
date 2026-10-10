import React, { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { Button, WaveLoader } from '../../components/ui';
import { DEFAULT_VOICE, FEATURED_VOICES, VOICES } from './campaignModel';

/**
 * Six voices up front, the other two dozen one click away — thirty tiles was
 * a wall nobody read. Each plays a sample, spoken in the campaign's own
 * opening line when there is one, via the cheap synchronous TTS endpoint
 * (not the Live session real calls use).
 */
export default function VoicePicker({ value, onChange, sampleText }) {
  const selected = value || DEFAULT_VOICE;
  const [showAll, setShowAll] = useState(!FEATURED_VOICES.includes(selected));
  const [preview, setPreview] = useState(null); // { voice, state: 'loading' | 'playing' }
  const audioRef = useRef(null);
  const cacheRef = useRef(new Map());

  useEffect(() => () => {
    audioRef.current?.pause();
    cacheRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  const play = async (voice) => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (preview?.voice === voice) { setPreview(null); return; }

    const text = sampleText?.replace(/\[Name\]/gi, 'Priya').trim() || undefined;
    const key = `${voice}::${text || ''}`;
    const start = (url) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      setPreview({ voice, state: 'playing' });
      audio.onended = () => setPreview(null);
      audio.onerror = () => setPreview(null);
      audio.play().catch(() => setPreview(null));
    };

    if (cacheRef.current.has(key)) { start(cacheRef.current.get(key)); return; }
    setPreview({ voice, state: 'loading' });
    try {
      const res = await api.post('/api/campaigns/preview-voice-gemini', { voice, text }, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      cacheRef.current.set(key, url);
      start(url);
    } catch {
      setPreview(null);
    }
  };

  const list = showAll ? VOICES : VOICES.filter(v => FEATURED_VOICES.includes(v.value));

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Voice" className={`grid grid-cols-2 gap-1.5 ${showAll ? 'max-h-64 overflow-y-auto pr-1' : ''}`}>
        {list.map(({ value: v, desc }) => {
          const isSelected = v === selected;
          const state = preview?.voice === v ? preview.state : null;
          return (
            <div
              key={v}
              className={`flex items-center gap-1 rounded-control border pl-2.5 pr-1 h-11 transition-colors
                ${isSelected ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500' : 'border-border hover:border-paper-800 dark:hover:border-white/20'}`}
            >
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onChange(v)}
                className="flex-1 min-w-0 text-left cursor-pointer outline-none focus-visible:underline"
              >
                <span className="block truncate text-xs font-semibold text-foreground">{v}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{desc}</span>
              </button>
              <button
                type="button"
                onClick={() => play(v)}
                aria-label={state === 'playing' ? `Stop ${v}` : `Play ${v}`}
                title={state === 'playing' ? 'Stop' : 'Hear this voice'}
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground cursor-pointer
                           hover:text-brand-500 hover:bg-brand-500/10 outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30"
              >
                {state === 'loading'
                  ? <WaveLoader size={14} label={`Loading ${v}`} />
                  : <span className="material-symbols-outlined [--icon-size:18px]">{state === 'playing' ? 'stop' : 'play_arrow'}</span>}
              </button>
            </div>
          );
        })}
      </div>
      <div>
        <Button variant="link" size="sm" onClick={() => setShowAll(s => !s)}>
          {showAll ? 'Show fewer voices' : `Show all ${VOICES.length} voices`}
        </Button>
      </div>
    </div>
  );
}
