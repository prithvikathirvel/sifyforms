import type { FormField } from '../types';

export function getFieldValidation(field: FormField) {
  const rules: any = {
    validate: {}
  };

  // 1. Legacy/Basic required field
  if (field.required) {
    rules.required = 'This field is required';
  }

  // 2. Legacy validation for backward compatibility
  if (field.validation) {
    if (field.validation.minLength) {
      rules.minLength = {
        value: field.validation.minLength,
        message: `Minimum ${field.validation.minLength} characters`,
      };
    }
    if (field.validation.maxLength) {
      rules.maxLength = {
        value: field.validation.maxLength,
        message: `Maximum ${field.validation.maxLength} characters`,
      };
    }
    if (field.validation.min !== undefined) {
      rules.min = {
        value: field.validation.min,
        message: `Minimum value is ${field.validation.min}`,
      };
    }
    if (field.validation.max !== undefined) {
      rules.max = {
        value: field.validation.max,
        message: `Maximum value is ${field.validation.max}`,
      };
    }
    if (field.validation.pattern) {
      try {
        rules.pattern = {
          value: new RegExp(field.validation.pattern),
          message: 'Invalid format',
        };
      } catch { }
    }
    if (field.validation.equalToFieldId) {
      const targetFieldId = field.validation.equalToFieldId;
      const errorMessage = field.validation.equalToMessage || 'Fields do not match';
      rules.validate.equalToLegacy = (value: any, formValues: any) => {
        const targetValue = formValues[targetFieldId];
        return value === targetValue || errorMessage;
      };
    }
  }

  // 3. NEW rules-based validation (Overrides or supplements legacy)
  if (field.rules && field.rules.length > 0) {
    field.rules.forEach((rule, index) => {
      // Legacy rules omit `enabled`, which means active. Only an explicit false
      // disables a rule, matching server-side enforcement.
      if (rule.enabled === false) return;
      const { type, value, message } = rule;
      const defaultMessage = (msg: string) => message || msg;

      switch (type) {
        case 'required':
          rules.required = defaultMessage('This field is required');
          break;
        case 'minLength':
          rules.minLength = {
            value: Number(value),
            message: defaultMessage(`Minimum ${value} characters`)
          };
          break;
        case 'maxLength':
          rules.maxLength = {
            value: Number(value),
            message: defaultMessage(`Maximum ${value} characters`)
          };
          break;
        case 'min':
          rules.min = {
            value: Number(value),
            message: defaultMessage(`Minimum value is ${value}`)
          };
          break;
        case 'max':
          rules.max = {
            value: Number(value),
            message: defaultMessage(`Maximum value is ${value}`)
          };
          break;
        case 'pattern':
        case 'regex':
          try {
            rules.pattern = {
              value: new RegExp(String(value)),
              message: defaultMessage('Invalid format')
            };
          } catch { }
          break;
        case 'email':
          rules.pattern = {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: defaultMessage('Invalid email address')
          };
          break;
        case 'url':
          rules.pattern = {
            value: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/,
            message: defaultMessage('Invalid URL')
          };
          break;

        // Custom validation functions for advanced operators
        case 'contains':
          rules.validate[`contains_${index}`] = (v: any) =>
            !v || String(v).includes(String(value)) || defaultMessage(`Must contain "${value}"`);
          break;
        case 'notContains':
          rules.validate[`notContains_${index}`] = (v: any) =>
            !v || !String(v).includes(String(value)) || defaultMessage(`Must not contain "${value}"`);
          break;
        case 'startsWith':
          rules.validate[`startsWith_${index}`] = (v: any) =>
            !v || String(v).startsWith(String(value)) || defaultMessage(`Must start with "${value}"`);
          break;
        case 'endsWith':
          rules.validate[`endsWith_${index}`] = (v: any) =>
            !v || String(v).endsWith(String(value)) || defaultMessage(`Must end with "${value}"`);
          break;
        case 'greaterThan':
          rules.validate[`gt_${index}`] = (v: any) =>
            !v || (v !== '' && Number(v) > Number(value)) || defaultMessage(`Must be greater than ${value}`);
          break;
        case 'lessThan':
          rules.validate[`lt_${index}`] = (v: any) =>
            !v || (v !== '' && Number(v) < Number(value)) || defaultMessage(`Must be less than ${value}`);
          break;
        case 'gte':
          rules.validate[`gte_${index}`] = (v: any) =>
            !v || (v !== '' && Number(v) >= Number(value)) || defaultMessage(`Must be at least ${value}`);
          break;
        case 'lte':
          rules.validate[`lte_${index}`] = (v: any) =>
            !v || (v !== '' && Number(v) <= Number(value)) || defaultMessage(`Must be at most ${value}`);
          break;
        case 'equals':
          rules.validate[`eq_${index}`] = (v: any) =>
            !v || String(v) === String(value) || defaultMessage(`Must be exactly "${value}"`);
          break;
        case 'notEquals':
          rules.validate[`neq_${index}`] = (v: any) =>
            !v || String(v) !== String(value) || defaultMessage(`Must not be "${value}"`);
          break;
        case 'custom': // Equal to field ID
          rules.validate[`custom_${index}`] = (v: any, formValues: any) => {
            const targetValue = formValues[String(value)];
            // Use string comparison to avoid type mismatch issues (e.g. "123" vs 123)
            const isValid = !v || String(v) === String(targetValue);
            return isValid || defaultMessage(`Does not match field`);
          };
          break;
      }
    });
  }

  // If no custom validation functions were added, remove the empty validate object
  if (Object.keys(rules.validate).length === 0) {
    delete rules.validate;
  }

  return rules;
}
