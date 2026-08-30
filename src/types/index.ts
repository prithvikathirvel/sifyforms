export interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  name: string | null;
  image?: string | null;
}

export interface Organization {
  id: string;
  slug: string;
  name: string;
  logo?: string | null;
  industry?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    forms: number;
  };
  role?: string;
}

/** Operator for show-when conditions (field interlinking) */
export type ShowConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'greaterThan'
  | 'lessThan'
  | 'gte'
  | 'lte'
  | 'in'
  | 'notIn';

/** Single condition: when field X has operator Y (optionally with value Z) */
export interface ShowCondition {
  id: string;
  fieldId: string;
  operator: ShowConditionOperator;
  value?: string | number | boolean | string[];
  /** For table grid fields: which column to evaluate (checks if ANY row matches) */
  tableColumnId?: string;
}

/** A node in a show-when rule tree: either a single condition or a nested group */
export type ShowWhenNode = ShowCondition | ShowWhenRule;

/**
 * Rule group: show this field when ALL (and) or ANY (or) child nodes match.
 * Children may be single conditions or nested groups, enabling expressions
 * like `A AND (B OR C)`. Flat rules (conditions only) remain valid.
 */
export interface ShowWhenRule {
  id: string;
  logic: 'and' | 'or';
  conditions: ShowWhenNode[];
}

/** Type guard: distinguishes a nested group from a single condition */
export function isShowWhenGroup(node: ShowWhenNode): node is ShowWhenRule {
  return typeof node === 'object' && node !== null && 'conditions' in node && 'logic' in node;
}

/** Single condition inside a Smart Connection (field linking) rule */
export interface LinkingCondition {
  fieldId: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'notContains';
  value: any;
}

/**
 * Node in a Smart Connection condition tree: either a single condition or a
 * nested AND/OR group, enabling expressions like `A AND (B OR C)`.
 * Flat condition lists remain valid.
 */
export type LinkingConditionNode = LinkingCondition | LinkingConditionGroup;

export interface LinkingConditionGroup {
  id?: string;
  logic: 'and' | 'or';
  conditions: LinkingConditionNode[];
}

/** Type guard: distinguishes a nested group from a single linking condition */
export function isLinkingGroup(node: LinkingConditionNode): node is LinkingConditionGroup {
  return typeof node === 'object' && node !== null && 'conditions' in node && !('fieldId' in node);
}

/** Single validation/rule for a field */
export interface FieldRule {
  id: string;
  type: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'regex' | 'email' | 'url' | 'custom' | 'contains' | 'notContains' | 'greaterThan' | 'lessThan' | 'gte' | 'lte' | 'equals' | 'notEquals' | 'startsWith' | 'endsWith';
  value?: string | number; // pattern string, or numeric value for min/max
  message?: string; // custom error message
  enabled?: boolean;
}

export interface DateConstraint {
  type: 'static' | 'variable' | 'field' | 'expression';
  value: string;
}

export interface AdvancedDateRange {
  min?: DateConstraint;
  max?: DateConstraint;
}

export interface TableNamedRow {
  id: string;
  label: string;
  /** Which column ids are active/editable for this row. Columns not listed render as locked empty cells. */
  columnIds: string[];
}

