import WaveLoader from './ui/WaveLoader';

// Full-screen loading state — app boot, auth checks, sign-in callback, invite
// lookup. One component so every "we're getting things ready" moment shows
// the same brand mark and voice-wave instead of four different spinners.
export default function AppLoader({ text = 'Loading…' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper-300 dark:bg-ink-50 animate-fade-in">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-raised">
        <WaveLoader size="md" label={text} />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
    </div>
  );
}
