import { z } from 'zod';
import { FormVariableSchema } from '../schemas/form.schema';

type FormVariable = z.infer<typeof FormVariableSchema>;

export class CalculationEngine {
  private variables: Map<string, FormVariable> = new Map();
  private fieldValues: Map<string, any> = new Map();

  constructor(variables: FormVariable[] = [], fieldValues: Record<string, any> = {}) {
    this.updateVariables(variables);
    this.updateFieldValues(fieldValues);
  }

  updateVariables(variables: FormVariable[]) {
    this.variables.clear();
    variables.forEach(variable => {
      this.variables.set(variable.id, variable);
      this.variables.set(variable.name, variable); // Also index by name
    });
  }

  updateFieldValues(fieldValues: Record<string, any>) {
    this.fieldValues.clear();
    Object.entries(fieldValues).forEach(([key, value]) => {
      this.fieldValues.set(key, value);
    });
  }

  calculateVariable(variableId: string, computedValues: Record<string, any> = {}): any {
    const variable = this.variables.get(variableId);
    if (!variable) {
      throw new Error(`Variable ${variableId} not found`);
    }

    if (!variable.calculation && !variable.valueMapping?.enabled) {
      return variable.value;
    }

    // Handle Value Mapping
    if (variable.valueMapping?.enabled && variable.valueMapping.sourceFieldId) {
      const sourceValue = this.fieldValues.get(variable.valueMapping.sourceFieldId);
      if (sourceValue !== undefined) {
        // Direct mapping
        const mappedValue = variable.valueMapping.mappings[String(sourceValue ?? '')];
        if (mappedValue !== undefined) {
          return this.convertType(mappedValue, variable.type);
        }
      }
      return null;
    }

    try {
      // Create a safe evaluation context and include any previously computed variables
      const context = this.createEvaluationContext(computedValues);

      if (!variable.calculation) {
        return variable.value;
      }

      // Evaluate the expression
      const result = this.evaluateExpression(variable.calculation, context);

      // Type conversion based on variable type
      return this.convertType(result, variable.type);
    } catch (error) {
      return variable.value || null;
    }
  }

  calculateAllVariables(): Record<string, any> {
    const results: Record<string, any> = {};

    // Calculate variables in order of dependencies
    const calculated = new Set<string>();
    const variableList = Array.from(new Set(this.variables.values())); // Deduplicate by identity

    const calculateVariableRecursive = (variable: FormVariable) => {
      if (calculated.has(variable.id)) {
        return results[variable.id];
      }

      // Check dependencies
      if (variable.dependencies) {
        variable.dependencies.forEach(dep => {
          const depVariable = this.variables.get(dep);
          if (depVariable && !calculated.has(dep)) {
            calculateVariableRecursive(depVariable);
          }
        });
      }

      // Calculate this variable, providing already computed values for dependency resolution
      const result = this.calculateVariable(variable.id, results);
      results[variable.id] = result;
      calculated.add(variable.id);

      return result;
    };

    variableList.forEach(variable => {
      if (!calculated.has(variable.id)) {
        calculateVariableRecursive(variable);
      }
    });

    return results;
  }

  private createEvaluationContext(computedValues: Record<string, any> = {}): any {
    const context: any = {};

    // Add field values
    this.fieldValues.forEach((value, key) => {
      context[key] = value;
    });

    // Add variable values (for already calculated variables)
    this.variables.forEach((variable) => {
      const valueFromComputed = computedValues[variable.id];
      const value = valueFromComputed !== undefined ? valueFromComputed : variable.value;

      if (value !== undefined) {
        context[variable.name] = value;
        context[variable.id] = value;
      }
    });

    // Add math functions
    context.Math = Math;
    context.sum = (...numbers: number[]) => numbers.reduce((a, b) => a + b, 0);
    context.avg = (...numbers: number[]) => numbers.reduce((a, b) => a + b, 0) / numbers.length;
    context.min = (...numbers: number[]) => Math.min(...numbers);
    context.max = (...numbers: number[]) => Math.max(...numbers);
    context.round = (num: number, decimals?: number) => {
      return decimals ? Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals) : Math.round(num);
    };
    context.today = new Date();
    context.now = new Date();
    
