import { describe, it, expect } from 'vitest';
import { insertVariable, matchVariables } from './variablesContext';

const variables = [
  { id: 'v_amt001', key: 'amount', label: 'Amount owed' },
  { id: 'v_due001', key: 'due_date', label: 'Last date' },
  { id: 'v_are001', key: 'area', label: 'Pending area' },
];

describe('the variable picker', () => {
  it('matches names that start with what was typed first, then ones that contain it', () => {
    expect(matchVariables(variables, '').map(v => v.key)).toEqual(['name', 'amount', 'due_date', 'area']);
    expect(matchVariables(variables, 'a').map(v => v.key)).toEqual(['amount', 'area', 'name', 'due_date']);
    expect(matchVariables(variables, 'pend').map(v => v.key)).toEqual(['area']);
  });

  it('replaces ## or {{ and the partial name with {{name}}, caret after it', () => {
    expect(insertVariable('Hi ##am', 7, 'amount')).toEqual({ text: 'Hi {{amount}}', caret: 13 });
    expect(insertVariable('Pay {{ am by Friday', 9, 'amount')).toEqual({ text: 'Pay {{amount}} by Friday', caret: 14 });
    expect(insertVariable('Pay {{am}} today', 8, 'amount')).toEqual({ text: 'Pay {{amount}} today', caret: 14 });
    expect(insertVariable('no trigger', 10, 'amount')).toEqual({ text: 'no trigger', caret: 10 });
  });
});
