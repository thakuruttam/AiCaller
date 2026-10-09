import React, { useEffect, useState, useCallback } from 'react';
import {
  Page, PageHeader, Button, IconButton, SelectableCard, Badge,
  Table, THead, Th, TBody, Tr, Td, TableToolbar, EmptyState, FilterBar, Pagination,
} from '../components/ui';
import { useSort } from '../hooks/useSort';
import { useFacets } from '../hooks/useFacets';
import { exportCsv } from '../lib/exportCsv';
import { usePagination } from '../hooks/usePagination';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import PageLoader from '../components/PageLoader';

const TIER_ORDER = ['TRIAL', 'BASIC', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE', 'ENTERPRISE_PLUS'];

const TIER_BADGE = {
  TRIAL:          'bg-paper-400 text-muted-foreground border-paper-500 dark:bg-ink-300 dark:border-ink-400',
  BASIC:          'bg-caution/10 text-caution-dim border-caution/25 dark:text-caution',
  STANDARD:       'bg-brand-500/10 text-brand-600 border-brand-500/25 dark:text-brand-300',
  PROFESSIONAL:   'bg-brand-500/10 text-brand-500 border-brand-500/25 dark:text-brand-300',
  ENTERPRISE:     'bg-brand-500/10 text-brand-600 border-brand-500/25 dark:text-brand-300',
  ENTERPRISE_PLUS:'bg-brand-500 text-white border-transparent',
};


const packLabel = (packId) => {
  const l = String(packId ?? '').replace(/_/g, ' ').toLowerCase();
  return l.charAt(0).toUpperCase() + l.slice(1);
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

  const filters = useFacets(history, {
    status: { label: 'Status', get: t => t.status, format: packLabel },
    pack: { label: 'Pack', get: t => t.packId, format: packLabel },
  }, { onChange: () => setPage(1) });

  const { sorted: sortedHistory, sortProps } = useSort(filters.filtered, {
    date: t => t.createdAt,
    pack: t => t.packId,
    minutes: t => t.minutes || 0,
  });
  const { paginated: pagedHistory, setPage, paginationProps } = usePagination(sortedHistory);

  const handleExport = () => exportCsv(`billing-history-${new Date().toISOString().slice(0, 10)}`, [
    { header: 'Date', value: t => t.createdAt && new Date(t.createdAt).toISOString().slice(0, 10) },
    { header: 'Pack', value: t => packLabel(t.packId) },
    { header: 'Minutes', value: t => t.minutes || 0 },
    { header: 'Amount', value: t => t.displayAmount },
    { header: 'Tier unlocked', value: t => t.tierUnlocked?.replace('_', '+') },
    { header: 'Status', value: t => packLabel(t.status) },
  ], sortedHistory);

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
        theme: { color: '#2563eb' },
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
    return <PageLoader text="Loading billing…" />;
  }

  if (!billing) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
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
        <div className="flex items-start gap-3 bg-caution/10 border border-caution/25 rounded-card px-5 py-4 mb-7">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-7">

        {/* Balance card */}
        <div className="md:col-span-1 bg-brand-500 rounded-2xl p-5 text-white shadow-primary">
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
        <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-5">
          <p className="text-xs font-medium text-muted-foreground mb-4">Plan Limits</p>
          <div className="space-y-3">
            {[
              { label: 'Team members', value: limits.teamMembers },
              { label: 'Active campaigns', value: limits.campaigns },
              { label: 'Contacts / campaign', value: limits.contacts },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-semibold text-foreground">
                  {value === -1 ? 'Unlimited' : value.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">API access</span>
              <Badge tone={limits.api ? 'positive' : 'neutral'} capitalize={false}>
                {limits.api ? 'Enabled' : 'Not included'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Total spend card */}
        <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-5">
          <p className="text-xs font-medium text-muted-foreground mb-4">Account Summary</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Minutes purchased</span>
              <span className="text-sm font-semibold text-foreground">
                {totalMinutesPurchased.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Top-ups</span>
              <span className="text-sm font-semibold text-foreground">{history.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Rate</span>
              <span className="text-sm font-semibold text-foreground">₹5.00 / min</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Balance expires</span>
              <span className="text-sm font-semibold text-positive-dim">Never</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pack grid */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Top Up</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
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
                <p className="text-xs font-medium text-muted-foreground mb-1">{pack.label}</p>
                <p className={`text-2xl font-semibold tabular ${isSelected ? 'text-brand-500' : 'text-foreground'}`}>
                  {pack.displayAmount}
                </p>
                <p className="text-sm text-brand-500 font-semibold mt-1 tabular">{pack.minutes.toLocaleString('en-IN')} min</p>
                <p className="text-xs text-muted-foreground mt-0.5 tabular">{pack.rateDisplay}</p>
              </SelectableCard>
            );
          })}
        </div>
      </div>

      {/* Confirm bar */}
      <div className={`mb-7 transition-all duration-200 ${selectedPackId ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {(() => {
          const pack = packs.find(p => p.id === selectedPackId);
          if (!pack) return null;
          return (
            <div className="flex items-center justify-between bg-brand-500/10 border border-brand-500/25 rounded-card px-6 py-4">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-brand-500 text-[22px]">shopping_cart</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{pack.label} — {pack.displayAmount}</p>
                  <p className="text-xs text-muted-foreground">{pack.minutes.toLocaleString('en-IN')} minutes at {pack.rateDisplay}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setSelectedPackId(null)}>Cancel</Button>
                <Button variant="primary" size="md" onClick={handleTopUp} loading={paying}>
                  {paying ? 'Processing…' : <>Pay {pack.displayAmount}</>}
                </Button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Transaction history */}
      <div className="bg-card dark:bg-muted rounded-2xl shadow-primary overflow-hidden">
        <TableToolbar
          title="Transaction history"
          count={history.length ? sortedHistory.length : null}
          actions={history.length > 0 && (
            <IconButton title="Export CSV" icon="download" onClick={handleExport} disabled={!sortedHistory.length} />
          )}
        >
          {history.length > 0 && <FilterBar filters={filters} />}
        </TableToolbar>
        {history.length === 0 ? (
          <EmptyState icon="receipt_long" title="No transactions yet" body="Top-ups you make will be listed here." />
        ) : sortedHistory.length === 0 ? (
          <EmptyState
            icon="filter_alt_off"
            title="No transactions match your filters"
            body="Try a different status or pack, or clear the filters."
            action={<Button variant="secondary" onClick={filters.reset}>Clear filters</Button>}
          />
        ) : (
          <Table>
            <THead>
              <Th {...sortProps('date')}>Date</Th>
              <Th {...sortProps('pack')}>Pack</Th>
              <Th align="right" {...sortProps('minutes')}>Minutes</Th>
              <Th align="right">Amount</Th>
              <Th>Tier unlocked</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {pagedHistory.map((t) => (
                <Tr key={t.id}>
                  <Td muted className="whitespace-nowrap">{formatDate(t.createdAt)}</Td>
                  <Td className="font-medium capitalize">{t.packId.replace('_', ' ')}</Td>
                  <Td numeric muted>+{(t.minutes || 0).toLocaleString('en-IN')} min</Td>
                  <Td numeric className="font-semibold">{t.displayAmount}</Td>
                  <Td>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${TIER_BADGE[t.tierUnlocked]}`}>
                      {t.tierUnlocked.replace('_', '+')}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={t.status === 'SUCCESS' ? 'positive' : 'neutral'}>
                      {t.status.toLowerCase()}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
        {sortedHistory.length > 0 && <Pagination {...paginationProps} label="transactions" />}
      </div>
  </Page>
  );
}
