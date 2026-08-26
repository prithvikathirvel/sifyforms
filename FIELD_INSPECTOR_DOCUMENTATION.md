# Field Inspector Configuration Reference

This document details the JSON schema for a **Form Field** as it is configured via the **Field Inspector** in the form builder. The JSON structure is represented by the `FormField` type and is used to store the form schema in the backend and render it dynamically on the frontend.

---

## 1. Basic Properties
Every field has a base configuration that defines its identity, type, and appearance.

### JSON Structure
```json
{
  "id": "field_1710000000000",
  "type": "text",
  "label": "First Name",
  "placeholder": "Enter your first name",
  "helpText": "As it appears on your passport",
  "required": true,
  "width": "half"
}
```

### Property Reference
*   **`id`**: Unique identifier (auto-generated timestamp).
*   **`type`**: The UI component to render (e.g., `"text"`, `"email"`, `"select"`, `"multiselect"`, `"date"`, `"file"`).
*   **`label`**: The display name of the field.
*   **`placeholder`**: Hint text shown inside text inputs.
*   **`helpText`**: Smaller instruction text rendered below the input.
*   **`required`**: Boolean dictating if the form blocks submission when empty.
*   **`width`**: Controls the flex grid width (`"full"`=100%, `"half"`=50%, `"third"`=33%).

---

## 2. Options Configuration
Applicable to fields with multiple choices: `select`, `multiselect`, `radio`, `checkbox`.

### JSON Structure
```json
{
  "type": "select",
  "label": "Country",
  "options": [
    { "label": "United States", "value": "us" },
    { "label": "Canada", "value": "ca" },
    { "label": "United Kingdom", "value": "uk" }
  ]
}
```

### Property Reference
*   **`options`**: An array of objects, each containing a `label` (what the user sees) and a `value` (what is submitted to the backend).

---

## 3. File Upload Settings
Applicable only when `type: "file"`.

### JSON Structure
```json
{
  "type": "file",
  "label": "Resume",
  "fileConfig": {
    "accept": [".pdf", ".doc,.docx"],
    "minSize": 1024,
    "maxSize": 5242880,
    "multiple": false
  }
}
```

### Property Reference
*   **`fileConfig.accept`**: Array of permitted file extensions or mime types.
*   **`fileConfig.minSize`**: Minimum file size in bytes (e.g., `1024` = 1KB).
*   **`fileConfig.maxSize`**: Maximum file size in bytes (e.g., `5242880` bytes = 5MB).
*   **`fileConfig.multiple`**: Boolean allowing the user to select more than one file.

---

## 4. Input Validation (Rules)
Defines complex validation conditions (like regex matches, min lengths, or matching another field). Managed in the Validation Modal.

### JSON Structure
```json
{
  "type": "text",
  "label": "Username",
  "rules": [
    {
      "id": "rule_171000001",
      "type": "minLength",
      "value": "5",
      "message": "Username must be at least 5 characters long."
    },
    {
      "id": "rule_171000002",
      "type": "pattern",
      "value": "^[a-zA-Z0-9_]+$",
      "message": "Only alphanumeric and underscores allowed."
    },
    {
      "id": "rule_171000003",
      "type": "custom",
      "value": "field_some_other_id",
      "message": "Username cannot match your password field."
    }
  ]
}
```

### Property Reference
*   **`rules`**: Array of active validation conditions.
*   **`rules[].type`**: The constraint type (`"required"`, `"minLength"`, `"pattern"`, `"email"`, `"custom"`, etc.).
*   **`rules[].value`**: The target threshold (number for min/max, string for Regex, or target field ID for `"custom"` rules).
*   **`rules[].message`**: Custom error string to show if validation fails.

---

## 5. Conditional Visibility (Show When)
Determines whether this field is rendered at all, based on answers given in *other* fields.

### JSON Structure
```json
{
  "label": "Spouse's Name",
  "showWhen": {
    "logic": "and",
    "conditions": [
      {
        "fieldId": "field_marital_status",
        "operator": "equals",
        "value": "married"
      }
    ]
  }
}
```

