import { useMemo, useState } from 'react';

// Click-to-sort for a table. `accessors` maps a column key to the value it
// sorts by; clicking a column sorts ascending, again descending, a third time
// back to the data's own order. `sortProps(key)` spreads straight onto <Th>.
// Strings compare case- and accent-insensitively with numeric awareness
// ("Campaign 2" before "Campaign 10"); empty values always sink to the bottom.
export function useSort(rows, accessors, initial = null) {
  const [sort, setSort] = useState(initial); // { key, dir } | null

  const sorted = useMemo(() => {
    if (!sort || !accessors[sort.key]) return rows;
    const get = accessors[sort.key];
    const factor = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const aEmpty = av == null || av === '';
      const bEmpty = bv == null || bv === '';
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      if (av instanceof Date && bv instanceof Date) return (av - bv) * factor;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * factor;
    });
    // accessors is a fresh object literal on every render; sorting only needs
    // to rerun when the rows or the chosen column/direction change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  const sortProps = (key) => ({
    sort: sort?.key === key ? sort.dir : null,
    onSort: () => setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    }),
  });

  return { sorted, sortProps, sort };
}
