import React from 'react';
import { Navigate, useLocation } from 'react-router';

export function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode, requiredRole?: string }) {
  const token = localStorage.getItem('amds_token');
  const user = JSON.parse(localStorage.getItem('amds_user') || 'null');
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user.role !== requiredRole && user.role !== 'Super Admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
