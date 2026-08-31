import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const ROLE_COLOR = {
  ADMIN:  "bg-[#e2dfff] text-[#0d9488] border-[#0d9488]/20 dark:bg-indigo-900/30 dark:text-teal-300 dark:border-teal-700",
  EDITOR: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  VIEWER: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600",
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
      <div className="min-h-screen bg-[#f0fdfa] dark:bg-slate-900 flex items-center justify-center">
        <span className="material-symbols-outlined text-[40px] text-[#0d9488] animate-spin">progress_activity</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f0fdfa] dark:bg-slate-900 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[28px] text-red-500">error</span>
          </div>
          <h2 className="text-[22px] font-extrabold tracking-tight text-zinc-900 dark:text-slate-100 mb-2">Invalid Invite</h2>
          <p className="text-zinc-500 dark:text-slate-400 text-sm mb-6">{error}</p>
          <button onClick={() => navigate('/login')}
            className="px-6 py-2.5 bg-[#0d9488] text-white rounded-xl text-sm font-semibold hover:bg-[#0f766e] transition-colors">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#f0fdfa] dark:bg-slate-900 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[28px] text-emerald-600">check_circle</span>
          </div>
          <h2 className="text-[22px] font-extrabold tracking-tight text-zinc-900 dark:text-slate-100 mb-2">You're in!</h2>
          <p className="text-zinc-500 dark:text-slate-400 text-sm">Joined <strong>{invite?.workspaceName}</strong>. Redirecting…</p>
        </div>
      </div>
    );
  }

  const emailMismatch = user && user.email.toLowerCase() !== invite.email.toLowerCase();

  return (
    <div className="min-h-screen bg-[#f0fdfa] dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden">

        {/* Header */}
        <div className="bg-[#0d9488] px-8 py-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-white text-[24px]" style={{fontVariationSettings:"'FILL' 1"}}>corporate_fare</span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-white">Workspace Invitation</h1>
          <p className="text-[#c7bfff] text-sm mt-1">You've been invited to collaborate</p>
        </div>

        <div className="px-8 py-6">
          {/* Invite details */}
          <div className="bg-zinc-50 dark:bg-slate-900 border border-zinc-100 dark:border-slate-700 rounded-xl p-4 mb-6">
            <p className="text-xs font-medium text-zinc-400 dark:text-slate-500 uppercase tracking-wider mb-3">Invite Details</p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500 dark:text-slate-400">Workspace</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-slate-100">{invite.workspaceName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500 dark:text-slate-400">Invited email</span>
                <span className="text-sm text-zinc-700 dark:text-slate-300">{invite.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500 dark:text-slate-400">Your role</span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ROLE_COLOR[invite.role] || ROLE_COLOR.VIEWER}`}>
                  {invite.role}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500 dark:text-slate-400">Expires</span>
                <span className="text-sm text-zinc-500 dark:text-slate-400">{new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {emailMismatch && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-700">
              <strong>Wrong account.</strong> You're signed in as <strong>{user.email}</strong> but this invite is for <strong>{invite.email}</strong>. Sign out and use the correct Google account.
            </div>
          )}

          {/* Action buttons */}
          {!user ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500 dark:text-slate-400 text-center mb-4">
                Sign in with the Google account for <strong>{invite.email}</strong> to join this workspace.
              </p>
              <button onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 py-3 border border-zinc-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700 transition-colors">
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </button>
            </div>
          ) : emailMismatch ? (
            <button onClick={() => navigate('/login')}
              className="w-full py-3 border border-zinc-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-zinc-600 dark:text-slate-400 hover:bg-zinc-50 dark:hover:bg-slate-700 transition-colors">
              Sign in with a different account
            </button>
          ) : (
            <button onClick={handleAccept} disabled={accepting}
              className="w-full py-3 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {accepting
                ? <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Joining…</>
                : <><span className="material-symbols-outlined text-[18px]">person_add</span> Join {invite.workspaceName}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
