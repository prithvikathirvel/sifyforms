import { z } from 'zod';

export const ShowConditionOperatorSchema = z.enum([
  'equals', 'notEquals', 'contains', 'notContains',
  'isEmpty', 'isNotEmpty', 'greaterThan', 'lessThan', 'gte', 'lte',
  'in', 'notIn'
]);

export const FormVariableSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['number', 'string', 'boolean', 'date']),
  calculation: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  value: z.any().optional(),
  computed: z.boolean().optional(),
  valueMapping: z.object({
    enabled: z.boolean(),
    sourceFieldId: z.string(),
    mappings: z.record(z.string(), z.union([z.string(), z.number()])),
  }).optional(),
});

export const ShowConditionSchema = z.object({
  id: z.string(),
  fieldId: z.string(),
  operator: ShowConditionOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
  // For table grid fields: which column to evaluate (matches if ANY row matches)
  tableColumnId: z.string().optional(),
});

// A rule's conditions may contain single conditions or nested groups,
// enabling expressions like `A AND (B OR C)`. Flat rules remain valid.
export type ShowWhenRule = {
  id: string;
  logic: 'and' | 'or';
  conditions: (z.infer<typeof ShowConditionSchema> | ShowWhenRule)[];
};

export const ShowWhenRuleSchema: z.ZodType<ShowWhenRule> = z.lazy(() =>
  z.object({
    id: z.string(),
    logic: z.enum(['and', 'or']),
    conditions: z.array(z.union([ShowConditionSchema, ShowWhenRuleSchema])),
  })
);

// Smart Connection (field linking) condition tree — a node is either a single
// condition or a nested AND/OR group, enabling `A AND (B OR C)`. Flat lists stay valid.
const LinkingConditionSchema = z.object({
  fieldId: z.string(),
  operator: ShowConditionOperatorSchema,
  value: z.any(),
});

type LinkingConditionNode =
  | z.infer<typeof LinkingConditionSchema>
  | { id?: string; logic: 'and' | 'or'; conditions: LinkingConditionNode[] };

const LinkingConditionNodeSchema: z.ZodType<LinkingConditionNode> = z.lazy(() =>
  z.union([
    LinkingConditionSchema,
    z.object({
      id: z.string().optional(),
      logic: z.enum(['and', 'or']),
      conditions: z.array(LinkingConditionNodeSchema),
    }),
  ])
);

// schema for AI editing payload
export const AIEditSchema = z.object({
  prompt: z.string(),
  sessionId: z.string().optional(),
});

