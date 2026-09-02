import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ArrowRight, RefreshCw, AlertCircle, Sparkles, Building2 } from 'lucide-react';

export default function LoginPage() {
  const { login, signup, quickLogin } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('billing@saasifycloud.io');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demoMerchants = [
    {
      name: 'SaaSify Cloud',
      email: 'billing@saasifycloud.io',
      tag: 'SaaS B2B &bull; ₹45k threshold',
    },
    {
      name: 'Aura Lifestyle',
      email: 'finance@auralifestyle.in',
      tag: 'E-commerce &bull; ₹25k threshold',
    },
    {
      name: 'QuickBite Logistics',
      email: 'payments@quickbitedeliver.com',
      tag: 'Hyperlocal &bull; ₹15k threshold',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const res = await login(email, password);
        if (res.success) {
          navigate('/dashboard');
        } else {
          setError(res.error || 'Invalid email or password');
        }
      } else {
        const res = await signup(name, email, password);
        if (res.success) {
          navigate('/dashboard');
        } else {
          setError(res.error || 'Registration failed');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await quickLogin(demoEmail);
      if (res.success) {
        navigate('/dashboard');
      } else {
        setError(res.error || 'Demo login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-6">
        {/* Card */}
        <div className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6 backdrop-blur">
          <div className="text-center space-y-2">
            <div className="h-11 w-11 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 mx-auto font-black text-xl shadow-lg shadow-sky-500/10">
              ⚡
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              {mode === 'signin' ? 'Merchant Sign In' : 'Create Merchant Account'}
            </h1>
            <p className="text-xs text-slate-400">
              {mode === 'signin'
                ? 'Sign in to access your autonomous revenue recovery console.'
                : 'Configure automated guardrails and launch recovery agents.'}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 py-1.5 font-semibold rounded-md transition ${
                mode === 'signin'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-1.5 font-semibold rounded-md transition ${
                mode === 'signup'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              New Merchant
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {mode === 'signup' && (
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Company / Merchant Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Payments Pvt Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Merchant Email</label>
              <input
                type="email"
                required
                placeholder="billing@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition shadow-lg shadow-sky-600/20 text-xs"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In to Dashboard' : 'Complete Registration'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* 1-Click Demo Logins */}
          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                1-Click Demo Profiles
              </span>
              <span className="text-[10px] text-amber-400">Preloaded demo data</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {demoMerchants.map((dm) => (
                <button
                  key={dm.email}
                  type="button"
                  onClick={() => handleQuickDemoLogin(dm.email)}
                  disabled={loading}
                  className="w-full p-2.5 rounded-lg bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 text-left transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-400" />
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-sky-300 transition">
                        {dm.name}
                      </div>
                      <div className="text-[10px] text-slate-400" dangerouslySetInnerHTML={{ __html: dm.tag }}></div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-sky-400 group-hover:translate-x-0.5 transition">
                    Use Profile &rarr;
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Secured via bcrypt &amp; signed HMAC-SHA256 JWT tokens</span>
        </div>
      </div>
    </div>
  );
}
