import React from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '../../pages/web3-dashboard/ui/dropdown-menu';
import Button, { IconButton } from './Button';

// Toolbar controls that pair with useFacets / useColumnVisibility /
// exportCsv. Styled after the shadcn data-table toolbar: a dashed "+ Status"
// pill per facet that fills in with the chosen values, a Reset link once
// anything is filtered, and a Columns menu on the right.

const PILL =
  'inline-flex h-8 items-center gap-1.5 rounded-control border border-dashed border-paper-700 dark:border-white/15 ' +
  'px-2.5 text-xs font-medium text-ink-600 dark:text-ink-900 hover:bg-paper-200 dark:hover:bg-white/[0.04] ' +
  'hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40';

// The selected values show inside the pill (up to two, then "N selected"),
// so the toolbar itself reads as a sentence of what's being shown.
export function FacetFilter({ facet }) {
  const { label, options, selected, toggle, clear } = facet;
  const chosen = options.filter((o) => selected.includes(o.value));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={`${PILL} ${chosen.length ? 'border-solid text-foreground' : ''}`}>
          <span className="material-symbols-outlined [--icon-size:15px]">
            {chosen.length ? 'filter_alt' : 'add_circle'}
          </span>
          {label}
          {chosen.length > 0 && (
            <>
              <span className="mx-0.5 h-4 w-px bg-paper-600 dark:bg-white/15" />
              {chosen.length > 2 ? (
                <span className="rounded-full bg-brand-500/10 px-1.5 py-px text-brand-600 dark:text-brand-300">
                  {chosen.length} selected
                </span>
              ) : (
                chosen.map((o) => (
                  <span key={o.value} className="rounded-full bg-brand-500/10 px-1.5 py-px text-brand-600 dark:text-brand-300 first-letter:uppercase">
                    {o.label}
                  </span>
                ))
              )}
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Filter by {label.toLowerCase()}</DropdownMenuLabel>
        {options.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No values</div>
        )}
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={selected.includes(o.value)}
            onCheckedChange={() => toggle(o.value)}
            onSelect={(e) => e.preventDefault()}
          >
            <span className="flex-1 truncate first-letter:uppercase">{o.label}</span>
            <span className="ml-3 text-xs tabular-nums text-muted-foreground">{o.count}</span>
          </DropdownMenuCheckboxItem>
        ))}
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={clear} className="justify-center text-sm">
              Clear filter
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Every facet's pill plus Reset. Takes the whole useFacets() result.
export function FilterBar({ filters, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {filters.facets.map((f) => <FacetFilter key={f.key} facet={f} />)}
      {filters.activeCount > 0 && (
        <Button variant="ghost" size="sm" iconRight="close" onClick={filters.reset}>
          Reset
        </Button>
      )}
    </div>
  );
}

// Column visibility menu. Takes the useColumnVisibility() result; the last
// visible column can't be hidden, so the table never collapses to nothing.
export function ColumnToggle({ visibility }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton title="Columns" icon="view_column" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Show columns</DropdownMenuLabel>
        {visibility.columns.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.key}
            checked={c.visible}
            disabled={c.visible && visibility.visibleCount === 1}
            onCheckedChange={() => visibility.toggle(c.key)}
            onSelect={(e) => e.preventDefault()}
          >
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
