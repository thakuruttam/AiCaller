import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSort } from './useSort';

const rows = [
  { name: 'Campaign 10', n: 3, when: '2026-10-02' },
  { name: 'campaign 2', n: null, when: '2026-10-01' },
  { name: 'Alpha', n: 1, when: '2026-10-03' },
];
const accessors = { name: r => r.name, n: r => r.n, when: r => r.when };

describe('useSort', () => {
  it('leaves rows in their original order until a column is chosen', () => {
    const { result } = renderHook(() => useSort(rows, accessors));
    expect(result.current.sorted).toBe(rows);
    expect(result.current.sortProps('name').sort).toBeNull();
  });

  it('cycles asc → desc → off on repeated clicks', () => {
    const { result } = renderHook(() => useSort(rows, accessors));
    act(() => result.current.sortProps('name').onSort());
    expect(result.current.sortProps('name').sort).toBe('asc');
    act(() => result.current.sortProps('name').onSort());
    expect(result.current.sortProps('name').sort).toBe('desc');
    act(() => result.current.sortProps('name').onSort());
    expect(result.current.sortProps('name').sort).toBeNull();
    expect(result.current.sorted).toBe(rows);
  });

  it('compares strings case-insensitively and numerically ("2" before "10")', () => {
    const { result } = renderHook(() => useSort(rows, accessors));
    act(() => result.current.sortProps('name').onSort());
    expect(result.current.sorted.map(r => r.name)).toEqual(['Alpha', 'campaign 2', 'Campaign 10']);
  });

  it('sinks empty values to the bottom in both directions', () => {
    const { result } = renderHook(() => useSort(rows, accessors));
    act(() => result.current.sortProps('n').onSort());
    expect(result.current.sorted.map(r => r.n)).toEqual([1, 3, null]);
    act(() => result.current.sortProps('n').onSort());
    expect(result.current.sorted.map(r => r.n)).toEqual([3, 1, null]);
  });

  it('switching columns starts the new column ascending', () => {
    const { result } = renderHook(() => useSort(rows, accessors));
    act(() => result.current.sortProps('name').onSort());
    act(() => result.current.sortProps('when').onSort());
    expect(result.current.sortProps('name').sort).toBeNull();
    expect(result.current.sorted.map(r => r.when)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });
});
