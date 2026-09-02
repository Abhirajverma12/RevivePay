import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PaymentsPage from './pages/PaymentsPage.jsx';
import PaymentDetailPage from './pages/PaymentDetailPage.jsx';
import AgentActivityPage from './pages/AgentActivityPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';

import { apiFetch } from './utils/api.js';
import { AuthProvider } from './context/AuthContext.jsx';

export default function App() {
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    let timer;

    const checkHealth = async () => {
      try {
        const res = await apiFetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok' && !cancelled) {
            setApiStatus('connected');
            return;
          }
        }
      } catch (err) {
        // Backend still spinning up from sleep
      }

      if (!cancelled) {
        setApiStatus('checking');
        timer = setTimeout(checkHealth, 2500);
      }
    };

    checkHealth();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
          <Navbar apiStatus={apiStatus} />

          {apiStatus === 'checking' && (
            <div className="bg-sky-950/80 border-b border-sky-500/30 px-4 py-2 text-center text-xs text-sky-200 flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
              <span>
                Waking up cloud backend (Render free tier cold start ~30s)... Metrics will populate automatically once connected.
              </span>
            </div>
          )}

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/payments/:id" element={<PaymentDetailPage />} />
              <Route path="/agent" element={<AgentActivityPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>

          <footer className="border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500 bg-slate-950/80">
            RevivePay &bull; Razorpay AI Buildathon (Revenue Recovery Track) &bull; Monorepo Local Instance
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}
