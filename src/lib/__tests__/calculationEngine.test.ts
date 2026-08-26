import { CalculationEngine } from '../calculationEngine';

describe('CalculationEngine date helpers', () => {
  let engine: CalculationEngine;

  beforeEach(() => {
    engine = new CalculationEngine([], {});
  });

  test('addDays should move forward by given number of days', () => {
    const result = engine.evaluate("addDays('2026-03-10', 5)");
    expect(new Date(result).toISOString().startsWith('2026-03-15')).toBe(true);
  });

  test('addMonths should move forward by months, handling month overflow', () => {
    const result = engine.evaluate("addMonths('2026-01-31', 1)");
    // February 2026 has 28 days
    expect(new Date(result).getDate()).toBe(28);
  });

  test('addYears should move forward by years', () => {
    const result = engine.evaluate("addYears('2020-02-29', 1)");
    expect(new Date(result).getFullYear()).toBe(2021);
  });

  test('chain of helpers can add and subtract correctly', () => {
    // reproduce the same calculation using nested helpers
    const expr = `addYears(addDays(addMonths('2026-03-10', 1), 7), 2) /* up to here -> 2028-04-17 */
                ` + 
                `/* subtract steps: */
                addYears(addMonths(addDays('2028-04-17', -10), -1), 2)`;
    const result = engine.evaluate(expr);
    expect(result).toBe('2030-03-07');
  });
});

describe('CalculationEngine variable dependency resolution', () => {
  test('calculateAllVariables resolves dependencies in order and passes computed values', () => {
    const variables = [
      { id: 'v1', name: 'base', type: 'number', calculation: 'field1 + 2', dependencies: ['field1'], value: undefined },
      { id: 'v2', name: 'timesThree', type: 'number', calculation: 'base * 3', dependencies: ['base'], value: undefined },
    ];

    const fieldValues = { field1: 5 };
    const engineWithVars = new CalculationEngine(variables as any, fieldValues);

    const results = engineWithVars.calculateAllVariables();
    expect(results.v1).toBe(7);
    expect(results.v2).toBe(21);
  });

  test('field named Date should not shadow global Date constructor when calculating age', () => {
    const variables = [
      { id: 'ageVar', name: 'age', type: 'number', calculation: 'age(Date)', dependencies: ['Date'], value: undefined },
    ];

    const fieldValues = { Date: '2001-01-01' };
    const engineWithVars = new CalculationEngine(variables as any, fieldValues);

    const results = engineWithVars.calculateAllVariables();
    expect(results.ageVar).toBeGreaterThan(0);
  });
});
