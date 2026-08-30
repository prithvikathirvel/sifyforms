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
  
  // 1. Sanitize all incoming data
  const data: Record<string, any> = {};
  Object.entries(submittedData).forEach(([key, val]) => {
    data[key] = normalizeValue(val);
  });

  const fields = schema.fields || [];
  const variables = schema.variables || [];

  // 1. CAPTCHA Check
  if (captchaActual && (Number(captchaSubmitted) !== captchaActual.answer)) {
    errors['captcha'] = 'Security verification failed. Incorrect answer.';
  }

  // 2. Re-calculate Variables
  const engine = new CalculationEngine(variables, data);
  const calculatedVariables = engine.calculateAllVariables();
  
  // 3. Rule Enforcement and Field Validation
  for (const field of fields) {
    // Check visibility
    const isVisible = evaluateShowWhen(field.showWhen, data);
    if (!isVisible) {
      // If field is hidden, we might want to strip its data, but let's keep it for now
      // return;
    }

    const value = data[field.id];

    // Check required
    if (field.required && isEmpty(value)) {
      errors[field.id] = field.label + ' is required';
      continue;
    }

    if (isEmpty(value)) continue;

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
        if (!rule.enabled) return;

        const { type, value: ruleVal, message } = rule;
        const msg = message || 'Invalid format';

        switch (type) {
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
        console.log(isGet ? `Query Parameters:` : `Body Payload:`, JSON.stringify(payload, null, 2));
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
        console.log(`Final URL: ${response.config.url}${isGet && response.config.params ? '?' + new URLSearchParams(response.config.params as any).toString() : ''}`);
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
