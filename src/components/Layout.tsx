import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { LayoutDashboard, Users, Building2, FileText, Menu, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('amds_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('amds_token');
    localStorage.removeItem('amds_user');
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Member Directory', href: '/members', icon: Users },
    { name: 'Cooperative Units', href: '/cooperatives', icon: Building2 },
    { name: 'M&E Reports', href: '/reports', icon: FileText },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-[#0F172A] text-slate-300 flex flex-col shrink-0 hidden md:flex">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800 h-16 shrink-0">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center font-bold text-white text-lg">A</div>
          <div className="leading-tight">
            <h1 className="text-white font-bold text-sm tracking-tight">AgriCOOPh</h1>
            <p className="text-[10px] opacity-60 uppercase">AMDS Federation</p>
          </div>
        </div>
        
        <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
          <div className="px-6 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Main Menu</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
            
            if (item.name === 'Cooperative Units' && user.role !== 'Super Admin') return null;

            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center px-6 py-3 text-sm transition-all duration-150 ease-in-out",
                  isActive 
                    ? "bg-[#0F172A] border-l-4 border-emerald-500 text-white" 
                    : "text-slate-300 hover:bg-[#1E293B] border-l-4 border-transparent"
                )}
              >
                <Icon className={cn("mr-3 flex-shrink-0 h-4 w-4", isActive ? "text-emerald-500" : "text-slate-400")} />
                {item.name}
              </Link>
            );
          })}
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
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-white p-1 rounded-md"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F1F5F9]">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center">
            <button className="mr-4 text-slate-500 hover:text-slate-700 focus:outline-none md:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-900 hidden md:block">Dashboard Overview</h2>
              <p className="text-[11px] text-slate-500 hidden md:block">Real-time data aggregation across cooperatives</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="relative hidden sm:block">
               <input type="text" placeholder="Search database..." className="bg-slate-100 border-none text-xs rounded-lg px-4 py-2 w-64 focus:ring-2 focus:ring-emerald-500 outline-none" />
             </div>
             <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center cursor-pointer hover:bg-slate-200">
               <span className="text-sm">🔔</span>
             </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {children}
        </div>

        <footer className="h-8 bg-white border-t border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-[10px] text-slate-400 font-medium">
            <span>AMDS v1.0.0 Stable</span>
            <span>•</span>
            <span>Philippines (PST)</span>
          </div>
          <div className="flex gap-2 items-center">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tight">System Online</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
