import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

export default function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] dark:bg-slate-900 flex-col gap-4">
        <div className="w-12 h-12 bg-[#0f766e] rounded-xl flex items-center justify-center shadow-lg">
          <span className="material-symbols-outlined text-white text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>graphic_eq</span>
        </div>
        <Spinner size={28} className="text-[#0d9488]" />
        <p className="text-sm text-[#64748b] dark:text-slate-400" style={{fontFamily:'JetBrains Mono, monospace'}}>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