    context.addDays = (d: any, n: any) => {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return null;
      dt.setDate(dt.getDate() + Number(n || 0));
      return dt;
    };
    context.addMonths = (d: any, n: any) => {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return null;
      const months = Number(n || 0);
      const m = dt.getMonth();
      dt.setMonth(m + months);
      if (dt.getMonth() !== ((m + months) % 12 + 12) % 12) {
        dt.setDate(0);
      }
      return dt;
    };
    context.addYears = (d: any, n: any) => {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return null;
      dt.setFullYear(dt.getFullYear() + Number(n || 0));
      return dt;
    };

    return context;
  }

  public evaluate(expression: string): any {
    const context = this.createEvaluationContext();
    return this.evaluateExpression(expression, context);
  }

  private evaluateExpression(expression: string, context: any): any {
    let processed = expression;

    try {
      const extendedContext: any = {
        ...context,
        age: (dob: any) => {
          if (!dob) return 0;
          const birthDate = new Date(dob);
          if (isNaN(birthDate.getTime())) return 0;
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          return age;
        },
        ageFromDate: (dob: any, target: any) => {
          if (!dob || !target) return 0;
          const birthDate = new Date(dob);
          const targetDate = new Date(target);
          if (isNaN(birthDate.getTime()) || isNaN(targetDate.getTime())) return 0;
          let age = targetDate.getFullYear() - birthDate.getFullYear();
          const m = targetDate.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && targetDate.getDate() < birthDate.getDate())) {
            age--;
          }
          return age;
        },
        ageFrom: (dob: any, target: any) => {
          return extendedContext.ageFromDate(dob, target);
        },
        diffDays: (d1: any, d2: any) => {
          const date1 = new Date(d1);
          const date2 = new Date(d2);
          if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 0;
          const diffTime = Math.abs(date2.getTime() - date1.getTime());
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        },
        diffMonths: (d1: any, d2: any) => {
          const date1 = new Date(d1);
          const date2 = new Date(d2);
          if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 0;
          return (date2.getFullYear() - date1.getFullYear()) * 12 + (date2.getMonth() - date1.getMonth());
        },
        diffYears: (d1: any, d2: any) => {
          const date1 = new Date(d1);
          const date2 = new Date(d2);
          if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 0;
          return date2.getFullYear() - date1.getFullYear();
        },
        abs: (val: any) => Math.abs(Number(val || 0)),
        floor: (val: any) => Math.floor(Number(val || 0)),
        ceil: (val: any) => Math.ceil(Number(val || 0)),
        pow: (base: any, exp: any) => Math.pow(Number(base || 0), Number(exp || 0)),
        sqrt: (val: any) => Math.sqrt(Number(val || 0)),
        sum: (...args: any[]) => args.reduce((a, b) => Number(a || 0) + Number(b || 0), 0),
        avg: (...args: any[]) => args.length ? args.reduce((a, b) => Number(a || 0) + Number(b || 0), 0) / args.length : 0,
        concat: (...args: any[]) => args.join(''),
        upper: (val: any) => String(val).toUpperCase(),
        lower: (val: any) => String(val).toLowerCase(),
      };

      const sanitizeIdentifier = (key: string) => {
        const safe = key.replace(/[^\w$]/g, '_');
        const startsWithValid = /^[A-Za-z_$]/.test(safe);
        const isReserved = ['Date', 'Math', 'Number', 'String', 'Boolean', 'Object', 'Array', 'globalThis', 'window', 'eval', 'Function'].includes(key);
        const safeKey = !startsWithValid || isReserved ? `_f_${safe}` : safe;
        return safeKey;
      };

      const keyMap: Record<string, string> = {};
      Object.keys(extendedContext).forEach((key) => {
        keyMap[key] = sanitizeIdentifier(key);
      });

      const safeContext: any = {};
      Object.entries(extendedContext).forEach(([key, value]) => {
        safeContext[keyMap[key]] = value;
      });

      Object.entries(keyMap).forEach(([orig, safe]) => {
        if (orig === safe) return;
        const regex = new RegExp(`\\b${orig}\\b`, 'g');
        processed = processed.replace(regex, safe);
      });

      const keys = Object.keys(safeContext);
      const values = Object.values(safeContext);

      const func = new Function(...keys, `
        try {
          return ${processed};
        } catch (e) {
          return null;
        }
      `);

      return func(...values);
    } catch (error) {
      return null;
    }
  }

  private convertType(value: any, targetType: string): any {
    switch (targetType) {
      case 'number':
        return Number(value) || 0;
      case 'string':
        return String(value);
      case 'boolean':
        return Boolean(value);
      case 'date':
        return value instanceof Date ? value : new Date(value);
      default:
        return value;
    }
  }
}
