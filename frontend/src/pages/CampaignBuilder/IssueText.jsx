import React from 'react';

/** A problem under the line it belongs to: a gap to fill, or a mistake. */
export default function IssueText({ issue }) {
  return (
    <p className={`mt-1.5 flex items-start gap-1.5 text-xs ${issue.gap ? 'text-caution-dim dark:text-caution' : 'text-negative-dim dark:text-negative'}`}>
      <span className="material-symbols-outlined [--icon-size:14px] mt-px">{issue.gap ? 'edit_note' : 'error'}</span>
      {issue.text}
    </p>
  );
}
