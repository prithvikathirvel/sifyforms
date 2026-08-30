import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox as UICheckbox } from '../components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Loader2, CheckCircle, Star, FileText, ChevronLeft, ChevronRight, ExternalLink, CreditCard, BarChart2, XCircle, Lock, ShieldCheck } from 'lucide-react';
import { PoweredBySify } from '../components/ui/SifyWordmark';
import api from '../lib/api';
import { getFieldValidation } from '../lib/fieldValidation';
import { evaluateShowWhen, evaluateLinkingConditions } from '../lib/ruleEngine';
import { CalculationEngine } from '../lib/calculationEngine';
import FileUpload from '../components/ui/FileUpload';
import DmsFileUpload from '../components/ui/DmsFileUpload';
import SignaturePad from '../components/ui/SignaturePad';
import { MultiSelectField } from '../components/builder/MultiSelectField';
import FormStepper from '../components/builder/FormStepper';
import TableField from '../components/ui/TableField';
import TurnstileWidget from '../components/security/TurnstileWidget';
import { getPublicDownloadUrl, resolveFilesForSubmission, resolveSignatureForSubmission, triggerBrowserDownload } from '../lib/dms';
import type { Form, FormField, FormLayout, DateConstraint, AssessmentResult, VotingResult, FormBrandingSection, DmsFileReference, FormFileValue } from '../types';

const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

const BRANDING_JUSTIFY: Record<string, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};
const BRANDING_TEXT_ALIGN: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

// Message shown when a Smart Connection restriction rule makes a field required.
// Reads the same as a normal required field — form fillers don't need to know
// the requirement is condition-driven. Shared between validation registration
// and the linking effect so the stale error can be detected and cleared when
// the condition stops matching.
const CONDITIONAL_REQUIRED_MESSAGE = 'This field is required';

/**
 * Branding around the public form. Header: a full-width bar pinned to the top
 * of the page, with logo and/or text each placed left/center/right (same side
 * = grouped together, e.g. logo + text both left; different sides = split row,
 * e.g. logo left + text center). Footer: plain text below the form, no bar.
 * Hidden when disabled or empty; legacy sections without the flag stay visible.
 */
function FormBranding({ section, variant, formId }: { section?: FormBrandingSection; variant: 'header' | 'footer'; formId?: string }) {
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (section?.logoDocumentId && formId) {
      getPublicDownloadUrl(section.logoDocumentId, formId)
        .then((url) => setResolvedLogoUrl(url))
        .catch(() => setResolvedLogoUrl(section?.logoUrl));
    } else {
      setResolvedLogoUrl(section?.logoUrl);
    }
  }, [section?.logoDocumentId, section?.logoUrl, formId]);

  if (!section || section.enabled === false) return null;

  if (variant === 'footer') {
    if (!section.text) return null;
    return (
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground whitespace-pre-line">{section.text}</p>
      </div>
    );
  }

  const hasLogo = !!resolvedLogoUrl;
  const hasText = !!section.text;
  if (!hasLogo && !hasText) return null;

  const logoPos = section.logoPosition || 'center';
  const textPos = section.textPosition || 'center';

  const logoEl = hasLogo ? (
    <img src={resolvedLogoUrl} alt="Form header logo" className="max-h-12 object-contain" />
  ) : null;
  const textEl = hasText ? (
    <p className="text-lg font-semibold text-foreground whitespace-pre-line">{section.text}</p>
  ) : null;

  // Single element, or both on the same side: one grouped row; otherwise a
  // three-column row so each element is pinned to its own side.
  const row = (!hasLogo || !hasText || logoPos === textPos) ? (
    <div className={`flex items-center gap-3 ${BRANDING_JUSTIFY[hasLogo ? logoPos : textPos]} ${BRANDING_TEXT_ALIGN[hasLogo ? logoPos : textPos]}`}>
      {logoEl}
      {textEl}
    </div>
  ) : (
    <div className="grid grid-cols-3 items-center gap-2">
      {(['left', 'center', 'right'] as const).map((pos) => (
        <div key={pos} className={`flex items-center gap-2 ${BRANDING_JUSTIFY[pos]} ${BRANDING_TEXT_ALIGN[pos]}`}>
          {logoPos === pos && logoEl}
          {textPos === pos && textEl}
        </div>
      ))}
    </div>
  );

  return (
    <div className="sticky top-0 z-40 w-full bg-card border-b border-border shadow-sm px-4 sm:px-6 lg:px-8 py-3">
      {row}
    </div>
  );
}

function FieldsByWidth({
  fields,
  errors,
  renderField,
  validationOpts,
  formValues,
  uniquenessErrors,
  uniquenessSuccess,
  externalValidationErrors,
  externalValidationSuccess,
  externalValidationLoading,
  onVerifyField,
  formId,
  orientation = 'vertical',
}: {
  fields: FormField[];
  errors: any;
  renderField: (field: FormField) => React.ReactNode;
  validationOpts: (field: FormField, formValues: Record<string, any>) => any;
  formValues: Record<string, any>;
  uniquenessErrors: Record<string, string>;
  uniquenessSuccess: Record<string, boolean>;
  externalValidationErrors: Record<string, string>;
  externalValidationSuccess: Record<string, string>;
  externalValidationLoading: Record<string, boolean>;
  onVerifyField: (fieldId: string, value: unknown) => void;
  formId?: string;
  orientation?: 'vertical' | 'horizontal';
}) {
  // Group consecutive fields by width to maintain order
  const groupFieldsByWidthConsecutive = () => {
    const groups: Array<{
      width: 'full' | 'half' | 'third';
      fields: FormField[];
    }> = [];

    let currentGroup: typeof groups[0] | null = null;

    fields.forEach(field => {
      const width = (field.width || 'full') as 'full' | 'half' | 'third';

      if (!currentGroup || currentGroup.width !== width) {
        currentGroup = { width, fields: [] };
        groups.push(currentGroup);
      }

      currentGroup.fields.push(field);
    });

    return groups;
  };

  const groups = groupFieldsByWidthConsecutive();



  const getGridClass = (width: string) => {
    switch (width) {
      case 'half':
        return 'grid grid-cols-2 gap-4';
      case 'third':
        return 'grid grid-cols-3 gap-4';
      default:
        return 'space-y-6';
    }
  };

  // Horizontal layout: each field spans columns of a 6-column grid based on its
  // width (full = 6, half = 3, third = 2), flowing left-to-right with wrapping.
  // On mobile they collapse to a single full-width column.
  const spanClass = (field: FormField) => {
    switch (field.width || 'full') {
      case 'half':
        return 'col-span-1 sm:col-span-3';
      case 'third':
        return 'col-span-1 sm:col-span-2';
      default:
        return 'col-span-1 sm:col-span-6';
    }
  };

  const renderSupportDocuments = (field: FormField) => {
    const docs = Array.isArray(field.supportDocuments)
      ? field.supportDocuments.filter((doc) => doc && doc.label && (doc.url || doc.fileData || doc.documentId))
      : [];

    if (docs.length === 0) return null;

    console.debug('[PublicFormPage] supportDocuments for field', field.id, docs);

    const handleDownload = (doc: typeof docs[number]) => {
      if (!doc.fileData || !doc.fileName) return;
      const link = document.createElement('a');
      const blob = fetch(doc.fileData).then((res) => res.blob());
      blob.then((b) => {
        const url = URL.createObjectURL(b);
        link.href = url;
        link.download = doc.fileName || 'document';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      });
    };

    const handleDmsDownload = async (doc: typeof docs[number]) => {
      if (!doc.documentId || !formId) return;
      try {
        const url = await getPublicDownloadUrl(doc.documentId, formId);
        await triggerBrowserDownload(url, doc.fileName || doc.label || 'document');
      } catch {
        alert('Failed to fetch document. Please try again.');
      }
    };

    return (
      <div className="flex flex-wrap gap-2 mt-1" data-testid={`support-documents-${field.id}`}>
        {docs.map((doc) => {
          if (doc.documentId) {
            return (
              <button
                type="button"
                key={doc.id || `${field.id}-${doc.label}`}
                onClick={() => handleDmsDownload(doc)}
                className="inline-flex items-center text-xs text-plum-600 hover:text-plum-800 bg-plum-50 px-2 py-1 rounded border border-plum-100 transition-colors"
                title={`Download ${doc.fileName || doc.label}`}
              >
                <FileText className="h-3 w-3 mr-1" />
                {doc.label}
                <span className="ml-1 text-green-700">(download)</span>
              </button>
            );
          }

          if (doc.fileData) {
            return (
              <button
                type="button"
                key={doc.id || `${field.id}-${doc.label}`}
                onClick={() => handleDownload(doc)}
                className="inline-flex items-center text-xs text-plum-600 hover:text-plum-800 bg-plum-50 px-2 py-1 rounded border border-plum-100 transition-colors"
                title={`Download ${doc.fileName || doc.label}`}
              >
                <FileText className="h-3 w-3 mr-1" />
                {doc.label}
                <span className="ml-1 text-green-700">(download)</span>
              </button>
            );
          }

          return (
            <a
              key={doc.id || `${field.id}-${doc.label}`}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-xs text-plum-600 hover:text-plum-800 bg-plum-50 px-2 py-1 rounded border border-plum-100 transition-colors"
              title={doc.url}
            >
              <FileText className="h-3 w-3 mr-1" />
              {doc.label}
              <ExternalLink className="h-2.5 w-2.5 ml-1 opacity-70" />
            </a>
          );
        })}
      </div>
    );
  };

  const renderCustomAlerts = () => {
    // Alerts are now auto-shown as popups when conditions match (handled in main useEffect)
    // Nothing rendered here
    return null;
  };

  const renderFieldItem = (field: FormField) => {
    const opts = validationOpts(field, formValues);

    return (
      <div
        key={field.id}
        id={`field-${field.id}`}
        className={orientation === 'horizontal' ? `space-y-2 ${spanClass(field)}` : 'space-y-2'}
      >
        <Label>
          {field.label}
          {(field.required || opts.required) && (
            <span className="text-destructive ml-1">*</span>
          )}
        </Label>
        {renderField(field)}
        {field.externalValidation?.enabled && field.externalValidation.trigger === 'manual' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!!errors[field.id] || externalValidationLoading[field.id] || field.disabled}
            onClick={() => onVerifyField(field.id, formValues[field.id])}
            className="h-8 gap-1.5"
          >
            {externalValidationLoading[field.id] ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            Verify
          </Button>
        )}
        {field.helpText && (
          <p className="text-sm text-muted-foreground">{field.helpText}</p>
        )}
        {errors[field.id] && (
          <p className="text-sm text-destructive">
            {errors[field.id]?.message as string}
          </p>
        )}

        {renderSupportDocuments(field)}
        {renderCustomAlerts()}
        {/* Custom alerts render nothing visible - they show as popups when conditions match */}

        {uniquenessErrors[field.id] && (
          <p className="text-sm text-destructive">
            {uniquenessErrors[field.id]}
          </p>
        )}
        {uniquenessSuccess[field.id] && !uniquenessErrors[field.id] && (
          <p className="text-sm text-green-600 font-medium">
            ✓ This value is unique
          </p>
        )}
        {externalValidationLoading[field.id] && (
          <p className="text-sm text-plum-600 font-medium flex items-center">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validating...
          </p>
        )}
        {!externalValidationLoading[field.id] && externalValidationErrors[field.id] && (
          <p className="text-sm text-destructive">
            {externalValidationErrors[field.id]}
          </p>
        )}
        {!externalValidationLoading[field.id] && externalValidationSuccess[field.id] && !externalValidationErrors[field.id] && (
          <p className="text-sm text-green-600 font-medium">
            ✓ {externalValidationSuccess[field.id]}
          </p>
        )}
      </div>
    );
  };

  if (orientation === 'horizontal') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
        {fields.map((field) => renderFieldItem(field))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group, groupIndex) => {
        const { width, fields: groupFields } = group;
        return (
          <div key={groupIndex} className={getGridClass(width)}>
            {groupFields.map((field) => renderFieldItem(field))}
          </div>
        );
      })}
    </div>
  );
}


// Format display values based on type and format
const formatDisplayValue = (value: any, type: string, format?: string): string => {
  if (value === null || value === undefined || value === 'Not calculated') {
    return 'Not set';
  }

  switch (type) {
    case 'number':
      if (format) {
        if (format === 'currency') {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
          }).format(Number(value));
        }
        if (format === 'percentage') {
          return new Intl.NumberFormat('en-US', {
            style: 'percent'
          }).format(Number(value) / 100);
        }
        if (format === 'decimal') {
          return Number(value).toFixed(2);
        }
      }
      return String(Number(value).toLocaleString());

    case 'date':
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);

        return new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }).format(date);
      } catch {
        return String(value);
      }

    case 'boolean':
      return value ? 'Yes' : 'No';

    default:
      return String(value);
  }
};