export interface TableColumn {
  id: string;
  label: string;
  /** Defaults to 'text' when omitted — a label-only column is valid. */
  type?: 'text' | 'number' | 'select' | 'calculated' | 'date';
  width?: string; // e.g. '150px', '20%'
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  /** Formula for calculated columns — use other column ids, e.g. "qty * rate" */
  formula?: string;
  /** Decimal places to display for number/calculated columns */
  decimals?: number;
  /** Text shown before the value, e.g. "$" */
  prefix?: string;
  /** Text shown after the value, e.g. "%" or " kg" */
  suffix?: string;
  /** Default cell value pre-filled when a new row is added */
  defaultValue?: string | number;
  /** Min/max constraints for number columns */
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
  /** Min date / time for date columns */
  minValue?: string;
  /** Max date / time for date columns */
  maxValue?: string;
  /** Validation rules (same system as FormField) */
  rules?: FieldRule[];
  /** Show this column only when these conditions match (references other form fields) */
  showWhen?: ShowWhenRule;
  /** Dynamic options / auto-fill / restriction based on other form fields */
  fieldLinking?: {
    enabled: boolean;
    mode?: 'basic' | 'advanced' | 'restriction';
    sourceFieldId: string;
    rules: Array<{
      id?: string;
      logic?: 'and' | 'or';
      /** Conditions may be flat or contain nested AND/OR groups */
      conditions?: LinkingConditionNode[];
      sourceValue?: string | number | boolean;
      operator?: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'notContains';
      targetValue: any;
      copyFromFieldId?: string;
    }>;
    restrictionRules?: Array<{
      id?: string;
      logic?: 'and' | 'or';
      /** Conditions may be flat or contain nested AND/OR groups */
      conditions?: LinkingConditionNode[];
      action: 'required' | 'disabled';
      apply: boolean;
    }>;
  };
  /** Custom alerts triggered by conditions */
  alerts?: Array<{
    id: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    logic: 'and' | 'or';
    conditions: ShowCondition[];
  }>;
}

export type TableValidationRuleType =
  | 'any-row-complete'   // at least one row has all required columnIds non-empty
  | 'all-rows-complete'  // every row has all required columnIds non-empty
  | 'min-rows-filled'    // at least N rows have at least one non-empty value
  | 'column-value'       // in any/all rows, a column satisfies a numeric condition
  | 'aggregate';         // free tableSum/tableAvg/etc. expression evaluates to truthy

export interface TableValidationRule {
  id: string;
  type: TableValidationRuleType;
  enabled?: boolean;
  message: string;
  /** Column ids that must be filled — used by any-row-complete / all-rows-complete */
  columnIds?: string[];
  /** Named row ids to scope the rule to — when set, only those named rows are evaluated */
  namedRowIds?: string[];
  /** Minimum filled rows — used by min-rows-filled */
  minCount?: number;
  /** Column to check — used by column-value */
  columnId?: string;
  /** Scope of column-value check: 'any' row satisfies, or 'all' rows satisfy */
  scope?: 'any' | 'all';
  /** Comparison operator — used by column-value */
  operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  /** Comparison value — used by column-value */
  value?: string;
  /** Expression using tableSum/tableAvg/tableMin/tableMax/tableCount/tableCountFilled — used by aggregate */
  expression?: string;
}

