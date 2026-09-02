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
    apiFetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok') {
          setApiStatus('connected');
        } else {
          setApiStatus('disconnected');
        }
      })
      .catch(() => setApiStatus('disconnected'));
  }, []);

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
          <Navbar apiStatus={apiStatus} />

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
