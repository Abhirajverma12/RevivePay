import React, { useState, useEffect } from 'react';
import { Bot, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api.js';

export default function AgentActivityPage() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/agent/activity?limit=40');
      const data = await res.json();
      setActivities(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Agent Autonomous Activity</h1>
            <span className="text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
              Simulated demo data
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit trail of autonomous recovery decisions, interventions, and financial resolutions.
          </p>
        </div>

        <button
          onClick={fetchActivity}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Activity Timeline Feed */}
      <div className="space-y-4">
        {loading && activities.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-600" />
            Loading autonomous agent activity feed...
          </div>
        ) : activities.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs bg-slate-900/60 rounded-xl border border-slate-800">
            No agent decisions recorded yet. Simulate a failed payment in the console to trigger agent decisions.
          </div>
        ) : (
          activities.map((act) => {
            const customer = act.failed_payment?.payment?.customer;
            const payment = act.failed_payment?.payment;
            const intervention = act.interventions?.[0];
            const outcome = intervention?.recovery_outcome;

            return (
              <div
                key={act.id}
                className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">
                          {act.action}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          act.status === 'EXECUTED'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : act.status === 'PENDING_APPROVAL'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-sky-500/15 text-sky-300'
                        }`}>
                          {act.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Target: <strong className="text-slate-200">{customer?.name || 'Customer'}</strong> &bull; Amount: ₹{payment?.amount?.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-400 font-mono text-[11px]">
                      {new Date(act.decided_at).toLocaleString()}
                    </span>
                    {payment && (
                      <Link
                        to={`/payments/${payment.id}`}
                        className="text-sky-400 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        Inspect &rarr;
                      </Link>
                    )}
                  </div>
                </div>

                {/* Reasoning */}
                <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-850">
                  "{act.reason}"
                </p>

                {/* Intervention & Outcome Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 pt-1">
                  <div className="flex items-center gap-3">
                    <span>Confidence: <strong>{(act.confidence * 100).toFixed(0)}%</strong></span>
                    <span>Expected Recovery: <strong>₹{act.expected_recovery?.toLocaleString()}</strong></span>
                    {act.delay_hours && <span>Delay: <strong>{act.delay_hours}h</strong></span>}
                  </div>

                  {outcome && (
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold flex items-center gap-1 ${
                        outcome.recovered ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {outcome.recovered
                          ? `Recovered ₹${outcome.amount_recovered.toLocaleString()}`
                          : 'Unrecovered'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