export const FieldRuleSchema = z.object({
  id: z.string(),
  type: z.enum([
    'required', 'minLength', 'maxLength', 'min', 'max',
    'pattern', 'regex', 'email', 'url', 'custom',
    'contains', 'notContains', 'greaterThan', 'lessThan', 'gte', 'lte',
    'equals', 'notEquals', 'startsWith', 'endsWith'
  ]),
  value: z.union([z.string(), z.number()]).optional(),
  message: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const FormFieldSchema = z.object({
  id: z.string(),
  type: z.enum([
    'text', 'email', 'phone', 'number', 'select', 'radio',
    'checkbox', 'multiselect', 'date', 'time', 'textarea', 'file', 'rating',
    'signature', 'html', 'display', 'table'
  ]),
  label: z.string(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  required: z.boolean().default(false),
  unique: z.boolean().optional(),
  fileConfig: z.object({
    accept: z.array(z.string()).optional(),
    minSize: z.number().optional(),
    maxSize: z.number().optional(),
    multiple: z.boolean().optional(),
    maxFiles: z.number().optional(),
  }).optional(),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    minVariableId: z.string().optional(),
    maxVariableId: z.string().optional(),
    equalToFieldId: z.string().optional(),
    equalToMessage: z.string().optional(),
  }).optional(),
  rules: z.array(FieldRuleSchema).optional(),
  defaultValue: z.any().optional(),
  options: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(),
  width: z.enum(['full', 'half', 'third']).optional(),
  conditionalLogic: z.object({
    show: z.boolean(),
    when: z.string(),
    equals: z.any(),
  }).optional(),
  showWhen: ShowWhenRuleSchema.optional(),
  // New Fields for Revamp
  dynamicOptions: z.object({
    enabled: z.boolean(),
    sourceFieldId: z.string(),
    mappings: z.record(z.string(), z.array(z.object({
      label: z.string(),
      value: z.string()
    }))),
  }).optional(),
  fieldLinking: z.object({
    enabled: z.boolean(),
    mode: z.enum(['basic', 'advanced', 'restriction']).optional().default('basic'),
    sourceFieldId: z.string().optional(), // Legacy/Primary source field
    rules: z.array(z.object({
      id: z.string().optional(),
      logic: z.enum(['and', 'or']).optional().default('and'),
      conditions: z.array(LinkingConditionNodeSchema).optional(),
      // Legacy fields for backward compatibility during migration
      sourceValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
      operator: ShowConditionOperatorSchema.optional(),
      targetValue: z.any(),
      // New: instead of a literal value, specify a source field whose current value should be copied
      copyFromFieldId: z.string().optional(),
      dateRange: z.object({
        min: z.object({
          type: z.enum(['static', 'variable', 'field']),
          value: z.string()
        }).optional(),
        max: z.object({
          type: z.enum(['static', 'variable', 'field']),
          value: z.string()
        }).optional(),
      }).optional(),
      dynamicOptions: z.array(z.object({
        label: z.string(),
        value: z.string()
      })).optional(),
    }).refine(r => {
      const hasVal = r.targetValue !== undefined && r.targetValue !== '';
      const hasCopy = r.copyFromFieldId !== undefined && r.copyFromFieldId !== '';
      // if neither value nor copy is set (e.g. newly-added rule), skip validation
      if (!hasVal && !hasCopy) return true;
      // otherwise ensure exactly one is provided
      return hasVal !== hasCopy;
    }, {
      message: 'Each rule must have either a targetValue or copyFromFieldId (not both)'
    })),
    restrictionRules: z.array(z.object({
      id: z.string().optional(),
      logic: z.enum(['and', 'or']).optional().default('and'),
      conditions: z.array(LinkingConditionNodeSchema),
      action: z.enum(['required', 'disabled']),
      apply: z.boolean().optional().default(true),
    })).optional(),
    dynamicConfig: z.object({
      options: z.record(z.string(), z.array(z.object({
        label: z.string(),
        value: z.string()
      }))).optional(),
      dateRange: z.object({
        enabled: z.boolean().optional(),
        default: z.object({
          min: z.object({
            type: z.enum(['static', 'variable', 'field']),
            value: z.string()
          }).optional(),
          max: z.object({
            type: z.enum(['static', 'variable', 'field']),
            value: z.string()
          }).optional(),
        }).optional(),
        mappings: z.record(z.string(), z.object({
          min: z.object({
            type: z.enum(['static', 'variable', 'field']),
            value: z.string()
          }).optional(),
          max: z.object({
            type: z.enum(['static', 'variable', 'field']),
            value: z.string()
          }).optional(),
        })).optional(),
      }).optional(),
    }).optional(),
  }).optional(),
  displayConfig: z.object({
    variableId: z.string().optional(),
    label: z.string().optional(),
    textColor: z.string().optional(),
    valueColor: z.string().optional(),
    labelFontSize: z.string().optional(),
    valueFontSize: z.string().optional(),
    showVariableName: z.boolean().optional(),
    format: z.string().optional(),
  }).optional(),
  alerts: z.array(z.object({
    id: z.string(),
    message: z.string(),
    type: z.enum(['info', 'warning', 'error', 'success']),
    logic: z.enum(['and', 'or']),
    conditions: z.array(ShowConditionSchema),
  })).optional(),
  supportDocuments: z.array(z.object({
    id: z.string(),
    label: z.string(),
    mode: z.enum(['link', 'upload', 'dms']).optional(),
    url: z.string().optional(),
    fileName: z.string().optional(),
    fileType: z.string().optional(),
    fileData: z.string().optional(),
    documentId: z.string().optional(),
  })).optional(),
  tableConfig: z.object({
    columns: z.array(z.object({
      id: z.string(),
      label: z.string(),
      type: z.enum(['text', 'number', 'select', 'calculated', 'date']),
      width: z.string().optional(),
      options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
      formula: z.string().optional(),
      decimals: z.number().int().min(0).max(10).optional(),
      prefix: z.string().optional(),
      suffix: z.string().optional(),
    })),
    defaultRows: z.number().optional(),
    allowAddRows: z.boolean().optional(),
    grandTotalColumn: z.string().optional(),
  }).optional(),
  // Assessment fields
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
  points: z.number().optional(),
  section: z.string().optional(),
  // Voting fields
  isPollQuestion: z.boolean().optional(),
});

export const FormStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  fieldIds: z.array(z.string()),
  order: z.number(),
});

