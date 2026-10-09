import { useCallback, useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { ACTION_CONFIRM, ACTION_TOAST } from '../lib/campaignState';

/**
 * Start / pause / resume / stop / re-run a campaign.
 *
 * POST /api/campaigns/:id/status has always accepted ADMIN and EDITOR (see
 * api-service/src/routes/campaigns.js) — until now the only caller was the
 * SUPER_ADMIN-only admin panel, so an ordinary workspace admin could build a
 * campaign and had no way to run it. This hook is the shared client for that
 * endpoint, so the Dashboard row and the campaign detail header stay in step
 * on confirmation copy, toast wording and in-flight state.
 *
 * Pending state is keyed by campaign id because the Dashboard renders one
 * control per row against a single hook instance — a flat boolean would
 * disable every row's button while any one of them was working.
 *
 * @param {{ onDone?: (campaignId: string, action: string) => void }} options
 *   onDone fires after a successful action so the caller can refetch. The
 *   derived run state comes from call logs, so the UI can't move forward
 *   without re-reading them.
 */
export function useCampaignActions({ onDone } = {}) {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [pending, setPending] = useState({});

  const pendingFor = useCallback((campaignId) => pending[campaignId] ?? null, [pending]);

  const run = useCallback(async (campaignId, action) => {
    if (!campaignId || !action) return false;
    if (pending[campaignId]) return false; // already working on this campaign

    const needsConfirm = ACTION_CONFIRM[action];
    if (needsConfirm && !(await confirm(needsConfirm))) return false;

    setPending(p => ({ ...p, [campaignId]: action }));
    try {
      await api.post(`/api/campaigns/${campaignId}/status`, { action });
      addToast(ACTION_TOAST[action] ?? 'Campaign updated.', 'success');
      onDone?.(campaignId, action);
      return true;
    } catch (err) {
      console.error(`[campaign ${action}]`, err);
      addToast(
        err.response?.data?.error || `Could not ${action} this campaign. Please try again.`,
        'error',
      );
      return false;
    } finally {
      setPending(p => {
        const next = { ...p };
        delete next[campaignId];
        return next;
      });
    }
  }, [pending, confirm, addToast, onDone]);

  return { run, pendingFor };
}

/**
 * Per-call actions: re-dial a contact, or re-run the evaluation on a call
 * that already has a transcript.
 *
 * Both endpoints already allow every role down to VIEWER
 * (routes/campaigns.js) but, like the lifecycle actions above, were only
 * ever wired into the admin panel — so a customer whose call dropped, or
 * whose report scored wrong, had no way to retry it themselves.
 */
export function useCallActions({ onDone } = {}) {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [pending, setPending] = useState({});

  const pendingFor = useCallback((callLogId) => pending[callLogId] ?? null, [pending]);

  const recall = useCallback(async (callLogId, { contactName } = {}) => {
    if (!callLogId || pending[callLogId]) return false;

    const ok = await confirm({
      title: contactName ? `Call ${contactName} again?` : 'Call this contact again?',
      body: 'A new call is queued straight away and spends minutes from your balance. The original call, its recording and its report are kept.',
      confirmLabel: 'Call again',
      tone: 'danger',
    });
    if (!ok) return false;

    setPending(p => ({ ...p, [callLogId]: 'recall' }));
    try {
      await api.post(`/api/campaigns/calls/${callLogId}/recall`);
      addToast('Call queued — it will be placed shortly.', 'success');
      onDone?.(callLogId, 'recall');
      return true;
    } catch (err) {
      console.error('[call recall]', err);
      addToast(err.response?.data?.error || 'Could not queue the call. Please try again.', 'error');
      return false;
    } finally {
      setPending(p => { const n = { ...p }; delete n[callLogId]; return n; });
    }
  }, [pending, confirm, addToast, onDone]);

  // No confirmation: re-evaluating costs no minutes and places no call, it
  // just re-reads the transcript the call already produced.
  const reevaluate = useCallback(async (callLogId) => {
    if (!callLogId || pending[callLogId]) return false;

    setPending(p => ({ ...p, [callLogId]: 'evaluate' }));
    try {
      await api.post(`/api/campaigns/calls/${callLogId}/evaluate`);
      addToast('Evaluation queued — the report will refresh in a moment.', 'success');
      onDone?.(callLogId, 'evaluate');
      return true;
    } catch (err) {
      console.error('[call evaluate]', err);
      addToast(
        err.response?.data?.error || 'Could not queue the evaluation. Please try again.',
        'error',
      );
      return false;
    } finally {
      setPending(p => { const n = { ...p }; delete n[callLogId]; return n; });
    }
  }, [pending, addToast, onDone]);

  return { recall, reevaluate, pendingFor };
}
