import Spinner from './Spinner';

export default function PageLoader({ text = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Spinner size={36} className="text-[#0d9488]" />
      <p className="text-sm text-[#64748b]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        {text}
      </p>
    </div>
  );
}
