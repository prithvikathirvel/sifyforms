import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchForm, updateForm } from '../store/formsSlice';
import { updateSettings, updateLayout, setLayoutMode, addStep, removeStep, updateStep, assignFieldsToStep, reorderSteps } from '../store/builderSlice';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox as UICheckbox } from '../components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { X, Settings, Shield, Palette, CreditCard, KeyRound, ClipboardCheck, BarChart2, Layout, ChevronLeft } from 'lucide-react';
import { uploadFileAuthenticated, getDownloadUrl } from '../lib/dms';
import type { PaymentConfig, FormAuthentication, PartialSubmissionConfig, FormBrandingSection, BrandingPosition } from '../types';
import { cn } from '../lib/utils';
import FormAccessPanel from '../components/forms/FormAccessPanel';
import LayoutConfigPanel from '../components/builder/LayoutConfigPanel';
import { getSchemaWithLayout } from '../pages/FormBuilderPage';

// Reuse the branding section editor from SettingsModal
const MAX_LOGO_SIZE = 500 * 1024;
const BRANDING_POSITIONS: { value: BrandingPosition; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

function BrandingSectionEditor({
  label,
  description,
  value,
  onChange,
  showLogo = false,
  dmsEnabled = false,
  orgId,
  formId,
}: {
  label: string;
  description: string;
  value: FormBrandingSection | undefined;
  onChange: (section: FormBrandingSection | undefined) => void;
  showLogo?: boolean;
  dmsEnabled?: boolean;
  orgId?: string;
  formId?: string;
}) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dmsUploading, setDmsUploading] = useState(false);
  const [dmsProgress, setDmsProgress] = useState(0);

  const enabled = value?.enabled ?? !!(value?.logoUrl || value?.logoDocumentId || value?.text);

  const update = (updates: Partial<FormBrandingSection>) => {
    const next = { ...value, ...updates };
    if (!next.logoUrl && !next.logoDocumentId && !next.text && !next.enabled) {
      onChange(undefined);
    } else {
      onChange(next);
    }
  };

  const handleLogoFile = (file: File | undefined) => {
    setUploadError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setUploadError('Image must be smaller than 500 KB. Use an image URL or DMS upload for larger files.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update({ logoUrl: reader.result as string, logoDocumentId: undefined });
    reader.readAsDataURL(file);
  };

  const handleDmsLogoUpload = async (file: File | undefined) => {
    setUploadError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file.');
      return;
    }
    if (!orgId || !formId) {
      setUploadError('Organization or form context is missing.');
      return;
    }
    setDmsUploading(true);
    setDmsProgress(0);
    try {
      const ref = await uploadFileAuthenticated(file, 'branding', orgId, formId, (pct) => setDmsProgress(pct));
      const url = await getDownloadUrl(ref.documentId);
      update({ logoUrl: url, logoDocumentId: ref.documentId });
    } catch (err: any) {
      setUploadError(err.response?.data?.error || err.message || 'DMS upload failed');
    } finally {
      setDmsUploading(false);
      setDmsProgress(0);
    }
  };

  const checkboxId = `branding-toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor={checkboxId} className="text-sm font-medium cursor-pointer">{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <UICheckbox
          id={checkboxId}
          checked={enabled}
          onCheckedChange={(checked: boolean) => update({ enabled: checked })}
        />
      </div>

      {enabled && (
        <>
          {showLogo && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Logo (Optional)</Label>
              {value?.logoUrl ? (
                <div className="flex items-center gap-3">
                  <img
                    src={value.logoUrl}
                    alt={`${label} logo preview`}
                    className="h-12 max-w-[160px] object-contain border rounded-md bg-background p-1"
                  />
                  <div className="flex flex-col gap-1">
                    {value.logoDocumentId && (
                      <span className="text-[10px] text-green-600 font-medium">Stored in DMS</span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => update({ logoUrl: undefined, logoDocumentId: undefined })}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : dmsUploading ? (
                <div className="flex items-center gap-2 p-2 bg-muted rounded">
                  <div className="flex-1">
                    <div className="w-full bg-background rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${dmsProgress}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{dmsProgress}%</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        className="text-xs file:text-xs"
                        onChange={(e) => {
                          handleLogoFile(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Inline (max 500 KB)</p>
                    </div>
                  </div>
                  {dmsEnabled && (
                    <label className="block">
                      <div className="px-3 py-2 bg-plum-50 hover:bg-plum-100 border border-plum-200 rounded cursor-pointer text-center text-xs font-semibold text-plum-700 transition-colors flex items-center justify-center gap-1.5">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
                        Upload via DMS (no size limit)
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          handleDmsLogoUpload(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  <Input
                    placeholder="…or paste an image URL"
                    className="text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const url = (e.target as HTMLInputElement).value.trim();
                        if (url) update({ logoUrl: url, logoDocumentId: undefined });
                      }
                    }}
                    onBlur={(e) => {
                      const url = e.target.value.trim();
                      if (url) update({ logoUrl: url, logoDocumentId: undefined });
                    }}
                  />
                </div>
              )}
              {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Text (Optional)</Label>
            <Textarea
              value={value?.text || ''}
              onChange={(e) => update({ text: e.target.value || undefined })}
              placeholder="e.g. company name, tagline, or legal notice"
              className="resize-none text-sm"
              rows={2}
            />
          </div>

          {showLogo && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Logo Position</Label>
                <select
                  className="w-full h-9 text-sm rounded-md border border-input bg-background px-2 outline-none focus:ring-1 focus:ring-ring"
                  value={value?.logoPosition || 'center'}
                  onChange={(e) => update({ logoPosition: e.target.value as BrandingPosition })}
                >
                  {BRANDING_POSITIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Text Position</Label>
                <select
                  className="w-full h-9 text-sm rounded-md border border-input bg-background px-2 outline-none focus:ring-1 focus:ring-ring"
                  value={value?.textPosition || 'center'}
                  onChange={(e) => update({ textPosition: e.target.value as BrandingPosition })}
                >
                  {BRANDING_POSITIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function FormSettingsPage() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentForm, isLoading: formLoading } = useAppSelector((state) => state.forms);
  const { currentOrg } = useAppSelector((state) => state.org);
  const builder = useAppSelector((state) => state.builder);
  const [activeTab, setActiveTab] = useState('layout');

  useEffect(() => {
    if (formId) {
      dispatch(fetchForm(formId));
    }
  }, [formId, dispatch]);

  useEffect(() => {
    if (currentForm) {
      dispatch(updateSettings(currentForm.settings));
      dispatch(updateLayout(currentForm.schema.layout || undefined));
    }
  }, [currentForm, dispatch]);

  const handleSave = async () => {
    if (!formId || !currentForm) return;

    const schema = getSchemaWithLayout();

    const formData = {
      formId,
      data: {
        name: builder.formName.trim(),
        description: builder.formDescription?.trim() || '',
        schema,
        settings: builder.settings || {},
      },
    };

    try {
      await dispatch(updateForm({ id: formId, data: formData.data })).unwrap();
    } catch (error: any) {
      alert(`Save failed: ${error.message || 'Unknown error'}`);
    }
  };

  const PORTAL_BASE = 'https://apidev.sifymodernization.digital/payment-service';
  const origin = window.location.origin;
  const paymentRedirectUrl = formId ? `${origin}/payment/${formId}/status` : '';
  const paymentCancelUrl = formId ? `${origin}/payment/${formId}/status?cancelled=true` : '';

  if (formLoading || !currentForm) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-workspace">
      {/* Header */}
      <header className="relative shrink-0 border-b border-border/70 bg-card">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(`/forms/${formId}/edit`)}
            title="Back to builder"
            aria-label="Back to builder"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="h-4 w-px shrink-0 bg-border/70" />
          <div>
            <h1 className="text-[13px] font-semibold text-foreground">
              {activeTab === 'layout' ? 'Layout Settings' : 'Form Settings'}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {currentForm.name}
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">
          {/* Back navigation */}
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 h-8 gap-1.5"
            onClick={() => navigate(`/forms/${formId}/edit`)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to canvas
          </Button>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex gap-6">
              <div className="w-52 shrink-0 border-r border-border">
                <TabsList className="flex flex-col h-full gap-1 p-2 bg-muted/20">
                  <TabsTrigger value="layout" className="w-full justify-start data-[state=active]:bg-background">
                    <Layout className="h-4 w-4 mr-2" />
                    Layout Settings
                  </TabsTrigger>
                  <TabsTrigger value="form" className="w-full justify-start data-[state=active]:bg-background">
                    <Settings className="h-4 w-4 mr-2" />
                    Form Settings
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 min-w-0">
                {/* Layout Settings Tab */}
                <TabsContent value="layout" className="mt-0 h-full">
                  {activeTab === 'layout' && (
                    <div className="h-full min-h-[500px]">
                      <LayoutConfigPanel
                        layout={builder.layout}
                        fields={builder.schema.fields}
                        onSetLayoutMode={(mode) => dispatch(setLayoutMode(mode))}
                        onUpdateLayout={(updates) => dispatch(updateLayout(updates))}
                        onAddStep={() => dispatch(addStep())}
                        onRemoveStep={(id) => dispatch(removeStep(id))}
                        onUpdateStep={(id, updates) => dispatch(updateStep({ id, updates }))}
                        onAssignFieldsToStep={(stepId, fieldIds) => dispatch(assignFieldsToStep({ stepId, fieldIds }))}
                        onReorderStep={(oldIndex, newIndex) => dispatch(reorderSteps({ oldIndex, newIndex }))}
                      />
                      <div className="mt-6 flex justify-end">
                        <Button size="sm" onClick={handleSave} className="h-9">
                          Save Layout
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Form Settings Tab */}
                <TabsContent value="form" className="mt-0 h-full">
                  {activeTab === 'form' && (
                    <div className="space-y-6">
                      {/* General Settings */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Thank You Message</Label>
                        <Textarea
                          value={builder.settings.thankYouMessage || ''}
                          onChange={(e) => dispatch(updateSettings({ thankYouMessage: e.target.value }))}
                          placeholder="Thank you for your submission!"
                          className="resize-none"
                        />
                        <p className="text-xs text-muted-foreground">Displayed to users immediately after successful submission.</p>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Redirect URL (Optional)</Label>
                        <Input
                          value={builder.settings.redirectUrl || ''}
                          onChange={(e) => dispatch(updateSettings({ redirectUrl: e.target.value || null }))}
                          placeholder="https://example.com/thank-you"
                        />
                        <p className="text-xs text-muted-foreground">Redirect users to this URL instead of showing the thank you message.</p>
                      </div>

                      {/* Access & Security */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Access & Security</Label>

                        <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                          <div>
                            <Label htmlFor="active-toggle" className="text-sm font-medium cursor-pointer">Allow Form Submissions</Label>
                            <p className="text-xs text-muted-foreground">When disabled, public visitors cannot view or submit this form.</p>
                          </div>
                          <UICheckbox
                            id="active-toggle"
                            checked={builder.settings.isFormActive !== false}
                            onCheckedChange={(checked: boolean) => dispatch(updateSettings({ isFormActive: checked }))}
                          />
                        </div>

                        <div className="space-y-3 p-3 border rounded-lg bg-card">
                          <div>
                            <Label className="text-sm font-medium">Expiration Date & Time (Optional)</Label>
                            <p className="text-xs text-muted-foreground mb-3">Automatically disable the form at this specific date and time.</p>
                          </div>
                          <Input
                            type="datetime-local"
                            value={(() => {
                              const val = builder.settings.expirationDateTime;
                              if (!val) return '';
                              const d = new Date(val);
                              if (isNaN(d.getTime())) return val.slice(0, 16);
                              const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
                              return local.toISOString().slice(0, 16);
                            })()}
                            onChange={(e) => {
                              const val = e.target.value;
                              dispatch(updateSettings({ expirationDateTime: val ? new Date(val).toISOString() : undefined }));
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3">
                          <div>
                            <Label className="text-sm font-medium">Bot protection</Label>
                            <p className="text-xs text-muted-foreground">Cloudflare Turnstile protects every public submission automatically.</p>
                          </div>
                          <span className="shrink-0 rounded-full border border-primary/15 bg-primary/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                            Always on
                          </span>
                        </div>

                        {/* DMS File Storage */}
                        <div className="space-y-3 p-3 border rounded-lg bg-card">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label htmlFor="dms-toggle" className="text-sm font-medium cursor-pointer">Enable DMS File Storage</Label>
                              <p className="text-xs text-muted-foreground">Store uploaded files (file fields, support docs, logos) in the Document Management System instead of inline.</p>
                            </div>
                            <UICheckbox
                              id="dms-toggle"
                              checked={builder.settings.dms?.enabled || false}
                              onCheckedChange={(checked: boolean) =>
                                dispatch(updateSettings({ dms: { ...builder.settings.dms, enabled: checked } }))
                              }
                            />
                          </div>

                          {builder.settings.dms?.enabled && (
                            <div className="space-y-3 pt-2 border-t">
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Max File Size (MB, optional override)</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={builder.settings.dms?.maxFileSize || ''}
                                  onChange={(e) =>
                                    dispatch(updateSettings({
                                      dms: { ...builder.settings.dms, enabled: true, maxFileSize: e.target.value ? Number(e.target.value) : undefined },
                                    }))
                                  }
                                  placeholder="e.g. 10 (default: no limit)"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Allowed File Types (optional override)</Label>
                                <div className="flex flex-wrap gap-2">
                                  {[
                                    { label: 'Images', value: 'image/*' },
                                    { label: 'PDFs', value: 'application/pdf' },
                                    { label: 'Documents', value: 'application/msword' },
                                    { label: 'Spreadsheets', value: 'application/vnd.ms-excel' },
                                    { label: 'Text', value: 'text/plain' },
                                  ].map((opt) => {
                                    const current = builder.settings.dms?.allowedMimeTypes || [];
                                    const isSelected = current.includes(opt.value);
                                    return (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                          const next = isSelected
                                            ? current.filter((t: string) => t !== opt.value)
                                            : [...current, opt.value];
                                          dispatch(updateSettings({
                                            dms: { ...builder.settings.dms, enabled: true, allowedMimeTypes: next.length ? next : undefined },
                                          }));
                                        }}
                                        className={`px-2 py-1 text-xs rounded border transition-colors ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted'}`}
                                      >
                                        {opt.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                <p className="text-xs text-muted-foreground">Leave empty to allow all file types.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Authentication */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Authentication</Label>

                        <div className="space-y-3 p-3 border rounded-lg bg-card">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-sm font-semibold">OTP Verification</Label>
                              <p className="text-xs text-muted-foreground mt-0.5">Verify users via OTP before they can view or fill the form.</p>
                            </div>
                            <UICheckbox
                              checked={builder.settings.authentication?.enabled || false}
                              onCheckedChange={(checked: boolean) => {
                                dispatch(updateSettings({ authentication: { enabled: checked, method: 'email', ...builder.settings.authentication } }));
                                if (!checked) dispatch(updateSettings({ partialSubmission: { enabled: false, ...builder.settings.partialSubmission } }));
                              }}
                            />
                          </div>

                          {builder.settings.authentication?.enabled && (
                            <div className="space-y-3 pt-2 border-t">
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Method</Label>
                                <div className="flex gap-2">
                                  {(['email', 'phone', 'both'] as const).map(m => (
                                    <button key={m} type="button" onClick={() => dispatch(updateSettings({ authentication: { ...builder.settings.authentication, method: m } }))}
                                      className={`flex-1 py-2 px-3 rounded border text-sm font-medium transition-colors ${(builder.settings.authentication?.method ?? 'email') === m ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted'}`}>
                                      {m === 'email' ? 'Email OTP' : m === 'phone' ? 'Phone OTP' : 'Both'}
                                    </button>
                                  ))}
                                </div>
                                {builder.settings.authentication?.method === 'both' && (
                                  <p className="text-xs text-muted-foreground">User must verify email first, then phone number.</p>
                                )}
                              </div>

                              {(builder.settings.authentication?.method === 'email' || builder.settings.authentication?.method === 'both' || !builder.settings.authentication?.method) && (
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Email Field to Prefill & Lock</Label>
                                  <select value={builder.settings.authentication?.emailFieldId || ''} onChange={(e) => dispatch(updateSettings({ authentication: { ...builder.settings.authentication, emailFieldId: e.target.value } }))}
                                    className="w-full h-9 rounded border border-input px-3 text-sm bg-background">
                                    <option value="">— select field —</option>
                                    {builder.schema.fields.filter(f => ['email', 'text'].includes(f.type)).map(f => (
                                      <option key={f.id} value={f.id}>{f.label}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {(builder.settings.authentication?.method === 'phone' || builder.settings.authentication?.method === 'both') && (
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Phone Field to Prefill & Lock</Label>
                                  <select value={builder.settings.authentication?.phoneFieldId || ''} onChange={(e) => dispatch(updateSettings({ authentication: { ...builder.settings.authentication, phoneFieldId: e.target.value } }))}
                                    className="w-full h-9 rounded border border-input px-3 text-sm bg-background">
                                    <option value="">— select field —</option>
                                    {builder.schema.fields.filter(f => ['phone', 'text', 'number'].includes(f.type)).map(f => (
                                      <option key={f.id} value={f.id}>{f.label}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className={`space-y-3 p-3 border rounded-lg ${builder.settings.authentication?.enabled ? 'bg-card' : 'bg-muted/40 opacity-60'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-sm font-semibold">Partial Submission (Save & Resume)</Label>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Auto-save progress so users can continue where they left off.
                                {!builder.settings.authentication?.enabled && <span className="text-amber-600"> Requires authentication to be enabled.</span>}
                              </p>
                            </div>
                            <UICheckbox
                              checked={builder.settings.partialSubmission?.enabled || false}
                              disabled={!builder.settings.authentication?.enabled}
                              onCheckedChange={(checked: boolean) => dispatch(updateSettings({ partialSubmission: { enabled: checked, ...builder.settings.partialSubmission } }))}
                            />
                          </div>
                          {builder.settings.partialSubmission?.enabled && builder.settings.authentication?.enabled && (
                            <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
                              <p>✓ Form data auto-saves every 3 seconds after the user is verified.</p>
                              <p>✓ On next visit, verified users will see their saved progress restored.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Team & Sharing */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Team & Sharing</Label>
                        {formId ? (
                          <FormAccessPanel formId={formId} />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Save the form once and its team and sharing options will appear here.
                          </p>
                        )}
                      </div>

                      {/* Appearance */}
                      <div className="space-y-4 pt-4 border-t">
                        <Label className="text-sm font-semibold">Appearance</Label>

                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Theme</Label>
                          <p className="text-xs text-muted-foreground">Select a color scheme for the public form.</p>
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              { id: 'default', name: 'Default (System)', color: '#3b82f6', inner: '#ffffff' },
                              { id: 'modern-blue', name: 'Professional Blue', color: '#f1f5f9', inner: '#0f172a' },
                              { id: 'dark-mode', name: 'Elegant Dark', color: '#09090b', inner: '#1e293b' },
                              { id: 'nature-green', name: 'Soft Sage', color: '#f0fdf4', inner: '#14532d' },
                              { id: 'sunset-orange', name: 'Warm Sand', color: '#fefce8', inner: '#451a03' },
                              { id: 'royal-purple', name: 'Royal Velvet', color: '#f5f3ff', inner: '#3b0764' },
                              { id: 'monochrome', name: 'Clean Slate', color: '#f8fafc', inner: '#0f172a' },
                              { id: 'ocean-teal', name: 'Oceanic', color: '#f0f9ff', inner: '#083344' },
                              { id: 'cherry-red', name: 'Rose Garden', color: '#fff1f2', inner: '#4c0519' },
                              { id: 'corporate-gray', name: 'Corporate', color: '#f1f5f9', inner: '#1e293b' },
                            ].map((theme) => (
                              <button
                                key={theme.id}
                                onClick={() => dispatch(updateSettings({ theme: theme.id === 'default' ? undefined : theme.id }))}
                                className={`flex items-center gap-3 w-full p-2 rounded-md border transition-all text-foreground hover:text-foreground ${(builder.settings.theme === theme.id || (!builder.settings.theme && theme.id === 'default'))
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'border-input hover:bg-muted'
                                  }`}
                              >
                                <div className="flex-shrink-0 flex items-center border rounded overflow-hidden shadow-sm">
                                  <div
                                    className="w-4 h-6"
                                    style={{ backgroundColor: theme.color }}
                                    title="Outer Page"
                                  />
                                  <div
                                    className="w-4 h-6"
                                    style={{ backgroundColor: theme.inner }}
                                    title="Inner Form"
                                  />
                                </div>
                                <span className="text-sm font-medium">{theme.name}</span>
                                {(builder.settings.theme === theme.id || (!builder.settings.theme && theme.id === 'default')) && (
                                  <svg className="h-4 w-4 ml-auto text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                          <div>
                            <Label className="text-sm font-medium">Header & Footer</Label>
                            <p className="text-xs text-muted-foreground">Show branding above and below the public form. Header supports a logo and text with custom placement; footer is text only.</p>
                          </div>
                          <BrandingSectionEditor
                            label="Form Header"
                            description="Logo and/or text shown above the form."
                            value={builder.settings.header}
                            onChange={(header) => dispatch(updateSettings({ header }))}
                            showLogo
                            dmsEnabled={builder.settings.dms?.enabled || false}
                            orgId={currentOrg?.id}
                            formId={formId}
                          />
                          <BrandingSectionEditor
                            label="Form Footer"
                            description="Text shown below the form."
                            value={builder.settings.footer}
                            onChange={(footer) => dispatch(updateSettings({ footer }))}
                          />
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label htmlFor="preview-toggle" className="text-sm font-medium cursor-pointer">Enable Form Preview</Label>
                              <p className="text-xs text-muted-foreground">Show users a review screen before final submission.</p>
                            </div>
                            <UICheckbox
                              id="preview-toggle"
                              checked={builder.settings.previewConfig?.enabled || false}
                              onCheckedChange={(checked: boolean) => {
                                const currentConfig = builder.settings.previewConfig || {
                                  enabled: false,
                                  title: 'Review Your Information',
                                  showFieldLabels: true,
                                  allowEdit: true,
                                };
                                dispatch(updateSettings({
                                  previewConfig: {
                                    ...currentConfig,
                                    enabled: checked,
                                    title: currentConfig.title || 'Review Your Information',
                                    showFieldLabels: currentConfig.showFieldLabels !== false,
                                    allowEdit: currentConfig.allowEdit !== false,
                                  }
                                }));
                              }}
                            />
                          </div>

                          {builder.settings.previewConfig?.enabled && (
                            <div className="space-y-4 pl-4 border-l-2 border-muted pt-2">
                              <div className="space-y-2">
                                <Label className="text-sm">Preview Title</Label>
                                <Input
                                  value={builder.settings.previewConfig?.title || 'Review Your Information'}
                                  onChange={(e) => dispatch(updateSettings({
                                    previewConfig: {
                                      ...builder.settings.previewConfig,
                                      enabled: true,
                                      title: e.target.value,
                                    }
                                  }))}
                                />
                              </div>

                              <div className="flex items-center justify-between">
                                <Label htmlFor="show-labels-toggle" className="text-sm cursor-pointer">Show Field Labels</Label>
                                <UICheckbox
                                  id="show-labels-toggle"
                                  checked={builder.settings.previewConfig?.showFieldLabels !== false}
                                  onCheckedChange={(checked: boolean) => dispatch(updateSettings({
                                    previewConfig: {
                                      ...builder.settings.previewConfig,
                                      enabled: true,
                                      showFieldLabels: checked,
                                    }
                                  }))}
                                />
                              </div>

                              <div className="flex items-center justify-between">
                                <Label htmlFor="allow-edit-toggle" className="text-sm cursor-pointer">Allow Editing</Label>
                                <UICheckbox
                                  id="allow-edit-toggle"
                                  checked={builder.settings.previewConfig?.allowEdit !== false}
                                  onCheckedChange={(checked: boolean) => dispatch(updateSettings({
                                    previewConfig: {
                                      ...builder.settings.previewConfig,
                                      enabled: true,
                                      allowEdit: checked,
                                    }
                                  }))}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Payment */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Payment</Label>

                        <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                          <div>
                            <Label className="text-sm font-medium">Enable Payment Collection</Label>
                            <p className="text-xs text-muted-foreground">Collect payment from users after form submission.</p>
                          </div>
                          <UICheckbox
                            checked={builder.settings.payment?.enabled || false}
                            onCheckedChange={(checked: boolean) => dispatch(updateSettings({ payment: { enabled: checked, gateway: 'razorpay', amountType: 'static', ...builder.settings.payment } }))}
                          />
                        </div>

                        {builder.settings.payment?.enabled && (
                          <>
                            <div className="space-y-2 p-3 border rounded-lg bg-card">
                              <Label className="text-sm font-semibold">Payment Gateway</Label>
                              <select
                                value={builder.settings.payment?.gateway ?? ''}
                                onChange={(e) => dispatch(updateSettings({ payment: { gateway: e.target.value as PaymentConfig['gateway'], tenantId: undefined, ...builder.settings.payment } }))}
                                className="w-full h-9 rounded border border-input px-3 text-sm bg-background"
                              >
                                <option value="" disabled>Select a gateway…</option>
                                <option value="razorpay">Razorpay</option>
                                <option value="paytm">Paytm</option>
                                <option value="payu">PayU</option>
                              </select>
                            </div>

                            {builder.settings.payment?.gateway && (
                              <div className="space-y-3 p-3 border rounded-lg bg-card">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-semibold">POS Tenant Registration</Label>
                                  {builder.settings.payment?.tenantId && (
                                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg> Registered
                                    </span>
                                  )}
                                </div>

                                {builder.settings.payment?.tenantId ? (
                                  <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground">Tenant ID</p>
                                    <div className="flex items-center gap-2">
                                      <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono truncate">{builder.settings.payment.tenantId}</code>
                                      <Button type="button" variant="ghost" size="sm" className="text-xs h-7"
                                        onClick={() => dispatch(updateSettings({ payment: { ...builder.settings.payment, tenantId: undefined } }))}>
                                        Re-register
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <p className="text-xs text-muted-foreground">Register this form with the Payment Orchestration Service to obtain a Tenant ID. This is required before accepting payments.</p>

                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Tenant Name</Label>
                                      <Input value={builder.settings.payment?.tenantName || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, tenantName: e.target.value } }))} placeholder="e.g. MyOrg_FormName" />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Redirect URL (on success)</Label>
                                      <Input value={paymentRedirectUrl} readOnly className="bg-muted text-muted-foreground cursor-not-allowed select-all" />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Cancel URL (on failure)</Label>
                                      <Input value={paymentCancelUrl} readOnly className="bg-muted text-muted-foreground cursor-not-allowed select-all" />
                                    </div>

                                    {builder.settings.payment?.gateway === 'razorpay' && (
                                      <>
                                        <div className="space-y-2">
                                          <Label className="text-xs text-muted-foreground">Key ID</Label>
                                          <Input value={builder.settings.payment?.razorpayKeyId || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, razorpayKeyId: e.target.value } }))} placeholder="rzp_live_xxxxxxxxxxxxxx" />
                                        </div>
                                        <div className="space-y-2">
                                          <Label className="text-xs text-muted-foreground">Secret Key</Label>
                                          <Input type="password" value={builder.settings.payment?.razorpaySecretKey || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, razorpaySecretKey: e.target.value } }))} placeholder="••••••••••••••••" />
                                        </div>
                                        <div className="space-y-2">
                                          <Label className="text-xs text-muted-foreground">Webhook Secret (optional)</Label>
                                          <Input type="password" value={builder.settings.payment?.razorpayWebhookSecret || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, razorpayWebhookSecret: e.target.value } }))} placeholder="••••••••••••••••" />
                                        </div>
                                      </>
                                    )}

                                    {builder.settings.payment?.gateway === 'paytm' && (
                                      <>
                                        <div className="space-y-2">
                                          <Label className="text-xs text-muted-foreground">MID</Label>
                                          <Input value={builder.settings.payment?.paytmMid || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, paytmMid: e.target.value } }))} placeholder="PaytmMerchantID" />
                                        </div>
                                        <div className="space-y-2">
                                          <Label className="text-xs text-muted-foreground">Merchant Key</Label>
                                          <Input type="password" value={builder.settings.payment?.paytmMerchantKey || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, paytmMerchantKey: e.target.value } }))} placeholder="••••••••••••••••" />
                                        </div>
                                        <div className="space-y-2">
                                          <Label className="text-xs text-muted-foreground">Website</Label>
                                          <Input value={builder.settings.payment?.paytmWebsite || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, paytmWebsite: e.target.value } }))} placeholder="DEFAULT" />
                                        </div>
                                        <div className="space-y-2">
                                          <Label className="text-xs text-muted-foreground">Industry Type ID</Label>
                                          <Input value={builder.settings.payment?.paytmIndustryTypeId || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, paytmIndustryTypeId: e.target.value } }))} placeholder="Retail" />
                                        </div>
                                      </>
                                    )}

                                    {builder.settings.payment?.gateway === 'payu' && (
                                      <>
                                        <div className="space-y-2">
                                          <Label className="text-xs text-muted-foreground">Key</Label>
                                          <Input value={builder.settings.payment?.payuKey || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, payuKey: e.target.value } }))} placeholder="gtKFFx" />
                                        </div>
                                        <div className="space-y-2">
                                          <Label className="text-xs text-muted-foreground">Salt</Label>
                                          <Input type="password" value={builder.settings.payment?.payuSalt || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, payuSalt: e.target.value } }))} placeholder="••••••••••••••••••••••••••••••••" />
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {builder.settings.payment?.tenantId && (
                              <>
                                <div className="space-y-3 p-3 border rounded-lg bg-card">
                                  <Label className="text-sm font-semibold">Amount Configuration</Label>
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Amount Type</Label>
                                    <select
                                      value={builder.settings.payment?.amountType || 'static'}
                                      onChange={(e) => dispatch(updateSettings({ payment: { amountType: e.target.value as PaymentConfig['amountType'], ...builder.settings.payment } }))}
                                      className="w-full h-9 rounded border border-input px-3 text-sm bg-background"
                                    >
                                      <option value="static">Static Amount</option>
                                      <option value="field">From a Field</option>
                                      <option value="variable">Calculated Variable</option>
                                    </select>
                                  </div>
                                  {builder.settings.payment?.amountType === 'static' && (
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Amount (INR)</Label>
                                      <Input value={builder.settings.payment?.staticAmount || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, staticAmount: e.target.value } }))} placeholder="e.g. 500.00" type="number" min="0" step="0.01" />
                                    </div>
                                  )}
                                  {builder.settings.payment?.amountType === 'field' && (
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Amount Field</Label>
                                      <select value={builder.settings.payment?.amountFieldId || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, amountFieldId: e.target.value } }))} className="w-full h-9 rounded border border-input px-3 text-sm bg-background">
                                        <option value="">— select field —</option>
                                        {builder.schema.fields.filter(f => f.type === 'number').map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                      </select>
                                    </div>
                                  )}
                                  {builder.settings.payment?.amountType === 'variable' && (
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Calculated Variable</Label>
                                      <select value={builder.settings.payment?.amountVariableId || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, amountVariableId: e.target.value } }))} className="w-full h-9 rounded border border-input px-3 text-sm bg-background">
                                        <option value="">— select variable —</option>
                                        {(builder.schema.variables || []).filter(v => v.type === 'number').map(v => <option key={v.id} value={v.id}>{v.name}{v.description ? ` — ${v.description}` : ''}</option>)}
                                      </select>
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-3 p-3 border rounded-lg bg-card">
                                  <Label className="text-sm font-semibold">Customer Info Fields</Label>
                                  <p className="text-xs text-muted-foreground">Map form fields to pass customer details to the payment gateway.</p>
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Email Field</Label>
                                    <select value={builder.settings.payment?.emailFieldId || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, emailFieldId: e.target.value } }))} className="w-full h-9 rounded border border-input px-3 text-sm bg-background">
                                      <option value="">— select field —</option>
                                      {builder.schema.fields.filter(f => ['email', 'text'].includes(f.type)).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                    </select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Mobile Field</Label>
                                    <select value={builder.settings.payment?.mobileFieldId || ''} onChange={(e) => dispatch(updateSettings({ payment: { ...builder.settings.payment, mobileFieldId: e.target.value } }))} className="w-full h-9 rounded border border-input px-3 text-sm bg-background">
                                      <option value="">— select field —</option>
                                      {builder.schema.fields.filter(f => ['phone', 'text', 'number'].includes(f.type)).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                    </select>
                                  </div>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>

                      {/* Assessment */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Assessment</Label>

                        <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                          <div>
                            <Label className="text-sm font-semibold">Enable Assessment Mode</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">Auto-score submissions based on correct answers defined per field.</p>
                          </div>
                          <UICheckbox
                            checked={builder.settings.formType === 'assessment'}
                            onCheckedChange={(checked: boolean) =>
                              dispatch(updateSettings({ formType: checked ? 'assessment' : undefined }))
                            }
                          />
                        </div>

                        {builder.settings.formType === 'assessment' && (
                          <>
                            <div className="space-y-3 p-3 border rounded-lg bg-card">
                              <Label className="text-sm font-semibold">Pass Threshold</Label>
                              <p className="text-xs text-muted-foreground">Minimum percentage score required to pass.</p>
                              <div className="flex items-center gap-3">
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={builder.settings.assessment?.passThreshold ?? 60}
                                  onChange={(e) => dispatch(updateSettings({ assessment: { passThreshold: Number(e.target.value), showScoreAfterSubmit: true, showCorrectAnswers: false, ...builder.settings.assessment } }))}
                                  className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">%</span>
                              </div>
                            </div>

                            <div className="space-y-3 p-3 border rounded-lg bg-card">
                              <Label className="text-sm font-semibold">Result Visibility</Label>
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label className="text-sm cursor-pointer">Show score after submission</Label>
                                  <p className="text-xs text-muted-foreground">Display scorecard to respondent immediately after submitting.</p>
                                </div>
                                <UICheckbox
                                  checked={builder.settings.assessment?.showScoreAfterSubmit !== false}
                                  onCheckedChange={(checked: boolean) => dispatch(updateSettings({ assessment: { ...builder.settings.assessment, showScoreAfterSubmit: checked } }))}
                                />
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t">
                                <div>
                                  <Label className="text-sm cursor-pointer">Show correct answers</Label>
                                  <p className="text-xs text-muted-foreground">Reveal the correct answer for each question in the scorecard.</p>
                                </div>
                                <UICheckbox
                                  checked={builder.settings.assessment?.showCorrectAnswers || false}
                                  onCheckedChange={(checked: boolean) => dispatch(updateSettings({ assessment: { ...builder.settings.assessment, showCorrectAnswers: checked } }))}
                                />
                              </div>
                            </div>

                            <div className="p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground space-y-1">
                              <p className="font-medium text-foreground">How to configure questions</p>
                              <p>Select any Radio, Select, or Checkbox field in the builder and set its <strong>Correct Answer</strong> and <strong>Points</strong> in the field inspector panel.</p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Voting */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Voting</Label>

                        <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                          <div>
                            <Label className="text-sm font-semibold">Enable Voting / Poll Mode</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">Aggregate votes per option and show results after submission.</p>
                          </div>
                          <UICheckbox
                            checked={builder.settings.formType === 'voting'}
                            onCheckedChange={(checked: boolean) =>
                              dispatch(updateSettings({ formType: checked ? 'voting' : undefined }))
                            }
                          />
                        </div>

                        {builder.settings.formType === 'voting' && (
                          <>
                            <div className="space-y-3 p-3 border rounded-lg bg-card">
                              <Label className="text-sm font-semibold">Duplicate Vote Prevention</Label>
                              <p className="text-xs text-muted-foreground">Prevent the same person from voting more than once.</p>
                              <div className="flex flex-col gap-2">
                                {([
                                  { value: 'none', label: 'None', desc: 'Allow unlimited votes per visitor' },
                                  { value: 'ip', label: 'By IP Address', desc: 'One vote per IP address' },
                                  { value: 'email', label: 'By Email', desc: 'One vote per email address (requires an email field)' },
                                ] as const).map(opt => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => dispatch(updateSettings({ voting: { duplicatePrevention: opt.value, showResultsAfterVoting: true, showResultsPublic: false, ...builder.settings.voting } }))}
                                    className={`flex items-start gap-3 w-full p-2.5 rounded border text-left transition-colors ${(builder.settings.voting?.duplicatePrevention ?? 'ip') === opt.value ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted'}`}
                                  >
                                    <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${(builder.settings.voting?.duplicatePrevention ?? 'ip') === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                                    <div>
                                      <p className="text-sm font-medium">{opt.label}</p>
                                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-3 p-3 border rounded-lg bg-card">
                              <Label className="text-sm font-semibold">Results Visibility</Label>
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label className="text-sm cursor-pointer">Show results after voting</Label>
                                  <p className="text-xs text-muted-foreground">Respondent sees vote distribution after they submit.</p>
                                </div>
                                <UICheckbox
                                  checked={builder.settings.voting?.showResultsAfterVoting !== false}
                                  onCheckedChange={(checked: boolean) => dispatch(updateSettings({ voting: { ...builder.settings.voting, showResultsAfterVoting: checked } }))}
                                />
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t">
                                <div>
                                  <Label className="text-sm cursor-pointer">Show results publicly (before voting)</Label>
                                  <p className="text-xs text-muted-foreground">Anyone can view live results without voting.</p>
                                </div>
                                <UICheckbox
                                  checked={builder.settings.voting?.showResultsPublic || false}
                                  onCheckedChange={(checked: boolean) => dispatch(updateSettings({ voting: { ...builder.settings.voting, showResultsPublic: checked } }))}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Save Button */}
                      <div className="pt-6 border-t">
                        <Button size="sm" onClick={handleSave} className="h-9">
                          Save Form Settings
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
