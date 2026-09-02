import React, { useState, useEffect } from 'react';
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
import { RefreshCw, BarChart3, PieChart as PieIcon } from 'lucide-react';
import { apiFetch } from '../utils/api.js';

const COLORS = ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#f87171', '#a78bfa', '#94a3b8'];

export default function AnalyticsPage() {
  const [strategies, setStrategies] = useState([]);
  const [failureReasons, setFailureReasons] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [stratRes, failRes] = await Promise.all([
        apiFetch('/api/analytics/strategies'),
        apiFetch('/api/analytics/failure-reasons'),
      ]);
      setStrategies(await stratRes.json());
      setFailureReasons(await failRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Strategy &amp; Decline Analytics</h1>
            <span className="text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
              Simulated demo data
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Deep-dive performance metrics across autonomous strategies and gateway declination buckets.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Grid: 2 Large Chart Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Strategy Breakdown Chart */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-400" />
                Strategy Conversion Rates
              </h2>
              <p className="text-[11px] text-slate-400">Total recovery attempts vs successful collections</p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={strategies} margin={{ top: 20, right: 20, left: -20, bottom: 25 }}>
                <XAxis
                  dataKey="action"
                  stroke="#64748b"
                  fontSize={10}
                  tickFormatter={(val) => val.replace('_', ' ')}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                />
                <Bar dataKey="attempts" name="Total Interventions" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recovered" name="Successful Recoveries" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Failure Reasons Recoveries */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-indigo-400" />
                Decline Volume by Reason
              </h2>
              <p className="text-[11px] text-slate-400">Transaction counts across failure categories</p>
            </div>
          </div>

          <div className="h-72 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={failureReasons}
                  dataKey="count"
                  nameKey="failureReason"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={50}
                  paddingAngle={3}
                >
                  {failureReasons.map((entry, index) => (
                    <Cell key={`cell-${entry.failureReason}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Strategies Detailed Table */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white">Full Strategy Performance Audit</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold text-[11px] uppercase">
                <th className="py-2.5 px-3">Strategy</th>
                <th className="py-2.5 px-3 text-center">Interventions</th>
                <th className="py-2.5 px-3 text-center">Recovered</th>
                <th className="py-2.5 px-3 text-center">Conversion Rate</th>
                <th className="py-2.5 px-3 text-right">Recovered Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y border-slate-800/60 text-slate-300">
              {strategies.map((s) => (
                <tr key={s.action} className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-3 font-semibold text-white">{s.action}</td>
                  <td className="py-2.5 px-3 text-center font-mono">{s.attempts}</td>
                  <td className="py-2.5 px-3 text-center font-mono">{s.recovered}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-emerald-400">
                    {(s.successRate * 100).toFixed(0)}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-white">
                    ₹{s.amountRecovered.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
