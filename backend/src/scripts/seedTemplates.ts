import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const templates = [
  {
    id: 'ibsp-exam',
    name: 'Bank Exam Registration',
    description: 'Registration for Bank Exams ',
    category: 'government',
    schema: {
      fields: [
        { id: 'field_1771390896056', type: 'text', label: 'Name', required: true, placeholder: '' },
        { id: 'field_1771390907417', type: 'text', label: 'LastName', required: false, placeholder: '' },
        { id: 'field_1771390935630', type: 'display', label: 'Full Name', required: false, placeholder: '', displayConfig: { variableId: 'var_1771391020958' } },
        {
          id: 'field_1771391231681',
          type: 'select',
          label: 'Post',
          required: true,
          placeholder: '',
          options: [
            { label: 'Assistant Engineer (Electrical)', value: 'Assistant Engineer (Electrical)' },
            { label: 'Assistant Engineer (Mechanical)', value: 'Assistant Engineer (Mechanical)' },
            { label: 'Accounts Officer', value: 'Accounts Officer' },
            { label: 'Personnel Officer', value: 'Personnel Officer' },
            { label: 'Junior Engineer', value: 'Junior Engineer' }
          ]
        },
        {
          id: 'field_1771391398556',
          type: 'radio',
          label: 'State from where Category Certificate issued  (If you are from out side Rajasthan State you will be considered as UR (GEN))',
          required: true,
          placeholder: '',
          options: [
            { label: 'Rajasthan State', value: 'Rajasthan State' },
            { label: 'Outside Rajasthan State', value: 'Outside Rajasthan State' }
          ]
        },
        {
          id: 'field_1771391503375',
          type: 'radio',
          label: 'Category',
          required: true,
          placeholder: '',
          options: [
            { label: 'SC', value: 'SC' },
            { label: 'ST', value: 'ST' },
            { label: 'BC', value: 'BC' },
            { label: 'MBC', value: 'MBC' },
            { label: 'EWS', value: 'EWS' },
            { label: 'UR (GEN)', value: 'UR (GEN)' }
          ],
          fieldLinking: {
            enabled: true,
            sourceFieldId: '',
            mode: 'advanced',
            rules: [
              {
                id: 'rule_1771392724842',
                logic: 'and',
                conditions: [{ fieldId: 'field_1771391231681', operator: 'equals', value: 'Assistant Engineer (Electrical)' }],
                targetValue: '',
                dynamicOptions: [
                  { label: 'BC', value: 'BC' },
                  { label: 'EWS', value: 'EWS' }
                ]
              },
              {
                id: 'rule_1771392919724',
                logic: 'and',
                conditions: [{ fieldId: 'field_1771391231681', operator: 'equals', value: 'Accounts Officer' }],
                targetValue: '',
                dynamicOptions: [
                  { label: 'BC', value: 'BC' },
                  { label: 'ST', value: 'ST' },
                  { label: 'EWS', value: 'EWS' }
                ]
              },
              {
                id: 'rule_1771480918303',
                logic: 'and',
                conditions: [{ fieldId: 'field_1771391398556', operator: 'equals', value: 'Outside Rajasthan State' }],
                targetValue: '',
                dynamicOptions: [{ label: 'UR (GEN)', value: 'UR (GEN)' }]
              }
            ],
            restrictionRules: [],
            dynamicConfig: { dateRange: {} }
          },
          helpText: 'Please indicate your category correctly in the online application form. No change in category will be permitted after submission. Candidates belonging to " BC" / "MBC" category but coming under creamy layer are not entitled to  "BC" / "MBC"  reservation. They should indicate their category as UR (Gen) in the online application form.'
        },
        {
          id: 'field_1771393839505',
          type: 'radio',
          label: 'If BC/MBC, whether you belong to : ',
          required: false,
          placeholder: '',
          options: [
            { label: 'Creamy Layer', value: 'Creamy Layer' },
            { label: 'Non-creamy Layer', value: 'Non-creamy Layer' }
          ],
          fieldLinking: {
            enabled: true,
            sourceFieldId: '',
            mode: 'restriction',
            rules: [],
            restrictionRules: [
              {
                id: 'restriction_1771481236403',
                logic: 'and',
                conditions: [
                  { fieldId: 'field_1771391503375', operator: 'equals', value: 'BC' },
                  { fieldId: 'field_1771391503375', operator: 'equals', value: 'MBC' }
                ],
                action: 'required',
                apply: true
              }
            ],
            dynamicConfig: { dateRange: {} }
          }
        },
        {
          id: 'field_1771394122291',
          type: 'select',
          label: 'Preference of Company',
          required: false,
          placeholder: '',
          options: [
            { label: 'RVUN', value: 'RVUN' },
            { label: 'RVPN', value: 'RVPN' },
            { label: 'JVVN', value: 'JVVN' },
            { label: 'AVVN', value: 'AVVN' },
            { label: 'JdVVN', value: 'JdVVN' }
          ]
        },
        {
          id: 'field_1771486687157',
          type: 'select',
          label: 'Preference of Company 2',
          required: false,
          placeholder: '',
          options: [
            { label: 'JdVVN', value: 'JdVVN' },
            { label: 'AVVN', value: 'AVVN' },
            { label: 'JVVN', value: 'JVVN' },
            { label: 'RVPN', value: 'RVPN' }
          ]
        },
        {
          id: 'field_1771394183788',
          type: 'select',
          label: 'State of which you are bonafide resident',
          required: false,
          placeholder: '',
          options: [{ label: 'TamilNadu', value: 'TamilNaduoption1' }]
        },
        {
          id: 'field_1771394997509',
          type: 'radio',
          label: 'Are you applying under TSP  ?',
          required: false,
          placeholder: '',
          options: [
            { label: 'Yes', value: 'Yes' },
            { label: 'No', value: 'No' }
          ],
          fieldLinking: {
            enabled: true,
            sourceFieldId: '',
            mode: 'advanced',
            rules: [
              {
                id: 'rule_1771486971001',
                logic: 'and',
                conditions: [{ fieldId: 'field_1771391231681', operator: 'equals', value: 'Assistant Engineer (Electrical)' }],
                targetValue: '',
                dynamicOptions: [{ label: 'Yes', value: 'Yes' }]
              },
              {
                id: 'rule_1771487039114',
                logic: 'or',
                conditions: [
                  { fieldId: 'field_1771394122291', operator: 'equals', value: 'AVVN' },
                  { fieldId: 'field_1771486687157', operator: 'equals', value: 'AVVN' }
                ],
                targetValue: '',
                dynamicOptions: [{ label: 'Yes', value: 'Yes' }]
              }
            ],
            restrictionRules: [
              {
                id: 'restriction_1771486007955',
                logic: 'and',
                conditions: [
                  { fieldId: 'field_1771391398556', operator: 'equals', value: 'Rajasthan State' },
                  { fieldId: 'field_1771391231681', operator: 'equals', value: 'Junior Engineer' }
                ],
                action: 'required',
                apply: true
              }
            ],
            dynamicConfig: { dateRange: {} }
          }
        },
        { id: 'field_1771488029830', type: 'date', label: 'Date of Birth', required: false, placeholder: '' },
        { id: 'field_1771488062451', type: 'display', label: 'Age completed as on 01.01.2025', required: false, placeholder: '', displayConfig: { variableId: 'var_1771488245201' } },
        { id: 'field_1771488440162', type: 'text', label: 'Correspondence Address', required: false, placeholder: '' },
        {
          id: 'field_1771488456253',
          type: 'checkbox',
          label: 'Same as Correspondence address',
          required: false,
          placeholder: '',
          options: [
            { label: 'Yes', value: 'Yes' },
            { label: 'No', value: 'No' }
          ]
        },
        { id: 'field_1771488480173', type: 'text', label: 'Permenant Address', required: false, placeholder: '', rules: [] },
        {
          id: 'field_1771496096741',
          type: 'select',
          label: 'Choose the Address for GST Invoicing',
          required: false,
          placeholder: '',
          options: [
            { label: 'Communication Address', value: 'Communication Address' },
            { label: 'Permenant Address', value: 'Permenant Address' }
          ]
        },
        {
          id: 'field_1771569017426',
          type: 'radio',
          label: 'Graduation / Equivalent',
          required: false,
          placeholder: '',
          options: [
            { label: 'Appeared', value: 'Appeared' },
            { label: 'Passed', value: 'Passed' }
          ]
        },
        { id: 'field_1771576877151', type: 'file', label: 'Left Thumb Impression', required: true, placeholder: '' },
        { id: 'field_1771576933413', type: 'file', label: 'Hand Written Declaration ', required: true, placeholder: '' }
      ],
      layout: {
        mode: 'multiStep',
        steps: [
          {
            id: 'step_1771576947853',
            title: 'Basic Details',
            description: '',
            fieldIds: [
              'field_1771390896056',
              'field_1771390907417',
              'field_1771390935630',
              'field_1771391231681',
              'field_1771391398556',
              'field_1771391503375',
              'field_1771393839505',
              'field_1771394122291',
              'field_1771486687157',
              'field_1771394183788',
              'field_1771394997509',
              'field_1771488029830',
              'field_1771488062451',
              'field_1771488440162',
              'field_1771488456253',
              'field_1771488480173',
              'field_1771496096741'
            ],
            order: 0
          },
          {
            id: 'step_1771576966010',
            title: 'Education Details',
            description: '',
            fieldIds: ['field_1771569017426'],
            order: 1
          },
          {
            id: 'step_1771577027165',
            title: 'Document Upload',
            description: '',
            fieldIds: ['field_1771576877151', 'field_1771576933413'],
            order: 2
          }
        ],
        allowBackNavigation: true
      },
      variables: [
        {
          id: 'var_1771391020958',
          name: 'Full Name',
          type: 'string',
          description: '',
          calculation: 'concat( field_1771390896056 + field_1771390907417)',
          dependencies: ['field_1771390896056', 'field_1771390907417'],
          computed: false
        },
        {
          id: 'var_1771488245201',
          name: 'Age',
          type: 'number',
          description: '',
          calculation: 'age( field_1771488029830)',
          dependencies: ['field_1771488029830'],
          computed: false
        },
        {
          id: 'var_1771490031572',
          name: 'Address',
          type: 'string',
          description: '',
          calculation: 'concat( field_1771488440162)',
          dependencies: ['field_1771488440162'],
          computed: false
        }
      ]
    },
    settings: { thankYouMessage: 'Thank you for applying to IBSP Exam! Your application has been received.' },
  },
  {
    id: 'event-registration',
    name: 'Event Registration',
    description: 'Perfect for conferences, workshops, and meetups',
    category: 'events',
    schema: {
      fields: [
        { id: 'fullName', type: 'text', label: 'Full Name', required: true, placeholder: 'Enter your full name' },
        { id: 'email', type: 'email', label: 'Email Address', required: true, placeholder: 'your@email.com' },
        { id: 'phone', type: 'phone', label: 'Phone Number', required: false, placeholder: '+1 (555) 000-0000' },
        { id: 'organization', type: 'text', label: 'Organization', required: false, placeholder: 'Company or organization name' },
        {
          id: 'ticketType', type: 'select', label: 'Ticket Type', required: true, options: [
            { label: 'Early Bird - $99', value: 'early' },
            { label: 'Regular - $149', value: 'regular' },
            { label: 'VIP - $299', value: 'vip' },
          ]
        },
        { id: 'attendees', type: 'number', label: 'Number of Attendees', required: true, validation: { min: 1, max: 10 } },
        {
          id: 'dietary', type: 'checkbox', label: 'Dietary Restrictions', required: false, options: [
            { label: 'Vegetarian', value: 'vegetarian' },
            { label: 'Vegan', value: 'vegan' },
            { label: 'Gluten-free', value: 'gluten-free' },
            { label: 'Halal', value: 'halal' },
            { label: 'Kosher', value: 'kosher' },
          ]
        },
        { id: 'accessibility', type: 'textarea', label: 'Accessibility Needs', required: false, placeholder: 'Please describe any accessibility requirements' },
      ],
    },
    settings: { thankYouMessage: 'Thank you for registering! We look forward to seeing you at the event.' },
  },
  {
    id: 'webinar-signup',
    name: 'Webinar Signup',
    description: 'Collect registrations for online webinars and virtual events',
    category: 'events',
    schema: {
      fields: [
        { id: 'firstName', type: 'text', label: 'First Name', required: true, placeholder: 'First name' },
        { id: 'lastName', type: 'text', label: 'Last Name', required: true, placeholder: 'Last name' },
        { id: 'email', type: 'email', label: 'Email Address', required: true, placeholder: 'your@email.com' },
        { id: 'company', type: 'text', label: 'Company', required: false, placeholder: 'Company name' },
        { id: 'jobTitle', type: 'text', label: 'Job Title', required: false, placeholder: 'Your role' },
        {
          id: 'industry', type: 'select', label: 'Industry', required: false, options: [
            { label: 'Technology', value: 'technology' },
            { label: 'Healthcare', value: 'healthcare' },
            { label: 'Finance', value: 'finance' },
            { label: 'Education', value: 'education' },
            { label: 'Retail', value: 'retail' },
            { label: 'Other', value: 'other' },
          ]
        },
        {
          id: 'source', type: 'select', label: 'How did you hear about us?', required: false, options: [
            { label: 'Social Media', value: 'social' },
            { label: 'Email', value: 'email' },
            { label: 'Search Engine', value: 'search' },
            { label: 'Referral', value: 'referral' },
            { label: 'Other', value: 'other' },
          ]
        },
        { id: 'linkedin', type: 'text', label: 'LinkedIn Profile', required: false, placeholder: 'https://linkedin.com/in/yourprofile' },
      ],
    },
    settings: { thankYouMessage: 'You\'re registered! Check your email for the webinar link.' },
  },
  {
    id: 'job-application',
    name: 'Job Application',
    description: 'Streamline your hiring process with this application form',
    category: 'hr',
    schema: {
      fields: [
        { id: 'fullName', type: 'text', label: 'Full Name', required: true, placeholder: 'Enter your full name' },
        { id: 'email', type: 'email', label: 'Email Address', required: true, placeholder: 'your@email.com' },
        { id: 'phone', type: 'phone', label: 'Phone Number', required: true, placeholder: '+1 (555) 000-0000' },
        { id: 'linkedin', type: 'text', label: 'LinkedIn Profile', required: false, placeholder: 'https://linkedin.com/in/yourprofile' },
        {
          id: 'position', type: 'select', label: 'Position Applied For', required: true, options: [
            { label: 'Software Engineer', value: 'software-engineer' },
            { label: 'Product Manager', value: 'product-manager' },
            { label: 'Designer', value: 'designer' },
            { label: 'Marketing', value: 'marketing' },
            { label: 'Sales', value: 'sales' },
            { label: 'Other', value: 'other' },
          ]
        },
        { id: 'experience', type: 'number', label: 'Years of Experience', required: true, validation: { min: 0, max: 50 } },
        { id: 'resume', type: 'file', label: 'Resume/CV', required: true, helpText: 'Upload PDF or Word document' },
        { id: 'coverLetter', type: 'textarea', label: 'Cover Letter', required: false, placeholder: 'Tell us why you\'re a great fit...' },
        { id: 'availability', type: 'date', label: 'Available Start Date', required: true },
      ],
    },
    settings: { thankYouMessage: 'Thank you for applying! We\'ll review your application and get back to you soon.' },
  },
  {
    id: 'newsletter-signup',
    name: 'Newsletter Signup',
    description: 'Grow your email list with this simple signup form',
    category: 'marketing',
    schema: {
      fields: [
        { id: 'firstName', type: 'text', label: 'First Name', required: true, placeholder: 'First name' },
        { id: 'email', type: 'email', label: 'Email Address', required: true, placeholder: 'your@email.com' },
        {
          id: 'industry', type: 'select', label: 'Industry', required: false, options: [
            { label: 'Technology', value: 'technology' },
            { label: 'Healthcare', value: 'healthcare' },
            { label: 'Finance', value: 'finance' },
            { label: 'Education', value: 'education' },
            { label: 'Other', value: 'other' },
          ]
        },
        {
          id: 'interests', type: 'checkbox', label: 'Topics of Interest', required: false, options: [
            { label: 'Product Updates', value: 'product' },
            { label: 'Industry News', value: 'news' },
            { label: 'Tips & Tutorials', value: 'tips' },
            { label: 'Case Studies', value: 'cases' },
          ]
        },
        {
          id: 'frequency', type: 'radio', label: 'Email Frequency', required: true, options: [
            { label: 'Daily', value: 'daily' },
            { label: 'Weekly', value: 'weekly' },
            { label: 'Monthly', value: 'monthly' },
          ]
        },
      ],
    },
    settings: { thankYouMessage: 'Welcome aboard! Check your inbox to confirm your subscription.' },
  },
  {
    id: 'contact-form',
    name: 'Contact Form',
    description: 'A simple contact form for your website',
    category: 'general',
    schema: {
      fields: [
        { id: 'fullName', type: 'text', label: 'Full Name', required: true, placeholder: 'Your name' },
        { id: 'email', type: 'email', label: 'Email Address', required: true, placeholder: 'your@email.com' },
        { id: 'phone', type: 'phone', label: 'Phone Number', required: false, placeholder: '+1 (555) 000-0000' },
        { id: 'company', type: 'text', label: 'Company', required: false, placeholder: 'Company name' },
        { id: 'subject', type: 'text', label: 'Subject', required: true, placeholder: 'What is this about?' },
        { id: 'message', type: 'textarea', label: 'Message', required: true, placeholder: 'Your message...' },
        {
          id: 'priority', type: 'select', label: 'Priority Level', required: false, options: [
            { label: 'Low', value: 'low' },
            { label: 'Medium', value: 'medium' },
            { label: 'High', value: 'high' },
            { label: 'Urgent', value: 'urgent' },
          ]
        },
      ],
    },
    settings: { thankYouMessage: 'Thank you for reaching out! We\'ll get back to you within 24 hours.' },
  },
  {
    id: 'customer-feedback',
    name: 'Customer Feedback',
    description: 'Collect valuable feedback from your customers',
    category: 'feedback',
    schema: {
      fields: [
        { id: 'orderId', type: 'text', label: 'Order ID', required: false, placeholder: 'ORD-XXXXX' },
        { id: 'purchaseDate', type: 'date', label: 'Date of Purchase', required: false },
        {
          id: 'product', type: 'select', label: 'Product/Service', required: true, options: [
            { label: 'Product A', value: 'product-a' },
            { label: 'Product B', value: 'product-b' },
            { label: 'Service X', value: 'service-x' },
            { label: 'Service Y', value: 'service-y' },
          ]
        },
        { id: 'rating', type: 'rating', label: 'Overall Rating', required: true },
        { id: 'feedback', type: 'textarea', label: 'Your Feedback', required: true, placeholder: 'Tell us about your experience...' },
        { id: 'email', type: 'email', label: 'Email for Follow-up', required: false, placeholder: 'your@email.com' },
        {
          id: 'recommend', type: 'radio', label: 'Would you recommend us?', required: true, options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
            { label: 'Maybe', value: 'maybe' },
          ]
        },
      ],
    },
    settings: { thankYouMessage: 'Thank you for your feedback! It helps us improve.' },
  },
  {
    id: 'beta-signup',
    name: 'Product Beta Signup',
    description: 'Collect signups for your product beta program',
    category: 'product',
    schema: {
      fields: [
        { id: 'fullName', type: 'text', label: 'Full Name', required: true, placeholder: 'Your name' },
        { id: 'email', type: 'email', label: 'Email Address', required: true, placeholder: 'your@email.com' },
        { id: 'company', type: 'text', label: 'Company', required: false, placeholder: 'Company name' },
        {
          id: 'role', type: 'select', label: 'Your Role', required: true, options: [
            { label: 'Developer', value: 'developer' },
            { label: 'Designer', value: 'designer' },
            { label: 'Product Manager', value: 'pm' },
            { label: 'Executive', value: 'executive' },
            { label: 'Other', value: 'other' },
          ]
        },
        { id: 'problem', type: 'textarea', label: 'What problem would this solve for you?', required: true, placeholder: 'Describe your use case...' },
        {
          id: 'budget', type: 'select', label: 'Budget Range', required: false, options: [
            { label: 'Free tier only', value: 'free' },
            { label: '$1-50/month', value: 'starter' },
            { label: '$51-200/month', value: 'pro' },
            { label: '$200+/month', value: 'enterprise' },
          ]
        },
        {
          id: 'contact', type: 'radio', label: 'Preferred Contact Method', required: true, options: [
            { label: 'Email', value: 'email' },
            { label: 'Phone', value: 'phone' },
            { label: 'Slack', value: 'slack' },
          ]
        },
      ],
    },
    settings: { thankYouMessage: 'You\'re on the list! We\'ll reach out when beta access is available.' },
  },
  {
    id: 'course-registration',
    name: 'Course/Workshop Registration',
    description: 'Register students for courses and workshops',
    category: 'education',
    schema: {
      fields: [
        { id: 'fullName', type: 'text', label: 'Full Name', required: true, placeholder: 'Your name' },
        { id: 'email', type: 'email', label: 'Email Address', required: true, placeholder: 'your@email.com' },
        { id: 'phone', type: 'phone', label: 'Phone Number', required: true, placeholder: '+1 (555) 000-0000' },
        {
          id: 'education', type: 'select', label: 'Education Level', required: true, options: [
            { label: 'High School', value: 'high-school' },
            { label: 'Bachelor\'s Degree', value: 'bachelors' },
            { label: 'Master\'s Degree', value: 'masters' },
            { label: 'PhD', value: 'phd' },
            { label: 'Other', value: 'other' },
          ]
        },
        {
          id: 'course', type: 'select', label: 'Course Name', required: true, options: [
            { label: 'Introduction to Programming', value: 'intro-programming' },
            { label: 'Web Development Bootcamp', value: 'web-dev' },
            { label: 'Data Science Fundamentals', value: 'data-science' },
            { label: 'UX Design Workshop', value: 'ux-design' },
          ]
        },
        { id: 'startDate', type: 'date', label: 'Preferred Start Date', required: true },
        {
          id: 'experience', type: 'select', label: 'Experience Level', required: true, options: [
            { label: 'Beginner', value: 'beginner' },
            { label: 'Intermediate', value: 'intermediate' },
            { label: 'Advanced', value: 'advanced' },
          ]
        },
        { id: 'requirements', type: 'textarea', label: 'Special Requirements', required: false, placeholder: 'Any special needs or requirements...' },
      ],
    },
    settings: { thankYouMessage: 'Registration received! Check your email for course details.' },
  },
  {
    id: 'volunteer-signup',
    name: 'Volunteer Signup',
    description: 'Recruit volunteers for your organization',
    category: 'nonprofit',
    schema: {
      fields: [
        { id: 'fullName', type: 'text', label: 'Full Name', required: true, placeholder: 'Your name' },
        { id: 'email', type: 'email', label: 'Email Address', required: true, placeholder: 'your@email.com' },
        { id: 'phone', type: 'phone', label: 'Phone Number', required: true, placeholder: '+1 (555) 000-0000' },
        { id: 'address', type: 'textarea', label: 'Address', required: false, placeholder: 'Your address' },
        {
          id: 'availability', type: 'checkbox', label: 'Availability', required: true, options: [
            { label: 'Weekday Mornings', value: 'weekday-am' },
            { label: 'Weekday Afternoons', value: 'weekday-pm' },
            { label: 'Weekday Evenings', value: 'weekday-eve' },
            { label: 'Weekends', value: 'weekends' },
          ]
        },
        {
          id: 'interests', type: 'select', label: 'Volunteer Interests', required: true, options: [
            { label: 'Event Support', value: 'events' },
            { label: 'Administrative', value: 'admin' },
            { label: 'Outreach', value: 'outreach' },
            { label: 'Mentoring', value: 'mentoring' },
            { label: 'Fundraising', value: 'fundraising' },
          ]
        },
        { id: 'experience', type: 'textarea', label: 'Relevant Experience', required: false, placeholder: 'Tell us about your experience...' },
        {
          id: 'backgroundCheck', type: 'checkbox', label: 'Background Check Consent', required: true, options: [
            { label: 'I consent to a background check', value: 'consent' },
          ]
        },
      ],
    },
    settings: { thankYouMessage: 'Thank you for volunteering! We\'ll be in touch soon.' },
  },
  {
    id: 'membership-form',
    name: 'Membership/Subscription Form',
    description: 'Sign up new members for your organization',
    category: 'membership',
    schema: {
      fields: [
        { id: 'fullName', type: 'text', label: 'Full Name', required: true, placeholder: 'Your name' },
        { id: 'email', type: 'email', label: 'Email Address', required: true, placeholder: 'your@email.com' },
        { id: 'phone', type: 'phone', label: 'Phone Number', required: true, placeholder: '+1 (555) 000-0000' },
        {
          id: 'tier', type: 'select', label: 'Membership Tier', required: true, options: [
            { label: 'Basic - Free', value: 'basic' },
            { label: 'Pro - $9.99/month', value: 'pro' },
            { label: 'Premium - $19.99/month', value: 'premium' },
            { label: 'Enterprise - Contact us', value: 'enterprise' },
          ]
        },
        { id: 'address', type: 'textarea', label: 'Billing Address', required: true, placeholder: 'Your billing address' },
        {
          id: 'payment', type: 'radio', label: 'Payment Method', required: true, options: [
            { label: 'Credit Card', value: 'credit-card' },
            { label: 'PayPal', value: 'paypal' },
            { label: 'Bank Transfer', value: 'bank' },
          ]
        },
        { id: 'promoCode', type: 'text', label: 'Promo Code', required: false, placeholder: 'Enter promo code' },
        {
          id: 'newsletter', type: 'checkbox', label: 'Newsletter', required: false, options: [
            { label: 'Subscribe to our newsletter', value: 'subscribe' },
          ]
        },
      ],
    },
    settings: { thankYouMessage: 'Welcome to the club! Your membership is now active.' },
  },
];

async function seed() {
  console.log('Seeding templates...');
  for (const t of templates) {
    await prisma.template.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        description: t.description,
        category: t.category,
        schema: JSON.stringify(t.schema),
        settings: JSON.stringify(t.settings),
        isStatic: true,
      },
      create: {
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        schema: JSON.stringify(t.schema),
        settings: JSON.stringify(t.settings),
        isStatic: true,
      },
    });
  }
  console.log('Seeding completed.');
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
