# Fixed — 30 August 2026

Builder-side fixes only. No change to stored data, no impact on existing forms
or respondents.

## 1. Multiselect "Add Option" created duplicate option labels

**What was wrong:** Adding a second option to a multiselect field could label it
"Option 1" again (a code precedence mistake).

**Example — before:** a field with 1 option, clicking "Add Option" → new option
labelled `Option 1` (duplicate).

**After:** labels always increment correctly → `Option 2`, `Option 3`, …

## 2. CSV bulk import could create empty / duplicate option values

**What was wrong:** Importing options from CSV kept rows with a blank value, and
duplicated rows with the same value. Empty/duplicate values broke option display
and made assessment scoring unreliable.

**Example — before:**

```
Name,Value
Red,red
Green,red     ← duplicate value kept
Blue,         ← empty value kept
```

**After:** empty rows are skipped and values are de-duplicated → each option has
a unique, non-empty value.

## 3. Removed noisy debug logs from the field inspector

**What was wrong:** The builder logged AI request/response payloads and debug
messages to the browser console.

**After:** these logs are removed; only real error signals remain.

---

**Impact:** none for end users or existing forms. These affect only new edits in
the form builder.
