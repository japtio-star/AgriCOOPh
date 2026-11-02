/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Cooperatives from './pages/Cooperatives';
import Reports from './pages/Reports';
import Layout from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

const VirtualOffice = lazy(() => import('./pages/VirtualOffice'));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/members" element={
          <ProtectedRoute>
            <Layout>
              <Members />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/cooperatives" element={
          <ProtectedRoute requiredRole="Super Admin">
            <Layout>
              <Cooperatives />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/office" element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading virtual office…</div>}>
                <VirtualOffice />
              </Suspense>
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/reports" element={
          <ProtectedRoute>
            <Layout>
              <Reports />
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
