import xss from 'xss';
import axios from 'axios';
import { CalculationEngine } from './calculationEngine';

/**
 * Header keys that may carry credentials. Values for these keys are masked
 * before anything is written to logs, so bearer tokens, basic-auth strings,
 * API keys and cookies never end up in log aggregation.
 */
const SECRET_HEADER_KEY_PATTERN = /authorization|cookie|token|api[-_]?key|x-api-key/i;

/** Return a copy of `headers` with sensitive values masked. */
export function redactSecrets(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SECRET_HEADER_KEY_PATTERN.test(key) ? '[REDACTED]' : value;
  }
  return out;
}

export function normalizeValue(val: any): any {
  if (val === undefined || val === null) return val;
  if (typeof val === 'string') {
    // Basic trimming and XSS sanitization
    return xss(val.trim());
  }
  if (Array.isArray(val)) {
    return val.map(v => typeof v === 'string' ? xss(v) : v);
  }
  return val;
}

export function isEmpty(v: any): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

function evaluateCondition(condition: any, values: Record<string, any>): boolean {
  const actualValue = normalizeValue(values[condition.fieldId]);
  const conditionValue = condition.value;

  const isIncluded = (container: any, value: any) => {
    if (Array.isArray(container)) {
      return container.some((v) => String(v) === String(value));
    }
    return String(container) === String(value);
  };

  switch (condition.operator) {
    case 'equals':
      if (actualValue === undefined || actualValue === null) return false;
      if (Array.isArray(actualValue)) {
        return actualValue.some((v) => String(v) === String(conditionValue));
      }
      return String(actualValue) === String(conditionValue);

    case 'notEquals':
      if (actualValue === undefined || actualValue === null) {
        return !isEmpty(conditionValue);
      }
      if (Array.isArray(actualValue)) {
        return !actualValue.some((v) => String(v) === String(conditionValue));
      }
      return String(actualValue) !== String(conditionValue);

    case 'contains':
      if (actualValue === undefined || actualValue === null) return false;
      if (Array.isArray(actualValue)) {
        return actualValue.some((v) => String(v).includes(String(conditionValue)));
      }
      return String(actualValue).toLowerCase().includes(String(conditionValue).toLowerCase());

    case 'notContains':
      if (actualValue === undefined || actualValue === null) return true;
      if (Array.isArray(actualValue)) {
        return !actualValue.some((v) => String(v).includes(String(conditionValue)));
      }
      return !String(actualValue).toLowerCase().includes(String(conditionValue).toLowerCase());

    case 'isEmpty':
      return isEmpty(actualValue);

    case 'isNotEmpty':
      return !isEmpty(actualValue);

    case 'greaterThan':
      if (actualValue === undefined || actualValue === null) return false;
      return Number(actualValue) > Number(conditionValue);

    case 'lessThan':
      if (actualValue === undefined || actualValue === null) return false;
      return Number(actualValue) < Number(conditionValue);

    case 'gte':
      if (actualValue === undefined || actualValue === null) return false;
      return Number(actualValue) >= Number(conditionValue);

    case 'lte':
      if (actualValue === undefined || actualValue === null) return false;
      return Number(actualValue) <= Number(conditionValue);

    case 'in':
      if (actualValue === undefined || actualValue === null) return false;
      const inArr = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
      return inArr.some((v) => isIncluded(actualValue, v));

    case 'notIn':
      if (actualValue === undefined || actualValue === null) return true;
      const notInArr = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
      return !notInArr.some((v) => isIncluded(actualValue, v));

    default:
      return false;
  }
}

/** A node is a nested group if it carries its own logic + conditions; otherwise it's a single condition */
function isShowWhenGroup(node: any): boolean {
  return node && typeof node === 'object' && Array.isArray(node.conditions) && 'logic' in node;
}

/** Evaluate a rule-tree node: a single condition or a nested AND/OR group (mirrors frontend ruleEngine) */
function evaluateNode(node: any, values: Record<string, any>): boolean {
  if (isShowWhenGroup(node)) {
    if (!node.conditions || node.conditions.length === 0) return true;
    const results = node.conditions.map((child: any) => evaluateNode(child, values));
    return node.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
  }
  return evaluateCondition(node, values);
}

export function evaluateShowWhen(rule: any, values: Record<string, any>): boolean {
  if (!rule || !rule.conditions || rule.conditions.length === 0) {
    return true;
  }
  return evaluateNode(rule, values);
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  data: Record<string, any>;
}

