import { FormFieldSchema, UpdateFormSchema } from '../src/schemas/form.schema';
import { z } from 'zod';

const mockField = {
  id: 'field_1',
  type: 'select',
  label: 'Test Field',
  options: [
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' }
  ],
  alerts: [
    {
      id: 'alert_1',
      message: 'This is a test alert',
      type: 'warning',
      logic: 'and',
      conditions: [
        {
          id: 'cond_1',
          fieldId: 'field_1',
          operator: 'equals',
          value: 'yes'
        }
      ]
    }
  ],
  supportDocuments: [
    {
      id: 'doc_1',
      label: 'Test Doc',
      url: 'https://example.com/doc.pdf'
    }
  ]
};

const mockSchema = {
  fields: [mockField],
  variables: [],
  layout: { mode: 'singlePage' }
};

const mockUpdatePayload = {
  name: 'Test Form',
  schema: mockSchema
};

try {
  console.log('--- Validating Payload ---');
  const validated = UpdateFormSchema.parse(mockUpdatePayload);
  console.log('✅ Validation successful');

  console.log('--- Stringifying Schema ---');
  const stringified = JSON.stringify(validated.schema);
  console.log('Stringified length:', stringified.length);

  console.log('--- Parsing Back ---');
  const parsed = JSON.parse(stringified);
  console.log('Field 0 alerts:', parsed.fields[0].alerts?.length);
  console.log('Field 0 docs:', parsed.fields[0].supportDocuments?.length);

  if (parsed.fields[0].alerts?.length === 1 && parsed.fields[0].supportDocuments?.length === 1) {
    console.log('🚀 Persistence test PASSED');
  } else {
    console.error('❌ Persistence test FAILED');
  }
} catch (e: any) {
  console.error('❌ Error during test:', e.message);
  if (e instanceof z.ZodError) {
    console.error('Zod Errors:', JSON.stringify(e.errors, null, 2));
  }
}
