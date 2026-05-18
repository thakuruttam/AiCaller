import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';

const emptyRule = () => ({
  condition: '',
  field: 'Any Intent',
  operator: 'contains',
  value: '',
  action: 'End Call',
  actionTarget: '',
  expectedAnswer: '',
});

const emptyQuestionRule = () => ({
  condition: '',
  field: 'Any Intent',
  operator: 'contains',
  value: '',
  action: 'End Call',
  actionTarget: '',
  expectedAnswer: '',
});

function collectAskTargets(rules) {
  const set = new Set();
  const walk = (arr) => {
    for (const r of arr || []) {
      if (r.action === 'Ask Question' && r.actionTarget) set.add(r.actionTarget);
      if (r.questionRules?.length) walk(r.questionRules);
    }
  };
  walk(rules);
  return set;
}

export default function Step4Rules({ payload, updatePayload }) {
  const [newRule, setNewRule] = useState(() => ({
    ...emptyRule(),
    questionRules: [],
  }));
  const [newQuestionRule, setNewQuestionRule] = useState(emptyQuestionRule);

  const fields = payload.dataToCollect || [];
  const list = payload.rules?.list || [];

  const usedAskTargets = useMemo(() => collectAskTargets(list), [list]);

  const draftNestedAskTargets = useMemo(() => {
    const s = new Set();
    for (const r of newRule.questionRules || []) {
      if (r.action === 'Ask Question' && r.actionTarget) s.add(r.actionTarget);
    }
    return s;
  }, [newRule.questionRules]);

  const askTargetsAvailable = useMemo(() => {
    return fields.filter(
      (f) =>
        !usedAskTargets.has(f.name) &&
        (!draftNestedAskTargets.has(f.name) || f.name === newRule.actionTarget)
    );
  }, [fields, usedAskTargets, draftNestedAskTargets, newRule.actionTarget]);

  const nestedAskTargetsUsed = useMemo(() => {
    const q = newRule.questionRules || [];
    return new Set(
      q.filter((r) => r.action === 'Ask Question' && r.actionTarget).map((r) => r.actionTarget)
    );
  }, [newRule.questionRules]);

  const nestedAskOptions = useMemo(() => {
    const parent = newRule.actionTarget;
    return fields.filter(
      (f) =>
        f.name !== parent &&
        !usedAskTargets.has(f.name) &&
        !nestedAskTargetsUsed.has(f.name)
    );
  }, [fields, newRule.actionTarget, usedAskTargets, nestedAskTargetsUsed]);

  const addQuestionRule = () => {
    const isFieldRule = newQuestionRule.field !== 'Any Intent';
    const isFlowAction =
      newQuestionRule.action === 'Ask Question' || newQuestionRule.action === 'Skip Question';

    if (isFieldRule && !newQuestionRule.value && newQuestionRule.operator !== 'is set') return;
    if (!isFieldRule && !newQuestionRule.condition) return;

    if (newQuestionRule.action === 'Ask Question') {
      const t = newQuestionRule.actionTarget;
      if (!t) return;
      if (!String(newQuestionRule.expectedAnswer || '').trim()) {
        alert('Add what counts as a valid answer for that follow-up question.');
        return;
      }
      if (t === newRule.actionTarget) {
        alert('You cannot ask the same question you are defining rules for.');
        return;
      }
      if (usedAskTargets.has(t)) {
        alert(`Each question can only be asked once. "${t}" is already used elsewhere.`);
        return;
      }
      if (nestedAskTargetsUsed.has(t)) {
        alert(`"${t}" is already covered by another nested rule here.`);
        return;
      }
    }

    if (isFlowAction && !newQuestionRule.actionTarget) {
      const pick = fields[0]?.name || '';
      if (!pick) return;
      setNewRule((prev) => ({
        ...prev,
        questionRules: [...(prev.questionRules || []), { ...newQuestionRule, actionTarget: pick }],
      }));
      setNewQuestionRule(emptyQuestionRule());
      return;
    }

    setNewRule((prev) => ({
      ...prev,
      questionRules: [...(prev.questionRules || []), { ...newQuestionRule }],
    }));
    setNewQuestionRule(emptyQuestionRule());
  };

  const removeQuestionRule = (idx) => {
    setNewRule((prev) => ({
      ...prev,
      questionRules: (prev.questionRules || []).filter((_, i) => i !== idx),
    }));
  };

  const addRule = () => {
    const isFieldRule = newRule.field !== 'Any Intent';
    const isFlowAction = newRule.action === 'Ask Question' || newRule.action === 'Skip Question';

    if (
      (isFieldRule && (newRule.value || newRule.operator === 'is set')) ||
      (!isFieldRule && newRule.condition)
    ) {
      let draft = newRule;
      if (isFlowAction && !draft.actionTarget) {
        const pick = fields[0]?.name || '';
        if (!pick) return;
        draft = { ...draft, actionTarget: pick };
      }

      if (draft.action === 'Ask Question') {
        if (!draft.actionTarget) return;
        if (!String(draft.expectedAnswer || '').trim()) {
          alert(
            'Describe the expected or valid answer for the target question so the AI can evaluate responses.'
          );
          return;
        }
        if (usedAskTargets.has(draft.actionTarget)) {
          alert(
            `Each question can only be targeted once. "${draft.actionTarget}" is already used by another Ask Question rule.`
          );
          return;
        }
        const qr = draft.questionRules || [];
        if (qr.length === 0) {
          alert(
            'Define at least one rule for this question so the AI knows how to handle the conversation when asking it.'
          );
          return;
        }
      }

      const { questionRules: qRules, ...rest } = draft;
      const toSave =
        rest.action === 'Ask Question'
          ? { ...rest, questionRules: qRules?.length ? [...qRules] : [] }
          : rest;

      updatePayload({ rules: { ...payload.rules, list: [...list, toSave] } });
      setNewRule({ ...emptyRule(), questionRules: [] });
      setNewQuestionRule(emptyQuestionRule());
    }
  };

  const removeRule = (idx) => {
    updatePayload({ rules: { ...payload.rules, list: list.filter((_, i) => i !== idx) } });
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight">Campaign Rules</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Set logical flow control for the AI. By default, the AI moves sequentially through your data
          fields.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium leading-none">Success Score Threshold (0-100)</label>
        <input
          type="number"
          className="flex h-10 w-full md:w-1/3 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={payload.rules?.successScore || 50}
          onChange={(e) => updatePayload({ rules: { ...payload.rules, successScore: e.target.value } })}
        />
        <p className="text-xs text-muted-foreground">
          If the conversation score drops below this, it is marked as failed.
        </p>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 overflow-hidden">
        <h4 className="font-semibold text-lg mb-4">Custom Flow Rules</h4>

        {(!list || list.length === 0) && (
          <div className="text-muted-foreground text-sm py-4 text-center border border-dashed rounded-lg bg-muted/20">
            No flow rules defined. The AI will follow the default sequential path.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {list.map((r, i) => (
            <div key={i} className="flex flex-col gap-2 p-3 rounded-md border bg-muted/10">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm flex items-center flex-wrap gap-1">
                  <span className="text-muted-foreground font-mono">IF</span>
                  {r.field === 'Any Intent' ? (
                    <span className="font-medium">{r.condition}</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-primary">{r.field}</span>
                      <span className="text-muted-foreground italic">{r.operator}</span>
                      <span className="font-medium">"{r.value}"</span>
                    </div>
                  )}
                  <span className="text-muted-foreground font-mono ml-2">THEN</span>
                  <span className="font-medium rounded bg-secondary px-2 py-0.5 text-xs inline-flex items-center text-secondary-foreground">
                    {r.action === 'End Call'
                      ? 'End Call'
                      : `${r.action === 'Ask Question' ? 'Ask' : 'Skip'} "${r.actionTarget}"`}
                  </span>
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
                  onClick={() => removeRule(i)}
                >
                  <X size={16} />
                </button>
              </div>
              {r.action === 'Ask Question' && r.expectedAnswer && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Expected answer:</span> {r.expectedAnswer}
                </p>
              )}
              {r.action === 'Ask Question' && r.questionRules?.length > 0 && (
                <div className="pl-3 border-l-2 border-primary/30 ml-1 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">
                    Rules while asking "{r.actionTarget}"
                  </div>
                  {r.questionRules.map((qr, j) => (
                    <div key={j} className="text-xs flex flex-col gap-0.5 text-muted-foreground">
                      <div className="flex flex-wrap gap-1 items-baseline">
                        <span className="font-mono text-[10px]">IF</span>
                        {qr.field === 'Any Intent' ? (
                          <span>{qr.condition}</span>
                        ) : (
                          <>
                            <span className="font-medium text-foreground">{qr.field}</span>
                            <span className="italic">{qr.operator}</span>
                            <span>"{qr.value}"</span>
                          </>
                        )}
                        <span className="font-mono text-[10px] ml-1">THEN</span>
                        <span className="font-medium text-foreground">
                          {qr.action === 'End Call'
                            ? 'End Call'
                            : `${qr.action === 'Ask Question' ? 'Ask' : 'Skip'} "${qr.actionTarget}"`}
                        </span>
                      </div>
                      {qr.action === 'Ask Question' && qr.expectedAnswer && (
                        <div className="text-[11px] pl-1">
                          <span className="font-medium text-foreground">Expected answer:</span> {qr.expectedAnswer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-border flex flex-col gap-3">
          <label className="text-sm font-medium leading-none">Add Rule</label>
          <div className="flex flex-col gap-3 bg-muted/5 p-4 rounded-lg border">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">
                  Condition Target
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={newRule.field}
                  onChange={(e) => setNewRule({ ...newRule, field: e.target.value })}
                >
                  <option>Any Intent</option>
                  {fields.map((f) => (
                    <option key={f.name}>{f.name}</option>
                  ))}
                </select>
              </div>

              {newRule.field === 'Any Intent' ? (
                <div className="flex-[2] flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">
                    User describes...
                  </label>
                  <input
                    type="text"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground"
                    placeholder="e.g. User asks for human"
                    value={newRule.condition}
                    onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
                  />
                </div>
              ) : (
                <>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">
                      Operator
                    </label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={newRule.operator}
                      onChange={(e) => setNewRule({ ...newRule, operator: e.target.value })}
                    >
                      <option value="equals">Equals</option>
                      <option value="contains">Contains</option>
                      <option value="does not contain">Does not contain</option>
                      <option value="greater than">Greater than</option>
                      <option value="less than">Less than</option>
                      <option value="is set">Is set</option>
                    </select>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">
                      Value
                    </label>
                    <input
                      type="text"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground"
                      placeholder="Expected value"
                      value={newRule.value}
                      onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col md:flex-row items-end gap-2">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Action</label>
                <select
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background w-full"
                  value={newRule.action}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = {
                      ...newRule,
                      action: v,
                      actionTarget:
                        v === 'Ask Question'
                          ? askTargetsAvailable[0]?.name || ''
                          : v === 'Skip Question'
                            ? fields[0]?.name || ''
                            : '',
                      expectedAnswer: v === 'Ask Question' ? newRule.expectedAnswer || '' : '',
                      questionRules: v === 'Ask Question' ? newRule.questionRules || [] : [],
                    };
                    setNewRule(next);
                  }}
                >
                  <option>End Call</option>
                  <option>Ask Question</option>
                  <option>Skip Question</option>
                </select>
              </div>

              {(newRule.action === 'Ask Question' || newRule.action === 'Skip Question') && (
                <div className="flex-1 flex flex-col gap-1.5 animate-in slide-in-from-left-2 duration-200">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">
                    Target Question
                  </label>
                  <select
                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background w-full"
                    value={newRule.actionTarget}
                    onChange={(e) =>
                      setNewRule({
                        ...newRule,
                        actionTarget: e.target.value,
                        questionRules: [],
                        expectedAnswer: '',
                      })
                    }
                  >
                    {(newRule.action === 'Ask Question' ? askTargetsAvailable : fields).map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.name}
                        {newRule.action === 'Ask Question' && usedAskTargets.has(f.name)
                          ? ' (already used)'
                          : ''}
                      </option>
                    ))}
                  </select>
                  {newRule.action === 'Ask Question' && askTargetsAvailable.length === 0 && (
                    <p className="text-xs text-destructive">
                      Every data field already has an Ask Question rule. Remove or edit an existing rule
                      to free a question.
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
                onClick={addRule}
              >
                <Plus size={18} className="mr-2" /> Add Rule
              </button>
            </div>

            {newRule.action === 'Ask Question' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">
                  Expected answer (for "{newRule.actionTarget || '…'}")
                </label>
                <textarea
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[2.5rem]"
                  placeholder='e.g. Lists Python and React; or any clear mention of backend + frontend skills'
                  value={newRule.expectedAnswer || ''}
                  onChange={(e) => setNewRule({ ...newRule, expectedAnswer: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Describe what a valid answer looks like (format, keywords, ranges). The AI uses this to
                  judge whether the response satisfies the question.
                </p>
              </div>
            )}

            {newRule.action === 'Ask Question' && (
              <div className="mt-2 pt-4 border-t border-border space-y-3">
                <div>
                  <h5 className="text-sm font-semibold">Rules for this question</h5>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Define what happens while or after asking "{newRule.actionTarget || '…'}". Each
                    question can only be the target of one Ask Question rule in this campaign.
                  </p>
                </div>

                {(newRule.questionRules || []).length > 0 && (
                  <div className="flex flex-col gap-2">
                    {(newRule.questionRules || []).map((qr, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-2 p-2 rounded-md border bg-background text-xs"
                      >
                        <span className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="flex flex-wrap gap-1 items-baseline">
                            <span className="font-mono text-muted-foreground">IF</span>
                            {qr.field === 'Any Intent' ? (
                              <span>{qr.condition}</span>
                            ) : (
                              <>
                                <span className="font-medium">{qr.field}</span>
                                <span className="italic text-muted-foreground">{qr.operator}</span>
                                <span>"{qr.value}"</span>
                              </>
                            )}
                            <span className="font-mono text-muted-foreground ml-1">THEN</span>
                            <span className="font-medium">
                              {qr.action === 'End Call'
                                ? 'End Call'
                                : `${qr.action === 'Ask Question' ? 'Ask' : 'Skip'} "${qr.actionTarget}"`}
                            </span>
                          </span>
                          {qr.action === 'Ask Question' && qr.expectedAnswer && (
                            <span className="text-muted-foreground">
                              Expected answer: {qr.expectedAnswer}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive p-1"
                          onClick={() => removeQuestionRule(idx)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2 bg-muted/20 p-3 rounded-lg border border-dashed">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Add nested rule
                  </span>
                  <div className="flex flex-col md:flex-row gap-2 flex-wrap">
                    <select
                      className="flex h-9 rounded-md border border-input bg-background px-2 text-xs md:max-w-[140px]"
                      value={newQuestionRule.field}
                      onChange={(e) => setNewQuestionRule({ ...newQuestionRule, field: e.target.value })}
                    >
                      <option>Any Intent</option>
                      {fields.map((f) => (
                        <option key={f.name}>{f.name}</option>
                      ))}
                    </select>
                    {newQuestionRule.field === 'Any Intent' ? (
                      <input
                        type="text"
                        className="flex h-9 flex-1 min-w-[120px] rounded-md border border-input bg-background px-2 text-xs"
                        placeholder="User says..."
                        value={newQuestionRule.condition}
                        onChange={(e) =>
                          setNewQuestionRule({ ...newQuestionRule, condition: e.target.value })
                        }
                      />
                    ) : (
                      <>
                        <select
                          className="flex h-9 rounded-md border border-input bg-background px-2 text-xs"
                          value={newQuestionRule.operator}
                          onChange={(e) =>
                            setNewQuestionRule({ ...newQuestionRule, operator: e.target.value })
                          }
                        >
                          <option value="equals">Equals</option>
                          <option value="contains">Contains</option>
                          <option value="does not contain">Does not contain</option>
                          <option value="greater than">Greater than</option>
                          <option value="less than">Less than</option>
                          <option value="is set">Is set</option>
                        </select>
                        <input
                          type="text"
                          className="flex h-9 flex-1 min-w-[80px] rounded-md border border-input bg-background px-2 text-xs"
                          placeholder="Value"
                          value={newQuestionRule.value}
                          onChange={(e) =>
                            setNewQuestionRule({ ...newQuestionRule, value: e.target.value })
                          }
                        />
                      </>
                    )}
                    <select
                      className="flex h-9 rounded-md border border-input bg-background px-2 text-xs"
                      value={newQuestionRule.action}
                      onChange={(e) => {
                        const v = e.target.value;
                        setNewQuestionRule({
                          ...newQuestionRule,
                          action: v,
                          actionTarget:
                            v === 'Ask Question' || v === 'Skip Question'
                              ? nestedAskOptions[0]?.name || ''
                              : '',
                          expectedAnswer: v === 'Ask Question' ? newQuestionRule.expectedAnswer || '' : '',
                        });
                      }}
                    >
                      <option>End Call</option>
                      <option>Ask Question</option>
                      <option>Skip Question</option>
                    </select>
                    {(newQuestionRule.action === 'Ask Question' ||
                      newQuestionRule.action === 'Skip Question') && (
                      <select
                        className="flex h-9 rounded-md border border-input bg-background px-2 text-xs md:max-w-[160px]"
                        value={newQuestionRule.actionTarget}
                        onChange={(e) =>
                          setNewQuestionRule({
                            ...newQuestionRule,
                            actionTarget: e.target.value,
                            expectedAnswer: '',
                          })
                        }
                      >
                        {(newQuestionRule.action === 'Ask Question' ? nestedAskOptions : fields).map(
                          (f) => (
                            <option key={f.name} value={f.name}>
                              {f.name}
                            </option>
                          )
                        )}
                      </select>
                    )}
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md h-9 px-3 bg-secondary text-secondary-foreground text-xs font-medium"
                      onClick={addQuestionRule}
                    >
                      <Plus size={14} className="mr-1" /> Add
                    </button>
                  </div>
                  {newQuestionRule.action === 'Ask Question' && nestedAskOptions.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      No other questions available to ask here (parent question excluded; each question
                      only once).
                    </p>
                  )}
                  {newQuestionRule.action === 'Ask Question' && (
                    <div className="flex flex-col gap-1 w-full mt-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">
                        Expected answer (for "{newQuestionRule.actionTarget || '…'}")
                      </label>
                      <textarea
                        rows={2}
                        className="flex w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground resize-y min-h-[2rem]"
                        placeholder="Valid answer criteria for this follow-up"
                        value={newQuestionRule.expectedAnswer || ''}
                        onChange={(e) =>
                          setNewQuestionRule({ ...newQuestionRule, expectedAnswer: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