export interface TableConfig {
  columns: TableColumn[];
  defaultRows?: number;
  allowAddRows?: boolean;
  /** Column id whose values should be summed in a Grand Total footer row */
  grandTotalColumn?: string;
  /** Custom label shown in the first cell of the grand total footer row */
  grandTotalLabel?: string;
  /** Fixed named rows (e.g. SSC, HSC, Degree) each with their own active column subset */
  namedRows?: TableNamedRow[];
}

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'date' | 'time' | 'textarea' | 'file' | 'rating' | 'signature' | 'html' | 'display' | 'table';
  label: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  unique?: boolean;
  disabled?: boolean;
  /** Field width in the form layout */
  width?: 'full' | 'half' | 'third';
  /** Options for select, radio, checkbox fields */
  options?: Array<{ label: string; value: string }>;
  /**
   * Group name for mutual exclusion — fields sharing the same group name
   * automatically hide each other's already-selected values from their options.
   */
  mutualExclusionGroup?: string;
  /** File upload configuration */
  fileConfig?: {
    accept?: string[];
    minSize?: number; // minimum file size in bytes
    maxSize?: number;
    multiple?: boolean;
    maxFiles?: number;
  };
  /** Validation rules */
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    /** Custom validation message */
    message?: string;
    /** Multi-select specific options */
    allowClearAll?: boolean;
    showCount?: boolean;
    /** Link min/max constraints to a variable */
    minVariableId?: string;
    maxVariableId?: string;
    /** Field ID to compare equality against (e.g. for Confirm Email) */
    equalToFieldId?: string;
    /** Error message for field equality check */
    equalToMessage?: string;
  };
  /** Validation rules (new system) */
  rules?: FieldRule[];
  /** Show this field only when these conditions match (field interlinking) */
  showWhen?: ShowWhenRule;
  /** Dynamic options configuration for advanced field linking */
  dynamicOptions?: {
    enabled: boolean;
    sourceFieldId: string;
    mappings: Record<string, { label: string; value: string }[]>;
  };
  fieldLinking?: {
    enabled: boolean;
    mode?: 'basic' | 'advanced' | 'restriction';
    sourceFieldId: string;
    rules: Array<{
      id?: string;
      logic?: 'and' | 'or';
      /** Conditions may be flat or contain nested AND/OR groups */
      conditions?: LinkingConditionNode[];
      /** Legacy fields */
      sourceValue?: string | number | boolean;
      operator?: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'notContains';
      /** Static value to fill when rule matches. Ignored if `copyFromFieldId` is set. */
      targetValue: any;
      /** Instead of a literal value, copy from this other field when rule matches */
      copyFromFieldId?: string;
      /** Optional date range for this specific rule */
      dateRange?: AdvancedDateRange;
      /** Optional dynamic options for select/radio/checkbox fields */
      dynamicOptions?: Array<{ label: string; value: string }>;
    }>;
    /** Field-specific dynamic configurations */
    dynamicConfig?: {
      /** For dropdown/radio - dynamic options based on other fields */
      options?: Record<string, { label: string; value: string }[]>;
      /** For date/time fields - dynamic min/max based on other fields */
      dateRange?: {
        enabled?: boolean;
        /** Default date range when no rule matches */
        default?: AdvancedDateRange;
        /** Mappings from source field option values to specific date ranges */
        mappings?: Record<string, AdvancedDateRange>;
      };
    };
    /** Restriction rules for field requirements and disable states */
    restrictionRules?: Array<{
      id?: string;
      logic?: 'and' | 'or';
      /** Conditions may be flat or contain nested AND/OR groups */
      conditions?: LinkingConditionNode[];
      /** Action to apply when conditions match */
      action: 'required' | 'disabled';
      /** Whether to apply the action (true) or remove it (false) */
      apply: boolean;
    }>;
  };
  /** Configuration for display fields (non-editable variable display) */
  displayConfig?: {
    /** Variable to display */
    variableId?: string;
    /** Custom display label (key) */
    label?: string;
    /** Text color for label */
    textColor?: string;
    /** Text color for value */
    valueColor?: string;
    /** Font size for label (e.g., '14px', '1rem') */
    labelFontSize?: string;
    /** Font size for value */
    valueFontSize?: string;
    /** Show variable name */
    showVariableName?: boolean;
    /** Custom format */
    format?: string;
  };
  /** Table field configuration */
  tableConfig?: TableConfig;
  /** Table-specific validation rules (only used when type === 'table') */
  tableValidation?: TableValidationRule[];
  /** Default value for the field (fallback when smart connections not enabled) */
  defaultValue?: any;
  /** Minimum value/date for constraint fields (fallback when smart connections not enabled) */
  minValue?: any;
  /** Maximum value/date for constraint fields (fallback when smart connections not enabled) */
  maxValue?: any;
  /** Configuration for validating field value against external API */
  externalValidation?: {
    enabled: boolean;
    /** When to run the check: on blur ('auto', the default) or only when the
     *  respondent clicks the Verify button ('manual'). Existing forms without
     *  this flag behave as 'auto'. */
    trigger?: 'auto' | 'manual';
    /** Custom label for the Verify button (only used when trigger is 'manual'). */
    buttonLabel?: string;
    /** IDs of other fields referenced by payload params; populated by the server
     *  in the public schema so the client can send a minimal formData. */
    referencedFieldIds?: string[];
    url: string;
    method?: 'GET' | 'POST';
    headers?: Array<{ key: string; value: string }>;
    auth?: {
      type: 'none' | 'bearer' | 'basic' | 'custom';
      token?: string; // For bearer/custom
      username?: string; // For basic
      password?: string; // For basic
      customHeaderName?: string; // For custom
    };
    params?: Array<{
      key: string;
      value: string;
      type: 'static' | 'field';
    }>;
    fieldValueKey?: string; // Key name for the field value in request (e.g. "value")
    responseCheck?: {
      path?: string; // JSON path (e.g. "data.isValid")
      type: 'boolean' | 'equals' | 'notEquals' | 'contains' | 'notContains' | 'regex' | 'greaterThan' | 'lessThan' | 'exists';
      targetValue?: string | number; // Value to compare against for 'equals'/'contains'
    };
    /** Legacy fields (keep for backward compatibility or simple setups) */
    successPath?: string;
    errorMsg?: string;
    successMsg?: string;
    /** Configuration for validating field value against external API */
  };
  /** Custom alerts triggered by conditions */
  alerts?: Array<{
    id: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    logic: 'and' | 'or';
    conditions: ShowCondition[];
  }>;
  /** Reference documents for the user/candidate */
  supportDocuments?: Array<{
    id: string;
    label: string;
    mode?: 'link' | 'upload' | 'dms';
    url?: string;
    fileName?: string;
    fileType?: string;
    fileData?: string; // base64 string
    documentId?: string; // DMS document ID
  }>;
  /** Assessment: correct answer for auto-scoring (option value or array of values) */
  correctAnswer?: string | string[];
  /** Assessment: point value for this question */
  points?: number;
  /** Assessment: logical section name for grouped scoring */
  section?: string;
  /** Voting: marks this field as a poll question for tally aggregation */
  isPollQuestion?: boolean;
}

