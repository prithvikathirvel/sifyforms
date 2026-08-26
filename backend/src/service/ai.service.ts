import axios from 'axios';

export interface AIFormRequest {
  prompt: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface AIFormResponse {
  title: string;
  description: string;
  form: {
    fields: Array<{
      id: string;
      type: string;
      label: string;
      required: boolean;
      placeholder?: string;
      options?: Array<{ label: string; value: string }>;
      validation?: {
        min?: number;
        max?: number;
      };
    }>;
  };
  settings: {
    thankYouMessage: string;
    reCaptcha: boolean;
    previewConfig: {
      enabled: boolean;
      title: string;
      showFieldLabels: boolean;
      allowEdit: boolean;
    };
  };
}

export class AIService {
  private baseUrl: string;
  private agentId: string;
  private apiKey: string;
  private username: string;
  private isConfigured: boolean;
  private bearerToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.baseUrl = process.env.AI_BASE_URL || '';
    this.agentId = process.env.AI_AGENT_ID || '';
    this.apiKey = process.env.AI_API_KEY || '';
    this.username = process.env.AI_USERNAME || 'app-modern';
    this.isConfigured = !!(this.baseUrl && this.agentId && this.apiKey);

    console.log('=== AI Service Initialization ===');
    console.log('Base URL:', this.baseUrl);
    console.log('Agent ID:', this.agentId);
    console.log('API Key present:', !!this.apiKey);
    console.log('Username:', this.username);
    console.log('Is Configured:', this.isConfigured);

    if (!this.isConfigured) {
      console.warn('AI API configuration missing. Using fallback mode.');
    } else {
      console.log('AI service configured successfully!');
    }
    console.log('================================');
  }

  private async getBearerToken(): Promise<string> {
    // Check if we have a valid cached token (not expired)
    if (this.bearerToken && Date.now() < this.tokenExpiry) {
      return this.bearerToken;
    }

    try {
      console.log('Getting bearer token from login API');

      // Call login API using base URL from environment
      const loginResponse = await axios.post(
        `${this.baseUrl}/login`,
        {
          username: this.username,
          password: this.apiKey
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout for login
        }
      );

      const responseData = loginResponse.data as any;
      console.log('Login API response:', responseData);

      if (!responseData || !responseData.access_token) {
        throw new Error('No access_token received from login API');
      }

      this.bearerToken = responseData.access_token;
      // Set token to expire in 1 hour (3600000 ms) - use expires_in from response if available
      const expiresIn = responseData.expires_in || 36000; // Default to 10 hours if not provided
      this.tokenExpiry = Date.now() + (expiresIn * 1000);

      console.log('Bearer token obtained successfully, expires in:', expiresIn, 'seconds');
      return this.bearerToken!;

    } catch (error: any) {
      console.error('Failed to get bearer token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with AI service');
    }
  }

