import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

export default function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper-300 dark:bg-ink-50 flex-col gap-4">
        <div className="w-12 h-12 bg-brand-500 rounded-card flex items-center justify-center shadow-raised">
          <span className="material-symbols-outlined text-white text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>graphic_eq</span>
        </div>
        <Spinner size={28} className="text-brand-500" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
