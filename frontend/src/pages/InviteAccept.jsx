import React, { useEffect, useState } from 'react';
import { Button, IconButton } from '../components/ui';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const ROLE_COLOR = {
  ADMIN:  "bg-brand-500/10 text-brand-500 border-brand-500/25 dark:text-brand-300",
  EDITOR: "bg-caution/10 text-caution-dim border-caution/25 dark:text-caution",
  VIEWER: "bg-paper-400 text-muted-foreground border-paper-500 dark:bg-ink-300 dark:border-ink-400",
};

export default function InviteAccept() {
  const { token } = useParams();
  const { user, refreshWorkspaces, switchWorkspace } = useAuth();
  const navigate = useNavigate();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const { data } = await api.get(`/api/workspaces/invite/${token}`);
        setInvite(data);
      } catch (err) {
        setError(err.response?.data?.error || 'Invalid or expired invite link');
      } finally {
        setLoading(false);
      }
    };
    fetchInvite();
  }, [token]);

  const handleGoogleLogin = () => {
    // Store invite token so AuthCallback can handle it after OAuth
    localStorage.setItem('pendingInviteToken', token);
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/auth/google`;
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const { data } = await api.post(`/api/workspaces/invite/${token}/accept`);
      await refreshWorkspaces();
      await switchWorkspace(data.workspaceId);
      setDone(true);
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-500/10 dark:bg-ink-50 flex items-center justify-center">
        <span className="material-symbols-outlined text-[40px] text-brand-500 animate-spin">progress_activity</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-500/10 dark:bg-ink-50 flex items-center justify-center px-4">
        <div className="bg-card dark:bg-muted rounded-2xl shadow-overlay max-w-md w-full p-5 text-center">
          <div className="w-14 h-14 rounded-full bg-negative/10 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[28px] text-negative">error</span>
          </div>
          <h2 className="text-[22px] font-semibold tracking-tight text-foreground mb-2">Invalid Invite</h2>
          <p className="text-muted-foreground text-sm mb-6">{error}</p>
          <Button variant="primary" size="md" onClick={() => navigate('/login')}>Go to Login</Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-brand-500/10 dark:bg-ink-50 flex items-center justify-center px-4">
        <div className="bg-card dark:bg-muted rounded-2xl shadow-overlay max-w-md w-full p-5 text-center">
          <div className="w-14 h-14 rounded-full bg-positive/10 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[28px] text-positive-dim">check_circle</span>
          </div>
          <h2 className="text-[22px] font-semibold tracking-tight text-foreground mb-2">You're in!</h2>
          <p className="text-muted-foreground text-sm">Joined <strong>{invite?.workspaceName}</strong>. Redirecting…</p>
        </div>
      </div>
    );
  }

  const emailMismatch = user && user.email.toLowerCase() !== invite.email.toLowerCase();

  return (
    <div className="min-h-screen bg-brand-500/10 dark:bg-ink-50 flex items-center justify-center px-4">
      <div className="bg-card dark:bg-muted rounded-2xl shadow-overlay max-w-md w-full overflow-hidden">

        {/* Header */}
        <div className="bg-brand-500 px-8 py-6 text-center">
          <div className="w-12 h-12 rounded-card bg-white/10 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-white text-[24px]" style={{fontVariationSettings:"'FILL' 1"}}>corporate_fare</span>
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Workspace Invitation</h1>
          <p className="text-brand-300 text-sm mt-1">You've been invited to collaborate</p>
        </div>

        <div className="px-8 py-6">
          {/* Invite details */}
          <div className="bg-paper-200 dark:bg-ink-50 border border-paper-400 dark:border-ink-400 rounded-card p-4 mb-6">
            <p className="text-xs font-medium text-muted-foreground mb-3">Invite Details</p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Workspace</span>
                <span className="text-sm font-semibold text-foreground">{invite.workspaceName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Invited email</span>
                <span className="text-sm text-muted-foreground">{invite.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your role</span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLE_COLOR[invite.role] || ROLE_COLOR.VIEWER}`}>
                  {invite.role}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Expires</span>
                <span className="text-sm text-muted-foreground">{new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {emailMismatch && (
            <div className="mb-4 p-3 bg-caution/10 border border-caution/25 rounded-card text-xs font-medium text-caution-dim">
              <strong>Wrong account.</strong> You're signed in as <strong>{user.email}</strong> but this invite is for <strong>{invite.email}</strong>. Sign out and use the correct Google account.
            </div>
          )}

          {/* Action buttons */}
          {!user ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Sign in with the Google account for <strong>{invite.email}</strong> to join this workspace.
              </p>
              <Button variant="secondary" size="lg" onClick={handleGoogleLogin}>
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </Button>
            </div>
          ) : emailMismatch ? (
            <Button variant="secondary" size="lg" onClick={() => navigate('/login')}>Sign in with a different account</Button>
          ) : (
            <Button variant="primary" size="lg" onClick={handleAccept} disabled={accepting}>
              {accepting
                ? <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Joining…</>
                : <><span className="material-symbols-outlined text-[18px]">person_add</span> Join {invite.workspaceName}</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
