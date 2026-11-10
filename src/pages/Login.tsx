import React, { useState } from 'react';
import { useNavigate } from 'react-router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('amds_token', data.token);
      localStorage.setItem('amds_user', JSON.stringify(data.user));
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-white text-2xl shadow-sm border border-emerald-400">
          A
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-slate-900 tracking-tight">
          AgriCOOPh
        </h2>
        <p className="mt-2 text-center text-[11px] text-slate-500 uppercase tracking-widest font-bold">
          AMDS Federation Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl sm:px-10 border border-slate-200">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold border border-red-100 uppercase tracking-widest text-center">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-widest">
                Email Address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@agricooph.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-widest">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="admin123"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors uppercase tracking-widest"
              >
                Secure Login
              </button>
            </div>
          </form>
          
          <div className="mt-8 border-t border-slate-100 pt-6">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Test Accounts:</h4>
            <ul className="text-xs text-slate-500 space-y-2">
              <li className="flex justify-between"><span>CEO:</span> <code className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono">ceo@agricooph.com</code></li>
              <li className="flex justify-between"><span>SMS Unit Head:</span> <code className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono">sms.head@agricooph.com</code></li>
              <li className="flex justify-between"><span>Super Admin:</span> <code className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono">admin@agricooph.com</code></li>
              <li className="flex justify-between"><span>Coop Admin:</span> <code className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono">coop1@agricooph.com</code></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
