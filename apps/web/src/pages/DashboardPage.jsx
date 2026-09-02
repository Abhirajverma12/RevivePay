import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  AlertOctagon,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Bot,
  RefreshCw,
  CreditCard,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

const FAILURE_COLORS = {
  BANK_ERROR: '#ef4444',
  INSUFFICIENT_FUNDS: '#f97316',
  NETWORK_ERROR: '#38bdf8',
  AUTHENTICATION_FAILED: '#a855f7',
  CARD_DECLINED: '#ec4899',
  EXPIRED_CARD: '#64748b',
};

import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../utils/api.js';

export default function DashboardPage() {
  const { merchant } = useAuth();
  const [revenue, setRevenue] = useState(null);
  const [failureReasons, setFailureReasons] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const merchantQuery = merchant?.id ? `?merchantId=${merchant.id}` : '';
      const [revRes, failRes, stratRes] = await Promise.all([
        apiFetch(`/api/analytics/revenue${merchantQuery}`),
        apiFetch(`/api/analytics/failure-reasons${merchantQuery}`),
        apiFetch(`/api/analytics/strategies${merchantQuery}`),
      ]);
      if (revRes.ok) setRevenue(await revRes.json());
      if (failRes.ok) setFailureReasons(await failRes.json());
      if (stratRes.ok) setStrategies(await stratRes.json());
    } catch (err) {
      console.error('Analytics fetch wait (waking up cloud backend):', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timer;

    const loadData = async () => {
      await fetchData();
      // If data is still null, retry in 3 seconds to catch Render waking up
      if (!cancelled && !revenue) {
        timer = setTimeout(loadData, 3000);
      }
    };

    loadData();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [merchant?.id, revenue !== null]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Merchant Recovery Dashboard</h1>
            <span className="text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
              Simulated demo data
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time revenue monitoring and AI-driven recovery operations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Metrics
          </button>
          <Link
            to="/payments"
            className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition"
          >
            <CreditCard className="w-3.5 h-3.5" />
            View Failed Payments
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue at Risk */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Revenue At Risk</span>
            <AlertOctagon className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            ₹{revenue ? revenue.revenueAtRisk.toLocaleString() : '---'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>{revenue ? revenue.totalFailedCount : 0} total failed transactions</span>
          </p>
        </div>

        {/* Recovered Revenue */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Recovered Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            ₹{revenue ? revenue.recoveredRevenue.toLocaleString() : '---'}
          </div>
          <p className="text-[11px] text-emerald-500 mt-1 flex items-center gap-1 font-medium">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{revenue ? revenue.recoveredCount : 0} payments recovered</span>
          </p>
        </div>

        {/* Recovery Rate */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Recovery Rate</span>
            <ShieldCheck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-400">
            {revenue ? `${(revenue.recoveryRate * 100).toFixed(1)}%` : '---'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Volumetric recovery across active cases
          </p>
        </div>

        {/* Pending Recoveries */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Recoveries</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {revenue ? revenue.pendingRecoveries : '---'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Actionable transactions awaiting execution
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Strategy Performance Bar Chart */}
        <div className="lg:col-span-7 p-5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">Recovery Strategy Performance</h2>
              <p className="text-[11px] text-slate-400">Attempts and success rate by autonomous strategy</p>
            </div>
            <Link to="/analytics" className="text-xs text-sky-400 hover:underline">
              Detailed Analytics &rarr;
            </Link>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={strategies} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis
                  dataKey="action"
                  stroke="#64748b"
                  fontSize={9}
                  tickFormatter={(val) => val.replace('_', ' ')}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                />
                <Bar dataKey="attempts" name="Attempts" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recovered" name="Recovered" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Failure Reasons Breakdown */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">Failure Reasons Breakdown</h2>
              <p className="text-[11px] text-slate-400">Gateway error distribution</p>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {failureReasons.reduce((sum, r) => sum + r.count, 0)} Total
            </span>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={failureReasons}
                  dataKey="count"
                  nameKey="failureReason"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={68}
                  paddingAngle={3}
                >
                  {failureReasons.map((entry) => (
                    <Cell
                      key={`cell-${entry.failureReason}`}
                      fill={FAILURE_COLORS[entry.failureReason] || '#64748b'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Compact Legend */}
          <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-slate-800 text-[11px]">
            {failureReasons.slice(0, 4).map((r) => (
              <div key={r.failureReason} className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: FAILURE_COLORS[r.failureReason] || '#64748b' }}
                  ></span>
                  <span className="truncate">{r.failureReason.replace('_', ' ')}</span>
                </span>
                <span className="font-semibold text-white ml-2">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Launchpad to Live Playground */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40 border border-sky-500/20 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <Bot className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white">Live AI Recovery Engine</h3>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-medium">
              Ready
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Simulate fresh failed payments on demand, run deterministic probability scoring, and execute recovery actions in real time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/agent"
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            View Activity Feed
          </Link>
          <Link
            to="/payments"
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/20 transition"
          >
            Open Recovery Console &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