const normalizeFieldExtras = (field: FormField): FormField => ({
  ...field,
  supportDocuments: Array.isArray(field.supportDocuments)
    ? field.supportDocuments.filter((doc) => doc && doc.label && (doc.url || doc.fileData || doc.documentId))
    : [],
  alerts: Array.isArray(field.alerts)
    ? field.alerts
        .map((alert) => ({
          ...alert,
          logic: alert?.logic || 'and',
          conditions: Array.isArray(alert?.conditions) ? alert.conditions : [],
        }))
        .filter((alert) => alert && alert.message)
    : [],
});

const normalizeFormSchema = (schema: Form['schema'] | undefined) => {
  if (!schema || !Array.isArray(schema.fields)) return schema;
  return {
    ...schema,
    fields: schema.fields.map(normalizeFieldExtras),
  } as typeof schema;
};

export default function PublicFormPage() {
  const { orgSlug, formSlug } = useParams<{ orgSlug: string; formSlug: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [thankYouMessage, setThankYouMessage] = useState('');
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [lockedSteps, setLockedSteps] = useState<Set<string>>(new Set());
  const [showLockConfirmDialog, setShowLockConfirmDialog] = useState(false);
  const [calculatedVariables, setCalculatedVariables] = useState<Record<string, any>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [uniquenessErrors, setUniquenessErrors] = useState<Record<string, string>>({});
  const [uniquenessSuccess, setUniquenessSuccess] = useState<Record<string, boolean>>({});

  const [externalValidationErrors, setExternalValidationErrors] = useState<Record<string, string>>({});
  const [externalValidationSuccess, setExternalValidationSuccess] = useState<Record<string, string>>({});
  const [externalValidationLoading, setExternalValidationLoading] = useState<Record<string, boolean>>({});
  // Per-field request sequence, so a slower older response can never overwrite a
  // newer one when the respondent triggers several checks in quick succession.
  const externalValidationSeq = useRef<Record<string, number>>({});

  // Cloudflare Turnstile is mandatory for every public submission. The token is
  // short-lived, single-use, and verified by the backend before any write.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<{ id: string; fieldId: string; message: string; type: 'info' | 'warning' | 'error' | 'success' } | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Form Authentication state
  // Steps: email → email-otp → (phone → phone-otp →) done
  const [authStep, setAuthStep] = useState<'email' | 'email-otp' | 'phone' | 'phone-otp' | 'done'>('email');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authOtp, setAuthOtp] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const AUTH_SESSION_KEY = `form_auth_${form?.id}`;

  const sendOtp = () => {
    const isPhoneStep = authStep === 'phone';
    if (isPhoneStep) {
      if (!authPhone.trim() || !/^\+?\d{7,15}$/.test(authPhone.replace(/\s/g, ''))) {
        setAuthError('Please enter a valid phone number.');
        return;
      }
    } else {
      if (!authEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail)) {
        setAuthError('Please enter a valid email address.');
        return;
      }
    }
    setAuthLoading(true);
    // OTP service integrated later — hardcoded as 1234 for now
    setTimeout(() => {
      setAuthLoading(false);
      setAuthStep(isPhoneStep ? 'phone-otp' : 'email-otp');
      setAuthError(null);
    }, 800);
  };

  const verifyOtp = () => {
    if (authOtp.length !== 4) { setAuthError('Please enter the 4-digit OTP.'); return; }
    setAuthLoading(true);
    setTimeout(() => {
      setAuthLoading(false);
      if (authOtp === '1234') {
        setAuthError(null);
        setAuthOtp('');
        const method = form?.settings?.authentication?.method ?? 'email';
        if (authStep === 'email-otp' && method === 'both') {
          // Email verified — now collect phone
          setAuthStep('phone');
        } else {
          // Fully verified
          const sessionData = {
            email: authEmail,
            phone: authPhone,
            step: 'done',
            stepIndex: currentStepIndex,
            verifiedAt: Date.now(),
          };
          sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));
          setAuthStep('done');
        }
      } else {
        setAuthError('Invalid OTP. Please try again.');
        setAuthOtp('');
      }
    }, 600);
  };

  // Draft / partial submission
  const [draftRestored, setDraftRestored] = useState(false);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Payment overlay state
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed' | null>(null);
  const paymentPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Payment confirmation dialog
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [paymentConfirmInfo, setPaymentConfirmInfo] = useState<{ amount: string; email: string; mobile: string } | null>(null);
  const pendingSubmissionDataRef = useRef<Record<string, any> | null>(null);

  const [tableValidationErrors, setTableValidationErrors] = useState<Record<string, string[]>>({});

  // Post-submission processing state
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  const [pollResults, setPollResults] = useState<VotingResult | null>(null);
  // After assessment submission: poll until processing is done, then fetch scorecard
  useEffect(() => {
    if (!submitted || !submissionId || form?.settings?.formType !== 'assessment') return;
    if (!form?.settings?.assessment?.showScoreAfterSubmit) return;

    let attempts = 0;
    const maxAttempts = 20;

    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await api.get(`/processing/submissions/${submissionId}/result/public`);
        const { processingStatus: status, result } = res.data;
        if (status === 'done' && result) {
          setAssessmentResult(result);
          clearInterval(poll);
        } else if (status === 'failed' || attempts >= maxAttempts) {
          clearInterval(poll);
        }
      } catch {
        if (attempts >= maxAttempts) clearInterval(poll);
      }
    }, 1500);

    return () => clearInterval(poll);
  }, [submitted, submissionId, form?.settings?.formType, form?.settings?.assessment?.showScoreAfterSubmit]);

  // After voting submission: fetch live poll results if enabled
  useEffect(() => {
    if (!submitted || !form?.id || form?.settings?.formType !== 'voting') return;
    if (!form?.settings?.voting?.showResultsAfterVoting) return;

    api.get(`/processing/forms/${form.id}/poll-results`)
      .then(res => setPollResults(res.data))
      .catch(() => {});
  }, [submitted, form?.id, form?.settings?.formType, form?.settings?.voting?.showResultsAfterVoting]);

  const POS_BASE = 'https://apidev.sifymodernization.digital/payment-service';

  // Kept for cleanup on unmount only (Paytm injects a form into body)
  const stopPaymentPolling = useCallback(() => {
    if (paymentPollRef.current) {
      clearInterval(paymentPollRef.current);
      paymentPollRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopPaymentPolling(), [stopPaymentPolling]);

  const handlePaymentConfirm = () => {
    setPaymentConfirmOpen(false);
    // pendingSubmissionDataRef.current is already set; re-trigger RHF submit
    // which will skip the confirmation dialog on the second pass
    handleSubmit(onSubmit)();
  };

  const handlePaymentCancel = () => {
    setPaymentConfirmOpen(false);
    pendingSubmissionDataRef.current = null;
  };

  const { register, handleSubmit, formState: { errors }, setValue, watch, trigger, getValues, reset } = useForm({
    mode: 'onTouched',
    shouldUnregister: false,
  });
  const formValues = watch() || {};

  // Clear a field's external-validation result when its value changes, so a
  // stale "✓ verified" (or an old error) never lingers after the respondent
  // edits the field.
  const prevExternalValuesRef = useRef<Record<string, unknown>>({});
  useEffect(() => {
    const prev = prevExternalValuesRef.current;
    prevExternalValuesRef.current = formValues;
    setExternalValidationSuccess(prevState => {
      const nextState = { ...prevState };
      let dirty = false;
      for (const id of Object.keys(prevState)) {
        if (prev[id] !== formValues[id]) { delete nextState[id]; dirty = true; }
      }
      return dirty ? nextState : prevState;
    });
    setExternalValidationErrors(prevState => {
      const nextState = { ...prevState };
      let dirty = false;
      for (const id of Object.keys(prevState)) {
        if (prev[id] !== formValues[id]) { delete nextState[id]; dirty = true; }
      }
      return dirty ? nextState : prevState;
    });
  }, [formValues]);

  // Auto-save draft on field change (debounced 3s)
  useEffect(() => {
    // Never save after the form has been successfully submitted — doing so
    // recreates a stale draft that shows "previous progress restored" on the
    // user's next visit even though they already finished.
    if (submitted) return;
    const authIdentity = authEmail || authPhone;
    if (authStep !== 'done' || !authIdentity || !form?.settings?.partialSubmission?.enabled) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      const draftSafe: Record<string, unknown> = {};
      Object.entries(formValues || {}).forEach(([key, val]) => {
        if (val instanceof File || val instanceof FileList) return;
        if (Array.isArray(val) && val.some((item) => item instanceof File || (item && typeof item === 'object' && (item as any).status === 'pending'))) {
          return;
        }
        if (val && typeof val === 'object' && (val as any).status === 'pending') return;
        draftSafe[key] = val;
      });
      api.post('/drafts', {
        formId: form.id,
        identity: authIdentity,
        data: draftSafe,
        stepIndex: currentStepIndex,
      }).catch(() => {});
    }, 3000);
    return () => { if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current); };
  }, [formValues, currentStepIndex, submitted, authStep, authEmail, authPhone]);

  // Verified sessions expire after 30 minutes of inactivity
  const AUTH_SESSION_TTL_MS = 30 * 60 * 1000;

  // Restore auth state from sessionStorage, or initialise the input step
  useEffect(() => {
    if (!form) return;
    const auth = form.settings?.authentication;
    if (!auth?.enabled) {
      setAuthStep('done');
      return;
    }
    const saved = sessionStorage.getItem(`form_auth_${form.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const age = Date.now() - (parsed.verifiedAt ?? 0);
        if (parsed.step === 'done' && age < AUTH_SESSION_TTL_MS) {
          setAuthEmail(parsed.email || '');
          setAuthPhone(parsed.phone || '');
          setAuthStep('done');
          if (typeof parsed.stepIndex === 'number') setCurrentStepIndex(parsed.stepIndex);
          if (Array.isArray(parsed.lockedSteps) && parsed.lockedSteps.length > 0) {
            setLockedSteps(new Set(parsed.lockedSteps));
          }
          return;
        }
        // Expired or invalid — remove stale entry
        sessionStorage.removeItem(`form_auth_${form.id}`);
      } catch { /* corrupt session — fall through */ }
    }
    // No valid session: start at email input (or phone input if phone-only)
    setAuthStep(auth.method === 'phone' ? 'phone' : 'email');
  }, [form?.id]);

  // Persist step index, locked steps and refresh TTL on every step/lock change
  useEffect(() => {
    if (!form?.id || authStep !== 'done') return;
    const saved = sessionStorage.getItem(`form_auth_${form.id}`);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      parsed.stepIndex = currentStepIndex;
      parsed.lockedSteps = [...lockedSteps];
      parsed.verifiedAt = Date.now(); // refresh inactivity timer
      sessionStorage.setItem(`form_auth_${form.id}`, JSON.stringify(parsed));
    } catch { /* ignore */ }
  }, [currentStepIndex, lockedSteps, authStep]);

  // After verification: prefill mapped field(s) + load draft if partial submission enabled
  useEffect(() => {
    if (authStep !== 'done' || !form) return;

    const auth = form.settings?.authentication;
    if (auth?.method === 'phone' && auth.phoneFieldId) {
      setValue(auth.phoneFieldId, authPhone || authEmail);
    } else if (auth?.method === 'both') {
      if (auth.emailFieldId) setValue(auth.emailFieldId, authEmail);
      if (auth.phoneFieldId) setValue(auth.phoneFieldId, authPhone);
    } else if (auth?.emailFieldId) {
      setValue(auth.emailFieldId, authEmail);
    }

    const authIdentity = authEmail || authPhone;
    if (form.settings?.partialSubmission?.enabled && authIdentity) {
      api.get(`/drafts/${form.id}`, { params: { identity: authIdentity } }).then(res => {
        const draft = res.data?.draft;
        if (draft?.data) {
          Object.entries(draft.data).forEach(([key, val]) => setValue(key, val));
          if (typeof draft.stepIndex === 'number') {
            // Clamp to valid range in case steps were added/removed after the draft was saved
            const stepCount = form.schema?.layout?.steps?.length ?? 1;
            const safeIndex = Math.min(Math.max(draft.stepIndex, 0), stepCount - 1);
            setCurrentStepIndex(safeIndex);
          }
          setDraftRestored(true);
        }
      }).catch(() => {/* no draft found — start fresh */});
    }
  }, [authStep]);

  const layout: FormLayout = form?.schema?.layout || { mode: 'singlePage', steps: [] };
  const isMultiStep = layout.mode === 'multiStep' && layout.steps && layout.steps.length > 0;
  const sortedSteps = useMemo(
    () => [...(layout.steps || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [layout.steps]
  );
  const stepperStyle = layout.stepperStyle || 'progress';

  const { fieldsToShow, currentStep, totalSteps } = useMemo(() => {
    if (!form) return { fieldsToShow: [], currentStep: null, totalSteps: 0 };
    if (!isMultiStep) {

      return { fieldsToShow: form.schema.fields, currentStep: null, totalSteps: 1 };
    }
    const steps = (layout.steps || []).sort((a, b) => a.order - b.order);


    if (steps.length === 0) {

      return { fieldsToShow: form.schema.fields, currentStep: null, totalSteps: 1 };
    }
    const step = steps[currentStepIndex] ?? steps[0];
    const stepFieldIds = new Set(step?.fieldIds || []);
    // Use schema.fields order (drag-drop source of truth) filtered to this step's fields
    const fieldsToShow = form.schema.fields.filter((f) => stepFieldIds.has(f.id));



    return {
      fieldsToShow,
      currentStep: step,
      totalSteps: steps.length,
    };
  }, [form, isMultiStep, layout.steps, currentStepIndex]);

  const isCurrentStepLocked = isMultiStep && currentStep != null && lockedSteps.has(currentStep.id);

  const visibleFields = useMemo(
    () => {
      const filtered = fieldsToShow.filter((f) =>
        evaluateShowWhen(f.showWhen, formValues as Record<string, unknown>, f)
      );

      return filtered;
    },
    [fieldsToShow, formValues]
  );

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const response = await api.get(`/forms/public/${orgSlug}/${formSlug}`);
        const normalizedSchema = normalizeFormSchema(response.data?.schema);
        setForm({
          ...response.data,
          schema: normalizedSchema,
        });
      } catch (err: any) {
        setError(err.response?.data?.error || 'Form not found or not published');
      } finally {
        setIsLoading(false);
      }
    };

    fetchForm();
  }, [orgSlug, formSlug]);

  // Initialize default values for fields when form loads
  useEffect(() => {
    if (!form?.schema?.fields) return;

    form.schema.fields.forEach((field: FormField) => {
      // Only set default value if the field doesn't already have a value
      if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
        // Check if field is not linked or if linking is not enabled
        const hasNoLinking = !field.fieldLinking?.enabled;
        if (hasNoLinking) {
          setValue(field.id, field.defaultValue, { shouldValidate: false });
        }
      }
    });
  }, [form, setValue]);

  // Auto-show alerts when conditions match
  useEffect(() => {
    if (!form?.schema?.fields || !formValues) return;

    // Check all fields for matching alerts
    for (const field of form.schema.fields) {
      if (!Array.isArray(field.alerts) || field.alerts.length === 0) continue;

      for (const alert of field.alerts) {
        if (!alert || !alert.message) continue;

        const hasConditions = Array.isArray(alert.conditions) && alert.conditions.length > 0;
        if (!hasConditions) continue;

        const isVisible = evaluateShowWhen(alert as any, formValues as any);
        const alertKey = `${field.id}-${alert.id}`;

        // If conditions are no longer met, remove from dismissed so it can re-trigger
        if (!isVisible && dismissedAlerts.has(alertKey)) {
          setDismissedAlerts(prev => {
            const next = new Set(prev);
            next.delete(alertKey);
            return next;
          });
        }

        // Only show if conditions match AND not already dismissed
        if (isVisible && !activeAlert && !dismissedAlerts.has(alertKey)) {
          console.debug('[PublicFormPage] Auto-showing matching alert:', field.id, alert.id, alertKey);
          setActiveAlert({ id: alert.id, fieldId: field.id, message: alert.message, type: alert.type });
          return; // Only show one alert at a time
        }
      }
    }

    // Also check alerts configured on individual table grid columns.
    // Conditions on a column use fieldId = col.id. Since formValues stores the
    // whole table as formValues[tableFieldId] = { rows: [...] }, we inject each
    // row's cell values into a patched formValues so the rule engine can resolve
    // col.id → cell value. An alert fires if ANY row satisfies its conditions.
    for (const field of form.schema.fields) {
      if (field.type !== 'table') continue;
      const tableValue = (formValues as Record<string, unknown>)[field.id] as { rows: Record<string, unknown>[] } | undefined;
      const rows = tableValue?.rows ?? [];
      const columns = field.tableConfig?.columns ?? [];
      for (const col of columns) {
        if (!Array.isArray(col.alerts) || col.alerts.length === 0) continue;
        for (const alert of col.alerts) {
          if (!alert || !alert.message) continue;
          const hasConditions = Array.isArray(alert.conditions) && alert.conditions.length > 0;
          if (!hasConditions) continue;

          // Evaluate: inject each row's cell values so formValues[col.id] resolves
          let isVisible = false;
          if (rows.length > 0) {
            for (const row of rows) {
              const rowFormValues: Record<string, unknown> = { ...formValues as Record<string, unknown> };
              for (const [k, v] of Object.entries(row)) {
                if (k !== '_id') rowFormValues[k] = v;
              }
              if (evaluateShowWhen(alert as any, rowFormValues as any)) {
                isVisible = true;
                break;
              }
            }
          } else {
            isVisible = evaluateShowWhen(alert as any, formValues as any);
          }

          const alertKey = `${field.id}-${col.id}-${alert.id}`;
          if (!isVisible && dismissedAlerts.has(alertKey)) {
            setDismissedAlerts(prev => {
              const next = new Set(prev);
              next.delete(alertKey);
              return next;
            });
          }
          if (isVisible && !activeAlert && !dismissedAlerts.has(alertKey)) {
            setActiveAlert({ id: alert.id, fieldId: `${field.id}-${col.id}`, message: alert.message, type: alert.type });
            return;
          }
        }
      }
    }
  }, [formValues, form?.schema?.fields, activeAlert, dismissedAlerts]);

  // Apply Theme (Scoped)
  useEffect(() => {
    // Themes are now applied strictly to the container via data-theme
    // No side effects needed on document.body
  }, [form?.settings?.theme]);



  // Calculate variables when form values change
  useEffect(() => {
    if (!form?.schema?.variables || form.schema.variables.length === 0) return;

    const engine = new CalculationEngine(form.schema.variables, formValues);
    const results = engine.calculateAllVariables();

    // Only update if values have changed to avoid infinite loops
    if (JSON.stringify(results) !== JSON.stringify(calculatedVariables)) {

      setCalculatedVariables(results);
    }
  }, [form, formValues]);

  // Handle cross-field validation dependencies
  const lastSourceValues = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!form?.schema?.fields) return;

    // Find fields that depend on other fields (legacy or new rules)
    const dependentFields = form.schema.fields.filter(f =>
      f.validation?.equalToFieldId ||
      (f.rules || []).some(r => r.type === 'custom' && r.value)
    );

    if (dependentFields.length === 0) return;

    const changedSources = new Set<string>();

    dependentFields.forEach(field => {
      // 1. Check legacy equalToFieldId
      const sourceIdLegacy = field.validation?.equalToFieldId;
      if (sourceIdLegacy && formValues[sourceIdLegacy] !== undefined) {
        if (formValues[sourceIdLegacy] !== lastSourceValues.current[sourceIdLegacy]) {
          trigger(field.id);
          changedSources.add(sourceIdLegacy);
        }
      }

      // 2. Check new rules-based custom matches
      const customRules = (field.rules || []).filter(r => r.type === 'custom' && r.value);
      customRules.forEach(rule => {
        const sourceId = String(rule.value);
        if (sourceId && formValues[sourceId] !== undefined) {
          if (formValues[sourceId] !== lastSourceValues.current[sourceId]) {
            trigger(field.id);
            changedSources.add(sourceId);
          }
        }
      });
    });

    // Update reference values for all changed sources after processing all dependents
    changedSources.forEach(sourceId => {
      lastSourceValues.current[sourceId] = formValues[sourceId];
    });
  }, [formValues, form?.schema?.fields, trigger]);

  const resolveDateConstraint = useCallback((constraint?: DateConstraint) => {
    if (!constraint || !constraint.value) return undefined;
    const engine = new CalculationEngine(form?.schema?.variables || [], formValues);

    const formatMaybeDate = (val: any) => {
      if (val instanceof Date && !isNaN(val.getTime())) {
        return val.toISOString().split('T')[0];
      }
      if (val && typeof val.toISOString === 'function') {
        return val.toISOString().split('T')[0];
      }
      return val;
    };

    switch (constraint.type) {
      case 'static':
        return constraint.value;
      case 'variable': {
        let result = calculatedVariables[constraint.value];
        if (result === undefined) {
          const variable = (form?.schema?.variables || []).find(v => v.id === constraint.value);
          result = variable?.value;
        }
        return formatMaybeDate(result);
      }
      case 'field':
        return formatMaybeDate(formValues[constraint.value]);
      case 'expression':
        try {
          const result = engine.evaluate(constraint.value);
          return formatMaybeDate(result);
        } catch {
          return undefined;
        }
      default:
        return undefined;
    }
  }, [calculatedVariables, form?.schema?.variables, formValues]);

  const handleUniquenessCheck = async (fieldId: string, value: any) => {
    if (!form || !value || value === '') {
      setUniquenessErrors(prev => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      return;
    }

    try {
      const response = await api.post('/submissions/check-unique', {
        formId: form.id,
        fieldId,
        value
      });

      if (!response.data.isUnique) {
        setUniquenessErrors(prev => ({
          ...prev,
          [fieldId]: 'This value must be unique'
        }));
        setUniquenessSuccess(prev => {
          const next = { ...prev };
          delete next[fieldId];
          return next;
        });
      } else {
        setUniquenessErrors(prev => {
          const next = { ...prev };
          delete next[fieldId];
          return next;
        });
        setUniquenessSuccess(prev => ({
          ...prev,
          [fieldId]: true
        }));
      }
    } catch (error) {
      console.error('Uniqueness check failed:', error);
    }
  };

  const handleExternalValidation = async (fieldId: string, value: any) => {
    const field = form?.schema.fields.find(f => f.id === fieldId);
    if (!form || !field?.externalValidation?.enabled || !value || value === '') {
      setExternalValidationErrors(prev => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      setExternalValidationSuccess(prev => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      return;
    }

    const seq = (externalValidationSeq.current[fieldId] = (externalValidationSeq.current[fieldId] || 0) + 1);
    try {
      setExternalValidationLoading(prev => ({ ...prev, [fieldId]: true }));
      const response = await api.post('/submissions/check-external', {
        formId: form.id,
        fieldId,
        value,
        formData: getValues()
      });

      // Ignore responses that arrived out of order (a newer check superseded this one).
      if (externalValidationSeq.current[fieldId] !== seq) return;

      if (!response.data.isValid) {
        setExternalValidationErrors(prev => ({
          ...prev,
          [fieldId]: response.data.message || 'Validation failed'
        }));
        setExternalValidationSuccess(prev => {
          const next = { ...prev };
          delete next[fieldId];
          return next;
        });
      } else {
        setExternalValidationErrors(prev => {
          const next = { ...prev };
          delete next[fieldId];
          return next;
        });
        setExternalValidationSuccess(prev => ({
          ...prev,
          [fieldId]: response.data.message || 'Verified'
        }));
      }
    } catch (error) {
      console.error('External validation check failed:', error);
    } finally {
      // Only clear the loading flag if this is still the latest request.
      if (externalValidationSeq.current[fieldId] === seq) {
        setExternalValidationLoading(prev => ({ ...prev, [fieldId]: false }));
      }
    }
  };

  /**
   * Auto mode: run the external check only after the field's own constraints
   * (required / format / rules) pass, so the third-party API is never called
   * with a value the form itself already rejects.
   */
  const runAutoExternalValidation = async (fieldId: string, value: unknown) => {
    const ok = await trigger(fieldId);
    if (ok) handleExternalValidation(fieldId, value);
  };

  // Handle field linking - update dependent fields when source field changes
  useEffect(() => {
    if (!form) return;



    const fieldsWithFieldLinking = form.schema.fields.filter(
      field => field.fieldLinking?.enabled
    );



    fieldsWithFieldLinking.forEach((field: FormField) => {
      const linking = field.fieldLinking;
      if (!linking?.enabled) return;



      const mode = linking.mode || 'basic';
      const sourceFieldValue = linking.sourceFieldId ? formValues[linking.sourceFieldId] : undefined;



      // Check if this field should be processed for restriction rules
      const shouldProcessRestrictionRules = (mode === 'restriction' || (mode === 'advanced' && linking.restrictionRules)) && linking.restrictionRules;


      if (shouldProcessRestrictionRules) {

      }

      // 1. EVALUATE RULES (Both for Auto-fill and Date Constraints)
      const matchingRule = linking.rules?.find((r: any) => {


        // New multi-condition system (supports nested AND/OR groups)
        if (r.conditions && r.conditions.length > 0) {
          return evaluateLinkingConditions(r.conditions, r.logic === 'or' ? 'or' : 'and', formValues);
        }

        // Only use legacy single-source trigger if in 'basic' mode OR if conditions are empty
        if (mode === 'basic' && linking.sourceFieldId) {
          if (sourceFieldValue === undefined || sourceFieldValue === null) return false;
          const currentVal = sourceFieldValue;
          const targetVal = r.sourceValue;



          switch (r.operator) {
            case 'equals': return String(currentVal) === String(targetVal);
            case 'notEquals': return String(currentVal) !== String(targetVal);
            case 'greaterThan': return Number(currentVal) > Number(targetVal);
            case 'lessThan': return Number(currentVal) < Number(targetVal);
            case 'contains': return String(currentVal).includes(String(targetVal));
            case 'notContains': return !String(currentVal).includes(String(targetVal));
            default: return false;
          }
        }

        return false;
      });

      // 2. APPLY AUTO-FILL
      if (matchingRule) {

        // if rule instructs to copy from another field
        if (matchingRule.copyFromFieldId) {
          const copyVal = formValues[matchingRule.copyFromFieldId];
          if (String(formValues[field.id] || '') !== String(copyVal)) {
            setValue(field.id, copyVal, { shouldValidate: true });
          }
        }

        // Check if rule has targetValue for auto-fill (not empty string)
        else if (matchingRule.targetValue !== undefined && matchingRule.targetValue !== '') {
          // Use loose comparison to avoid infinite loops with string/number mismatches
          if (String(formValues[field.id] || '') !== String(matchingRule.targetValue)) {
            setValue(field.id, matchingRule.targetValue, { shouldValidate: true });
          } else {
          }
        } else if (matchingRule.dynamicOptions && matchingRule.dynamicOptions.length > 0) {
        } else {
        }
      } else {
      }

      // 3. APPLY DATE CONSTRAINTS VALIDATION (To clear field if it becomes out of range)
      if (['date', 'time'].includes(field.type)) {

        const dateConfig = linking.dynamicConfig?.dateRange;
        let min: string | undefined;
        let max: string | undefined;

        // Mode determines where specific constraints come from
        if (mode === 'advanced' && matchingRule?.dateRange) {
          min = resolveDateConstraint(matchingRule.dateRange.min);
          max = resolveDateConstraint(matchingRule.dateRange.max);

        } else if (mode === 'basic' && dateConfig?.mappings) {
          const mapping = dateConfig.mappings[String(sourceFieldValue)];
          if (mapping) {
            min = resolveDateConstraint(mapping.min);
            max = resolveDateConstraint(mapping.max);

          }
        }

        // Overlay with Global Defaults (Fallback layer)
        const dMin = resolveDateConstraint(dateConfig?.default?.min);
        const dMax = resolveDateConstraint(dateConfig?.default?.max);
        if (!min) min = dMin;
        if (!max) max = dMax;

        const currentVal = formValues[field.id];
        if (currentVal) {
          if (min && String(currentVal) < String(min)) setValue(field.id, '', { shouldValidate: false });
          else if (max && String(currentVal) > String(max)) setValue(field.id, '', { shouldValidate: false });
        }
      }

      // 4. HANDLE DYNAMIC OPTIONS
      if (['select', 'radio', 'multiselect', 'checkbox'].includes(field.type)) {


        let newOptions: any[] = [];

        if (mode === 'basic' && linking.dynamicConfig?.options) {
          // Basic mode - use dynamicConfig.options

          const optionsMap = linking.dynamicConfig.options as Record<string, any[]>;
          newOptions = optionsMap[String(sourceFieldValue)] || field.options || [];
        } else if ((mode === 'advanced' || mode === 'restriction') && matchingRule?.dynamicOptions) {
          // Condition-based rules (advanced or restriction mode) - use rule.dynamicOptions

          newOptions = matchingRule.dynamicOptions;
        } else {
          // Fallback to original field options

          newOptions = field.options || [];
        }



        // Reset child field value when parent value changes and options change
        const currentVal = formValues[field.id];


        if (newOptions && newOptions.length > 0) {
          // Check if current value is still valid in new options
          if (currentVal && Array.isArray(newOptions)) {
            if (Array.isArray(currentVal)) {
              // checkbox/multiselect store arrays — keep only values still present
              const validVals = currentVal.filter((v: string) => newOptions.some((opt: any) => opt.value === v));
              if (validVals.length !== currentVal.length) {
                setValue(field.id, validVals, { shouldValidate: false });
              }
            } else {
              const isValid = newOptions.some((opt: any) => opt.value === currentVal);

              if (!isValid) {

                setValue(field.id, '', { shouldValidate: false });
              }
            }
          }
        } else if (Array.isArray(currentVal) ? currentVal.length > 0 : currentVal) {
          // If options are cleared/empty, reset the field

          setValue(field.id, Array.isArray(currentVal) ? [] : '', { shouldValidate: false });
        }
      }

      // 5. APPLY RESTRICTION RULES (for restriction mode or advanced mode with restrictionRules)
      if ((mode === 'restriction' || (mode === 'advanced' && linking.restrictionRules)) && linking.restrictionRules) {
        const testRule = linking.restrictionRules[0];
        if (testRule) {
          const testMatches = testRule.conditions && testRule.conditions.length > 0 &&
            evaluateLinkingConditions(testRule.conditions, testRule.logic === 'or' ? 'or' : 'and', formValues);

          if (testMatches) {
            if (testRule.action === 'required') {
              // Field should be required
            } else if (testRule.action === 'disabled') {
              setValue(field.id, '', { shouldValidate: false }); // Clear the field
            }
          }
        }

        const matchingRestrictionRules = linking.restrictionRules.filter((r: any) => {
          // Restriction rules should always have conditions
          if (!r.conditions || r.conditions.length === 0) {
            return false;
          }
          return evaluateLinkingConditions(r.conditions, r.logic === 'or' ? 'or' : 'and', formValues);
        });

        // Apply restriction actions
        const hasRequiredRule = matchingRestrictionRules.some(
          (rule: any) => rule.action === 'required' && rule.apply !== false
        );

        matchingRestrictionRules.forEach((rule: any) => {
          if (rule.action === 'disabled' && rule.apply !== false) {
            // Field should be disabled - this will be handled by the disabled state
            setValue(field.id, '', { shouldValidate: false }); // Clear the field when disabled
          }
        });

        // When a required rule MATCHES we deliberately do nothing: the rule is
        // registered via validationOpts, so the error surfaces on blur/submit
        // like any other required field ('onTouched' mode) instead of being
        // forced into view the moment the parent value changes.
        if (!hasRequiredRule && errors[field.id]?.message === CONDITIONAL_REQUIRED_MESSAGE) {
          // The condition no longer applies: the field was re-registered without
          // the conditional required rule on this render, but react-hook-form
          // only re-validates a field when ITS OWN value changes — so the stale
          // error would stick until the user touches the field. Re-validate now
          // to remove it (an originally-required empty field keeps its error).
          setTimeout(() => trigger(field.id), 0);
        }
      }
    });
  }, [form, formValues, setValue, resolveDateConstraint, trigger]);

  const handleNextToPreview = async () => {
    if (!form) return;

    // Validate all fields before showing preview
    const isValid = await trigger();
    if (!isValid) return;

    if (!turnstileToken) {
      setTurnstileError('Complete the security verification before continuing.');
      return;
    }

    setTurnstileError(null);
    setShowPreview(true);
  };

  const onSubmit = async (data: Record<string, unknown>) => {
    if (!form) return;

    if (!turnstileToken) {
      setTurnstileError('Security verification is required before submitting.');
      return;
    }
    setTurnstileError(null);

    // Check for uniqueness errors
    if (Object.keys(uniquenessErrors).length > 0) {
      return;
    }

    // Table validation rules
    const newTableErrors: Record<string, string[]> = {};
    for (const field of (form.schema?.fields ?? [])) {
      if (field.type !== 'table' || !field.tableValidation?.length) continue;
      const tableValue = data[field.id] as { rows: Record<string, any>[] } | undefined;
      const tableRows = tableValue?.rows ?? [];
      const cols = field.tableConfig?.columns ?? [];
      const fieldErrors: string[] = [];

      for (const rule of field.tableValidation) {
        if (rule.enabled === false) continue;

        const isCellFilled = (row: Record<string, any>, colId: string) => {
          const v = row[colId];
          return v !== undefined && v !== null && v !== '' && v !== 0;
        };

        // Narrow to specific named rows if the rule targets them
        const scopedRows = rule.namedRowIds?.length
          ? tableRows.filter((r) => rule.namedRowIds!.includes(r._id as string))
          : tableRows;

        switch (rule.type) {
          case 'any-row-complete': {
            const colIds = rule.columnIds?.length ? rule.columnIds : cols.map((c) => c.id);
            const ok = scopedRows.some((row) => colIds.every((cid) => isCellFilled(row, cid)));
            if (!ok) fieldErrors.push(rule.message);
            break;
          }
          case 'all-rows-complete': {
            const colIds = rule.columnIds?.length ? rule.columnIds : cols.map((c) => c.id);
            const ok = scopedRows.length > 0 && scopedRows.every((row) => colIds.every((cid) => isCellFilled(row, cid)));
            if (!ok) fieldErrors.push(rule.message);
            break;
          }
          case 'min-rows-filled': {
            const colIds = rule.columnIds?.length ? rule.columnIds : cols.map((c) => c.id);
            const min = rule.minCount ?? 1;
            const count = scopedRows.filter((row) => colIds.every((cid) => isCellFilled(row, cid))).length;
            if (count < min) fieldErrors.push(rule.message);
            break;
          }
          case 'column-value': {
            if (!rule.columnId || rule.value === undefined || rule.value === '') break;
            const cvOp = rule.operator ?? 'gt';
            const compareNum = (v: number, rv: number) => {
              switch (cvOp) {
                case 'gt': return v > rv;
                case 'gte': return v >= rv;
                case 'lt': return v < rv;
                case 'lte': return v <= rv;
                case 'eq': return v === rv;
                case 'neq': return v !== rv;
                default: return false;
              }
            };
            const rv = Number(rule.value);
            const check = (row: Record<string, any>) => compareNum(Number(row[rule.columnId!]), rv);
            const ok = rule.scope === 'all'
              ? scopedRows.length > 0 && scopedRows.every(check)
              : scopedRows.some(check);
            if (!ok) fieldErrors.push(rule.message);
            break;
          }
          case 'aggregate': {
            if (!rule.expression || rule.value === undefined || rule.value === '') break;
            try {
              const aggOp = rule.operator ?? 'gt';
              const engine = new CalculationEngine(form.schema?.variables ?? [], data);
              const result = engine.evaluate(rule.expression);
              const rv = Number(rule.value);
              const v = Number(result ?? 0);
              let ok = false;
              switch (aggOp) {
                case 'gt': ok = v > rv; break;
                case 'gte': ok = v >= rv; break;
                case 'lt': ok = v < rv; break;
                case 'lte': ok = v <= rv; break;
                case 'eq': ok = v === rv; break;
                case 'neq': ok = v !== rv; break;
              }
              if (!ok) fieldErrors.push(rule.message);
            } catch { /* skip malformed expression */ }
            break;
          }
        }
      }

      if (fieldErrors.length > 0) newTableErrors[field.id] = fieldErrors;
    }
    setTableValidationErrors(newTableErrors);
    if (Object.keys(newTableErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const dmsEnabled = form.settings?.dms?.enabled === true;
      const fieldsById = new Map((form.schema?.fields || []).map((f) => [f.id, f]));

      // Convert File objects to base64, or upload pending files/signatures to DMS on final submit
      const processedData = await Promise.all(
        Object.entries(data).map(async ([key, value]) => {
          const field = fieldsById.get(key);

          if (dmsEnabled && field?.type === 'file') {
            const uploaded = await resolveFilesForSubmission(value, form.id, field.id);
            if (uploaded) setValue(key, uploaded, { shouldValidate: false });
            return [key, uploaded];
          }

          if (dmsEnabled && field?.type === 'signature') {
            const uploaded = await resolveSignatureForSubmission(value, form.id, field.id);
            if (uploaded) setValue(key, uploaded, { shouldValidate: false });
            return [key, uploaded];
          }

          // Already-uploaded DMS file references
          if (Array.isArray(value) && value.length > 0 && value[0]?.documentId) {
            return [key, value];
          }
          if (value && typeof value === 'object' && 'documentId' in value) {
            return [key, value];
          }
          if (value instanceof FileList) {
            const files = Array.from(value);
            const base64Files = await Promise.all(
              files.map(file => fileToBase64(file))
            );
            return [key, base64Files];
          } else if (value instanceof File) {
            const base64File = await fileToBase64(value);
            return [key, base64File];
          } else if (Array.isArray(value) && value.length > 0 && value[0] instanceof File) {
            const base64Files = await Promise.all(
              value.map(file => fileToBase64(file))
            );
            return [key, base64Files];
          } else {
            return [key, value];
          }
        })
      );

      const submissionData = Object.fromEntries(processedData);

      // Payment confirmation — show dialog on first pass, skip on confirmed pass
      const paymentCfg = form.settings?.payment;
      if (paymentCfg?.enabled && pendingSubmissionDataRef.current === null) {
        let amount = '0.00';
        if (paymentCfg.amountType === 'static' && paymentCfg.staticAmount) {
          amount = parseFloat(paymentCfg.staticAmount).toFixed(2);
        } else if (paymentCfg.amountType === 'field' && paymentCfg.amountFieldId) {
          const v = parseFloat(String(submissionData[paymentCfg.amountFieldId] ?? 0));
          amount = isNaN(v) ? '0.00' : v.toFixed(2);
        } else if (paymentCfg.amountType === 'variable' && paymentCfg.amountVariableId) {
          const v = parseFloat(String(calculatedVariables[paymentCfg.amountVariableId] ?? 0));
          amount = isNaN(v) ? '0.00' : v.toFixed(2);
        }
        const email = paymentCfg.emailFieldId ? String(submissionData[paymentCfg.emailFieldId] ?? '') : '';
        const mobile = paymentCfg.mobileFieldId ? String(submissionData[paymentCfg.mobileFieldId] ?? '') : '';

        pendingSubmissionDataRef.current = submissionData;
        setPaymentConfirmInfo({ amount, email, mobile });
        setPaymentConfirmOpen(true);
        setIsSubmitting(false);
        return;
      }
      // Second pass after user confirmed — clear the ref
      pendingSubmissionDataRef.current = null;

      let submissionResponse: any;
      try {
        submissionResponse = await api.post('/submissions', {
          formId: form.id,
          data: submissionData,
          turnstileToken,
        });
      } catch (submissionError: any) {
        const msg = submissionError?.response?.data?.error || 'Failed to submit form. Please try again.';
        setError(msg);
        // Siteverify tokens are single-use. Always request a fresh token before
        // retrying, including when a later form validation rejects the request.
        setTurnstileToken(null);
        setTurnstileResetKey((key) => key + 1);
        setIsSubmitting(false);
        return;
      }

      // Handle payment redirect if payment is configured
      const payment = form.settings?.payment;
      console.log('[Payment] config:', payment);

      if (payment?.enabled) {
        try {
          // Resolve amount
          let amount = '0.00';
          if (payment.amountType === 'static' && payment.staticAmount) {
            amount = parseFloat(payment.staticAmount).toFixed(2);
          } else if (payment.amountType === 'field' && payment.amountFieldId) {
            const val = parseFloat(String(submissionData[payment.amountFieldId] ?? 0));
            amount = isNaN(val) ? '0.00' : val.toFixed(2);
          } else if (payment.amountType === 'variable' && payment.amountVariableId) {
            const val = parseFloat(String(calculatedVariables[payment.amountVariableId] ?? 0));
            amount = isNaN(val) ? '0.00' : val.toFixed(2);
          }

          const email = payment.emailFieldId ? String(submissionData[payment.emailFieldId] ?? '') : '';
          const mobile = payment.mobileFieldId ? String(submissionData[payment.mobileFieldId] ?? '') : '';

          const gateway = payment.gateway ?? 'razorpay';
          const tenantId = payment.tenantId;
          if (!tenantId) throw new Error('Payment not configured. Please contact the form administrator.');

          const orderId = `ORD_${Date.now()}`;
          const callbackUrl = `${POS_BASE}/api/callback/${gateway}`;
          const appOrigin = window.location.origin;
          const successUrl = `${appOrigin}/payment/${form.id}/status?gateway=${gateway}`;
          const failureUrl = `${appOrigin}/payment/${form.id}/status?cancelled=true&order_id=${orderId}`;

          // ── Call POS /api/pay ─────────────────────────────────────────────
          const posRes = await fetch(`${POS_BASE}/api/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenant_id: tenantId,
              order_id: orderId,
              amount: parseFloat(amount),
              currency: 'INR',
              callback_url: callbackUrl,
              success_url: successUrl,
              failure_url: failureUrl,
              customer_details: {
                id: authEmail || authPhone || email || 'anonymous',
                firstname: '',
                lastname: '',
                email: email || '',
                phone: mobile || '',
              },
              products: [{ id: orderId, name: form.name, quantity: 1, price: parseFloat(amount) }],
            }),
          });

          if (!posRes.ok) {
            const errData = await posRes.json().catch(() => ({}));
            throw new Error((errData as any).message || (errData as any).error || 'Payment initiation failed');
          }

          // ── Paytm: POS returns text/html directly ─────────────────────────
          const contentType = posRes.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            const html = await posRes.text();
            console.log('[Payment] Paytm HTML redirect');
            document.open();
            document.write(html);
            document.close();
            return;
          }

          // ── JSON response (Razorpay / PayU) ───────────────────────────────
          const posData = await posRes.json();
          console.log('[Payment] POS response:', posData);

          // ── Razorpay ──────────────────────────────────────────────────────
          if (posData.gateway === 'razorpay' || gateway === 'razorpay') {
            const razorpayKey = payment.razorpayKeyId || '';
            if (!razorpayKey) throw new Error('Razorpay Key ID not configured. Please reconfigure payment settings.');

            await new Promise<void>((resolve, reject) => {
              if ((window as any).Razorpay) { resolve(); return; }
              const script = document.createElement('script');
              script.src = 'https://checkout.razorpay.com/v1/checkout.js';
              script.onload = () => resolve();
              script.onerror = () => reject(new Error('Razorpay SDK failed to load'));
              document.body.appendChild(script);
            });

            await new Promise<void>((resolve, reject) => {
              const options = {
                key: razorpayKey,
                amount: posData.amount,
                currency: posData.currency || 'INR',
                order_id: posData.payment_id,
                handler: (response: any) => {
                  const txnId = response.razorpay_payment_id || '';
                  window.location.href = `${appOrigin}/payment/${form.id}/status?txnId=${txnId}&gateway=razorpay`;
                  resolve();
                },
                modal: { ondismiss: () => reject(new Error('Payment cancelled by user')) },
              };
              new (window as any).Razorpay(options).open();
            });
            return;
          }

          // ── PayU / any redirect-based gateway ────────────────────────────
          if (posData.payment_url) {
            window.location.href = posData.payment_url;
            return;
          }

          throw new Error(`Unsupported payment gateway response: ${JSON.stringify(posData)}`);
        } catch (payError: any) {
          const msg = payError?.message || 'Payment failed. Please contact support.';
          setError(msg);
          setIsSubmitting(false);
          return;
        }
      }

      setThankYouMessage(submissionResponse.data.thankYouMessage);
      setSubmissionId(submissionResponse.data.submissionId);
      setSubmitted(true);

      // Clear auth session so the form can be filled again fresh
      sessionStorage.removeItem(`form_auth_${form.id}`);

      // Delete draft on successful submission
      const authIdentityFinal = authEmail || authPhone;
      if (form.settings?.partialSubmission?.enabled && authIdentityFinal) {
        api.delete(`/drafts/${form.id}`, { params: { identity: authIdentityFinal } }).catch(() => {});
      }

      if (submissionResponse.data.redirectUrl) {
        setTimeout(() => {
          window.location.href = submissionResponse.data.redirectUrl;
        }, 2000);
      }
    } catch (error: any) {
      const code = error?.response?.data?.code;
      const msg = error?.response?.data?.error;
      if (code === 'ALREADY_VOTED') {
        setAlreadyVoted(true);
      } else {
        setError(msg || 'Failed to submit form. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to convert File to base64
  const fileToBase64 = (file: File): Promise<{ name: string; size: number; type: string; base64: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve({
          name: file.name,
          size: file.size,
          type: file.type,
          base64: result
        });
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const validationOpts = (field: FormField, formValues: Record<string, any>) => {
    const baseOpts = getFieldValidation(field);

    // Add dynamic required from restriction rules
    const linking = field.fieldLinking;
    if (linking?.enabled && (linking.mode === 'restriction' || (linking.mode === 'advanced' && linking.restrictionRules)) && linking.restrictionRules) {
      const matchingRestrictionRules = linking.restrictionRules.filter((r: any) => {
        if (!r.conditions || r.conditions.length === 0) {
          return false;
        }
        return evaluateLinkingConditions(r.conditions, r.logic === 'or' ? 'or' : 'and', formValues);
      });

      // Check if any rule makes this field required
      const hasRequiredRule = matchingRestrictionRules.some((rule: any) =>
        rule.action === 'required' && rule.apply !== false
      );

      if (hasRequiredRule) {
        baseOpts.required = CONDITIONAL_REQUIRED_MESSAGE;
      } else {
        // Check if field was originally required (not from restriction rules)
        if (!field.required) {
          // Explicitly disable instead of deleting the key: react-hook-form
          // merges re-register options OVER the previously registered ones
          // (_f = {...old._f, ...options}), so omitting `required` would leave
          // the stale conditional-required rule active forever.
          baseOpts.required = false;
        }
      }
    }

    // Add manual constraint validations (when smart connections not enabled)
    if (!linking?.enabled) {
      // Text field constraints
      if (['text', 'email', 'phone', 'textarea'].includes(field.type)) {
        if (field.validation?.minLength !== undefined) {
          baseOpts.minLength = {
            value: field.validation.minLength,
            message: `Must be at least ${field.validation.minLength} characters`
          };
        }
        if (field.validation?.maxLength !== undefined) {
          baseOpts.maxLength = {
            value: field.validation.maxLength,
            message: `Must be no more than ${field.validation.maxLength} characters`
          };
        }
      }
      // Number field constraints
      else if (field.type === 'number') {
        if (field.minValue !== undefined || field.validation?.min !== undefined) {
          const minVal = field.minValue !== undefined ? field.minValue : field.validation?.min;
          baseOpts.min = {
            value: minVal,
            message: `Must be at least ${minVal}`
          };
        }
        if (field.maxValue !== undefined || field.validation?.max !== undefined) {
          const maxVal = field.maxValue !== undefined ? field.maxValue : field.validation?.max;
          baseOpts.max = {
            value: maxVal,
            message: `Must be no more than ${maxVal}`
          };
        }
      }
    }

    return baseOpts;
  };

  const renderField = (field: FormField) => {
    const opts = validationOpts(field, formValues);

    // Apply field linking dynamic configurations
    const getDynamicProps = () => {
      const props: any = {};
      const linking = field.fieldLinking;
      const sourceFieldId = linking?.sourceFieldId;
      const sourceFieldValue = sourceFieldId ? formValues[sourceFieldId] : undefined;

      // If linking is enabled, run through the existing cascading/advanced logic
      if (linking?.enabled) {
        // 1. Handle Dynamic Options (Cascading and Advanced Rules)
        if (['select', 'radio', 'multiselect', 'checkbox'].includes(field.type)) {
          const mode = linking.mode || 'basic';

          // Check condition-based rules (advanced mode, or restriction mode —
          // the builder saves Smart Connection rules under either mode)
          if ((mode === 'advanced' || mode === 'restriction') && linking.rules) {
            const matchedRule = linking.rules.find((r: any) => {
              if (r.conditions && r.conditions.length > 0) {
                return evaluateLinkingConditions(r.conditions, r.logic === 'or' ? 'or' : 'and', formValues);
              }
              return false;
            });

            // If a rule matches and has dynamicOptions, use them
            if (matchedRule?.dynamicOptions && matchedRule.dynamicOptions.length > 0) {
              props.options = matchedRule.dynamicOptions;
              return props;
            }
          }

          // Fallback to Basic Mode (Cascading) - Only if source field exists
          if (sourceFieldId && linking.dynamicConfig?.options) {
            if (sourceFieldValue !== undefined && sourceFieldValue !== null) {
              const sourceValues = Array.isArray(sourceFieldValue) ? sourceFieldValue : [sourceFieldValue];
              let mergedOptions: { label: string; value: string }[] = [];
              const seenValues = new Set<string>();

              sourceValues.forEach((val: string | number | boolean) => {
                const mapped = linking.dynamicConfig?.options?.[String(val)];
                if (mapped) {
                  mapped.forEach((opt: { label: string; value: string }) => {
                    if (!seenValues.has(opt.value)) {
                      mergedOptions.push(opt);
                      seenValues.add(opt.value);
                    }
                  });
                }
              });

              if (mergedOptions.length > 0) {
                props.options = mergedOptions;
              }
            }
          }
        }

        // 2. Handle Conditional Date Ranges (Rules-based OR Mapping OR Fallback)
        if (['date', 'time'].includes(field.type)) {
          const mode = linking.mode || 'basic';
          const dateConfig = linking.dynamicConfig?.dateRange;
          if (!dateConfig) return props;

          let min: string | undefined;
          let max: string | undefined;

          // Overlay 1: Advanced Rules (if mode is advanced)
          if (mode === 'advanced') {
            const rule = linking.rules?.find((r: any) => {
              if (r.conditions && r.conditions.length > 0) {
                return evaluateLinkingConditions(r.conditions, r.logic === 'or' ? 'or' : 'and', formValues);
              }
              return false;
            });
            if (rule?.dateRange) {
              min = resolveDateConstraint(rule.dateRange.min);
              max = resolveDateConstraint(rule.dateRange.max);
            }
          } else if (mode === 'basic' && dateConfig.mappings && sourceFieldValue !== undefined && sourceFieldValue !== null) {
            // Overlay 2: Basic Mappings (strictest strategy)
            const sourceValues = Array.isArray(sourceFieldValue) ? sourceFieldValue : [sourceFieldValue];
            sourceValues.forEach((v: any) => {
              const m = dateConfig.mappings?.[String(v)];
              if (m) {
                const mMin = resolveDateConstraint(m.min);
                const mMax = resolveDateConstraint(m.max);
                if (mMin && (!min || mMin > min)) min = mMin;
                if (mMax && (!max || mMax < max)) max = mMax;
              }
            });
          }

          // Overlay 3: Global Defaults (Always apply as fallback)
          const dMin = resolveDateConstraint(dateConfig.default?.min);
          const dMax = resolveDateConstraint(dateConfig.default?.max);
          if (!min && dMin) min = dMin;
          if (!max && dMax) max = dMax;

          if (min) props.min = min;
          if (max) props.max = max;
        }

        // 4. Handle Restriction Rules
        if ((linking.mode === 'restriction' || (linking.mode === 'advanced' && linking.restrictionRules)) && linking.restrictionRules) {
          const matchingRestrictionRules = linking.restrictionRules.filter((r: any) => {
            if (!r.conditions || r.conditions.length === 0) return false;
            return evaluateLinkingConditions(r.conditions, r.logic === 'or' ? 'or' : 'and', formValues);
          });

          // Apply restriction actions
          matchingRestrictionRules.forEach((rule: any) => {
            if (rule.action === 'disabled' && rule.apply !== false) {
              props.disabled = true;
            } else if (rule.action === 'required' && rule.apply !== false) {
              props.required = true;
            }
          });

          // If no restriction rules match, ensure field is not disabled by restriction rules
          if (matchingRestrictionRules.length === 0 && !field.disabled) {
            props.disabled = false;
          }
        }
      }

      // 5. Apply manual defaults and constraints (fallback when smart connections not enabled)
      // These apply when smart connections are disabled or don't provide values
      if (!linking?.enabled) {
        // Apply manual default value
        if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
          props.defaultValue = field.defaultValue;
        }

        // Apply manual min/max constraints based on field type
        if (['text', 'email', 'phone', 'textarea'].includes(field.type)) {
          // Text-based constraints
          if (field.validation?.minLength !== undefined) {
            props.minLength = field.validation.minLength;
          }
          if (field.validation?.maxLength !== undefined) {
            props.maxLength = field.validation.maxLength;
          }
        } else if (field.type === 'number') {
          // Number constraints
          if (field.minValue !== undefined || field.validation?.min !== undefined) {
            props.min = field.minValue !== undefined ? field.minValue : field.validation?.min;
          }
          if (field.maxValue !== undefined || field.validation?.max !== undefined) {
            props.max = field.maxValue !== undefined ? field.maxValue : field.validation?.max;
          }
        } else if (field.type === 'date') {
          // Date constraints
          if (field.minValue !== undefined) {
            props.min = field.minValue;
          }
          if (field.maxValue !== undefined) {
            props.max = field.maxValue;
          }
        } else if (field.type === 'time') {
          // Time constraints
          if (field.minValue !== undefined) {
            props.min = field.minValue;
          }
          if (field.maxValue !== undefined) {
            props.max = field.maxValue;
          }
        }
      }



      // 5. Apply manual defaults and constraints (fallback when smart connections not enabled)
      // These apply when smart connections are disabled or don't provide values
      if (!linking?.enabled) {
        // Apply manual default value
        if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
          props.defaultValue = field.defaultValue;
        }

        // Apply manual min/max constraints based on field type
        if (['text', 'email', 'phone', 'textarea'].includes(field.type)) {
          // Text-based constraints
          if (field.validation?.minLength !== undefined) {
            props.minLength = field.validation.minLength;
          }
          if (field.validation?.maxLength !== undefined) {
            props.maxLength = field.validation.maxLength;
          }
        } else if (field.type === 'number') {
          // Number constraints
          if (field.minValue !== undefined || field.validation?.min !== undefined) {
            props.min = field.minValue !== undefined ? field.minValue : field.validation?.min;
          }
          if (field.maxValue !== undefined || field.validation?.max !== undefined) {
            props.max = field.maxValue !== undefined ? field.maxValue : field.validation?.max;
          }
        } else if (field.type === 'date') {
          // Date constraints
          if (field.minValue !== undefined) {
            props.min = field.minValue;
          }
          if (field.maxValue !== undefined) {
            props.max = field.maxValue;
          }
        } else if (field.type === 'time') {
          // Time constraints
          if (field.minValue !== undefined) {
            props.min = field.minValue;
          }
          if (field.maxValue !== undefined) {
            props.max = field.maxValue;
          }
        }
      }

      return props;
    };

    const dynamicProps = getDynamicProps();

    // Merge options if dynamic options are present
    const fieldOptions = (() => {
      const base: { label: string; value: string }[] = dynamicProps.options || field.options || [];
      // Mutual exclusion: remove values already selected by other fields in the same group
      if (field.mutualExclusionGroup) {
        const takenValues = new Set(
          (form?.schema?.fields ?? [])
            .filter(f =>
              f.id !== field.id &&
              f.mutualExclusionGroup === field.mutualExclusionGroup
            )
            .map(f => {
              const v = formValues[f.id];
              return Array.isArray(v) ? v : v != null && v !== '' ? [String(v)] : [];
            })
            .flat()
        );
        if (takenValues.size > 0) {
          return base.filter(opt => !takenValues.has(opt.value));
        }
      }
      return base;
    })();

    const authCfg = form?.settings?.authentication;
    const authLockedField = authStep === 'done' && (
      authCfg?.emailFieldId === field.id || authCfg?.phoneFieldId === field.id
    );
    const isDisabled = field.disabled || dynamicProps.disabled || authLockedField || isCurrentStepLocked;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone': {
        const { onBlur: regOnBlur, ...regRest } = register(field.id, opts);
        return (
          <Input
            type={field.type === 'phone' ? 'tel' : field.type}
            placeholder={field.placeholder}
            disabled={isDisabled}
            minLength={dynamicProps.minLength}
            maxLength={dynamicProps.maxLength}
            {...regRest}
            onBlur={(e) => {
              regOnBlur(e);
              if (field.unique) handleUniquenessCheck(field.id, e.target.value);
              if (field.externalValidation?.enabled && (field.externalValidation.trigger ?? 'auto') === 'auto') {
                void runAutoExternalValidation(field.id, e.target.value);
              }
            }}
          />
        );
      }

      case 'number': {
        const { onBlur: regOnBlur, ...regRest } = register(field.id, opts);
        return (
          <Input
            type="number"
            placeholder={field.placeholder}
            disabled={isDisabled}
            min={dynamicProps.min}
            max={dynamicProps.max}
            {...regRest}
            onBlur={(e) => {
              regOnBlur(e);
              if (field.unique) handleUniquenessCheck(field.id, e.target.value);
              if (field.externalValidation?.enabled && (field.externalValidation.trigger ?? 'auto') === 'auto') {
                void runAutoExternalValidation(field.id, e.target.value);
              }
            }}
          />
        );
      }

      case 'textarea': {
        const { onBlur: regOnBlur, ...regRest } = register(field.id, opts);
        return (
          <Textarea
            placeholder={field.placeholder}
            disabled={isDisabled}
            minLength={dynamicProps.minLength}
            maxLength={dynamicProps.maxLength}
            {...regRest}
            onBlur={(e) => {
              regOnBlur(e);
              if (field.unique) handleUniquenessCheck(field.id, e.target.value);
              if (field.externalValidation?.enabled && (field.externalValidation.trigger ?? 'auto') === 'auto') {
                void runAutoExternalValidation(field.id, e.target.value);
              }
            }}
          />
        );
      }

      case 'select':
        return (
          <div className="relative">
            <select
              id={`field-${field.id}`}
              disabled={isDisabled}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...register(field.id, opts)}
            >
              <option value="">Select an option</option>
              {(fieldOptions || []).map((option: any) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'radio':
        return (
          <div className="grid gap-2">
            {(fieldOptions || []).map((option: any) => (
              <div key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={`${field.id}-${option.value}`}
                  value={option.value}
                  disabled={isDisabled}
                  {...register(field.id, opts)}
                  className="h-4 w-4 border-border text-primary focus:ring-primary"
                />
                <Label
                  htmlFor={`${field.id}-${option.value}`}
                  className={isDisabled ? "opacity-50 cursor-not-allowed" : ""}
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        );


      case 'checkbox':
        return (
          <>
            {/* Hidden registration keeps RHF aware of this setValue-driven field
                (same pattern as file/table) so watch() re-renders and required
                validation applies */}
            <input type="hidden" {...register(field.id, opts)} />
            <div className="space-y-2">
              {(fieldOptions || []).map((option: { label: string; value: string }) => {
                const currentValue = (Array.isArray(formValues[field.id]) ? formValues[field.id] : []) as string[];
                const isChecked = currentValue.includes(option.value);

                return (
                  <label key={option.value} className={`flex items-center space-x-2 ${isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                    <UICheckbox
                      id={`${field.id}-${option.value}`}
                      checked={isChecked}
                      onCheckedChange={(checked: boolean) => {
                        const next = checked
                          ? [...currentValue, option.value]
                          : currentValue.filter((val) => val !== option.value);
                        setValue(field.id, next, { shouldValidate: true, shouldDirty: true });
                      }}
                      disabled={isDisabled}
                    />
                    <span className={isDisabled ? "text-muted-foreground" : ""}>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </>
        );

      case 'date': {
        const { onBlur: regOnBlur, ...regRest } = register(field.id, opts);
        return (
          <Input
            type="date"
            placeholder={field.placeholder}
            min={dynamicProps.min}
            max={dynamicProps.max}
            disabled={isDisabled}
            {...regRest}
            onBlur={(e) => {
              regOnBlur(e);
              if (field.unique) handleUniquenessCheck(field.id, e.target.value);
            }}
          />
        );
      }

      case 'time': {
        const { onBlur: regOnBlur, ...regRest } = register(field.id, opts);
        return (
          <Input
            type="time"
            placeholder={field.placeholder}
            min={dynamicProps.min}
            max={dynamicProps.max}
            disabled={isDisabled}
            {...regRest}
            onBlur={(e) => {
              regOnBlur(e);
              if (field.unique) handleUniquenessCheck(field.id, e.target.value);
            }}
          />
        );
      }

      case 'file': {
        const dmsEnabled = form?.settings?.dms?.enabled === true;
        if (dmsEnabled && form?.id) {
          return (
            <>
              <input type="hidden" {...register(field.id, opts)} />
              <DmsFileUpload
                field={field}
                value={formValues[field.id] as FormFileValue[] | null}
                onChange={(files) => setValue(field.id, files, { shouldValidate: true })}
                formId={form.id}
                hideLabel={true}
                deferUpload
                publicDownload
              />
            </>
          );
        }
        return (
          <>
            <input type="hidden" {...register(field.id, opts)} />
            <FileUpload
              field={field}
              value={formValues[field.id] as FileList | File[] | null}
              onChange={(files) => setValue(field.id, files, { shouldValidate: true })}
              hideLabel={true}
            />
          </>
        );
      }

      case 'multiselect':
        return (
          <>
            <input type="hidden" {...register(field.id, opts)} />
            <MultiSelectField
              field={field}
              options={fieldOptions}
              value={Array.isArray(formValues[field.id]) ? (formValues[field.id] as string[]) : []}
              onChange={(val) => {
                setValue(field.id, val, { shouldValidate: true, shouldDirty: true });
              }}
              disabled={isDisabled}
              hideLabel={true}
            />
          </>
        );

      case 'display': {
        // Find the variable to display
        const formVariables = form?.schema?.variables || [];
        const variable = formVariables.find(v => v.id === field.displayConfig?.variableId);

        if (!variable) {
          return (
            <div className="space-y-2">
              <Label>{field.label}</Label>
              <div className="border rounded-md p-3 bg-muted">
                <div className="text-muted-foreground text-sm">No variable selected</div>
              </div>
            </div>
          );
        }

        const displayValue = calculatedVariables[variable.id] !== undefined
          ? calculatedVariables[variable.id]
          : (variable.value !== undefined ? variable.value : 'Not calculated');

        // Use a more robust formatting function
        const formattedValue = formatDisplayValue(displayValue, variable.type, field.displayConfig?.format);

        return (
          <div className="border rounded-md p-3 bg-muted mb-4">
            <div className="flex flex-row justify-start items-center gap-2">
              {/* Key/Label */}
              <div
                style={{
                  color: field.displayConfig?.textColor || '#6b7280',
                  fontSize: field.displayConfig?.labelFontSize || '0.875rem'
                }}
                className="font-medium"
              >
                {field.displayConfig?.label || variable.name}
              </div>

              {/* Value */}
              <div
                style={{
                  color: field.displayConfig?.valueColor || '#1f2937',
                  fontSize: field.displayConfig?.valueFontSize || '1.125rem'
                }}
                className="font-semibold"
              >
                {formattedValue}
              </div>
            </div>

            {field.displayConfig?.showVariableName && field.displayConfig.label && (
              <div className="text-[10px] text-muted-foreground opacity-50 mt-1">
                Var: {variable.name}
              </div>
            )}

            {variable.description && (
              <div className="text-xs text-muted-foreground mt-1">
                {variable.description}
              </div>
            )}
          </div>
        );
      }

      case 'rating': {
        const ratingValue = formValues[field.id] || 0;
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setValue(field.id, star)}
                className="p-1"
              >
                <Star
                  className={`h-6 w-6 ${star <= ratingValue
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-muted-foreground'
                    }`}
                />
              </button>
            ))}
            <input type="hidden" {...register(field.id, opts)} />
          </div>
        );
      }

      case 'table': {
        return (
          <TableField
            field={field}
            value={watch(field.id) as any}
            onChange={(val: { rows: Record<string, string | number>[] }) => setValue(field.id, val as any, { shouldDirty: true })}
            disabled={field.disabled}
            formValues={formValues}
            validationErrors={tableValidationErrors[field.id] ?? []}
          />
        );
      }

      case 'signature': {
        const dmsEnabled = form?.settings?.dms?.enabled === true;
        return (
          <>
            <input type="hidden" {...register(field.id, opts)} />
            <SignaturePad
              field={field}
              value={formValues[field.id] as DmsFileReference | string | null}
              onChange={(val) => setValue(field.id, val, { shouldValidate: true })}
              formId={form?.id}
              dmsEnabled={dmsEnabled}
              disabled={isDisabled}
              hideLabel={true}
            />
          </>
        );
      }

      default: {
        const { onBlur: regOnBlur, ...regRest } = register(field.id, opts);
        return (
          <Input
            placeholder={field.placeholder}
            {...regRest}
            onBlur={(e) => {
              regOnBlur(e);
              if (field.unique) handleUniquenessCheck(field.id, e.target.value);
            }}
          />
        );
      }
    }
  };

  const handleNextStep = async (e?: React.FormEvent) => {
    e?.preventDefault?.();

    const fields = visibleFields.map((f) => f.id);

    if (fields.length === 0) {
      // Don't auto-advance if we're already on the last step
      if (currentStepIndex >= totalSteps - 1) {
        return;
      }
      setIsAdvancing(true);
      setCurrentStepIndex((i) => Math.min(i + 1, totalSteps - 1));
      setTimeout(() => setIsAdvancing(false), 100);
      return;
    }

    const valid = await trigger(fields);

    if (valid) {
      if (currentStepIndex >= totalSteps - 1) {
        // Already on last step, would submit
      } else if (currentStep?.lockOnComplete && !lockedSteps.has(currentStep.id)) {
        // Step requires confirmation before locking — show warning dialog
        setShowLockConfirmDialog(true);
      } else {
        setIsAdvancing(true);
        setCurrentStepIndex((i) => Math.min(i + 1, totalSteps - 1));
        setTimeout(() => setIsAdvancing(false), 100);
      }
    }
  };

  const confirmStepAndAdvance = () => {
    if (currentStep) {
      setLockedSteps(prev => new Set(prev).add(currentStep.id));
    }
    setShowLockConfirmDialog(false);
    setIsAdvancing(true);
    setCurrentStepIndex((i) => Math.min(i + 1, totalSteps - 1));
    setTimeout(() => setIsAdvancing(false), 100);
  };

  const handlePrevStep = () => {
    setCurrentStepIndex((i) => Math.max(i - 1, 0));
  };

  const allowBack = layout.allowBackNavigation !== false;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Form Not Found</h2>
            <p className="text-muted-foreground">
              {error || 'This form does not exist or is not published.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadyVoted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <XCircle className="h-16 w-16 mx-auto text-amber-500 mb-2" />
            <h2 className="text-2xl font-semibold">Already Voted</h2>
            <p className="text-muted-foreground">You have already submitted a response for this poll. Each person may only vote once.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    const formType = form?.settings?.formType;

    // Assessment scorecard
    if (formType === 'assessment' && form?.settings?.assessment?.showScoreAfterSubmit) {
      if (!assessmentResult) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Card className="w-full max-w-md">
              <CardContent className="pt-6 text-center space-y-4">
                <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                <h2 className="text-xl font-semibold">Evaluating your answers…</h2>
                <p className="text-muted-foreground text-sm">This takes just a moment.</p>
              </CardContent>
            </Card>
          </div>
        );
      }

      const passColor = assessmentResult.passed ? 'text-green-600' : 'text-red-500';
      const showAnswers = form?.settings?.assessment?.showCorrectAnswers;

      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center border-b pb-4">
              <div className={`text-5xl font-bold mb-1 ${passColor}`}>{assessmentResult.percentage}%</div>
              <div className={`text-lg font-semibold ${passColor}`}>{assessmentResult.passed ? '✓ Passed' : '✗ Failed'}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Score: {assessmentResult.totalScore} / {assessmentResult.maxScore}
                {assessmentResult.rank && ` · Rank #${assessmentResult.rank} of ${assessmentResult.totalParticipants}`}
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Section breakdown */}
              {Object.keys(assessmentResult.sections).filter(k => k !== '__default__').length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Section Breakdown</p>
                  {Object.entries(assessmentResult.sections).map(([key, sec]) => (
                    <div key={key} className="flex items-center justify-between text-sm bg-muted/40 px-3 py-2 rounded">
                      <span>{sec.label}</span>
                      <span className="font-medium">{sec.score}/{sec.maxScore}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Per-question review */}
              {showAnswers && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Question Review</p>
                  {assessmentResult.fieldResults.map(fr => (
                    <div key={fr.fieldId} className={`p-3 rounded border text-sm ${fr.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                      <p className="font-medium mb-1">{fr.label}</p>
                      <p className="text-xs">Your answer: <span className="font-medium">{String(fr.submittedAnswer ?? '—')}</span></p>
                      {!fr.isCorrect && <p className="text-xs">Correct: <span className="font-medium text-green-700">{String(fr.correctAnswer ?? '—')}</span></p>}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-center text-sm text-muted-foreground pt-2 border-t">{thankYouMessage || 'Thank you for completing the assessment!'}</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Voting poll results
    if (formType === 'voting' && form?.settings?.voting?.showResultsAfterVoting) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center border-b pb-4">
              <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-2" />
              <h2 className="text-xl font-semibold">Vote Recorded!</h2>
              <p className="text-sm text-muted-foreground">{thankYouMessage || 'Thank you for voting.'}</p>
            </CardHeader>
            <CardContent className="pt-4">
              {!pollResults ? (
                <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading results…</span>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BarChart2 className="h-4 w-4" />
                    <span>Live results · {pollResults.totalSubmissions} vote{pollResults.totalSubmissions !== 1 ? 's' : ''}</span>
                  </div>
                  {pollResults.tallies.map(tally => (
                    <div key={tally.fieldId} className="space-y-2">
                      <p className="text-sm font-medium">{tally.label}</p>
                      {tally.options.map(opt => (
                        <div key={opt.value} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{opt.label}</span>
                            <span className="font-medium">{opt.percentage}% ({opt.count})</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${opt.percentage}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    // Default thank-you screen
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Thank You!</h2>
            <p className="text-muted-foreground">
              {thankYouMessage || 'Your submission has been received.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show preview for single-page forms
  const previewConfig = form?.settings.previewConfig;
  if (!isMultiStep && previewConfig?.enabled && showPreview) {
    const formatFieldValue = (field: FormField, value: any) => {
      if (value === undefined || value === null || value === '') return 'Not provided';

      if (field.type === 'checkbox' || field.type === 'multiselect') {
        if (Array.isArray(value)) {
          return value.map(v => {
            const option = field.options?.find(opt => opt.value === v);
            return option?.label || v;
          }).join(', ');
        }
      }

      if (field.type === 'select' || field.type === 'radio') {
        const option = field.options?.find(opt => opt.value === value);
        return option?.label || value;
      }

      if (field.type === 'file') {
        if (value instanceof FileList) {
          return `${value.length} file(s) selected`;
        }
        if (value instanceof File) {
          return value.name;
        }
        if (Array.isArray(value)) {
          const names = value
            .map((v: any) => v?.filename || v?.name || (v instanceof File ? v.name : null))
            .filter(Boolean);
          return names.length > 0 ? names.join(', ') : `${value.length} file(s) selected`;
        }
      }

      if (field.type === 'signature') {
        if (value && typeof value === 'object' && 'documentId' in value) {
          return 'Signature captured ✓';
        }
        if (typeof value === 'string' && value.startsWith('data:')) {
          return 'Signature captured ✓';
        }
      }

      return String(value);
    };

    return (
      <div className="min-h-screen bg-muted/30">
        <FormBranding section={form.settings?.header} variant="header" formId={form.id} />
        <div className="p-4">
        <div className="max-w-2xl mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle className="min-w-0 break-words text-2xl">{previewConfig.title || 'Review Your Information'}</CardTitle>
              {previewConfig.description && (
                <p className="text-sm text-muted-foreground mt-2">{previewConfig.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {form.schema.fields.filter(f => f.type !== 'html' && f.type !== 'display').map((field) => (
                <div key={field.id} className="border-b pb-4 last:border-0">
                  <Label className="text-sm font-semibold text-muted-foreground">{field.label}</Label>
                  <p className="mt-1 text-base">{formatFieldValue(field, formValues[field.id])}</p>
                </div>
              ))}

              {/* Show calculated variables */}
              {form.schema.variables && form.schema.variables.length > 0 && (
                <div className="border-t pt-4 mt-6">
                  <h3 className="font-semibold mb-4">Calculated Values</h3>
                  {form.schema.variables.map((variable) => (
                    <div key={variable.id} className="border-b pb-3 last:border-0 mb-3">
                      <Label className="text-sm font-semibold text-muted-foreground">{variable.name}</Label>
                      <p className="mt-1 text-base">
                        {formatDisplayValue(calculatedVariables[variable.id], variable.type, undefined)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 border-t pt-4">
                <TurnstileWidget
                  siteKey={TURNSTILE_SITE_KEY}
                  formId={form.id}
                  resetKey={turnstileResetKey}
                  onTokenChange={(token) => {
                    setTurnstileToken(token);
                    if (token) setTurnstileError(null);
                  }}
                />
                {turnstileError && (
                  <p role="alert" className="text-xs font-medium text-destructive">{turnstileError}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                {previewConfig.allowEdit !== false && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPreview(false)}
                    className="flex-1"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back to Edit
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleSubmit(onSubmit)}
                  disabled={isSubmitting || !turnstileToken}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          <FormBranding section={form.settings?.footer} variant="footer" formId={form.id} />
        </div>
        </div>
      </div>
    );
  }

  const isLastStep = isMultiStep && currentStepIndex >= totalSteps - 1;
  const isFirstStep = currentStepIndex <= 0;

  const onFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prevent submission if we're currently advancing between steps
    if (isAdvancing) {
      return;
    }

    // Check for external validation errors/loading on visible fields
    const visibleFieldIds = visibleFields.map(f => f.id);
    const activeExternalErrors = Object.keys(externalValidationErrors).filter(id => visibleFieldIds.includes(id));
    const activeExternalLoading = Object.keys(externalValidationLoading).filter(id => visibleFieldIds.includes(id) && externalValidationLoading[id]);

    if (activeExternalErrors.length > 0) {
      // Just return, the errors are already displayed below the fields
      return;
    }

    if (activeExternalLoading.length > 0) {
      // Potentially show a toast or alert, but for now we just block
      return;
    }

    // Prevent submission if there are no visible fields in multi-step forms
    if (isMultiStep && visibleFields.length === 0) {
      return;
    }

    if (isMultiStep && !isLastStep) {
      await handleNextStep(e);
      return;
    }

    if (!turnstileToken) {
      setTurnstileError('Security verification is required before submitting.');
      return;
    }

    handleSubmit(onSubmit)(e);
  };


  // ── OTP Gate ───────────────────────────────────────────────────────────────
  if (authStep !== 'done') {
    const isOtpStep = authStep === 'email-otp' || authStep === 'phone-otp';
    const isPhoneStep = authStep === 'phone' || authStep === 'phone-otp';
    const authMethod = form?.settings?.authentication?.method ?? 'email';
    const isBothMode = authMethod === 'both';
    const stepLabel = isBothMode
      ? isPhoneStep ? 'Step 2 of 2 — Phone Verification' : 'Step 1 of 2 — Email Verification'
      : null;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center space-y-1 pb-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="min-w-0 break-words text-xl">{form.name}</CardTitle>
            {stepLabel && <p className="text-xs font-medium text-primary">{stepLabel}</p>}
            <CardDescription>
              {isOtpStep
                ? `Enter the OTP sent to ${isPhoneStep ? authPhone : authEmail}`
                : isPhoneStep
                  ? 'Enter your phone number to receive a verification code'
                  : 'Enter your email to receive a verification code'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isOtpStep ? (
              <>
                <div className="space-y-2">
                  <Label>{isPhoneStep ? 'Phone Number' : 'Email Address'}</Label>
                  <Input
                    type={isPhoneStep ? 'tel' : 'email'}
                    value={isPhoneStep ? authPhone : authEmail}
                    onChange={e => {
                      if (isPhoneStep) { setAuthPhone(e.target.value); }
                      else { setAuthEmail(e.target.value); }
                      setAuthError(null);
                    }}
                    placeholder={isPhoneStep ? '+91 9999999999' : 'you@example.com'}
                    onKeyDown={e => e.key === 'Enter' && !authLoading && sendOtp()}
                  />
                </div>
                {authError && <p className="text-sm text-destructive">{authError}</p>}
                <Button className="w-full" onClick={sendOtp} disabled={authLoading}>
                  {authLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Send OTP
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>One-Time Password</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={authOtp}
                    onChange={e => { setAuthOtp(e.target.value.replace(/\D/g, '')); setAuthError(null); }}
                    placeholder="Enter 4-digit OTP"
                    onKeyDown={e => e.key === 'Enter' && !authLoading && verifyOtp()}
                    className="text-center text-2xl tracking-widest font-mono"
                  />
                </div>
                {authError && <p className="text-sm text-destructive">{authError}</p>}
                <Button className="w-full" onClick={verifyOtp} disabled={authLoading}>
                  {authLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Verify & Continue
                </Button>
                <button
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    setAuthStep(isPhoneStep ? 'phone' : 'email');
                    setAuthOtp('');
                    setAuthError(null);
                  }}
                >
                  ← Use a different {isPhoneStep ? 'phone number' : 'email'}
                </button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background text-foreground transition-colors duration-300"
      data-theme={form?.settings?.theme || 'default'}
    >
      <FormBranding section={form.settings?.header} variant="header" formId={form.id} />
      <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className={layout.orientation === 'horizontal' ? 'mx-auto w-full max-w-[1400px]' : 'max-w-2xl mx-auto'}>
        <Card className="form-card border-border shadow-xl">
          <CardHeader>
            <CardTitle className="min-w-0 break-words text-2xl">{form.name}</CardTitle>
            {form.description && (
              <CardDescription className="break-words">{form.description}</CardDescription>
            )}
            {isMultiStep && currentStep && (
              <div className="pt-2 space-y-2">
                <h4 className="font-medium">{currentStep.title}</h4>
                {currentStep.description && (
                  <p className="text-sm text-muted-foreground">{currentStep.description}</p>
                )}
                {isCurrentStepLocked && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    This step has been confirmed and cannot be edited.
                  </div>
                )}
                {!isCurrentStepLocked && currentStep.lockOnComplete && (
                  <div className="flex items-start gap-2 rounded-lg border border-plum-200 bg-plum-50 px-3 py-2 text-xs text-plum-700">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-plum-500 mt-0.5" />
                    <span>
                      <span className="font-medium">You can edit this step now.</span>{' '}
                      Once you click <span className="font-medium">Next</span> and confirm, this step will be permanently locked and cannot be changed.
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {draftRestored && (
              <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  Your previous progress has been restored.
                </div>
                <button
                  className="text-xs text-green-600 hover:text-green-800 underline"
                  onClick={() => {
                    // Clear session + send user back to the auth login screen
                    if (form?.id) sessionStorage.removeItem(`form_auth_${form.id}`);
                    reset();
                    setCurrentStepIndex(0);
                    setLockedSteps(new Set());
                    setDraftRestored(false);
                    const auth = form?.settings?.authentication;
                    setAuthEmail('');
                    setAuthPhone('');
                    setAuthStep(auth?.method === 'phone' ? 'phone' : 'email');
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}
            {isMultiStep && totalSteps > 1 && (
              <FormStepper
                steps={sortedSteps.map((s) => ({ id: s.id, title: s.title }))}
                currentIndex={currentStepIndex}
                style={stepperStyle}
                onStepClick={allowBack && !isCurrentStepLocked ? (i) => setCurrentStepIndex(i) : undefined}
              />
            )}



            <form onSubmit={onFormSubmit} className="space-y-6" noValidate>
              {/* fieldset[disabled] propagates disabled state to every form control
                  inside it at the browser level — no reliance on prop/closure chains */}
              <fieldset disabled={isCurrentStepLocked} className="border-0 p-0 m-0 min-w-0 w-full">
                <FieldsByWidth
                  fields={visibleFields}
                  errors={errors}
                  renderField={renderField}
                  validationOpts={validationOpts}
                  formValues={formValues}
                  uniquenessErrors={uniquenessErrors}
                  uniquenessSuccess={uniquenessSuccess}
                  externalValidationErrors={externalValidationErrors}
                  externalValidationSuccess={externalValidationSuccess}
                  externalValidationLoading={externalValidationLoading}
                  onVerifyField={handleExternalValidation}
                  formId={form.id}
                  orientation={layout.orientation}
                />
              </fieldset>

              {(!isMultiStep || isLastStep) && (
                <div className="space-y-2 border-t border-border/70 pt-4">
                  <TurnstileWidget
                    siteKey={TURNSTILE_SITE_KEY}
                    formId={form.id}
                    resetKey={turnstileResetKey}
                    onTokenChange={(token) => {
                      setTurnstileToken(token);
                      if (token) setTurnstileError(null);
                    }}
                  />
                  {turnstileError && (
                    <p role="alert" className="text-xs font-medium text-destructive">{turnstileError}</p>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-6">
                {isMultiStep && !isFirstStep && allowBack && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePrevStep()}
                    className="flex-1"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                )}
                {(() => {
                  const securityReady = Boolean(turnstileToken);
                  const isPreviewEnabled = !isMultiStep && previewConfig?.enabled && !showPreview;

                  return isMultiStep && !isLastStep ? (
                    isCurrentStepLocked ? (
                      <Button
                        type="button"
                        onClick={() => {
                          setIsAdvancing(true);
                          setCurrentStepIndex((i) => Math.min(i + 1, totalSteps - 1));
                          setTimeout(() => setIsAdvancing(false), 100);
                        }}
                        className="flex-1"
                      >
                        Continue
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => handleNextStep()}
                        className="flex-1"
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    )
                  ) : isPreviewEnabled ? (
                    <Button
                      type="button"
                      onClick={handleNextToPreview}
                      className="flex-1"
                      disabled={!securityReady}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button type="submit" className="flex-1" disabled={isSubmitting || !securityReady}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit'
                      )}
                    </Button>
                  );
                })()}
              </div>
            </form>
          </CardContent>
        </Card>

        <FormBranding section={form.settings?.footer} variant="footer" formId={form.id} />

        <div className="mt-4 flex items-center justify-center">
          <PoweredBySify />
        </div>
      </div>
      </div>

      <Dialog open={Boolean(activeAlert)} onOpenChange={(open) => {
        if (!open && activeAlert) {
          // Mark current alert as dismissed using field ID + alert ID
          const alertKey = `${activeAlert.fieldId}-${activeAlert.id}`;
          setDismissedAlerts(prev => new Set(prev).add(alertKey));
          setActiveAlert(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeAlert?.type?.toUpperCase() || 'Alert'}</DialogTitle>
            <DialogDescription>{activeAlert?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (activeAlert) {
                const alertKey = `${activeAlert.fieldId}-${activeAlert.id}`;
                setDismissedAlerts(prev => new Set(prev).add(alertKey));
              }
              setActiveAlert(null);
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step lock confirmation dialog */}
      <Dialog open={showLockConfirmDialog} onOpenChange={(open) => { if (!open) setShowLockConfirmDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 shrink-0">
                <Lock className="h-5 w-5 text-amber-600" />
              </div>
              <DialogTitle>Confirm Step</DialogTitle>
            </div>
            <DialogDescription className="space-y-2 pt-1">
              <span className="block">
                You are about to confirm{' '}
                <span className="font-semibold text-foreground">"{currentStep?.title}"</span>.
              </span>
              <span className="block font-medium text-amber-700">
                Once you continue, this step will be locked and you will not be able to edit it again.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowLockConfirmDialog(false)}>
              Go Back
            </Button>
            <Button
              onClick={confirmStepAndAdvance}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Confirm &amp; Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Confirmation dialog */}
      {paymentConfirmOpen && paymentConfirmInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Confirm Payment</h3>
                <p className="text-sm text-muted-foreground">Please review your payment details</p>
              </div>
            </div>

            <div className="rounded-xl border border-border divide-y divide-ink-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="text-lg font-bold text-foreground">₹{paymentConfirmInfo.amount}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm font-medium text-foreground truncate max-w-[180px]">{paymentConfirmInfo.email || '—'}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Mobile</span>
                <span className="text-sm font-medium text-foreground">{paymentConfirmInfo.mobile || '—'}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {form?.settings?.payment?.gateway === 'razorpay'
                ? 'A secure Razorpay payment window will open.'
                : 'You will be redirected to the Paytm payment page.'}
            </p>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handlePaymentCancel}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handlePaymentConfirm}>
                Confirm &amp; Pay
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payment in Progress overlay */}
      {paymentInProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-6">
            {paymentStatus !== 'failed' ? (
              <>
                {/* Spinner with icon */}
                <div className="relative mx-auto w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CreditCard className="h-8 w-8 text-primary" />
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-foreground">Payment in Progress</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Complete your payment in the opened tab. This page will update automatically once confirmed.
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0"></div>
                  <span className="text-sm text-amber-700 font-medium">Waiting for payment confirmation…</span>
                </div>

                <p className="text-xs text-muted-foreground">Do not close or refresh this page</p>
              </>
            ) : (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <CreditCard className="h-7 w-7 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Payment Not Completed</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    The payment was not confirmed. You can close this and try again.
                  </p>
                </div>
                <Button className="w-full" onClick={() => { setPaymentInProgress(false); setPaymentStatus(null); }}>
                  Close
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