/** Step in a multi-step form */
export interface FormStep {
  id: string;
  title: string;
  description?: string;
  fieldIds: string[];
  order: number;
  /** When true, user sees a confirmation warning before advancing and cannot edit this step afterwards */
  lockOnComplete?: boolean;
}

/** Form layout configuration */
export interface FormLayout {
  mode: 'singlePage' | 'multiStep';
  steps?: FormStep[];
  /** Allow going back to previous steps (multi-step only). Default: true */
  allowBackNavigation?: boolean;
  /**
   * Form width layout. 'vertical' (default) renders a narrow, centered card;
   * 'horizontal' renders a full-width container where fields flow left-to-right
   * by their width (full/half/third) and wrap onto new rows.
   */
  orientation?: 'vertical' | 'horizontal';
  /**
   * Visual style of the multi-step progress indicator.
   * 'progress' = segmented progress bar (default);
   * 'circles'  = numbered circle stepper with connecting lines and labels;
   * 'minimal'  = subtle "Step X of Y" text only.
   */
  stepperStyle?: 'progress' | 'circles' | 'minimal';
}

/** Variable interface for calculations and form data */
export interface FormVariable {
  id: string;
  name: string;
  description?: string;
  /** Variable type */
  type: 'number' | 'string' | 'boolean' | 'date';
  /** 'formula' (default) | 'function' | 'mapping' */
  mode?: 'formula' | 'function' | 'mapping';
  /** Calculation formula expression (mode: formula) */
  calculation?: string;
  /** Custom function parameters (mode: function) */
  functionParameters?: { fieldId: string; paramName: string }[];
  /** Custom function body — statements only, must return a value (mode: function) */
  functionBody?: string;
  /** Dependencies (field IDs this variable depends on) */
  dependencies?: string[];
  /** Current value */
  value?: any;
  /** Whether this variable is computed */
  computed?: boolean;
  /** Value mapping for categorical fields */
  valueMapping?: {
    enabled: boolean;
    sourceFieldId: string;
    mappings: Record<string, number | string>;
  };
}

/** Form schema interface */
export interface FormSchema {
  fields: FormField[];
  variables?: FormVariable[];
  layout?: FormLayout;
}

