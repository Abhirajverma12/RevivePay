import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CreditCard, Bot, BarChart3, LogOut, User, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar({ apiStatus }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { merchant, logout } = useAuth();

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Payments', path: '/payments', icon: CreditCard },
    { label: 'Agent Activity', path: '/agent', icon: Bot },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  ];

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Left: Brand */}
        <Link to="/dashboard" className="flex items-center space-x-2.5 group flex-shrink-0">
          <div className="h-8 w-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold shadow-sm group-hover:scale-105 transition">
            ⚡
          </div>
          <span className="text-lg font-bold tracking-tight text-white group-hover:text-sky-300 transition">
            Revive<span className="text-sky-400">Pay</span>
          </span>
        </Link>

        {/* Center: Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path === '/dashboard' && location.pathname === '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Status & Profile */}
        <div className="flex items-center space-x-3 flex-shrink-0">
          {/* Simulated Demo Badge */}
          <span className="text-[10px] font-medium bg-amber-500/10 text-amber-400/90 border border-amber-500/20 px-2 py-0.5 rounded-full hidden sm:inline-block">
            Simulated Demo
          </span>

          {/* API Health Pill */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-[11px]">
            {apiStatus === 'connected' ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-emerald-400 font-medium">Online</span>
              </>
            ) : apiStatus === 'checking' ? (
              <span className="text-amber-400">Connecting...</span>
            ) : (
              <span className="text-rose-400">Offline</span>
            )}
          </div>

          {/* Merchant Profile */}
          {merchant ? (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
              <div className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/80">
                <Building2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-200 max-w-[120px] lg:max-w-[160px] truncate">
                  {merchant.name}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 border border-slate-700/80 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition shadow-sm"
            >
              <User className="w-3.5 h-3.5" />
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
