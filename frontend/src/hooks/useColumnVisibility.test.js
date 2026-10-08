import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColumnVisibility } from './useColumnVisibility';

const COLUMNS = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }];

describe('useColumnVisibility', () => {
  beforeEach(() => localStorage.clear());

  it('shows every column by default', () => {
    const { result } = renderHook(() => useColumnVisibility('t', COLUMNS));
    expect(result.current.columns.every(c => c.visible)).toBe(true);
    expect(result.current.visibleCount).toBe(2);
  });

  it('toggles a column and remembers it across mounts', () => {
    const { result, unmount } = renderHook(() => useColumnVisibility('t', COLUMNS));
    act(() => result.current.toggle('b'));
    expect(result.current.isVisible('b')).toBe(false);
    unmount();
    const { result: again } = renderHook(() => useColumnVisibility('t', COLUMNS));
    expect(again.current.isVisible('b')).toBe(false);
    act(() => again.current.toggle('b'));
    expect(again.current.isVisible('b')).toBe(true);
  });

  it('still renders defaults when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const { result } = renderHook(() => useColumnVisibility('t', COLUMNS));
    expect(result.current.visibleCount).toBe(2);
    act(() => result.current.toggle('a'));
    expect(result.current.isVisible('a')).toBe(false);
    spy.mockRestore();
    set.mockRestore();
  });
});