export interface PaymentConfig {
  enabled: boolean;
  gateway: 'razorpay' | 'paytm' | 'payu';
  // POS tenant identifier (obtained via /tenant/onboard)
  tenantId?: string;
  tenantName?: string;
  redirectUrl?: string;
  cancelUrl?: string;
  // Razorpay onboarding credentials (sent once to POS; not stored after onboarding)
  razorpayKeyId?: string;
  razorpaySecretKey?: string;
  razorpayWebhookSecret?: string;
  // Paytm onboarding credentials
  paytmMid?: string;
  paytmWebsite?: string;
  paytmIndustryTypeId?: string;
  paytmMerchantKey?: string;
  // PayU onboarding credentials
  payuKey?: string;
  payuSalt?: string;
  /** 'static' = fixed amount; 'field' = derive from a form field; 'variable' = calculated variable */
  amountType: 'static' | 'field' | 'variable';
  staticAmount?: string;
  amountFieldId?: string;
  amountVariableId?: string;
  emailFieldId?: string;
  mobileFieldId?: string;
}

export interface FormAuthentication {
  enabled: boolean;
  method: 'email' | 'phone' | 'both';
  emailFieldId?: string;
  phoneFieldId?: string;
}

export interface PartialSubmissionConfig {
  enabled: boolean; // requires authentication.enabled = true
}

export interface DmsSettings {
  enabled: boolean;
  maxFileSize?: number; // MB
  allowedMimeTypes?: string[];
}

export interface DmsFileReference {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  status: 'pending_upload' | 'active';
}

/** Local file held in the form until final submit / Save Documents. */
export interface PendingLocalFile {
  pendingId: string;
  filename: string;
  mimeType: string;
  size: number;
  status: 'pending';
  /** In-memory File; never persisted to the API. */
  file: File;
}

export type FormFileValue = DmsFileReference | PendingLocalFile;

export type BrandingPosition = 'left' | 'center' | 'right';

/**
 * Header/footer branding for the public form.
 * Header: logo and/or text, each independently positionable (e.g. logo left +
 * text center, or both left). Footer: text only.
 * `enabled: false` hides the section without losing its content.
 */
export interface FormBrandingSection {
  enabled?: boolean;
  /** Image URL or data URI (header only) */
  logoUrl?: string;
  /** DMS document ID for the logo */
  logoDocumentId?: string;
  text?: string;
  /** Where the logo sits in the header row (default 'center') */
  logoPosition?: BrandingPosition;
  /** Where the text sits in the header row (default 'center') */
  textPosition?: BrandingPosition;
}

export interface FormSettings {
  thankYouMessage?: string;
  redirectUrl?: string | null;
  collectTimestamp?: boolean;
  reCaptcha?: boolean;
  customCss?: string;
  theme?: string;
  emailNotification?: string;
  isFormActive?: boolean;
  expirationDateTime?: string;
  /** Optional branding header shown above the form */
  header?: FormBrandingSection;
  /** Optional branding footer shown below the form */
  footer?: FormBrandingSection;
  previewConfig?: {
    enabled: boolean;
    title?: string;
    description?: string;
    showFieldLabels?: boolean;
    allowEdit?: boolean;
  };
  payment?: PaymentConfig;
  authentication?: FormAuthentication;
  partialSubmission?: PartialSubmissionConfig;
  /** DMS file storage configuration */
  dms?: DmsSettings;
  /** Determines which post-submission processor runs */
  formType?: 'assessment' | 'voting' | 'survey' | 'registration' | 'application';
  /** Assessment-specific processing config */
  assessment?: {
    passThreshold: number;
    showScoreAfterSubmit: boolean;
    showCorrectAnswers: boolean;
  };
  /** Voting-specific processing config */
  voting?: {
    duplicatePrevention: 'none' | 'ip' | 'email';
    showResultsAfterVoting: boolean;
    showResultsPublic: boolean;
  };
}

