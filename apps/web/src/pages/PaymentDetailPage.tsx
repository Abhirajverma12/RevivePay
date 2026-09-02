import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  User,
  History,
} from 'lucide-react';

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Recovery & Decision Actions
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<any>(null);

  const fetchDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/recovery/${id}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleRunAnalysisAndAgent = async () => {
    if (!id) return;
    setIsAnalyzing(true);
    try {
      // Analyze and formulate AI decision
      const res = await fetch(`/api/agent/decide/${id}`, { method: 'POST' });
      if (res.ok) {
        await fetchDetails();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExecuteRecovery = async () => {
    if (!id) return;
    setIsRecovering(true);
    setRecoveryMessage(null);
    try {
      const res = await fetch(`/api/recovery/${id}/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceImmediateForDemo: true }),
      });
      const result = await res.json();
      setRecoveryMessage(result);
      await fetchDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRecovering(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-slate-500 text-xs">
        <RefreshCw className="w-6 h-6 animate-spin mb-2 text-sky-400" />
        Loading transaction recovery details...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">Payment Record Not Found</h2>
        <p className="text-xs text-slate-400">The requested transaction identifier could not be located.</p>
        <Link to="/payments" className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to failed payments
        </Link>
      </div>
    );
  }

  const { payment, prediction, customer, policy, attempts, actions } = data;
  const latestAction = actions?.[0];
  const isRecovered = payment.status === 'RECOVERED';

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Back Button & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/payments"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to console
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Recovery Analysis: <span className="font-mono text-sky-400">{payment.id.slice(0, 12)}...</span>
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              isRecovered
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
            }`}>
              {payment.status}
            </span>
            <span className="text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
              Simulated demo data
            </span>
          </div>
        </div>

        {/* Action Buttons for Demo Driving */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunAnalysisAndAgent}
            disabled={isAnalyzing}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition"
          >
            {isAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-sky-400" />}
            Re-run AI Analysis
          </button>

          <button
            onClick={handleExecuteRecovery}
            disabled={isRecovering || isRecovered}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
          >
            {isRecovering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {isRecovered ? 'Already Recovered' : 'Run Recovery'}
          </button>
        </div>
      </div>

      {/* Outcome Banner if just executed */}
      {recoveryMessage && (
        <div className={`p-4 rounded-xl text-xs border ${
          recoveryMessage.outcome?.recovered
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
        } animate-fadeIn`}>
          <div className="flex items-center justify-between font-bold mb-1">
            <span className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {recoveryMessage.outcome?.recovered
                ? `Recovery Successful! Recovered ₹${recoveryMessage.outcome.amount_recovered.toLocaleString()}`
                : 'Recovery Execution Completed (Gateway Decline)'}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
              Intervention #{recoveryMessage.intervention?.id.slice(0, 8)}
            </span>
          </div>
          <p className="text-xs text-slate-300">{recoveryMessage.message}</p>
        </div>
      )}

      {/* 🌟 HERO AI ANALYSIS BLOCK (Prominent, Non-Buried, High-Contrast) */}
      <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-sky-500/40 shadow-2xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-md shadow-sky-500/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Autonomous Recovery Intelligence
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Model: rule-based-v1 + AI Agent
                </span>
              </h2>
              <p className="text-xs text-slate-400">Deterministic scoring bound by strict external merchant policies</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Policy Guardrail:</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
              latestAction?.status === 'PENDING_APPROVAL'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {latestAction?.status || 'AUTO_APPROVED'}
            </span>
          </div>
        </div>

        {/* 3 Prominent Metrics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Recovery Probability */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Recovery Probability
            </span>
            <div className="text-3xl font-extrabold text-sky-400">
              {prediction ? `${(prediction.recovery_probability * 100).toFixed(1)}%` : '---'}
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-sky-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${prediction ? prediction.recovery_probability * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          {/* Expected Recovery */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Expected Recovery Value
            </span>
            <div className="text-3xl font-extrabold text-emerald-400">
              ₹{prediction ? prediction.expected_recovery.toLocaleString() : '---'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {prediction ? `₹${payment.amount.toLocaleString()} × ${(prediction.recovery_probability * 100).toFixed(1)}%` : ''}
            </p>
          </div>

          {/* Recommended Action */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Optimal Strategy
            </span>
            <div className="text-2xl font-black text-indigo-400 truncate">
              {latestAction ? latestAction.action : 'IMMEDIATE_RETRY'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Confidence: {latestAction ? `${(latestAction.confidence * 100).toFixed(0)}%` : '85%'}
            </p>
          </div>
        </div>

        {/* 🌟 PROMINENT AGENT REASONING BLOCK */}
        <div className="p-5 rounded-xl bg-slate-950/90 border border-sky-500/30 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
              AI Agent Contextual Reasoning
            </span>
            {latestAction?.delay_hours && (
              <span className="text-indigo-400 flex items-center gap-1 text-[11px]">
                <Clock className="w-3.5 h-3.5" /> Delay Window: {latestAction.delay_hours} Hours
              </span>
            )}
          </div>

          <p className="text-sm md:text-base font-medium text-white leading-relaxed p-4 rounded-lg bg-slate-900/60 border border-slate-800">
            "{latestAction?.reason || 'Calculated high probability of successful collection upon immediate rail retry.'}"
          </p>

          <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500 font-mono">
            <span>Action ID: #{latestAction?.id || 'sim-action-01'}</span>
            <span>Policy Retries Cap: {policy?.max_retries || 3}</span>
          </div>
        </div>
      </div>

      {/* Context Details Grid (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Customer Context Block */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-sky-400" />
            Customer Historical Context
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-850">
              <span className="text-slate-500 block text-[10px] uppercase">Name &amp; Email</span>
              <div className="font-semibold text-white mt-0.5">{customer.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{customer.email}</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-850">
              <span className="text-slate-500 block text-[10px] uppercase">Lifetime Value</span>
              <div className="font-bold text-white text-base mt-0.5">
                ₹{customer.lifetime_value.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400">High-value account tier</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-850">
              <span className="text-slate-500 block text-[10px] uppercase">Historical Recovery Rate</span>
              <div className="font-bold text-emerald-400 text-base mt-0.5">
                {(customer.historical_recovery_rate * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] text-slate-400">Prior successful recoveries</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-850">
              <span className="text-slate-500 block text-[10px] uppercase">Payment History</span>
              <div className="font-bold text-white text-base mt-0.5">
                {customer.successful_payments} S / {customer.failed_payments} F
              </div>
              <div className="text-[10px] text-slate-400">Successful vs Failed</div>
            </div>
          </div>
        </div>

        {/* Payment & Attempts Timeline */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-sky-400" />
            Gateway Attempts &amp; Declines
          </h3>

          <div className="space-y-2.5 text-xs">
            {attempts?.map((att: any) => (
              <div
                key={att.id}
                className="p-3 rounded-lg bg-slate-950/60 border border-slate-850 flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>Attempt #{att.attempt_number}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                      att.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {att.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{att.error_message || 'Transaction approved'}</div>
                </div>

                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(att.attempted_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
