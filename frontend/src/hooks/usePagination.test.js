import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from './usePagination';

const rows = Array.from({ length: 40 }, (_, i) => i + 1);

describe('usePagination', () => {
  it('starts on page 1 at the default size of 15', () => {
    const { result } = renderHook(() => usePagination(rows));
    expect(DEFAULT_PAGE_SIZE).toBe(15);
    expect(PAGE_SIZE_OPTIONS).toEqual([15, 30, 60, 120]);
    expect(result.current.paginated).toEqual(rows.slice(0, 15));
    expect(result.current.paginationProps).toMatchObject({ page: 1, totalPages: 3, totalRows: 40, pageSize: 15 });
  });

  it('moves between pages', () => {
    const { result } = renderHook(() => usePagination(rows));
    act(() => result.current.paginationProps.onPageChange(3));
    expect(result.current.paginated).toEqual(rows.slice(30, 40));
  });

  it('changing the page size returns to page 1', () => {
    const { result } = renderHook(() => usePagination(rows));
    act(() => result.current.paginationProps.onPageChange(3));
    act(() => result.current.paginationProps.onPageSizeChange(30));
    expect(result.current.page).toBe(1);
    expect(result.current.paginated).toHaveLength(30);
    expect(result.current.paginationProps.totalPages).toBe(2);
  });

  it('clamps the page when the rows shrink below it', () => {
    const { result, rerender } = renderHook(({ list }) => usePagination(list), { initialProps: { list: rows } });
    act(() => result.current.paginationProps.onPageChange(3));
    rerender({ list: rows.slice(0, 10) });
    expect(result.current.page).toBe(1);
    expect(result.current.paginated).toEqual(rows.slice(0, 10));
  });

  it('reports a single empty page for no rows', () => {
    const { result } = renderHook(() => usePagination([]));
    expect(result.current.paginated).toEqual([]);
    expect(result.current.paginationProps).toMatchObject({ totalPages: 1, totalRows: 0 });
  });
});