/** Result returned from the processing engine for a single assessment submission */
export interface AssessmentResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  rank?: number;
  totalParticipants?: number;
  sections: Record<string, { score: number; maxScore: number; label: string }>;
  fieldResults: Array<{
    fieldId: string;
    label: string;
    submittedAnswer: unknown;
    correctAnswer: unknown;
    isCorrect: boolean;
    score: number;
    maxScore: number;
  }>;
}

/** Vote tally for a single poll field */
export interface VoteTally {
  fieldId: string;
  label: string;
  options: Array<{ value: string; label: string; count: number; percentage: number }>;
  totalVotes: number;
}

/** Aggregate result for a voting form */
export interface VotingResult {
  tallies: VoteTally[];
  totalSubmissions: number;
  lastUpdated: string;
}

export interface Form {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description?: string | null;
  schema: FormSchema;
  settings: FormSettings;
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submissionCount?: number;
  /** Owning team. Its roles, and those of every team above it, govern this form. */
  teamId?: string | null;
  responsePolicy?: ResponsePolicy;
  /**
   * What the signed-in viewer may do with this form, resolved server-side from
   * their role on the owning team and its ancestors.
   */
  access?: {
    canEdit: boolean;
    canDelete: boolean;
    canPublish: boolean;
    canShare: boolean;
    canMove: boolean;
    canViewResponses: boolean;
    canViewResults: boolean;
  };
  org?: {
    slug: string;
    name: string;
  };
}

export interface Submission {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  isRead: boolean;
  tags: string[];
  /** Server-side processing state for assessments, voting, and other processors. */
  processingStatus?: 'pending' | 'processing' | 'done' | 'failed' | string;
  createdAt: string;
  /**
   * Keys the server masked for this viewer. Present only under REDACTED access
   * or a blind-review form, so the UI can say a value is hidden rather than
   * leaving a blank that reads as "no answer".
   */
  redactedFields?: string[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  type?: 'static' | 'organization';
  schema?: FormSchema;
  settings?: FormSettings;
  createdAt?: string;
  createdBy?: string;
}

export interface AuthState {
  user: User | null;
  keycloakUser: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  needsOrgSetup: boolean | null;
}

export type Org = {
  id: string;
  name: string;
  [key: string]: unknown;
};

export interface OrgState {
  currentOrg: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  error: string | null;
}

// --- organization membership, invitations and teams -------------------------

/**
 * Roles. OWNER and ADMIN are organization-only (administrative); TEAM_LEAD is
 * team-only; CREATOR, ANALYST and VIEWER apply at both levels, where a team
 * assignment overrides the organization-wide one for that team and below.
 * Mirrors backend rbac.config.ts.
 */
export type OrgRole = 'OWNER' | 'ADMIN' | 'CREATOR' | 'ANALYST' | 'VIEWER';
export type TeamRole = 'TEAM_LEAD' | 'CREATOR' | 'ANALYST' | 'VIEWER';

/** How much of a response someone may see. Ordinal: each tier includes the last. */
export type ResponseLevel = 'NONE' | 'AGGREGATE' | 'REDACTED' | 'FULL' | 'EXPORT';

/** A property of the form, applied as a ceiling over whatever role says. */
export type ResponsePolicy = 'STANDARD' | 'ANONYMOUS' | 'BLIND_REVIEW' | 'RESTRICTED';

/** What the signed-in user may do with one specific form, and why. */
export interface FormAccess {
  formId: string;
  level: ResponseLevel;
  canEdit: boolean;
  canDelete: boolean;
  canPublish: boolean;
  canShare: boolean;
  canMove: boolean;
  canDeleteResponses: boolean;
  policy: ResponsePolicy;
  reasons: string[];
}

export interface FormShare {
  id: string;
  formId: string;
  principalType: 'USER' | 'TEAM';
  principalId: string;
  level: ResponseLevel;
  canEdit: boolean;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  isExpired?: boolean;
}

export interface FieldSummary {
  key: string;
  label: string;
  type: string;
  answered: number;
  skipped?: number;
  responseRate?: number;
  counts?: Record<string, number>;
  stats?: { min: number; max: number; mean: number; median?: number };
}

/** Counts and distributions, computed server-side so no row ever leaves it. */
export interface AggregateResult {
  formId: string;
  formName: string;
  total: number;
  firstResponseAt: string | null;
  lastResponseAt: string | null;
  fields: FieldSummary[];
  /** Optional for compatibility with servers deployed before analytics enrichment. */
  insights?: {
    responsesLast7Days: number;
    responsesPrevious7Days: number;
    changePercent: number | null;
    averageAnswerRate: number;
    activeDays: number;
  };
  trend?: {
    rangeDays: number;
    series: Array<{ date: string; count: number }>;
  };
  /** True when too few responses exist for a breakdown to stay anonymous. */
  suppressed: boolean;
  minimumForBreakdown: number;
  access: { level: ResponseLevel; policy: ResponsePolicy };
}

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVOKED';

export interface OrgMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: OrgRole | string;
  roleId: string | null;
  joinedAt: string;
  isOwner: boolean;
}

