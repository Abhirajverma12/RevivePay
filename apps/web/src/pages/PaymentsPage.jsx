import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowRight, RefreshCw, AlertCircle, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../utils/api.js';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [search, setSearch] = useState('');

  // Quick Simulation Modal state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simModalOpen, setSimModalOpen] = useState(false);
  const { merchant } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [simCustomerId, setSimCustomerId] = useState('');
  const [simAmount, setSimAmount] = useState(4999);
  const [simMethod, setSimMethod] = useState('upi');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        ...(merchant?.id ? { merchantId: merchant.id } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(reasonFilter ? { failureReason: reasonFilter } : {}),
        ...(search ? { search } : {}),
      });

      const res = await apiFetch(`/api/recovery/failed-payments?${queryParams}`);
      const data = await res.json();
      setPayments(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page, statusFilter, reasonFilter, merchant?.id]);

  // Load customers for modal
  useEffect(() => {
    apiFetch('/api/payments/customers')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCustomers(data);
          setSimCustomerId(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleTriggerSimulation = async () => {
    if (!simCustomerId) return;
    setIsSimulating(true);
    try {
      const res = await apiFetch('/api/payments/simulate-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: simCustomerId,
          amount: Number(simAmount),
          method: simMethod,
        }),
      });
      if (res.ok) {
        setSimModalOpen(false);
        fetchPayments();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Failed Transactions Console</h1>
            <span className="text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
              Simulated demo data
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor and resolve {total} payment declines across your active customer base.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSimModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-indigo-600/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Simulate New Failure
          </button>
          <button
            onClick={fetchPayments}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search customer name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPayments()}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="UNRESOLVED">Unresolved</option>
            <option value="RECOVERED">Recovered</option>
            <option value="IN_RECOVERY">In Recovery</option>
          </select>

          {/* Failure Reason Filter */}
          <select
            value={reasonFilter}
            onChange={(e) => {
              setReasonFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Failure Reasons</option>
            <option value="INSUFFICIENT_FUNDS">Insufficient Funds</option>
            <option value="NETWORK_ERROR">Network Error</option>
            <option value="BANK_ERROR">Bank Error</option>
            <option value="AUTHENTICATION_FAILED">Auth Failed</option>
            <option value="CARD_DECLINED">Card Declined</option>
            <option value="EXPIRED_CARD">Expired Card</option>
          </select>
        </div>

        <div className="text-[11px] text-slate-400">
          Showing <strong>{payments.length}</strong> of <strong>{total}</strong> records
        </div>
      </div>

      {/* Dense Payments Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Retries</th>
                <th className="py-3 px-4">Probability</th>
                <th className="py-3 px-4">Recommended Action</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading && payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-600" />
                    Loading failed payment records...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <AlertCircle className="w-5 h-5 mx-auto mb-2 text-slate-600" />
                    No failed payments matched the filter criteria.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.failedPaymentId} className="hover:bg-slate-800/40 transition">
                    {/* Customer */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{p.customerName}</div>
                      <div className="text-[10px] text-slate-400">{p.customerEmail}</div>
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">₹{p.amount.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400 uppercase">{p.method}</div>
                    </td>

                    {/* Reason */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {p.failure_reason}
                      </span>
                    </td>

                    {/* Retries */}
                    <td className="py-3 px-4 text-center font-mono">
                      {p.retry_count}
                    </td>

                    {/* Probability */}
                    <td className="py-3 px-4">
                      {p.recovery_probability !== null ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${
                            p.recovery_probability >= 0.75
                              ? 'text-emerald-400'
                              : p.recovery_probability >= 0.40
                              ? 'text-sky-400'
                              : 'text-rose-400'
                          }`}>
                            {(p.recovery_probability * 100).toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic text-[10px]">Pending</span>
                      )}
                    </td>

                    {/* Recommended Action */}
                    <td className="py-3 px-4">
                      {p.recommended_action ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          {p.recommended_action}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-[10px]">Unanalyzed</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.status === 'RECOVERED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : p.status === 'IN_RECOVERY'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {p.status}
                      </span>
                    </td>

                    {/* Action Button */}
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/payments/${p.paymentId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-sky-600 hover:text-white text-slate-300 transition text-[11px] font-medium"
                      >
                        Details
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Quick Simulate Modal */}
      {simModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Simulate Payment Failure</h3>
              <button
                onClick={() => setSimModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                &times; Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Customer</label>
                <select
                  value={simCustomerId}
                  onChange={(e) => setSimCustomerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (LTV: ₹{c.lifetime_value.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Amount (INR)</label>
                <input
                  type="number"
                  value={simAmount}
                  onChange={(e) => setSimAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Method</label>
                <select
                  value={simMethod}
                  onChange={(e) => setSimMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                >
                  <option value="upi">UPI</option>
                  <option value="card">Credit/Debit Card</option>
                  <option value="netbanking">Net Banking</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setSimModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerSimulation}
                disabled={isSimulating}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5"
              >
                {isSimulating ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                Trigger Failure
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