export async function validateSubmission(schema: any, submittedData: Record<string, any>, captchaActual: { text: string; answer: number } | null, captchaSubmitted: any): Promise<ValidationResult> {
  const errors: Record<string, string> = {};
  
  const fields = Array.isArray(schema?.fields) ? schema.fields : [];
  const variables = Array.isArray(schema?.variables) ? schema.variables : [];

  // Only published field IDs may reach storage. This prevents request tampering
  // from injecting arbitrary properties or client-computed values. Display-only
  // and disabled fields are not respondent input and are discarded as well.
  const acceptedFieldIds = new Set(
    fields
      .filter((field: any) => field && !field.disabled && !['display', 'html'].includes(field.type))
      .map((field: any) => String(field.id))
  );
  const data: Record<string, any> = {};
  Object.entries(submittedData).forEach(([key, val]) => {
    if (acceptedFieldIds.has(key)) data[key] = normalizeValue(val);
  });

  // 1. CAPTCHA Check
  if (captchaActual && (Number(captchaSubmitted) !== captchaActual.answer)) {
    errors['captcha'] = 'Security verification failed. Incorrect answer.';
  }

  // 2. Re-calculate Variables
  const engine = new CalculationEngine(variables, data);
  const calculatedVariables = engine.calculateAllVariables();
  
  // 3. Rule Enforcement and Field Validation
  for (const field of fields) {
    if (!field || !acceptedFieldIds.has(String(field.id))) continue;
    // Check visibility
    const isVisible = evaluateShowWhen(field.showWhen, data);
    if (!isVisible) {
      // Hidden answers can be forged independently of the condition in a raw
      // request. Drop them so they cannot affect reports or downstream systems.
      delete data[field.id];
      continue;
    }

    const value = data[field.id];

    // Check required
    if (field.required && isEmpty(value)) {
      errors[field.id] = field.label + ' is required';
      continue;
    }

    if (isEmpty(value)) {
      const requiredRule = Array.isArray(field.rules)
        ? field.rules.find((rule: any) => rule?.type === 'required' && rule.enabled !== false)
        : undefined;
      if (requiredRule) errors[field.id] = requiredRule.message || `${field.label} is required`;
      continue;
    }

    // Core type validation is a server-side security boundary. Browser and
    // react-hook-form checks improve UX, but can be removed from a forged POST.
    const stringTypes = new Set(['text', 'email', 'phone', 'select', 'radio', 'date', 'time', 'textarea']);
    if (stringTypes.has(field.type) && typeof value !== 'string') {
      errors[field.id] = `${field.label} has an invalid value.`;
      continue;
    }
    if (['checkbox', 'multiselect'].includes(field.type) && (
      !Array.isArray(value) || value.some((item: any) => typeof item !== 'string')
    )) {
      errors[field.id] = `${field.label} must contain a list of selected options.`;
      continue;
    }
    if (typeof value === 'string' && value.length > 100_000) {
      errors[field.id] = `${field.label} is too long.`;
      continue;
    }
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
      errors[field.id] = 'Please enter a valid email address.';
      continue;
    }
    if ((field.type === 'number' || field.type === 'rating') && !Number.isFinite(Number(value))) {
      errors[field.id] = `${field.label} must be a valid number.`;
      continue;
    }
    if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      errors[field.id] = `${field.label} must be a valid date.`;
      continue;
    }
    if (field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(value))) {
      errors[field.id] = `${field.label} must be a valid time.`;
      continue;
    }

    if (['select', 'radio', 'checkbox', 'multiselect'].includes(field.type)) {
      const selected = Array.isArray(value) ? value.map(String) : [String(value)];
      if (['checkbox', 'multiselect'].includes(field.type) && !Array.isArray(value)) {
        errors[field.id] = `${field.label} must contain a list of selected options.`;
        continue;
      }
      if (['select', 'radio'].includes(field.type) && Array.isArray(value)) {
        errors[field.id] = `${field.label} accepts only one option.`;
        continue;
      }
      // Include every configured static/dynamic option. A submitted label or an
      // invented option is never accepted merely because it came from a client.
      const allowed = new Set<string>();
      const addOptions = (options: any) => {
        if (!Array.isArray(options)) return;
        options.forEach((option: any) => {
          if (option && option.value !== undefined) allowed.add(String(option.value));
        });
      };
      addOptions(field.options);
      if (field.dynamicOptions?.mappings) Object.values(field.dynamicOptions.mappings).forEach(addOptions);
      if (field.fieldLinking?.dynamicConfig?.options) Object.values(field.fieldLinking.dynamicConfig.options).forEach(addOptions);
      (field.fieldLinking?.rules || []).forEach((rule: any) => addOptions(rule.dynamicOptions));
      if (allowed.size > 0 && selected.some((option) => !allowed.has(option))) {
        errors[field.id] = `${field.label} contains an invalid option.`;
        continue;
      }
    }

    // File field validation (DMS references or base64 objects)
    if (field.type === 'file' && field.fileConfig) {
      const files = Array.isArray(value) ? value : [value];
      const cfg = field.fileConfig;
      if (!cfg.multiple && files.length > 1) {
        errors[field.id] = 'Only one file is allowed.';
        continue;
      }
      if (cfg.maxFiles && files.length > cfg.maxFiles) {
        errors[field.id] = `Maximum ${cfg.maxFiles} files allowed.`;
        continue;
      }
      for (const f of files) {
        if (typeof f !== 'object' || !f) continue;
        const maxBytes = cfg.maxSize > 1024 ? cfg.maxSize : cfg.maxSize * 1024 * 1024;
        if (cfg.maxSize && f.size && f.size > maxBytes) {
          errors[field.id] = `File "${f.filename || f.name}" exceeds maximum size.`;
          break;
        }
        if (cfg.accept && cfg.accept.length > 0) {
          const fname = f.filename || f.name || '';
          const fmime = f.mimeType || f.type || '';
          const allowed = (cfg.accept as string[]).some((pattern: string) => {
            if (pattern.startsWith('.')) return fname.toLowerCase().endsWith(pattern.toLowerCase());
            if (pattern.endsWith('/*')) return fmime.startsWith(pattern.replace('/*', '/'));
            return fmime === pattern;
          });
          if (!allowed) {
            errors[field.id] = `File "${fname}" is not an allowed type.`;
            break;
          }
        }
      }
      if (errors[field.id]) continue;
    }

    // Rules
    if (field.rules && field.rules.length > 0) {
      field.rules.forEach((rule: any) => {
        // Historical rules did not persist `enabled`; absence means active.
        // Treating undefined as disabled allowed browser-tampered submissions to
        // bypass cross-field “must match” and every other inspector rule.
        if (rule.enabled === false) return;

        const { type, value: ruleVal, message } = rule;
        const msg = message || 'Invalid format';

        switch (type) {
          case 'required':
            if (isEmpty(value)) errors[field.id] = message || `${field.label} is required`;
            break;
          case 'minLength':
            if (String(value).length < Number(ruleVal)) errors[field.id] = msg;
            break;
          case 'maxLength':
            if (String(value).length > Number(ruleVal)) errors[field.id] = msg;
            break;
          case 'min':
            if (Number(value) < Number(ruleVal)) errors[field.id] = msg;
            break;
          case 'max':
            if (Number(value) > Number(ruleVal)) errors[field.id] = msg;
            break;
          case 'pattern':
          case 'regex':
            try {
              const regex = new RegExp(String(ruleVal));
              if (!regex.test(String(value))) errors[field.id] = msg;
            } catch {}
            break;
          case 'email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) errors[field.id] = msg;
            break;
          case 'url':
            if (!/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/.test(String(value))) errors[field.id] = msg;
            break;
          case 'equals':
            if (String(value) !== String(ruleVal)) errors[field.id] = msg;
            break;
          case 'notEquals':
            if (String(value) === String(ruleVal)) errors[field.id] = msg;
            break;
          case 'contains':
            if (!String(value).includes(String(ruleVal))) errors[field.id] = msg;
            break;
          case 'notContains':
            if (String(value).includes(String(ruleVal))) errors[field.id] = msg;
            break;
          case 'startsWith':
            if (!String(value).startsWith(String(ruleVal))) errors[field.id] = msg;
            break;
          case 'endsWith':
            if (!String(value).endsWith(String(ruleVal))) errors[field.id] = msg;
            break;
          case 'greaterThan':
            if (Number(value) <= Number(ruleVal)) errors[field.id] = msg;
            break;
          case 'lessThan':
            if (Number(value) >= Number(ruleVal)) errors[field.id] = msg;
            break;
          case 'gte':
            if (Number(value) < Number(ruleVal)) errors[field.id] = msg;
            break;
          case 'lte':
            if (Number(value) > Number(ruleVal)) errors[field.id] = msg;
            break;
          case 'custom': // Match another field
            if (String(value) !== String(data[String(ruleVal)])) errors[field.id] = msg;
            break;
        }
      });
    }

    // Legacy validation
    if (field.validation && !errors[field.id]) {
      const v = field.validation;
      if (v.minLength && String(value).length < v.minLength) errors[field.id] = `Min ${v.minLength} chars`;
      if (v.maxLength && String(value).length > v.maxLength) errors[field.id] = `Max ${v.maxLength} chars`;
      if (v.min !== undefined && Number(value) < v.min) errors[field.id] = `Min value ${v.min}`;
      if (v.max !== undefined && Number(value) > v.max) errors[field.id] = `Max value ${v.max}`;
      if (v.pattern) {
        try {
          const regex = new RegExp(v.pattern);
          if (!regex.test(String(value))) errors[field.id] = 'Invalid format';
        } catch {}
      }
      if (v.equalToFieldId && String(value) !== String(data[v.equalToFieldId])) {
        errors[field.id] = v.equalToMessage || 'Fields do not match';
      }
    }

    // 4. External Validation
    if (field.externalValidation?.enabled && !errors[field.id] && !isEmpty(value)) {
      const config = field.externalValidation;
      try {
        let payload: any = {};
        const fieldKey = config.fieldValueKey || 'value';
        payload[fieldKey] = value;

        if (config.params && Array.isArray(config.params)) {
          config.params.forEach((param: any) => {
            if (param.key) {
              if (param.type === 'static') {
                payload[param.key] = param.value;
              } else if (param.type === 'field' && data) {
                payload[param.key] = data[param.value];
              }
            }
          });
        }

        const headers: any = {};
        if (config.headers && Array.isArray(config.headers)) {
          config.headers.forEach((h: any) => {
            if (h.key) headers[h.key] = h.value;
          });
        }

        if (config.auth) {
          if (config.auth.type === 'bearer' && config.auth.token) {
            headers['Authorization'] = `Bearer ${config.auth.token}`;
          } else if (config.auth.type === 'basic' && config.auth.username && config.auth.password) {
            headers['Authorization'] = `Basic ${Buffer.from(config.auth.username + ':' + config.auth.password).toString('base64')}`;
          } else if (config.auth.type === 'custom' && config.auth.customHeaderName && config.auth.token) {
            headers[config.auth.customHeaderName] = config.auth.token;
          }
        }

        const isGet = (config.method || 'POST').toUpperCase() === 'GET';
        console.log('--- External Validation (Submission) Request ---');
        console.log(`URL: ${config.url}`);
        console.log(`Method: ${config.method || 'POST'}`);
        console.log(`Headers:`, JSON.stringify(redactSecrets(headers), null, 2));
        // Log only the keys (not the respondent's value) so PII never reaches logs.
        console.log(isGet ? `Query Parameter Keys:` : `Body Payload Keys:`, JSON.stringify(Object.keys(payload)));
        console.log('--------------------------------------------');

        const response = await axios({
          url: config.url,
          method: config.method || 'POST',
          headers,
          [isGet ? 'params' : 'data']: payload,
          timeout: 5000 
        });

        console.log('--- External Validation (Submission) Response ---');
        console.log(`Status: ${response.status} ${response.statusText}`);
        // Query params (GET) can contain the respondent's value, so log only the
        // final path, never the query string.
        console.log(`Final URL: ${response.config.url}`);
        console.log(`Response Data:`, '[redacted]');
        console.log('-----------------------------------------------');

        let isValid = true;
        let targetValueExtracted = response.data;
        
        const responseCheck = config.responseCheck;
        const checkType = responseCheck?.type || responseCheck?.logic || 'boolean';
        
        if (responseCheck?.path) {
          targetValueExtracted = responseCheck.path.split('.').reduce((obj: any, key: string) => obj?.[key], response.data);
        } else if (config.successPath) {
          targetValueExtracted = config.successPath.split('.').reduce((obj: any, key: string) => obj?.[key], response.data);
        }
        
        switch (checkType) {
          case 'boolean':
            isValid = Boolean(targetValueExtracted);
            break;
          case 'equals':
            isValid = String(targetValueExtracted) === String(responseCheck?.targetValue);
            break;
          case 'notEquals':
            isValid = String(targetValueExtracted) !== String(responseCheck?.targetValue);
            break;
          case 'contains':
            isValid = String(targetValueExtracted).includes(String(responseCheck?.targetValue));
            break;
          case 'notContains':
            isValid = !String(targetValueExtracted).includes(String(responseCheck?.targetValue));
            break;
          case 'regex':
            try {
              const regex = new RegExp(String(responseCheck?.targetValue));
              isValid = regex.test(String(targetValueExtracted));
            } catch {
              isValid = false;
            }
            break;
          case 'greaterThan':
            isValid = Number(targetValueExtracted) > Number(responseCheck?.targetValue);
            break;
          case 'lessThan':
            isValid = Number(targetValueExtracted) < Number(responseCheck?.targetValue);
            break;
          case 'exists':
            isValid = targetValueExtracted !== undefined && targetValueExtracted !== null;
            break;
          default:
            isValid = Boolean(targetValueExtracted);
        }

        if (!isValid) {
          errors[field.id] = config.errorMsg || 'External validation failed';
        }
      } catch (error: any) {
        console.log('--- External Validation (Submission) Error Response ---');
        if (error.response) {
          console.log(`Status: ${error.response.status} ${error.response.statusText}`);
          console.log(`Response Data:`, '[redacted]');
        } else {
          console.log(`Error Message:`, error.message);
        }
        console.log('-----------------------------------------------');
        console.error(`External validation error for field ${field.id}:`, error.message);
        errors[field.id] = config.errorMsg || 'Could not reach validation server';
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data
  };
}