export interface OrgInvite {
  id: string;
  email: string;
  orgId: string;
  role: OrgRole | string;
  roleId: string | null;
  inviteStatus: InviteStatus | string;
  invitedBy: string;
  createdAt: string;
  respondedAt: string | null;
}

/** An invite as shown to its recipient, carrying the organization it is for. */
export interface IncomingInvite extends OrgInvite {
  org: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    industry: string | null;
  };
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole | string;
  roleId: string | null;
  addedBy: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
}

export interface Team {
  id: string;
  orgId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  /** Materialized ancestry of team ids, e.g. "/root/child/self". */
  path: string;
  depth: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** The organization-created fallback team for forms without an explicit owner. */
  isDefault?: boolean;
  _count?: { members: number; children: number };
}

/** A team plus its nested sub-teams, as returned by GET /orgs/:orgId/teams. */
export interface TeamNode extends Team {
  children: TeamNode[];
}

export interface TeamDetail extends Team {
  members: TeamMember[];
  children: Team[];
}

/**
 * What the signed-in user may do, resolved server-side from their ORG role plus
 * every TEAM role along the team's ancestry.
 */
export interface EffectivePermissions {
  orgId: string;
  teamId?: string;
  roles: string[];
  orgRole: string | null;
  teamRole: string | null;
  actions: string[];
}

export interface MembersState {
  members: OrgMember[];
  invites: OrgInvite[];
  incomingInvites: IncomingInvite[];
  isLoading: boolean;
  error: string | null;
}

export interface FormSharingState {
  access: Record<string, FormAccess>;
  shares: Record<string, FormShare[]>;
  aggregate: Record<string, AggregateResult>;
  isLoading: boolean;
  error: string | null;
}

export interface TeamsState {
  tree: TeamNode[];
  currentTeam: TeamDetail | null;
  /** Effective permissions keyed by teamId, with '' holding the org-wide set. */
  permissions: Record<string, EffectivePermissions>;
  isLoading: boolean;
  error: string | null;
}

export interface FormsState {
  forms: Form[];
  currentForm: Form | null;
  isLoading: boolean;
  error: string | null;
}

export interface BuilderState {
  schema: FormSchema;
  settings: FormSettings;
  selectedFieldId: string | null;
  unsavedChanges: boolean;
  formName: string;
  formDescription: string;
  layout: FormLayout;
  /** AI session identifier used by the backend to maintain conversation state */
  aiSessionId?: string | null;
}

// Response returned when editing an existing form via the AI endpoint
export interface AIEditResponse {
  schema: FormSchema;
  sessionId?: string;
}

export interface SubmissionsState {
  submissions: Submission[];
  currentSubmission: Submission | null;
  /** Response level and form policy that shaped the rows above. */
  access: { level: ResponseLevel; policy: ResponsePolicy } | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  error: string | null;
}
