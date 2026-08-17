import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor, renderHook, act } from '@testing-library/react';

const mockApiInstance = {
  get: vi.fn(),
  post: vi.fn(),
  interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
};
const mockAxiosPost = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockApiInstance),
    post: mockAxiosPost,
  },
}));

const { AuthProvider, useAuth } = await import('./AuthContext.jsx');

function wrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  localStorage.clear();
  mockApiInstance.get.mockReset();
  mockApiInstance.post.mockReset();
  mockAxiosPost.mockReset();
});

describe('AuthProvider — initial mount', () => {
  it('finishes loading with no user when there is no stored session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(mockAxiosPost).not.toHaveBeenCalled();
    expect(mockApiInstance.get).not.toHaveBeenCalled();
  });

  it('refreshes and fetches workspaces when a session is stored', async () => {
    localStorage.setItem('refreshToken', 'rt-1');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', workspaceId: 'w1' }));
    mockAxiosPost.mockResolvedValue({ data: { accessToken: 'new-access-token' } });
    mockApiInstance.get.mockResolvedValue({ data: [{ id: 'w1', name: 'Workspace 1' }] });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockAxiosPost).toHaveBeenCalledWith(expect.stringContaining('/api/auth/refresh'), { refreshToken: 'rt-1', workspaceId: 'w1' });
    expect(localStorage.getItem('accessToken')).toBe('new-access-token');
    expect(result.current.user).toMatchObject({ id: 'u1' });
    expect(result.current.workspaces).toEqual([{ id: 'w1', name: 'Workspace 1' }]);
  });

  it('auto-switches to the first workspace when the stored workspaceId is no longer valid', async () => {
    localStorage.setItem('refreshToken', 'rt-1');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', workspaceId: 'stale-workspace' }));
    mockAxiosPost.mockResolvedValue({ data: { accessToken: 'new-access-token' } });
    mockApiInstance.get.mockResolvedValue({ data: [{ id: 'w2', name: 'Workspace 2' }] });
    mockApiInstance.post.mockResolvedValue({
      data: { accessToken: 'switched-token', refreshToken: 'switched-refresh', user: { id: 'u1', workspaceId: 'w2' } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiInstance.post).toHaveBeenCalledWith('/api/auth/switch-workspace', { workspaceId: 'w2' });
    expect(localStorage.getItem('accessToken')).toBe('switched-token');
    expect(result.current.user).toMatchObject({ workspaceId: 'w2' });
  });

  it('clears all stored session keys when the refresh call fails', async () => {
    localStorage.setItem('refreshToken', 'rt-1');
    localStorage.setItem('user', JSON.stringify({ id: 'u1' }));
    localStorage.setItem('accessToken', 'stale-token');
    localStorage.setItem('workspaces', JSON.stringify([{ id: 'w1' }]));
    mockAxiosPost.mockRejectedValue(new Error('refresh failed'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('workspaces')).toBeNull();
  });
});

describe('login', () => {
  it('persists tokens/user/workspaces to localStorage on success', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { accessToken: 'at', refreshToken: 'rt', user: { id: 'u1', email: 'a@b.com' }, workspaces: [{ id: 'w1' }] },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.login('a@b.com', 'password'); });

    expect(localStorage.getItem('accessToken')).toBe('at');
    expect(localStorage.getItem('refreshToken')).toBe('rt');
    expect(JSON.parse(localStorage.getItem('user'))).toMatchObject({ id: 'u1' });
  });

  it('does not touch localStorage when login fails', async () => {
    mockAxiosPost.mockRejectedValue({ response: { data: { error: 'Invalid email or password' } } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.login('a@b.com', 'wrong')).rejects.toBeTruthy();
    expect(localStorage.getItem('accessToken')).toBeNull();
  });
});

describe('logout', () => {
  it('clears all 4 localStorage keys even when the network call fails', async () => {
    localStorage.setItem('accessToken', 'at');
    localStorage.setItem('refreshToken', 'rt');
    localStorage.setItem('user', JSON.stringify({ id: 'u1' }));
    localStorage.setItem('workspaces', JSON.stringify([{ id: 'w1' }]));
    mockAxiosPost.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.logout(); });

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('workspaces')).toBeNull();
    expect(result.current.user).toBeNull();
  });
});

describe('switchWorkspace', () => {
  it('preserves the existing in-memory workspaces list rather than refetching', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { accessToken: 'at', refreshToken: 'rt', user: { id: 'u1' }, workspaces: [{ id: 'w1' }, { id: 'w2' }] },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.login('a@b.com', 'password'); });
    await waitFor(() => expect(result.current.workspaces).toHaveLength(2));

    mockApiInstance.post.mockResolvedValue({
      data: { accessToken: 'at2', refreshToken: 'rt2', user: { id: 'u1', workspaceId: 'w2' } },
    });
    await act(async () => { await result.current.switchWorkspace('w2'); });

    expect(mockApiInstance.get).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.user).toMatchObject({ workspaceId: 'w2' }));
    expect(result.current.workspaces).toHaveLength(2); // unchanged, not refetched
  });
});

describe('useAuth', () => {
  it('throws when used outside an AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider');
  });
});
