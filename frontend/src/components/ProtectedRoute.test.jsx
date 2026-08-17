import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute.jsx';

const useAuthMock = vi.fn();
vi.mock('../context/AuthContext', () => ({ useAuth: () => useAuthMock() }));

function renderAt(path, { user, isLoading }) {
  useAuthMock.mockReturnValue({ user, isLoading });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/*" element={<ProtectedRoute><div>Protected Content</div></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('renders a loading state while isLoading is true', () => {
    renderAt('/dashboard', { user: null, isLoading: true });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to /login when not loading and no user', () => {
    renderAt('/dashboard', { user: null, isLoading: false });
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    renderAt('/dashboard', { user: { id: 'u1' }, isLoading: false });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
