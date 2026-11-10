import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { LayoutDashboard, Users, Building2, FileText, Menu, LogOut, Gauge, Network, AlertTriangle, BookOpenCheck, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { isExecutive } from '../lib/exec';

type NavItem = { name: string; href: string; icon: any };

function navFor(user: any): { section: string; items: NavItem[] }[] {
  if (isExecutive(user)) {
    return [
      {
        section: 'Executive',
        items: [
          { name: 'Command Center', href: '/', icon: Gauge },
          { name: 'Departments', href: '/departments', icon: Network },
          { name: 'Issues', href: '/issues', icon: AlertTriangle },
          { name: 'Decision Log', href: '/decisions', icon: BookOpenCheck },
        ],
      },
      {
        section: 'Membership',
        items: [
          { name: 'Membership Overview', href: '/dashboard', icon: LayoutDashboard },
          { name: 'Member Directory', href: '/members', icon: Users },
          { name: 'Cooperative Units', href: '/cooperatives', icon: Building2 },
          { name: 'M&E Reports', href: '/reports', icon: FileText },
        ],
      },
    ];
  }
  if (user.role === 'Department Head') {
    return [{
      section: 'My Department',
      items: [
        { name: 'Department Dashboard', href: `/departments/${user.dept_id}`, icon: Gauge },
        { name: 'Issues', href: '/issues', icon: AlertTriangle },
      ],
    }];
  }
  return [{
    section: 'Main Menu',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Member Directory', href: '/members', icon: Users },
      { name: 'M&E Reports', href: '/reports', icon: FileText },
    ],
  }];
}

function titleFor(path: string): [string, string] {
  if (path === '/') return ['Command Center', 'One view of all services and support units'];
  if (path === '/departments') return ['Departments', 'Income services and support units'];
  if (path.startsWith('/departments/')) return ['Department', 'KPIs, finances, issues and decisions'];
  if (path === '/issues') return ['Issues', 'Escalations tracked until resolved'];
  if (path === '/decisions') return ['Decision Log', 'Decisions and the evidence behind them'];
  if (path === '/members') return ['Member Directory', 'Members across the federation'];
  if (path === '/cooperatives') return ['Cooperative Units', 'Member cooperatives'];
  if (path === '/reports') return ['M&E Reports', 'Reports submitted by member cooperatives'];
  return ['Membership Overview', 'Data across member cooperatives'];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem('amds_user') || '{}');
  const groups = navFor(user);
  let [title, subtitle] = titleFor(location.pathname);
  if (location.pathname === '/' && !isExecutive(user)) [title, subtitle] = ['Dashboard Overview', 'Real-time data aggregation across cooperatives'];

  const handleLogout = () => {
    localStorage.removeItem('amds_token');
    localStorage.removeItem('amds_user');
    navigate('/login');
  };

  const sidebar = (
    <aside className="w-60 h-full bg-[#0F172A] text-slate-300 flex flex-col shrink-0">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800 h-16 shrink-0">
        <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center font-bold text-white text-lg">A</div>
        <div className="leading-tight flex-1">
          <h1 className="text-white font-bold text-sm tracking-tight">AgriCOOPh</h1>
          <p className="text-[10px] opacity-60 uppercase">Federation Management</p>
        </div>
        <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setOpen(false)} aria-label="Close menu"><X className="w-4 h-4" /></button>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
        {groups.map((g) => (
          <div key={g.section} className="mb-2">
            <div className="px-6 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{g.section}</div>
            {g.items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href + '/'));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center px-6 py-2.5 text-sm transition-all duration-150 ease-in-out',
                    isActive ? 'bg-[#1E293B] border-l-4 border-emerald-500 text-white' : 'text-slate-300 hover:bg-[#1E293B] border-l-4 border-transparent'
                  )}
                >
                  <Icon className={cn('mr-3 flex-shrink-0 h-4 w-4', isActive ? 'text-emerald-500' : 'text-slate-400')} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-800 bg-[#0a101f] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white uppercase font-bold">
            {user.name ? user.name.substring(0, 2) : 'SA'}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs text-white truncate">{user.name}</p>
            <p className="text-[10px] text-emerald-400 truncate">{user.role}</p>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white p-1 rounded-md" title="Logout" aria-label="Logout">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="hidden md:flex">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          {sidebar}
          <div className="flex-1 bg-slate-900/40" onClick={() => setOpen(false)} />
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0 bg-[#F1F5F9]">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center">
            <button className="mr-4 text-slate-500 hover:text-slate-700 focus:outline-none md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">{title}</h2>
              <p className="text-[11px] text-slate-500 hidden md:block">{subtitle}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
          {children}
        </div>

        <footer className="h-8 bg-white border-t border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-[10px] text-slate-400 font-medium">
            <span>AMDS v1.1.0</span>
            <span>•</span>
            <span>Philippines (PST)</span>
          </div>
          <div className="flex gap-2 items-center">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tight">Online</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
