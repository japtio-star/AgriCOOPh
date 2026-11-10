/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, MemoryRouter, Routes, Route, Navigate } from 'react-router';
import { DEMO } from './lib/session';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Cooperatives from './pages/Cooperatives';
import Reports from './pages/Reports';
import CommandCenter from './pages/CommandCenter';
import Departments from './pages/Departments';
import DepartmentDetail from './pages/DepartmentDetail';
import Issues from './pages/Issues';
import Decisions from './pages/Decisions';
import Layout from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { currentUser, isExecutive } from './lib/exec';

const EXEC = ['Executive', 'Super Admin'];
// The static preview has no server to serve page URLs, so it keeps routes in memory.
const Router = DEMO ? MemoryRouter : BrowserRouter;

// Home depends on role: CEO sees the command center, unit heads their department.
function Home() {
  const user = currentUser();
  if (isExecutive(user)) return <CommandCenter />;
  if (user.role === 'Department Head' && user.dept_id) return <Navigate to={`/departments/${user.dept_id}`} replace />;
  return <Dashboard />;
}

function page(element: React.ReactNode, roles?: string[]) {
  return (
    <ProtectedRoute requiredRole={roles}>
      <Layout>{element}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={page(<Home />)} />
        <Route path="/departments" element={page(<Departments />, EXEC)} />
        <Route path="/departments/:id" element={page(<DepartmentDetail />, [...EXEC, 'Department Head'])} />
        <Route path="/issues" element={page(<Issues />, [...EXEC, 'Department Head'])} />
        <Route path="/decisions" element={page(<Decisions />, EXEC)} />
        <Route path="/dashboard" element={page(<Dashboard />)} />
        <Route path="/members" element={page(<Members />)} />
        <Route path="/cooperatives" element={page(<Cooperatives />, EXEC)} />
        <Route path="/reports" element={page(<Reports />)} />
      </Routes>
    </Router>
  );
}
