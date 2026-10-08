import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFacets } from './useFacets';

const rows = [
  { id: 1, status: 'active', type: 'SALES' },
  { id: 2, status: 'active', type: 'HR' },
  { id: 3, status: 'draft', type: 'SALES' },
  { id: 4, status: 'completed', type: 'HR' },
];
const facets = {
  status: { label: 'Status', get: r => r.status },
  type: { label: 'Type', get: r => r.type, format: v => v.toLowerCase() },
};
const facet = (result, key) => result.current.facets.find(f => f.key === key);
const ids = result => result.current.filtered.map(r => r.id);

describe('useFacets', () => {
  it('returns every row and full option counts with nothing selected', () => {
    const { result } = renderHook(() => useFacets(rows, facets));
    expect(ids(result)).toEqual([1, 2, 3, 4]);
    expect(facet(result, 'status').options).toEqual([
      { value: 'active', label: 'active', count: 2 },
      { value: 'completed', label: 'completed', count: 1 },
      { value: 'draft', label: 'draft', count: 1 },
    ]);
    expect(facet(result, 'type').options.map(o => o.label)).toEqual(['hr', 'sales']);
    expect(result.current.activeCount).toBe(0);
  });

  it('ORs values within a facet and ANDs across facets', () => {
    const { result } = renderHook(() => useFacets(rows, facets));
    act(() => facet(result, 'status').toggle('active'));
    act(() => facet(result, 'status').toggle('draft'));
    expect(ids(result)).toEqual([1, 2, 3]);
    act(() => facet(result, 'type').toggle('SALES'));
    expect(ids(result)).toEqual([1, 3]);
    expect(result.current.activeCount).toBe(3);
  });

  it("counts a facet's options against the other facets' filters only", () => {
    const { result } = renderHook(() => useFacets(rows, facets));
    act(() => facet(result, 'type').toggle('HR'));
    const counts = Object.fromEntries(facet(result, 'status').options.map(o => [o.value, o.count]));
    expect(counts).toEqual({ active: 1, completed: 1 });
    // The Type facet itself still lists every type with its own full count.
    expect(facet(result, 'type').options.map(o => o.count)).toEqual([2, 2]);
  });

  it('keeps a selected value listed with a zero count when other filters exclude it', () => {
    const { result } = renderHook(() => useFacets(rows, facets));
    act(() => facet(result, 'status').toggle('draft'));
    act(() => facet(result, 'type').toggle('HR'));
    expect(ids(result)).toEqual([]);
    expect(facet(result, 'status').options.find(o => o.value === 'draft').count).toBe(0);
  });

  it('clear, reset and toggling off restore rows and call onChange each time', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useFacets(rows, facets, { onChange }));
    act(() => facet(result, 'status').toggle('active'));
    act(() => facet(result, 'status').toggle('active'));
    expect(ids(result)).toEqual([1, 2, 3, 4]);
    act(() => facet(result, 'type').toggle('HR'));
    act(() => facet(result, 'type').clear());
    expect(ids(result)).toEqual([1, 2, 3, 4]);
    act(() => facet(result, 'status').toggle('draft'));
    act(() => result.current.reset());
    expect(result.current.activeCount).toBe(0);
    expect(onChange).toHaveBeenCalledTimes(6);
  });
});