  async generateForm(request: AIFormRequest): Promise<AIFormResponse> {
    console.log('=== AI generateForm Called ===');
    console.log('Request prompt:', request.prompt);
    console.log('Is Configured:', this.isConfigured);

    // If AI service is not configured, return a fallback response
    if (!this.isConfigured) {
      console.log('AI service not configured, returning fallback form');
      return this.getFallbackForm(request.prompt);
    }

    console.log('AI service is configured, attempting real API call...');
    try {
      // Use base URL from environment for AI agent API
      const fullUrl = `${this.baseUrl}/engine/agents/invoke/${this.agentId}`;
      console.log('Calling AI API with prompt:', request.prompt);
      console.log('Full AI API URL:', fullUrl);

      // Get bearer token first
      console.log('Attempting to get bearer token...');
      const bearerToken = await this.getBearerToken();
      console.log('Bearer token obtained successfully');

      // Correct request body from screenshots: { "query": "prompt" }
      const requestBody = {
        "agent_id": this.agentId,
        "userInput": {
          "message": request.prompt,
          "uploadedFiles": []
        }
      }



      console.log('AI API request body:', requestBody);

      const response = await axios.post(
        fullUrl,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      console.log('AI API response status:', response.status);
      console.log('AI API response data:', JSON.stringify(response.data));

      // Extract and parse the agent_response from the AI API response
      const aiResponseData = response.data as any;
      if (!aiResponseData || !aiResponseData.agent_response) {
        console.error('No agent_response found in AI API response');
        throw new Error('Invalid response structure from AI service');
      }

      // agent_response may be a pre-parsed object or a JSON string depending on the API version
      let parsedFormData;
      try {
        parsedFormData = typeof aiResponseData.agent_response === 'string'
          ? JSON.parse(aiResponseData.agent_response)
          : aiResponseData.agent_response;
        console.log('Parsed AI form data:', parsedFormData);
      } catch (parseError) {
        console.error('Failed to parse agent_response as JSON:', parseError);
        throw new Error('Invalid JSON in agent_response from AI service');
      }

      // Validate the parsed response structure
      if (!parsedFormData || !parsedFormData.form || !Array.isArray(parsedFormData.form.fields)) {
        console.error('Invalid parsed form structure:', parsedFormData);
        throw new Error('Invalid form structure in AI response');
      }

      // Normalize missing settings — AI may omit this block
      if (!parsedFormData.settings) {
        parsedFormData.settings = {
          thankYouMessage: 'Thank you for your submission!',
          reCaptcha: false,
          previewConfig: {
            enabled: true,
            title: 'Review Your Information',
            showFieldLabels: true,
            allowEdit: true,
          },
        };
      }

      return parsedFormData as AIFormResponse;

    } catch (error: any) {
      // Log full details so the server console shows the real failure
      console.error('=== AI API call failed ===');
      console.error('Error message:', error.message);
      console.error('HTTP status:', error.response?.status);
      console.error('Response body:', JSON.stringify(error.response?.data));
      console.error('Request URL:', error.config?.url);
      console.error('=========================');

      // Propagate a meaningful error — do NOT silently fall back
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        throw new Error(`AI service authentication failed (HTTP ${status}). Check AI_USERNAME and AI_API_KEY in .env`);
      }
      if (status === 404) {
        throw new Error(`AI agent not found (HTTP 404). Check AI_AGENT_ID in .env`);
      }
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('AI service timed out. The agent may be overloaded — try again.');
      }
      if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        throw new Error(`Cannot reach AI service at ${this.baseUrl}. Check AI_BASE_URL in .env`);
      }
      throw new Error(error.response?.data?.message || error.response?.data?.error || error.message || 'AI API call failed');
    }
  }

  private getFallbackForm(prompt: string): AIFormResponse {
    // Generate a basic form based on the prompt
    const formType = this.inferFormType(prompt);

    return {
      title: `${formType} Form`,
      description: `A ${formType.toLowerCase()} form generated based on your requirements`,
      form: {
        fields: this.getBasicFields(formType)
      },
      settings: {
        thankYouMessage: "Thank you for your submission!",
        reCaptcha: true,
        previewConfig: {
          enabled: true,
          title: "Review Your Information",
          showFieldLabels: true,
          allowEdit: true
        }
      }
    };
  }

  private inferFormType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('contact') || lowerPrompt.includes('reach out')) {
      return 'Contact';
    } else if (lowerPrompt.includes('registration') || lowerPrompt.includes('sign up')) {
      return 'Registration';
    } else if (lowerPrompt.includes('survey') || lowerPrompt.includes('feedback')) {
      return 'Survey';
    } else if (lowerPrompt.includes('application') || lowerPrompt.includes('apply')) {
      return 'Application';
    } else if (lowerPrompt.includes('order') || lowerPrompt.includes('purchase')) {
      return 'Order';
    } else {
      return 'Generic';
    }
  }

  private getBasicFields(formType: string): Array<any> {
    const commonFields = [
      {
        id: "fullName",
        type: "text",
        label: "Full Name",
        required: true,
        placeholder: "Enter your full name"
      },
      {
        id: "email",
        type: "email",
        label: "Email Address",
        required: true,
        placeholder: "your@email.com"
      }
    ];

    const typeSpecificFields: { [key: string]: Array<any> } = {
      'Contact': [
        {
          id: "subject",
          type: "text",
          label: "Subject",
          required: true,
          placeholder: "What is this regarding?"
        },
        {
          id: "message",
          type: "textarea",
          label: "Message",
          required: true,
          placeholder: "Please describe your inquiry..."
        }
      ],
      'Registration': [
        {
          id: "phone",
          type: "phone",
          label: "Phone Number",
          required: false,
          placeholder: "+1 (555) 000-0000"
        },
        {
          id: "organization",
          type: "text",
          label: "Organization",
          required: false,
          placeholder: "Company or organization name"
        }
      ],
      'Survey': [
        {
          id: "rating",
          type: "radio",
          label: "How satisfied are you?",
          required: true,
          options: [
            { label: "Very Satisfied", value: "5" },
            { label: "Satisfied", value: "4" },
            { label: "Neutral", value: "3" },
            { label: "Dissatisfied", value: "2" },
            { label: "Very Dissatisfied", value: "1" }
          ]
        },
        {
          id: "comments",
          type: "textarea",
          label: "Additional Comments",
          required: false,
          placeholder: "Any additional feedback..."
        }
      ],
      'Application': [
        {
          id: "position",
          type: "text",
          label: "Position Applied",
          required: true,
          placeholder: "Job title or position"
        },
        {
          id: "experience",
          type: "textarea",
          label: "Relevant Experience",
          required: true,
          placeholder: "Describe your relevant experience..."
        }
      ]
    };

    return [...commonFields, ...(typeSpecificFields[formType] || [])];
  }

  /**
   * Modify an existing form schema using AI. Returns the updated form data
   * along with an optional session identifier that should be preserved between
   * calls to maintain conversation context.
   */
  async editForm(currentSchema: any, prompt: string, sessionId?: string): Promise<{ formData: AIFormResponse; sessionId?: string }> {
    const combinedPrompt = `${JSON.stringify({ title: '', description: '', form: currentSchema, settings: {} })} ${prompt}`;
    console.log('=== AI editForm Called ===');
    console.log('Prompt for edit:', combinedPrompt);
    console.log('Previous session id:', sessionId);

    if (!this.isConfigured) {
      console.log('AI service not configured, returning fallback form');
      return { formData: this.getFallbackForm(combinedPrompt), sessionId };
    }

    try {
      const fullUrl = `${this.baseUrl}/engine/agents/invoke/${this.agentId}`;
      console.log('Full AI API URL for edit:', fullUrl);
      const bearerToken = await this.getBearerToken();

      const requestBody: any = {
        agent_id: this.agentId,
        userInput: {
          message: combinedPrompt,
          uploadedFiles: []
        }
      };
      if (sessionId) {
        requestBody.session_id = sessionId;
      }

      console.log('AI edit request body:', JSON.stringify(requestBody));
      const response = await axios.post(fullUrl, requestBody, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log('AI edit response data:', JSON.stringify(response.data));
      const aiResponseData = response.data as any;
      if (!aiResponseData || !aiResponseData.agent_response) {
        throw new Error('Invalid response structure from AI service');
      }

      let parsedFormData;
      try {
        parsedFormData = typeof aiResponseData.agent_response === 'string'
          ? JSON.parse(aiResponseData.agent_response)
          : aiResponseData.agent_response;
      } catch (parseError) {
        console.error('Failed to parse agent_response as JSON:', parseError);
        throw new Error('Invalid JSON in agent_response');
      }

      if (!parsedFormData || !parsedFormData.form || !Array.isArray(parsedFormData.form.fields)) {
        throw new Error('Invalid form structure in AI response');
      }

      if (!parsedFormData.settings) {
        parsedFormData.settings = {
          thankYouMessage: 'Thank you for your submission!',
          reCaptcha: false,
          previewConfig: {
            enabled: true,
            title: 'Review Your Information',
            showFieldLabels: true,
            allowEdit: true,
          },
        };
      }

      const newSessionId = aiResponseData.session_id;
      return { formData: parsedFormData as AIFormResponse, sessionId: newSessionId };
    } catch (error: any) {
      console.error('AI edit call failed:', error);
      // fallback to default with same session id
      return { formData: this.getFallbackForm(combinedPrompt), sessionId };
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
