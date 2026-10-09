import React from 'react';
import { Link } from 'react-router-dom';
import { Button, IconButton } from './ui';
import {
  campaignRunState, actionsForState, primaryActionForState,
  runStateLabel, RUN_STATE_TEXT,
} from '../lib/campaignState';

/**
 * Start / pause / resume / stop / re-run, rendered from the campaign's own
 * derived state so the control on screen is always the one that applies.
 *
 * Two shapes, same behaviour:
 *   variant="row"     one icon button — the single action worth a click from
 *                     a table row, so running a campaign never requires
 *                     opening it first.
 *   variant="header"  every valid action, labelled, for the detail screen.
 *
 * `actions` comes from useCampaignActions() in the parent rather than being
 * created here: a table shares one instance across every row, which is what
 * keeps per-row pending state correct.
 */
export default function CampaignRunControls({
  campaign,
  actions,
  variant = 'row',
  size,
}) {
  const state = campaignRunState(campaign);
  const pending = actions.pendingFor(campaign.id);
  const available = actionsForState(state);

  if (variant === 'row') {
    const primary = primaryActionForState(state);
    const btnSize = size ?? 'sm';

    // Nothing to run yet. A disabled control (rather than a blank cell)
    // keeps the action column aligned down the table and, via its title,
    // says what's missing instead of leaving the user guessing why there's
    // no Start button on this row.
    if (!primary) {
      return (
        <IconButton
          size={btnSize}
          icon="play_arrow"
          disabled
          title={state === 'empty'
            ? 'Add contacts before starting this campaign'
            : 'No run action available'}
        />
      );
    }

    return (
      <IconButton
        size={btnSize}
        icon={primary.icon}
        tone={primary.tone}
        loading={pending === primary.action}
        disabled={!!pending}
        title={primary.label}
        onClick={() => actions.run(campaign.id, primary.action)}
      />
    );
  }

  // ── header variant ────────────────────────────────────────────────────
  if (state === 'empty') {
    return (
      <Button
        as={Link}
        to={`/edit-campaign/${campaign.id}`}
        variant="primary"
        icon="person_add"
      >
        Add contacts
      </Button>
    );
  }

  return (
    <>
      {available.map((a, i) => (
        <Button
          key={a.action + a.label}
          variant={i === 0 ? 'primary' : a.tone === 'danger' ? 'dangerGhost' : 'secondary'}
          size={size ?? 'md'}
          icon={a.icon}
          loading={pending === a.action}
          disabled={!!pending}
          onClick={() => actions.run(campaign.id, a.action)}
        >
          {a.label}
        </Button>
      ))}
    </>
  );
}

/** The campaign's state as plain coloured text — the table's Status cell. */
export function CampaignStatusText({ campaign, className = '' }) {
  const state = campaignRunState(campaign);
  return (
    <span className={`text-sm font-medium inline-block ${RUN_STATE_TEXT[state]} ${className}`}>
      {runStateLabel(state)}
    </span>
  );
}

/**
 * A live/paused campaign's state plus its contact progress, for the detail
 * header — so the operator can see what the buttons beside it will act on
 * without reading the table below.
 */
export function CampaignStateSummary({ campaign, progress }) {
  const state = campaignRunState(campaign);
  const { contactsDone, totalContacts } = progress;

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={`font-medium ${RUN_STATE_TEXT[state]}`}>{runStateLabel(state)}</span>
      {totalContacts > 0 && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground tabular-nums">
            {contactsDone} of {totalContacts} contacts called
          </span>
        </>
      )}
    </span>
  );
}
