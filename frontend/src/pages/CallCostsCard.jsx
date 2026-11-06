import React from 'react';
import { Card, Table, THead, Th, TBody, Tr, Td } from '../components/ui';

// Super admins only: what calls cost US, by service, for question calls vs
// conversation calls — priced from the usage each call recorded
// (api-service/src/services/callCost.service.js). Workspaces never see this.

const MODES = [
  { key: 'questions', label: 'Question calls' },
  { key: 'conversation', label: 'Conversation calls' },
];
const PRICE_PER_MINUTE = 5;

const inr = (n, digits = 2) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`);

export default function CallCostsCard({ costs }) {
  if (!costs) return null;
  const modes = MODES.filter(m => costs.modes?.[m.key]);
  const serviceRows = (modes[0] && costs.modes[modes[0].key].services) || [];

  return (
    <Card className="mb-7">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">What calls cost us</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last {costs.days} days, priced from what each call used. Only super admins see this.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">We charge {inr(PRICE_PER_MINUTE, 0)} / min</p>
      </div>

      {modes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No answered calls in this period.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {modes.map(m => {
              const g = costs.modes[m.key];
              const margin = PRICE_PER_MINUTE - g.perMinuteInr;
              return (
                <div key={m.key} className="rounded-xl border border-border px-4 py-3">
                  <p className="text-[13px] font-medium text-foreground">{m.label}</p>
                  <p className="text-xl font-semibold tabular-nums text-foreground mt-1">
                    {inr(g.perMinuteInr)} <span className="text-xs font-normal text-muted-foreground">per minute</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                    {inr(g.perCallInr)} per call · {g.calls} calls ({g.meteredCalls} fully metered) · {g.minutes} min
                  </p>
                  <p className={`text-xs mt-1 tabular-nums ${margin >= 0 ? 'text-positive-dim dark:text-positive' : 'text-negative-dim dark:text-negative'}`}>
                    {margin >= 0 ? 'Margin' : 'Loss'} {inr(Math.abs(margin))} / min before fixed costs
                  </p>
                </div>
              );
            })}
          </div>

          <Table>
            <THead>
              <Th>Service</Th>
              {modes.map(m => <Th key={m.key} align="right">{m.label} · per min</Th>)}
              {modes.map(m => <Th key={`${m.key}-t`} align="right">{m.label} · total</Th>)}
            </THead>
            <TBody>
              {serviceRows.map(s => (
                <Tr key={s.key}>
                  <Td>{s.label}</Td>
                  {modes.map(m => {
                    const row = costs.modes[m.key].services.find(x => x.key === s.key);
                    return <Td key={m.key} numeric>{inr(row?.perMinuteInr, 3)}</Td>;
                  })}
                  {modes.map(m => {
                    const row = costs.modes[m.key].services.find(x => x.key === s.key);
                    return <Td key={`${m.key}-t`} numeric muted>{inr(row?.totalInr)}</Td>;
                  })}
                </Tr>
              ))}
              <Tr>
                <Td className="font-medium">Total</Td>
                {modes.map(m => <Td key={m.key} numeric className="font-medium">{inr(costs.modes[m.key].perMinuteInr)}</Td>)}
                {modes.map(m => <Td key={`${m.key}-t`} numeric className="font-medium">{inr(costs.modes[m.key].totalInr)}</Td>)}
              </Tr>
            </TBody>
          </Table>
        </>
      )}

      <div className="mt-5">
        <p className="text-[13px] font-medium text-foreground">Fixed monthly costs</p>
        <ul className="mt-1.5 flex flex-col gap-1 text-xs">
          {costs.fixed.items.map(f => (
            <li key={f.item} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{f.item}{f.note ? ` — ${f.note}` : ''}</span>
              <span className="tabular-nums text-foreground shrink-0">{f.inr == null ? 'not known' : inr(f.inr, 0)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-2">
          Known fixed costs: {inr(costs.fixed.knownMonthlyInr, 0)} / month
          {costs.fixed.perMinuteInr != null && ` — ${inr(costs.fixed.perMinuteInr)} per call minute at this period's volume`}.
        </p>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Estimates from list prices at ₹{costs.usdToInr}/$ before GST and card fees. Gemini Live usage counted {costs.geminiUsageCountedAs}.
        Calls from before usage logging show only the phone line. Your real bills are the final word.
      </p>
    </Card>
  );
}