### Property Reference
*   **`showWhen.logic`**: Defines how multiple conditions are evaluated (`"and"` means all must be true, `"or"` means any one can be true).
*   **`showWhen.conditions`**: Array of triggers.
*   **`conditions[].fieldId`**: The source field being evaluated.
*   **`conditions[].operator`**: How to evaluate (`"equals"`, `"notEquals"`, `"contains"`, `"greaterThan"`, etc.).
*   **`conditions[].value`**: The target value to check against.

---

## 6. Smart Connections (Field Linking)
Advanced logic controlling how this field reacts to other fields including Auto-fill rules, Restrictions, and Dynamic Options.

### JSON Structure (Auto-fill Rule)
```json
{
  "label": "Shipping State",
  "fieldLinking": {
    "enabled": true,
    "mode": "basic",
    "sourceFieldId": "field_zip_code",
    "rules": [
      {
        "logic": "and",
        "conditions": [
          {
            "fieldId": "field_zip_code",
            "operator": "equals",
            "value": "90210"
          }
        ],
        "targetValue": "California",
        "copyFromFieldId": "" // optional: if set this field's value is copied instead
      }
    ]
  }
}
```

### JSON Structure (Restriction Rule - e.g. Make Required if...)
```json
{
  "label": "Why are you canceling?",
  "fieldLinking": {
    "enabled": true,
    "mode": "restriction",
    "restrictionRules": [
      {
        "logic": "and",
        "conditions": [
          {
             "fieldId": "field_cancel_reason",
             "operator": "equals",
             "value": "Other"
          }
        ],
        "action": "required",
        "apply": true
      }
    ]
  }
}
```

### Property Reference
*   **`fieldLinking.enabled`**: Must be true for any linking logic to fire.
*   **`fieldLinking.mode`**: `"basic"` (auto-fill value), `"restriction"` (change disabled/required state).
*   **`rules[].conditions`**: Triggers for an auto-fill action.
*   **`rules[].targetValue`**: The value to instantly set this field to if the conditions are met. Ignored when `rules[].copyFromFieldId` is provided.
*   **`rules[].copyFromFieldId`**: When supplied, instead of a literal value the matching rule will copy the current value from the referenced field. In the form builder UI this corresponds to choosing **"Copy value from field"** in the dropdown (the default is **"Enter value"**). This property is mutually exclusive with `targetValue`; selecting one option will clear the other.
*   **`restrictionRules[].action`**: Mutates the component state (`"required"` or `"disabled"`).
---

### Data Calculation Formula Tips
When creating a **number** or **date** variable you can write arbitrary formulas using field values, other variables, and helper functions.  The calculation editor includes quick‑insert buttons for common helpers, a handful of example snippets, and live syntax validation so mistakes are caught immediately.

Use the `addDays`, `addMonths`, `addYears` helpers to perform simple offsets without memorizing syntax.  The UI also provides clickable function buttons so users can inject the correct function names and parentheses.

For example, to subtract 60 months from a fixed date:

```js
addMonths('2001-01-01', -fields.field_months)
```

Or combine arithmetic and date helpers freely:

```js
addYears(addMonths(fields.startDate, 3), -1)
```
---

## 7. Data Calculations (Display Field)
Relevant when `type: "display"`. Used to render the output of an internal Engine variable.

### JSON Structure
```json
{
  "type": "display",
  "label": "Total Cost",
  "displayConfig": {
    "variableId": "var_quote_total",
    "label": "Final Price",
    "textColor": "#000000",
    "valueColor": "#16a34a",
    "labelFontSize": "16px",
    "valueFontSize": "24px",
    "showVariableName": false,
    "format": "currency"
  }
}
```

### Property Reference
*   **`displayConfig.variableId`**: References an internal `FormVariable` calculation.
*   **`displayConfig.format`**: Applies formatting functions before rendering (e.g. turning `10.5` into `$10.50`).
*   Appearance properties (`textColor`, `valueFontSize`): Overrides default CSS styling inline.
