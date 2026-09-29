// The question model: the condition vocabulary and the factory for a blank
// item. Kept out of QuestionCard.jsx so that file exports only components.
export const CONDITIONS = [
  'contains', 'does not contain', 'equals', 'starts with', 'ends with',
  'is greater than', 'is less than', 'is any value'
];

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function emptyItem(order) {
  return {
    id: uid(),
    order,
    itemType: 'question',
    text: '',
    is_mandatory: false,
    weight: 0,
    isWeightManuallySet: false,
    expectedAnswer: { condition: 'is any value', value: '' },
    scoringCriteria: '',
    scoringActiveTab: 'condition',
    onAnswer: { action: 'continue', skipToId: '', skipConditionActiveTab: 'condition', skipCondition: { condition: 'contains', value: '' } },
    fieldsToExtract: [],
  };
}
