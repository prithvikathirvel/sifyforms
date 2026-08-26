# AI Form Generation Integration

This document explains how to configure and use the AI form generation feature in the backend.

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```env
# AI API Configuration
AI_API_URL=https://apidev.sifymodernization.digital/engine/agents/invoke/
AI_AGENT_ID=10f6c71d-0067-4e26-bcdf-3986b22de8e2
AI_API_KEY=your-password-here
AI_USERNAME=your-username-here
```

**Note:** The final URL will be constructed as: `AI_API_URL + AI_AGENT_ID`

### AI API Requirements

The AI API should accept POST requests with the following structure:

**Authentication:**
- Uses Basic Authentication with username and password
- Username: `AI_USERNAME` environment variable
- Password: `AI_API_KEY` environment variable

**Request:**
```json
{
  "prompt": "Create a contact form for customer inquiries",
  "model": "form-generator",
  "max_tokens": 2000,
  "temperature": 0.7
}
```

**Response:**
```json
{
  "title": "Contact Form",
  "description": "A contact form for customer inquiries",
  "form": {
    "fields": [
      {
        "id": "fullName",
        "type": "text",
        "label": "Full Name",
        "required": true,
        "placeholder": "Enter your full name"
      },
      {
        "id": "email",
        "type": "email",
        "label": "Email Address",
        "required": true,
        "placeholder": "your@email.com"
      }
    ]
  },
  "settings": {
    "thankYouMessage": "Thank you for your submission!",
    "reCaptcha": true,
    "previewConfig": {
      "enabled": true,
      "title": "Review Your Information",
      "showFieldLabels": true,
      "allowEdit": true
    }
  }
}
```

## Features

### Fallback Mode

If the AI API is not configured or fails, the system will automatically fall back to generating basic forms based on the prompt:

- **Contact forms**: Include name, email, subject, and message fields
- **Registration forms**: Include name, email, phone, and organization fields
- **Survey forms**: Include name, email, rating, and comments fields
- **Application forms**: Include name, email, position, and experience fields
- **Generic forms**: Include basic name and email fields

### Error Handling

The system handles various error scenarios:

- **Configuration missing**: Returns appropriate error message
- **API timeouts**: Returns 408 status code
- **API errors**: Returns error message from AI service
- **Invalid response**: Falls back to basic form generation

### Supported Field Types

The AI can generate forms with the following field types:

- `text` - Single line text input
- `email` - Email address input
- `phone` - Phone number input
- `textarea` - Multi-line text input
- `select` - Dropdown selection
- `radio` - Radio button group
- `checkbox` - Checkbox group
- `number` - Numeric input

### Field Properties

Each field can include:

- `id` - Unique field identifier
- `type` - Field type (see above)
- `label` - Display label for the field
- `required` - Whether the field is required
- `placeholder` - Placeholder text
- `options` - Array of options for select/radio/checkbox fields
- `validation` - Validation rules (min/max for numbers)

## Usage

### Frontend Integration

The frontend calls the backend endpoint:

```javascript
POST /forms/ai-generate
{
  "prompt": "Create a registration form for a tech conference"
}
```

### Backend Processing

1. Validate the prompt
2. Call AI service (or use fallback)
3. Validate AI response structure
4. Return generated form data

## Testing

### Without AI API

The system works out of the box with fallback forms. Simply test with different prompts:

- "Create a contact form"
- "I need a registration form"
- "Build a survey form"

### With AI API

1. Configure your AI API credentials in `.env`
2. Ensure your API endpoint follows the required format
3. Test various prompts to verify AI-generated forms

## Monitoring

Check the backend logs for:

- AI API calls and responses
- Fallback mode activations
- Error messages and debugging information

## Security

- API keys are stored in environment variables
- Requests are properly validated
- Error messages don't expose sensitive information
- Fallback mode ensures service availability
