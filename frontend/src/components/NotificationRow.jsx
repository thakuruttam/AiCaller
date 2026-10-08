import React from 'react';
import { metaFor, timeAgo } from './notificationMeta';

// One presentation for a notification, shared by the bell dropdown and the
// notifications page. `compact` is the dropdown density; `leading` and
// `actions` are slots the page fills with its checkbox and row controls.
const TONE_ICON = {
  brand:    'bg-brand-500/10 text-brand-500',
  positive: 'bg-positive/10 text-positive-dim',
  caution:  'bg-caution/10 text-caution-dim',
  negative: 'bg-negative/10 text-negative-dim',
  neutral:  'bg-paper-400 dark:bg-ink-300 text-muted-foreground',
};

export default function NotificationRow({
  notification: n,
  compact = false,
  leading,
  actions,
  onOpen,
  className = '',
}) {
  const meta = metaFor(n.type);
  const clickable = Boolean(onOpen && n.link);

  return (
    <div
      className={[
        'group flex items-start gap-3 transition-colors',
        compact ? 'px-4 py-3' : 'px-4 py-4 sm:px-7 sm:py-5 sm:gap-4',
        n.isRead ? '' : 'bg-brand-500/10',
        'hover:bg-paper-200 dark:hover:bg-ink-300/60',
        className,
      ].join(' ')}
    >
      {leading}

      <span
        className={`shrink-0 rounded-chip flex items-center justify-center ${TONE_ICON[meta.tone]} ${
          compact ? 'w-8 h-8' : 'w-9 h-9'
        }`}
      >
        <span
          className="material-symbols-outlined"
          style={{ ['--icon-size']: compact ? '16px' : '18px' }}
        >
          {meta.icon}
        </span>
      </span>

      <div
        className={`min-w-0 flex-1 ${clickable ? 'cursor-pointer' : ''}`}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={() => clickable && onOpen(n)}
        onKeyDown={(e) => {
          if (!clickable) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(n); }
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" aria-label="Unread" />}
          <p
            className={`text-sm truncate ${
              n.isRead
                ? 'font-medium text-muted-foreground'
                : 'font-semibold text-foreground'
            }`}
          >
            {n.title}
          </p>
          {!compact && (
            <span className="inline-flex items-center rounded-field border border-paper-500 dark:border-ink-400 bg-paper-200 dark:bg-ink-300/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {meta.label}
            </span>
          )}
        </div>

        <p className={`text-muted-foreground mt-0.5 ${compact ? 'text-xs line-clamp-2' : 'text-[13px] mt-1'}`}>
          {n.body}
        </p>

        <div className="flex items-center gap-3 mt-1.5">
          <time
            className="text-xs text-muted-foreground"
            dateTime={n.createdAt}
            title={new Date(n.createdAt).toLocaleString()}
          >
            {timeAgo(n.createdAt)}
          </time>
          {!compact && n.link && <span className="text-xs font-medium text-brand-500">View →</span>}
        </div>
      </div>

      {/* Revealed on hover on a pointer device; a touch screen has no hover,
          so below `sm` the actions stay visible or they'd be unreachable. */}
      {actions && (
        <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {actions}
        </div>
      )}
    </div>
  );
}