export const FormLayoutSchema = z.object({
  mode: z.enum(['singlePage', 'multiStep']),
  steps: z.array(FormStepSchema).optional(),
  allowBackNavigation: z.boolean().optional(),
});

export const FormSchemaDefinition = z.object({
  fields: z.array(FormFieldSchema),
  variables: z.array(FormVariableSchema).optional(),
  layout: FormLayoutSchema.optional(),
});

export const FormSettingsSchema = z.object({
  thankYouMessage: z.string().optional(),
  redirectUrl: z.string().url().optional().nullable(),
  collectTimestamp: z.boolean().default(true),
  reCaptcha: z.boolean().default(false),
  customCss: z.string().optional(),
  emailNotification: z.string().email().optional(),
  previewConfig: z.object({
    enabled: z.boolean().default(false),
    title: z.string().optional().default('Review Your Information'),
    description: z.string().optional(),
    showFieldLabels: z.boolean().default(true),
    allowEdit: z.boolean().default(true),
  }).optional(),
  // Processing engine settings
  formType: z.enum(['assessment', 'voting', 'survey', 'registration', 'application']).optional(),
  assessment: z.object({
    passThreshold: z.number().min(0).max(100),
    showScoreAfterSubmit: z.boolean(),
    showCorrectAnswers: z.boolean(),
  }).optional(),
  voting: z.object({
    duplicatePrevention: z.enum(['none', 'ip', 'email']),
    showResultsAfterVoting: z.boolean(),
    showResultsPublic: z.boolean(),
  }).optional(),
  // Other settings that may come from the frontend
  theme: z.string().optional(),
  isFormActive: z.boolean().optional(),
  expirationDateTime: z.string().optional(),
  // Header/footer share one image model so builder preview and public view remain identical.
  // Bounds prevent accidentally persisted values from producing unusable layouts.
  header: z.object({
    enabled: z.boolean().optional(),
    logoUrl: z.string().optional(),
    logoDocumentId: z.string().optional(),
    text: z.string().optional(),
    logoPosition: z.enum(['left', 'center', 'right']).optional(),
    textPosition: z.enum(['left', 'center', 'right']).optional(),
    imageWidth: z.number().min(24).max(1200).optional(),
    imageHeight: z.number().min(24).max(400).optional(),
    imageFit: z.enum(['contain', 'cover', 'fill']).optional(),
    imagePadding: z.number().min(0).max(48).optional(),
    imageRadius: z.number().min(0).max(999).optional(),
    imageBackground: z.string().max(64).optional(),
    imageAlt: z.string().max(240).optional(),
  }).optional(),
  footer: z.object({
    enabled: z.boolean().optional(),
    logoUrl: z.string().optional(),
    logoDocumentId: z.string().optional(),
    text: z.string().optional(),
    logoPosition: z.enum(['left', 'center', 'right']).optional(),
    textPosition: z.enum(['left', 'center', 'right']).optional(),
    imageWidth: z.number().min(24).max(1200).optional(),
    imageHeight: z.number().min(24).max(400).optional(),
    imageFit: z.enum(['contain', 'cover', 'fill']).optional(),
    imagePadding: z.number().min(0).max(48).optional(),
    imageRadius: z.number().min(0).max(999).optional(),
    imageBackground: z.string().max(64).optional(),
    imageAlt: z.string().max(240).optional(),
  }).optional(),
  authentication: z.any().optional(),
  partialSubmission: z.any().optional(),
  dms: z.object({
    enabled: z.boolean(),
    maxFileSize: z.number().positive().optional(),
    allowedMimeTypes: z.array(z.string()).optional(),
  }).optional(),
});

export const CreateFormSchema = z.object({
  /** Team that will own the form. Omit to use the organization's General team. */
  teamId: z.string().nullable().optional(),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  schema: FormSchemaDefinition,
  settings: FormSettingsSchema.optional(),
});

export const UpdateFormSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  schema: FormSchemaDefinition.optional(),
  settings: FormSettingsSchema.optional(),
  isPublished: z.boolean().optional(),
});

export type FormField = z.infer<typeof FormFieldSchema>;
export type FormSchema = z.infer<typeof FormSchemaDefinition>;
export type FormSettings = z.infer<typeof FormSettingsSchema>;
export type CreateFormInput = z.infer<typeof CreateFormSchema>;
export type UpdateFormInput = z.infer<typeof UpdateFormSchema>;
