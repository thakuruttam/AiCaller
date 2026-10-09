import WaveLoader from './ui/WaveLoader';

// In-page loading state for a screen whose data hasn't arrived yet.
export default function PageLoader({ text = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 animate-fade-in">
      <WaveLoader size="lg" className="text-brand-500" label={text} />
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
    </div>
  );
}
