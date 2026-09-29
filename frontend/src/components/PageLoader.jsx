import Spinner from './Spinner';

export default function PageLoader({ text = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Spinner size={36} className="text-brand-500" />
      <p className="text-sm text-ink-700 dark:text-ink-900">
        {text}
      </p>
    </div>
  );
}
