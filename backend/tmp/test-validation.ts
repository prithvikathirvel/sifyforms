import { validateSubmission } from '../src/lib/validation';
import express from 'express';
import { Server } from 'http';

const MOCK_PORT = 12005;

async function runTest() {
  // 1. Start Mock API
  const app = express();
  app.use(express.json());
  app.post('/validate', (req: any, res: any) => {
    const { value } = req.body;
    console.log('Mock API received:', value);
    if (value === 'secret-code') {
      res.json({ isValid: true });
    } else {
      res.json({ isValid: false });
    }
  });

  const server = app.listen(MOCK_PORT);
  console.log(`Mock API running on port ${MOCK_PORT}`);

  const schema = {
    id: 'test-form',
    fields: [
      {
        id: 'field_1',
        label: 'License Key',
        type: 'text',
        externalValidation: {
          enabled: true,
          url: `http://localhost:${MOCK_PORT}/validate`,
          method: 'POST',
          errorMsg: 'Invalid License Key from External System',
          mapping: {
            fieldValue: 'value',
            successPath: 'isValid'
          }
        }
      }
    ]
  };

  try {
    // Test 1: Valid submission
    console.log('\n--- Test 1: Valid Submission ---');
    const result1 = await validateSubmission(schema, { field_1: 'secret-code' }, null, null);
    console.log('Result 1 (Valid):', result1.valid);
    if (!result1.valid) console.log('Errors 1:', result1.errors);

    // Test 2: Invalid submission
    console.log('\n--- Test 2: Invalid Submission ---');
    const result2 = await validateSubmission(schema, { field_1: 'wrong-code' }, null, null);
    console.log('Result 2 (Invalid):', result2.valid);
    console.log('Expected Error:', result2.errors.field_1);

    // Test 3: API Timeout/Error
    console.log('\n--- Test 3: API Error (Simulated) ---');
    server.close(); // Stop server to cause connection error
    const result3 = await validateSubmission(schema, { field_1: 'secret-code' }, null, null);
    console.log('Result 3 (Error):', result3.valid);
    console.log('Expected Connection Error:', result3.errors.field_1);

  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    // Use the variable server instead of server.close() because it might already be closed
    process.exit(0);
  }
}

runTest();
