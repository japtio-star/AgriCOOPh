import React from 'react';
import { Navigate, useLocation } from 'react-router';
import { session } from '../lib/session';

export function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode, requiredRole?: string | string[] }) {
  const token = session.token();
  const user = session.user();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const allowed = requiredRole ? (Array.isArray(requiredRole) ? requiredRole : [requiredRole]) : null;
  if (allowed && !allowed.includes(user.role) && user.role !== 'Super Admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
