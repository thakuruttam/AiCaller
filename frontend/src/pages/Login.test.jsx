import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const loginMock = vi.fn();
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ login: loginMock }) }));

const Login = (await import('./Login.jsx')).default;

function renderLogin(initialEntries = ['/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<div>Dashboard Page</div>} />
        <Route path="/somewhere" element={<div>Somewhere Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  loginMock.mockReset();
});

describe('Login page', () => {
  it('renders email and password fields and a submit button', () => {
    renderLogin();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('submits valid credentials and shows a success toast', async () => {
    loginMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/work email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(loginMock).toHaveBeenCalledWith('a@b.com', 'password123');
    expect(await screen.findByText('Signed in')).toBeInTheDocument();
  });

  it('shows the generic error message when login fails with a response error', async () => {
    loginMock.mockRejectedValue({ response: { data: { error: 'Invalid email or password' } } });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/work email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^password$/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });

  it('shows the Google-only-account error and highlights the Google button', async () => {
    loginMock.mockRejectedValue({
      response: { data: { error: 'This account uses Google sign-in — use the "Continue with Google" button instead', code: 'GOOGLE_ACCOUNT_NO_PASSWORD' } },
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/work email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^password$/i), 'whatever');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/uses Google sign-in/i)).toBeInTheDocument();
    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    expect(googleButton.className).toContain('google-btn-highlight');
  });

  it('falls back to the generic error message on a network error with no response', async () => {
    loginMock.mockRejectedValue(new Error('Network Error'));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/work email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^password$/i), 'whatever');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });

  it('pre-populates the error banner from ?error=google_failed on mount', () => {
    renderLogin(['/login?error=google_failed']);
    expect(screen.getByText('Google sign-in failed. Please try again.')).toBeInTheDocument();
  });

  it('disables the submit button while loading', async () => {
    let resolveLogin;
    loginMock.mockReturnValue(new Promise((resolve) => { resolveLogin = resolve; }));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/work email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button', { name: /authenticating/i })).toBeDisabled();
    await act(async () => { resolveLogin({}); });
  });
});

describe('Login page — Google button', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    delete window.location;
    window.location = { ...originalLocation, href: '' };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('navigates the browser to /api/auth/google on click', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(window.location.href).toContain('/api/auth/google');
  });
});
