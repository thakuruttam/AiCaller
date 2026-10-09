import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLoader from '../components/AppLoader';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { loginWithTokens, refreshWorkspaces } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    const userJson = params.get('user');
    const error = params.get('error');

    if (error || !token || !refreshToken || !userJson) {
      navigate('/login?error=google_failed', { replace: true });
      return;
    }

    const finalize = async () => {
      try {
        const user = JSON.parse(userJson);
        loginWithTokens(token, refreshToken, user);
        await refreshWorkspaces();

        // If user clicked an invite link before Google OAuth, accept it now
        const pendingInvite = localStorage.getItem('pendingInviteToken');
        if (pendingInvite) {
          localStorage.removeItem('pendingInviteToken');
          navigate(`/invite/${pendingInvite}`, { replace: true });
          return;
        }

        navigate('/', { replace: true });
      } catch {
        navigate('/login?error=google_failed', { replace: true });
      }
    };
    finalize();
  }, []);

  return <AppLoader text="Signing you in…" />;
}
