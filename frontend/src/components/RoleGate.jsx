import { useAuth } from '../context/AuthContext';

const ROLE_HIERARCHY = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1
};

/**
 * RoleGate — only renders children if user's effective role is in the `allow` list.
 * 
 * Usage:
 *   <RoleGate allow={['ADMIN', 'EDITOR']}>
 *     <button>Run Campaign</button>
 *   </RoleGate>
 * 
 * Optional `fallback` prop renders something else for unauthorized users.
 */
export default function RoleGate({ allow = [], children, fallback = null }) {
  const { user } = useAuth();

  if (!user) return fallback;

  // Use workspaceRole for workspace-scoped actions, fall back to global role
  const effectiveRole = user.workspaceRole || user.role;

  if (user.role === 'SUPER_ADMIN' || allow.includes(effectiveRole)) {
    return children;
  }

  return fallback;
}
