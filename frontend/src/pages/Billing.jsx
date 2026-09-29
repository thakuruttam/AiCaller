import React, { useEffect, useState, useCallback } from 'react';
import { Page, PageHeader, Button, IconButton, SelectableCard, Badge } from '../components/ui';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const TIER_ORDER = ['TRIAL', 'BASIC', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE', 'ENTERPRISE_PLUS'];

const TIER_BADGE = {
  TRIAL:          'bg-paper-400 text-ink-600 border-paper-500 dark:bg-ink-300 dark:text-ink-900 dark:border-ink-400',
  BASIC:          'bg-caution/10 text-caution-dim border-caution/30 dark:bg-caution/15 dark:text-caution dark:border-caution/15',
  STANDARD:       'bg-brand-100 text-brand-600 border-brand-200 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-600',
  PROFESSIONAL:   'bg-brand-100 text-brand-500 border-brand-500/20 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/30',
  ENTERPRISE:     'bg-brand-100 text-brand-600 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30',
  ENTERPRISE_PLUS:'bg-gradient-to-r from-brand-500 to-brand-600 text-white border-transparent',
};


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
        theme: { color: '#266df0' },
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
      <div className="flex items-center justify-center h-64 text-ink-800 text-sm">
        <span className="material-symbols-outlined animate-spin text-[20px] mr-2">progress_activity</span>
        Loading billing…
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-800 text-sm">
        Could not load billing info. Make sure the api-service is running.
      </div>
    );
  }

  const { minuteBalance, billingTier, packs, limits } = billing;
  const totalMinutesPurchased = history.reduce((sum, t) => sum + (t.minutes || 0), 0);
  const balanceRupees = (minuteBalance * 500) / 100; // ₹5/min

  return (
    <Page>
      <PageHeader
        title="Billing & Credits"
        subtitle="Top up your minute balance to run campaigns."
      />

      {/* Razorpay not configured warning */}
      {!razorpayConfigured && (
        <div className="flex items-start gap-3 bg-caution/10 border border-caution/30 rounded-card px-5 py-4 mb-6">
          <span className="material-symbols-outlined text-caution text-[20px] mt-0.5">warning</span>
          <div>
            <p className="text-sm font-semibold text-caution-dim">Payment gateway not configured</p>
            <p className="text-xs text-caution-dim mt-0.5">
              Add your Razorpay API keys to <code className="bg-caution/10 px-1 rounded">.env</code> to enable top-ups.
              Get your keys at <span>razorpay.com → Settings → API Keys</span>.
            </p>
          </div>
        </div>
      )}

      {/* Balance + Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

        {/* Balance card */}
        <div className="md:col-span-1 bg-gradient-to-br from-brand-500 to-brand-600 rounded-card p-6 text-white shadow-raised">
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
        <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card p-6 shadow-card">
          <p className="text-xs font-medium text-ink-600 dark:text-ink-900 mb-4">Plan Limits</p>
          <div className="space-y-3">
            {[
              { label: 'Team members', value: limits.teamMembers },
              { label: 'Active campaigns', value: limits.campaigns },
              { label: 'Contacts / campaign', value: limits.contacts },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm text-ink-600 dark:text-ink-900">{label}</span>
                <span className="text-sm font-semibold text-ink-100 dark:text-paper-200">
                  {value === -1 ? 'Unlimited' : value.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center">
              <span className="text-sm text-ink-600 dark:text-ink-900">API access</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${limits.api ? 'bg-positive/10 text-positive-dim' : 'bg-paper-400 text-ink-700'}`}>
                {limits.api ? 'Enabled' : 'Not included'}
              </span>
            </div>
          </div>
        </div>

        {/* Total spend card */}
        <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card p-6 shadow-card">
          <p className="text-xs font-medium text-ink-600 dark:text-ink-900 mb-4">Account Summary</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-ink-600 dark:text-ink-900">Minutes purchased</span>
              <span className="text-sm font-semibold text-ink-100 dark:text-paper-200">
                {totalMinutesPurchased.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-ink-600 dark:text-ink-900">Top-ups</span>
              <span className="text-sm font-semibold text-ink-100 dark:text-paper-200">{history.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-ink-600 dark:text-ink-900">Rate</span>
              <span className="text-sm font-semibold text-ink-100 dark:text-paper-200">₹5.00 / min</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-ink-600 dark:text-ink-900">Balance expires</span>
              <span className="text-sm font-semibold text-positive-dim">Never</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pack grid */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-ink-100 dark:text-paper-200 mb-4">Top Up</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {packs.map((pack) => {
            const isCurrentTier = pack.tier === billingTier;
            const isSelected = selectedPackId === pack.id;

            return (
              <SelectableCard
                key={pack.id}
                selected={isSelected}
                onSelect={() => setSelectedPackId(isSelected ? null : pack.id)}
                aria-label={`${pack.label} — ${pack.displayAmount} for ${pack.minutes} minutes`}
                badge={isCurrentTier && (
                  <Badge tone="positive">Current</Badge>
                )}
              >
                <p className="text-xs font-medium text-ink-600 dark:text-ink-900 mb-1">{pack.label}</p>
                <p className={`text-2xl font-semibold tabular ${isSelected ? 'text-brand-500' : 'text-ink-100 dark:text-paper-200'}`}>
                  {pack.displayAmount}
                </p>
                <p className="text-sm text-brand-500 font-semibold mt-1 tabular">{pack.minutes.toLocaleString('en-IN')} min</p>
                <p className="text-xs text-ink-800 mt-0.5 tabular">{pack.rateDisplay}</p>
              </SelectableCard>
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
            <div className="flex items-center justify-between bg-brand-100 dark:bg-brand-500/15 border border-brand-500/30 rounded-card px-6 py-4">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-brand-500 text-[22px]">shopping_cart</span>
                <div>
                  <p className="text-sm font-semibold text-ink-100 dark:text-paper-200">{pack.label} — {pack.displayAmount}</p>
                  <p className="text-xs text-ink-600 dark:text-ink-900">{pack.minutes.toLocaleString('en-IN')} minutes at {pack.rateDisplay}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setSelectedPackId(null)}>Cancel</Button>
                <Button variant="primary" size="md" onClick={handleTopUp} disabled={paying}>
                  {paying
                    ? <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span> Processing…</>
                    : <>Pay {pack.displayAmount}</>
                  }
                </Button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Transaction history */}
      <div>
        <h2 className="text-sm font-semibold text-ink-100 dark:text-paper-200 mb-4">Transaction History</h2>
        <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card shadow-card overflow-hidden">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <span className="material-symbols-outlined text-paper-200 dark:text-ink-500 text-[40px]">receipt_long</span>
              <p className="text-sm text-ink-800">No transactions yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-paper-200 dark:bg-ink-50 border-b border-paper-400 dark:border-ink-400">
                <tr>
                  <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 ">Date</th>
                  <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 ">Pack</th>
                  <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 ">Minutes</th>
                  <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 ">Amount</th>
                  <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 ">Tier Unlocked</th>
                  <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 ">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-400 dark:divide-ink-400">
                {history.map((t) => (
                  <tr key={t.id} className="hover:bg-paper-200/60 dark:hover:bg-ink-100/60 transition-colors">
                    <td className="px-7 py-5 text-ink-600 dark:text-ink-900">{formatDate(t.createdAt)}</td>
                    <td className="px-7 py-5 font-semibold text-ink-100 dark:text-paper-200 capitalize">{t.packId.replace('_', ' ')}</td>
                    <td className="px-7 py-5 text-ink-600 dark:text-ink-900">+{(t.minutes || 0).toLocaleString('en-IN')} min</td>
                    <td className="px-7 py-5 font-semibold text-ink-100 dark:text-paper-200">{t.displayAmount}</td>
                    <td className="px-7 py-5">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${TIER_BADGE[t.tierUnlocked]}`}>
                        {t.tierUnlocked.replace('_', '+')}
                      </span>
                    </td>
                    <td className="px-7 py-5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        t.status === 'SUCCESS' ? 'bg-positive/10 text-positive-dim' : 'bg-paper-400 text-ink-700'
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
  </Page>
  );
}
