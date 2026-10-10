import WaveLoader from './ui/WaveLoader';

// Kept at this path (and with its numeric `size` prop) because buttons and
// several screens already import it; it now renders the shared voice-wave
// loader so every loading state in the app looks the same.
export default function Spinner({ size = 24, className = '', label }) {
  return <WaveLoader size={size} className={className} label={label} />;
}
