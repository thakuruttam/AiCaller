import { useMemo, useState } from 'react';

// Faceted filtering for a table: each facet narrows rows to a set of chosen
// values (OR within a facet, AND across facets), the way Linear and the
// shadcn data table filter. `facets` maps a key to { label, get, format? };
// `get` returns the row's value for that facet. Option counts for a facet are
// computed against the rows the *other* facets let through, so a count always
// says how many rows ticking that option would add.
export function useFacets(rows, facets, { onChange } = {}) {
  const [selected, setSelected] = useState({}); // { [key]: string[] }

  const keys = Object.keys(facets);
  const matches = (row, skipKey) => keys.every((k) => {
    if (k === skipKey) return true;
    const chosen = selected[k];
    return !chosen?.length || chosen.includes(String(facets[k].get(row) ?? ''));
  });

  const filtered = useMemo(
    () => rows.filter((r) => matches(r, null)),
    // facets is a fresh literal each render; its getters are stable in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, selected],
  );

  const update = (next) => {
    setSelected(next);
    onChange?.();
  };

  const list = keys.map((key) => {
    const { label, get, format } = facets[key];
    const counts = new Map();
    rows.forEach((r) => {
      if (!matches(r, key)) return;
      const v = String(get(r) ?? '');
      if (v === '') return;
      counts.set(v, (counts.get(v) || 0) + 1);
    });
    // Keep chosen values listed even when other filters zero their count.
    (selected[key] || []).forEach((v) => { if (!counts.has(v)) counts.set(v, 0); });
    const options = [...counts.entries()]
      .map(([value, count]) => ({ value, count, label: format ? format(value) : value }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label)));
    const chosen = selected[key] || [];
    return {
      key,
      label,
      options,
      selected: chosen,
      toggle: (value) => update({
        ...selected,
        [key]: chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value],
      }),
      clear: () => update({ ...selected, [key]: [] }),
    };
  });

  const activeCount = keys.reduce((n, k) => n + (selected[k]?.length || 0), 0);

  return { filtered, facets: list, activeCount, reset: () => update({}) };
}
