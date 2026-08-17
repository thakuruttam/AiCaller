import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RoleGate from './RoleGate.jsx';

const useAuthMock = vi.fn();
vi.mock('../context/AuthContext', () => ({ useAuth: () => useAuthMock() }));

function renderGate(user, props = {}) {
  useAuthMock.mockReturnValue({ user });
  return render(
    <RoleGate allow={props.allow} fallback={props.fallback}>
      <div>Gated Content</div>
    </RoleGate>
  );
}

describe('RoleGate', () => {
  it('renders the default fallback (nothing) when there is no user', () => {
    const { container } = renderGate(null, { allow: ['ADMIN'] });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a custom fallback when there is no user', () => {
    renderGate(null, { allow: ['ADMIN'], fallback: <div>No Access</div> });
    expect(screen.getByText('No Access')).toBeInTheDocument();
  });

  it('SUPER_ADMIN always renders children, even with an empty allow list', () => {
    renderGate({ role: 'SUPER_ADMIN' }, { allow: [] });
    expect(screen.getByText('Gated Content')).toBeInTheDocument();
  });

  it('renders children when workspaceRole is in the allow list', () => {
    renderGate({ role: 'VIEWER', workspaceRole: 'ADMIN' }, { allow: ['ADMIN'] });
    expect(screen.getByText('Gated Content')).toBeInTheDocument();
  });

  it('falls back to role when workspaceRole is absent', () => {
    renderGate({ role: 'EDITOR' }, { allow: ['EDITOR'] });
    expect(screen.getByText('Gated Content')).toBeInTheDocument();
  });

  it('renders fallback when the effective role is not in the allow list', () => {
    renderGate({ role: 'VIEWER' }, { allow: ['ADMIN', 'EDITOR'] });
    expect(screen.queryByText('Gated Content')).not.toBeInTheDocument();
  });

  it('defaults allow to [] and always falls back for a non-SUPER_ADMIN user when omitted', () => {
    renderGate({ role: 'ADMIN' });
    expect(screen.queryByText('Gated Content')).not.toBeInTheDocument();
  });
});
