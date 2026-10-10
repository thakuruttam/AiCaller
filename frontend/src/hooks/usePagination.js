import { useState } from 'react';

// Page-size choices every table offers, and the size it starts at. One list
// app-wide so "per page" means the same thing on every screen.
export const PAGE_SIZE_OPTIONS = [15, 30, 60, 120];
export const DEFAULT_PAGE_SIZE = 15;

// Client-side pagination for a table. Pass the rows after search, filters
// and sorting; spread `paginationProps` onto <Pagination>. Changing the page
// size returns to page 1, and the current page is clamped when the row count
// shrinks (e.g. a filter narrows the list) so it never points past the end.
export function usePagination(rows, { initialPageSize = DEFAULT_PAGE_SIZE } = {}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const current = Math.min(page, totalPages);
  const paginated = rows.slice((current - 1) * pageSize, current * pageSize);

  const changePageSize = (size) => {
    setPageSize(size);
    setPage(1);
  };

  return {
    paginated,
    page: current,
    setPage,
    pageSize,
    paginationProps: {
      page: current,
      totalPages,
      totalRows,
      pageSize,
      onPageChange: setPage,
      onPageSizeChange: changePageSize,
    },
  };
}
