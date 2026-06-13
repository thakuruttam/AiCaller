import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const TIER_ORDER = ['TRIAL', 'BASIC', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE', 'ENTERPRISE_PLUS'];

const TIER_BADGE = {
  TRIAL:          'bg-zinc-100 text-zinc-600 border-zinc-200',
  BASIC:          'bg-amber-50 text-amber-700 border-amber-200',
  STANDARD:       'bg-sky-50 text-sky-700 border-sky-200',
  PROFESSIONAL:   'bg-[#e2dfff] text-[#0d9488] border-[#0d9488]/20',
  ENTERPRISE:     'bg-teal-50 text-teal-700 border-teal-200',
  ENTERPRISE_PLUS:'bg-gradient-to-r from-teal-600 to-teal-700 text-white border-transparent',
};


function formatPaise(paise) {
  const rs = paise / 100;
  return rs >= 100000
    ? `₹${(rs / 100000).toFixed(1)}L`
    : rs >= 1000
    ? `₹${(rs / 1000).toFixed(0)}K`
    : `₹${rs}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Billing() {
  const { addToast } = useToast();

  const [billing, setBilling] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [billRes, histRes] = await Promise.all([
        api.get('/api/billing'),
        api.get('/api/billing/history'),
      ]);
      setBilling(billRes.data);
      setHistory(histRes.data);
    } catch {
      addToast('Failed to load billing info', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load Razorpay checkout script once
  useEffect(() => {
    if (document.getElementById('razorpay-script')) return;
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    document.body.appendChild(script);
  }, []);

  const razorpayConfigured = import.meta.env.VITE_RAZORPAY_KEY_ID &&
    !import.meta.env.VITE_RAZORPAY_KEY_ID.includes('REPLACE_ME');

  const handleTopUp = async () => {
    if (!selectedPackId) { addToast('Select a pack first', 'error'); return; }
    if (!razorpayConfigured) {
      addToast('Payment gateway not configured. Add your Razorpay keys to .env first.', 'error');
      return;
    }
    const pack = billing.packs.find(p => p.id === selectedPackId);
    if (!pack) return;
    setPaying(true);
    try {
      const { data: order } = await api.post('/api/billing/order', { packId: pack.id });

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'AI Caller Pro',
        description: `${pack.label} — ${pack.minutes} minutes`,
        order_id: order.orderId,
        handler: async (response) => {
          try {
            await api.post('/api/billing/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            addToast(`${pack.minutes} minutes added to your account!`, 'success');
            setSelectedPackId(null);
            await load();
          } catch {
            addToast('Payment verification failed. Contact support.', 'error');
          }
        },
        prefill: {},
        theme: { color: '#0d9488' },
        modal: { ondismiss: () => setPaying(false) },
      };

      const rp = new window.Razorpay(options);
      rp.open();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to initiate payment', 'error');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 text-sm">
        <span className="material-symbols-outlined animate-spin text-[20px] mr-2">progress_activity</span>
        Loading billing…
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 text-sm">
        Could not load billing info. Make sure the api-service is running.
      </div>
    );
  }

  const { minuteBalance, billingTier, packs, limits } = billing;
  const totalMinutesPurchased = history.reduce((sum, t) => sum + (t.minutes || 0), 0);
  const currentTierIdx = TIER_ORDER.indexOf(billingTier);
  const balanceRupees = (minuteBalance * 500) / 100; // ₹5/min

  return (
    <div className="p-8 max-w-[1440px] mx-auto">

      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-[#0f172a] dark:text-zinc-100 tracking-tight">Billing & Credits</h1>
          <p className="text-base text-[#334155] dark:text-zinc-400 mt-1">Top up your minute balance to run campaigns.</p>
        </div>
      </div>

      {/* Razorpay not configured warning */}
      {!razorpayConfigured && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6">
          <span className="material-symbols-outlined text-amber-500 text-[20px] mt-0.5">warning</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Payment gateway not configured</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Add your Razorpay API keys to <code className="font-mono bg-amber-100 px-1 rounded">.env</code> to enable top-ups.
              Get your keys at <span className="font-mono">razorpay.com → Settings → API Keys</span>.
            </p>
          </div>
        </div>
      )}

      {/* Balance + Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

        {/* Balance card */}
        <div className="md:col-span-1 bg-gradient-to-br from-[#0d9488] to-[#0f766e] rounded-xl p-6 text-white shadow-lg">
          <p className="text-sm font-semibold opacity-80 mb-1">Minute Balance</p>
          <p className="text-5xl font-bold tracking-tight">{minuteBalance.toLocaleString('en-IN')}</p>
          <p className="text-sm opacity-70 mt-1">≈ ₹{balanceRupees.toLocaleString('en-IN')} value</p>
          <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${TIER_BADGE[billingTier]}`}>
              {billingTier.replace('_', '+')}
            </span>
            <span className="text-xs opacity-60">current tier</span>
          </div>
        </div>

        {/* Limits card */}
        <div className="bg-white dark:bg-[#1e1e2e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
          <p className="text-xs font-semibold text-[#334155] dark:text-zinc-400 uppercase tracking-wider mb-4">Plan Limits</p>
          <div className="space-y-3">
            {[
              { label: 'Team members', value: limits.teamMembers },
              { label: 'Active campaigns', value: limits.campaigns },
              { label: 'Contacts / campaign', value: limits.contacts },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm text-[#334155] dark:text-zinc-400">{label}</span>
                <span className="text-sm font-semibold text-[#0f172a] dark:text-zinc-100">
                  {value === -1 ? 'Unlimited' : value.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#334155] dark:text-zinc-400">API access</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${limits.api ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                {limits.api ? 'Enabled' : 'Not included'}
              </span>
            </div>
          </div>
        </div>

        {/* Total spend card */}
        <div className="bg-white dark:bg-[#1e1e2e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
          <p className="text-xs font-semibold text-[#334155] dark:text-zinc-400 uppercase tracking-wider mb-4">Account Summary</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#334155] dark:text-zinc-400">Minutes purchased</span>
              <span className="text-sm font-semibold text-[#0f172a] dark:text-zinc-100">
                {totalMinutesPurchased.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#334155] dark:text-zinc-400">Top-ups</span>
              <span className="text-sm font-semibold text-[#0f172a] dark:text-zinc-100">{history.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#334155] dark:text-zinc-400">Rate</span>
              <span className="text-sm font-semibold text-[#0f172a] dark:text-zinc-100">₹5.00 / min</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#334155] dark:text-zinc-400">Balance expires</span>
              <span className="text-sm font-semibold text-emerald-600">Never</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pack grid */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[#0f172a] dark:text-zinc-100 mb-4">Top Up</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {packs.map((pack) => {
            const isCurrentTier = pack.tier === billingTier;
            const isSelected = selectedPackId === pack.id;

            return (
              <div
                key={pack.id}
                onClick={() => setSelectedPackId(isSelected ? null : pack.id)}
                className={`relative flex flex-col rounded-xl border p-5 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#0d9488] shadow-lg shadow-[#0d9488]/15 bg-[#f0fdfa] dark:bg-[#1e1a3a]'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1e1e2e] hover:border-[#cbd5e1] hover:shadow-sm'
                }`}
              >
                {isCurrentTier && (
                  <div className="absolute -top-3 right-3">
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                      CURRENT
                    </span>
                  </div>
                )}

                {/* Selected checkmark */}
                <div className={`absolute top-3 left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  isSelected ? 'border-[#0d9488] bg-[#0d9488]' : 'border-zinc-200 dark:border-zinc-600'
                }`}>
                  {isSelected && <span className="material-symbols-outlined text-white text-[13px]">check</span>}
                </div>

                <div className="flex-1 pt-4">
                  <p className="text-xs font-bold text-[#334155] dark:text-zinc-400 uppercase tracking-wider mb-1">{pack.label}</p>
                  <p className={`text-2xl font-bold ${isSelected ? 'text-[#0d9488]' : 'text-[#0f172a] dark:text-zinc-100'}`}>{pack.displayAmount}</p>
                  <p className="text-sm text-[#0d9488] font-semibold mt-1">{pack.minutes.toLocaleString('en-IN')} min</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{pack.rateDisplay}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirm bar */}
      <div className={`mb-8 transition-all duration-200 ${selectedPackId ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {(() => {
          const pack = packs.find(p => p.id === selectedPackId);
          if (!pack) return null;
          return (
            <div className="flex items-center justify-between bg-[#f0fdfa] dark:bg-[#1e1a3a] border border-[#0d9488]/30 rounded-xl px-6 py-4">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-[#0d9488] text-[22px]">shopping_cart</span>
                <div>
                  <p className="text-sm font-semibold text-[#0f172a] dark:text-zinc-100">{pack.label} — {pack.displayAmount}</p>
                  <p className="text-xs text-[#334155] dark:text-zinc-400">{pack.minutes.toLocaleString('en-IN')} minutes at {pack.rateDisplay}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedPackId(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTopUp}
                  disabled={paying}
                  className="flex items-center gap-2 bg-[#0d9488] hover:bg-[#0f766e] text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {paying
                    ? <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span> Processing…</>
                    : <>Pay {pack.displayAmount}</>
                  }
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Transaction history */}
      <div>
        <h2 className="text-lg font-semibold text-[#0f172a] dark:text-zinc-100 mb-4">Transaction History</h2>
        <div className="bg-white dark:bg-[#1e1e2e] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <span className="material-symbols-outlined text-zinc-200 dark:text-zinc-700 text-[40px]">receipt_long</span>
              <p className="text-sm text-zinc-400">No transactions yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-[#13131f] border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Pack</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Minutes</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Amount</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Tier Unlocked</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {history.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-50/60 dark:hover:bg-[#13131f]/60 transition-colors">
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{formatDate(t.createdAt)}</td>
                    <td className="px-5 py-4 font-semibold text-[#0f172a] dark:text-zinc-100 capitalize">{t.packId.replace('_', ' ')}</td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">+{(t.minutes || 0).toLocaleString('en-IN')} min</td>
                    <td className="px-5 py-4 font-semibold text-[#0f172a] dark:text-zinc-100">{t.displayAmount}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${TIER_BADGE[t.tierUnlocked]}`}>
                        {t.tierUnlocked.replace('_', '+')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        t.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
