import React from 'react';
import { Plus, X } from 'lucide-react';

export default function StepEvaluationRules({ payload, updatePayload }) {
  // Ensure we have a valid rules object
  const rules = payload.rules || {};
  const fieldsToExtract = rules.fieldsToExtract || [];
  const scoringRules = rules.scoringRules || [];

  const addFieldToExtract = () => {
    updatePayload({
      rules: {
        ...rules,
        fieldsToExtract: [
          ...fieldsToExtract,
          { field: '', type: 'string', unit: '' }
        ]
      }
    });
  };

  const updateFieldToExtract = (idx, field, value) => {
    const newList = [...fieldsToExtract];
    newList[idx] = { ...newList[idx], [field]: value };
    updatePayload({ rules: { ...rules, fieldsToExtract: newList } });
  };

  const removeFieldToExtract = (idx) => {
    const newList = fieldsToExtract.filter((_, i) => i !== idx);
    updatePayload({ rules: { ...rules, fieldsToExtract: newList } });
  };

  const addScoringRule = () => {
    updatePayload({
      rules: {
        ...rules,
        scoringRules: [
          ...scoringRules,
          { field: '', condition: 'equals', value: '', score: 10, label: '' }
        ]
      }
    });
  };

  const updateScoringRule = (idx, field, value) => {
    const newList = [...scoringRules];
    // If it's the score field, parse it as int
    if (field === 'score') {
      value = parseInt(value, 10) || 0;
    }
    newList[idx] = { ...newList[idx], [field]: value };
    updatePayload({ rules: { ...rules, scoringRules: newList } });
  };

  const removeScoringRule = (idx) => {
    const newList = scoringRules.filter((_, i) => i !== idx);
    updatePayload({ rules: { ...rules, scoringRules: newList } });
  };

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight">Evaluation & Reporting Rules</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Tell the AI what information to automatically extract from the call transcript and how to calculate a score for the call.
        </p>
      </div>

      {/* Fields to Extract Section */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-semibold text-lg">Fields to Extract</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Specific data points the AI should pull from the conversation.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            onClick={addFieldToExtract}
          >
            <Plus size={16} className="mr-1" /> Add Field
          </button>
        </div>

        {fieldsToExtract.length === 0 ? (
          <div className="text-muted-foreground text-sm py-6 text-center border border-dashed rounded-lg bg-muted/20">
            No fields defined. The AI won't extract any structured data.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {fieldsToExtract.map((f, idx) => (
              <div key={idx} className="flex flex-col md:flex-row items-end gap-3 p-3 rounded-md border bg-muted/5 relative">
                <div className="flex-1 w-full">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Field Name</label>
                  <input
                    type="text"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground"
                    placeholder="e.g. experience"
                    value={f.field}
                    onChange={(e) => updateFieldToExtract(idx, 'field', e.target.value)}
                  />
                </div>
                <div className="w-full md:w-32">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Type</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
                    value={f.type}
                    onChange={(e) => updateFieldToExtract(idx, 'type', e.target.value)}
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="array">Array (List)</option>
                  </select>
                </div>
                <div className="flex-1 w-full">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Unit / Notes (Optional)</label>
                  <input
                    type="text"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground"
                    placeholder="e.g. years"
                    value={f.unit || ''}
                    onChange={(e) => updateFieldToExtract(idx, 'unit', e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="h-9 w-9 inline-flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors border border-transparent hover:border-destructive/20 shrink-0"
                  onClick={() => removeFieldToExtract(idx)}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scoring Rules Section */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-semibold text-lg">Scoring Rules</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Award points based on the extracted fields.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            onClick={addScoringRule}
          >
            <Plus size={16} className="mr-1" /> Add Rule
          </button>
        </div>

        {scoringRules.length === 0 ? (
          <div className="text-muted-foreground text-sm py-6 text-center border border-dashed rounded-lg bg-muted/20">
            No scoring rules defined. Calls will not receive a score.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {scoringRules.map((rule, idx) => (
              <div key={idx} className="flex flex-col gap-3 p-3 rounded-md border bg-muted/5 relative">
                <div className="flex items-center justify-between absolute right-3 top-3">
                  <button
                    type="button"
                    className="h-6 w-6 inline-flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
                    onClick={() => removeScoringRule(idx)}
                  >
                    <X size={14} />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pr-8">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Target Field</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
                      value={rule.field}
                      onChange={(e) => updateScoringRule(idx, 'field', e.target.value)}
                    >
                      <option value="">-- Select Field --</option>
                      {fieldsToExtract.map((f, i) => (
                        <option key={i} value={f.field}>{f.field}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Condition</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
                      value={rule.condition}
                      onChange={(e) => updateScoringRule(idx, 'condition', e.target.value)}
                    >
                      <option value="equals">Equals</option>
                      <option value="contains">Contains</option>
                      <option value="gt">Greater Than</option>
                      <option value="gte">Greater or Equal</option>
                      <option value="lt">Less Than</option>
                      <option value="lte">Less or Equal</option>
                      <option value="is_true">Is True</option>
                      <option value="is_false">Is False</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Value to match</label>
                    <input
                      type="text"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground disabled:opacity-50"
                      placeholder="e.g. 3 or React"
                      value={rule.value}
                      disabled={rule.condition === 'is_true' || rule.condition === 'is_false'}
                      onChange={(e) => updateScoringRule(idx, 'value', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Points (+)</label>
                    <input
                      type="number"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
                      value={rule.score}
                      onChange={(e) => updateScoringRule(idx, 'score', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Label / Description</label>
                  <input
                    type="text"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground"
                    placeholder="e.g. Has 3+ years experience"
                    value={rule.label || ''}
                    onChange={(e) => updateScoringRule(idx, 'label', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
