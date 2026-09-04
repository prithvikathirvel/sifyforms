import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox as UICheckbox } from '../ui/checkbox';
import { X, Check, Settings, Shield, Palette, CreditCard, KeyRound, ClipboardCheck, BarChart2, Loader2, Users, Upload, AlertTriangle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { updateSettings } from '../../store/builderSlice';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import FormAccessPanel from '../forms/FormAccessPanel';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useState } from 'react';

const POS_BASE = 'https://apidev.sifymodernization.digital/payment-service';

const POST_SUBMIT_PRESETS = {
  minimal: { accentColor: '#475569', backgroundColor: '#f8fafc', icon: 'check' as const },
  celebration: { accentColor: '#7c3aed', backgroundColor: '#f5f3ff', icon: 'sparkles' as const },
  professional: { accentColor: '#0f766e', backgroundColor: '#f0fdfa', icon: 'check' as const },
  nextSteps: { accentColor: '#2563eb', backgroundColor: '#eff6ff', icon: 'thumbsUp' as const },
};
import type { PaymentConfig, FormAuthentication, PartialSubmissionConfig, FormBrandingSection, BrandingPosition, PostSubmitSettings } from '../../types';
import { uploadFileAuthenticated, getDownloadUrl } from '../../lib/dms';
import {
  DMS_DEFAULT_MAX_FILE_SIZE_MB,
  DMS_FILE_TYPE_GROUPS,
  DMS_MAX_FILE_SIZE_MB,
  describeAllowedTypes,
  isBotProtectionEnabled,
  resolveUploadRules,
} from '../../lib/formPolicy';

interface FormSettingsContentProps {
  formId?: string;
}

/**
 * Keep inline branding below the API's 50 MB JSON limit. Large raster images
 * are downscaled client-side; DMS uploads retain the original file.
 */
const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2400;

async function imageAsDataUrl(file: File): Promise<string> {
  if (file.size <= MAX_INLINE_IMAGE_BYTES || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('The image could not be read.'));
      reader.readAsDataURL(file);
    });
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot process the image.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // WebP preserves transparency and dramatically reduces oversized uploads.
  return canvas.toDataURL('image/webp', 0.9);
}

const BRANDING_POSITIONS: { value: BrandingPosition; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

/**
 * Editor for one branding section. Header supports a logo (with placement) and
 * text (with placement); footer is text only. The enable checkbox hides the
 * section on the public form without losing its content.
 */
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

  const handleLogoFile = async (file: File | undefined) => {
    setUploadError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file.');
      return;
    }
    try {
      const dataUrl = await imageAsDataUrl(file);
      update({ logoUrl: dataUrl, logoDocumentId: undefined });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'The image could not be processed.');
    }
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
              <Label className="text-xs font-medium text-muted-foreground">Image (Optional)</Label>
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
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
                      <p className="text-[10px] text-muted-foreground mt-0.5">Large images are optimized automatically; transparency is preserved.</p>
                    </div>
                  </div>
                  {dmsEnabled && (
                    <label className="block">
                      <div className="px-3 py-2 bg-plum-50 hover:bg-plum-100 border border-plum-200 rounded cursor-pointer text-center text-xs font-semibold text-plum-700 transition-colors flex items-center justify-center gap-1.5">
                        <Upload className="h-3.5 w-3.5" />
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
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Image Position</Label>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Width (px)</Label>
                <Input type="number" min={24} max={1200} value={value?.imageWidth ?? (label.includes('Header') ? 180 : 120)} onChange={(e) => update({ imageWidth: Number(e.target.value) })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Height (px)</Label>
                <Input type="number" min={24} max={400} value={value?.imageHeight ?? (label.includes('Header') ? 64 : 48)} onChange={(e) => update({ imageHeight: Number(e.target.value) })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Fit</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs" value={value?.imageFit || 'contain'} onChange={(e) => update({ imageFit: e.target.value as FormBrandingSection['imageFit'] })}>
                  <option value="contain">Contain</option><option value="cover">Cover / crop</option><option value="fill">Stretch</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Padding (px)</Label>
                <Input type="number" min={0} max={48} value={value?.imagePadding ?? 0} onChange={(e) => update({ imagePadding: Number(e.target.value) })} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[7rem_7rem_1fr]">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Background</Label>
                <Input type="color" value={value?.imageBackground && /^#[0-9a-f]{6}$/i.test(value.imageBackground) ? value.imageBackground : '#ffffff'} onChange={(e) => update({ imageBackground: e.target.value })} className="h-9 p-1" title="Leave unchanged for a transparent background" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Corner (px)</Label>
                <Input type="number" min={0} max={999} value={value?.imageRadius ?? 0} onChange={(e) => update({ imageRadius: Number(e.target.value) })} className="h-9" />
              </div>
              <div className="col-span-2 space-y-1 sm:col-span-1">
                <Label className="text-[11px] text-muted-foreground">Accessible description</Label>
                <Input value={value?.imageAlt || ''} onChange={(e) => update({ imageAlt: e.target.value || undefined })} placeholder="e.g. Acme company logo" className="h-9" />
              </div>
            </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const SETTINGS_TAB_CLASS =
  'h-9 w-auto shrink-0 justify-start rounded-md border border-transparent px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[state=active]:border-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none md:w-full';

export default function FormSettingsContent({ formId }: FormSettingsContentProps) {
  const dispatch = useAppDispatch();
  const builder = useAppSelector((state) => state.builder);
  const currentOrg = useAppSelector((state) => state.org.currentOrg);
  // Persisted per form: leaving for the preview and coming back should return
  // to the section that was open, not to General.
  const [activeTab, setActiveTab] = usePersistentState<string>(
    `sifyforms.builder.${formId ?? 'draft'}.formSettingsTab`,
    'general'
  );
  const origin = window.location.origin;
  const paymentRedirectUrl = formId ? `${origin}/payment/${formId}/status` : '';
  const paymentCancelUrl = formId ? `${origin}/payment/${formId}/status?cancelled=true` : '';
  const postSubmit: PostSubmitSettings = builder.settings.postSubmit ?? { template: 'minimal', icon: 'check', loadingStyle: 'bar' };
  const updatePostSubmit = (updates: Partial<PostSubmitSettings>) => dispatch(updateSettings({ postSubmit: { ...postSubmit, ...updates } }));
  const botProtectionOn = isBotProtectionEnabled(builder.settings);
  const uploadRules = resolveUploadRules(builder.settings.dms);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-full w-full flex-col bg-card md:flex-row">
      <aside className="w-full shrink-0 border-b border-border bg-muted/40 md:sticky md:top-0 md:h-[calc(100vh-6.25rem)] md:w-60 md:self-start md:border-b-0 md:border-r">
        <p className="hidden px-4 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:block">
          Sections
        </p>
        <TabsList className="scrollbar-compact flex h-auto w-full flex-row justify-start gap-1 overflow-x-auto bg-transparent p-3 md:flex-col md:overflow-y-auto">
                <TabsTrigger value="general" className={SETTINGS_TAB_CLASS}>
                  <Settings className="mr-2 h-4 w-4" />
                  General
                </TabsTrigger>
                <TabsTrigger value="after-submit" className={SETTINGS_TAB_CLASS}>
                  <Check className="mr-2 h-4 w-4" />
                  After submission
                </TabsTrigger>
                <TabsTrigger value="access" className={SETTINGS_TAB_CLASS}>
                  <Shield className="h-4 w-4 mr-2" />
                  Access & Security
                </TabsTrigger>
                <TabsTrigger value="team" className={SETTINGS_TAB_CLASS}>
                  <Users className="h-4 w-4 mr-2" />
                  Team & Sharing
                </TabsTrigger>
                <TabsTrigger value="appearance" className={SETTINGS_TAB_CLASS}>
                  <Palette className="h-4 w-4 mr-2" />
                  Appearance
                </TabsTrigger>
                <TabsTrigger value="authentication" className={SETTINGS_TAB_CLASS}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Authentication
                </TabsTrigger>
                <TabsTrigger value="payment" className={SETTINGS_TAB_CLASS}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payment
                </TabsTrigger>
                <TabsTrigger value="assessment" className={SETTINGS_TAB_CLASS}>
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Assessment
                </TabsTrigger>
                <TabsTrigger value="voting" className={SETTINGS_TAB_CLASS}>
                  <BarChart2 className="h-4 w-4 mr-2" />
                  Voting
                </TabsTrigger>
                <TabsTrigger value="survey" className={SETTINGS_TAB_CLASS}>
                  <BarChart2 className="h-4 w-4 mr-2" />
                  Survey
                </TabsTrigger>
              </TabsList>
            </aside>

            {/* No max-width: the cap left a wide, empty gutter beside every
                panel on a normal laptop. Panels now use the full column. */}
            <div className="min-w-0 flex-1 bg-card [&>[role=tabpanel]]:w-full [&>[role=tabpanel]]:px-5 [&>[role=tabpanel]]:py-6 sm:[&>[role=tabpanel]]:px-8 sm:[&>[role=tabpanel]]:py-8 lg:[&>[role=tabpanel]]:px-10">
              <TabsContent value="general" className="m-0 space-y-7">
                <div className="border-b border-border/70 pb-5">
                  <h2 className="text-base font-semibold text-foreground">General settings</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Control the form’s availability and basic response metadata.</p>
                </div>

                <section className="space-y-5 rounded-xl border border-border p-5 sm:p-6">
                  <div>
                    <Label className="text-sm font-semibold">Form availability</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Choose whether respondents can access this form and optionally schedule when it closes.</p>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-4">
                    <div>
                      <Label htmlFor="general-active-toggle" className="cursor-pointer text-sm font-medium">Allow form submissions</Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">When disabled, public visitors cannot view or submit this form.</p>
                    </div>
                    <UICheckbox id="general-active-toggle" checked={builder.settings.isFormActive !== false} onCheckedChange={(checked: boolean) => dispatch(updateSettings({ isFormActive: checked }))} />
                  </div>
                  <div className="space-y-2 border-t border-border/70 pt-4">
                    <Label className="text-sm font-medium">Expiration date and time</Label>
                    <p className="text-xs text-muted-foreground">Automatically stop accepting responses at this date and time.</p>
                    <Input
                      type="datetime-local"
                      value={(() => {
                        const value = builder.settings.expirationDateTime;
                        if (!value) return '';
                        const date = new Date(value);
                        if (Number.isNaN(date.getTime())) return value.slice(0, 16);
                        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                        return local.toISOString().slice(0, 16);
                      })()}
                      onChange={(event) => dispatch(updateSettings({ expirationDateTime: event.target.value ? new Date(event.target.value).toISOString() : undefined }))}
                    />
                  </div>
                </section>

                <section className="flex items-center justify-between gap-4 rounded-xl border border-border p-5 sm:p-6">
                  <div>
                    <Label htmlFor="timestamp-toggle" className="cursor-pointer text-sm font-semibold">Record submission time</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Store the received timestamp with every completed response.</p>
                  </div>
                  <UICheckbox id="timestamp-toggle" checked={builder.settings.collectTimestamp !== false} onCheckedChange={(checked: boolean) => dispatch(updateSettings({ collectTimestamp: checked }))} />
                </section>
              </TabsContent>

              <TabsContent value="after-submit" className="m-0 space-y-7">
                <div className="border-b border-border/70 pb-5">
                  <h2 className="text-base font-semibold text-foreground">After-submit template</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Design the confirmation, processing, and result experience shown after submission.</p>
                </div>
                <section className="space-y-3">
                  <div><Label className="text-sm font-semibold">Completion experience</Label><p className="mt-1 text-xs text-muted-foreground">Choose the page shown after submission and while results are processing.</p></div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {([
                      ['minimal', 'Minimal', 'Quiet confirmation with a neutral layout.'],
                      ['celebration', 'Celebration', 'Colorful recognition for milestones and feedback.'],
                      ['professional', 'Professional', 'Trust-focused confirmation for business workflows.'],
                      ['nextSteps', 'Next steps', 'Action-led layout with links and response details.'],
                    ] as const).map(([value, title, description]) => (
                      <button key={value} type="button" onClick={() => updatePostSubmit({ template: value, ...POST_SUBMIT_PRESETS[value] })} className={`rounded-xl border p-3 text-left transition-colors ${postSubmit.template === value ? 'border-primary bg-primary/[0.05]' : 'border-border hover:border-primary/30'}`}>
                        <span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
                      </button>
                    ))}
                  </div>
                  <div className="rounded-xl border border-border p-3" style={{ backgroundColor: postSubmit.backgroundColor || '#f8fafc' }}>
                    <div className={`mx-auto max-w-sm rounded-xl border border-black/10 bg-white p-5 ${postSubmit.template === 'nextSteps' ? 'text-left' : 'text-center'}`}>
                      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full text-lg ${postSubmit.template === 'nextSteps' ? '' : 'mx-auto'}`} style={{ color: postSubmit.accentColor || '#475569', backgroundColor: `${postSubmit.accentColor || '#475569'}16` }}>✓</div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Response received</p>
                      <p className="mt-1 text-base font-semibold">{postSubmit.headline || 'Thank you'}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{postSubmit.message || builder.settings.thankYouMessage || 'Your submission has been received.'}</p>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2"><Label>Headline</Label><Input value={postSubmit.headline || ''} onChange={(e) => updatePostSubmit({ headline: e.target.value })} placeholder="Thank you — response received" maxLength={160} /></div>
                  <div className="space-y-2 sm:col-span-2"><Label>Message</Label><Textarea value={postSubmit.message ?? builder.settings.thankYouMessage ?? ''} onChange={(e) => { updatePostSubmit({ message: e.target.value }); dispatch(updateSettings({ thankYouMessage: e.target.value })); }} placeholder="Explain what happens next." className="min-h-24 resize-y" maxLength={4000} /></div>
                  <div className="space-y-2"><Label>Icon</Label><select value={postSubmit.icon || 'check'} onChange={(e) => updatePostSubmit({ icon: e.target.value as PostSubmitSettings['icon'] })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="check">Check</option><option value="sparkles">Sparkles</option><option value="heart">Heart</option><option value="thumbsUp">Thumbs up</option></select></div>
                  <div className="space-y-2"><Label>Accent color</Label><div className="flex gap-2"><Input type="color" value={postSubmit.accentColor || '#475569'} onChange={(e) => updatePostSubmit({ accentColor: e.target.value })} className="h-10 w-14 p-1" /><Input value={postSubmit.accentColor || '#475569'} onChange={(e) => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) updatePostSubmit({ accentColor: e.target.value }); }} maxLength={7} aria-label="Accent hex color" /></div></div>
                  <div className="space-y-2"><Label>Page background</Label><div className="flex gap-2"><Input type="color" value={postSubmit.backgroundColor || '#f8fafc'} onChange={(e) => updatePostSubmit({ backgroundColor: e.target.value })} className="h-10 w-14 p-1" /><Input value={postSubmit.backgroundColor || '#f8fafc'} onChange={(e) => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) updatePostSubmit({ backgroundColor: e.target.value }); }} maxLength={7} aria-label="Background hex color" /></div></div>
                  <div className="space-y-2"><Label>Loading activity</Label><select value={postSubmit.loadingStyle || 'bar'} onChange={(e) => updatePostSubmit({ loadingStyle: e.target.value as PostSubmitSettings['loadingStyle'] })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="bar">Activity bar</option><option value="spinner">Spinner</option><option value="pulse">Pulse</option></select></div>
                  <div className="space-y-2 sm:col-span-2"><Label>Loading title</Label><Input value={postSubmit.loadingTitle || ''} onChange={(e) => updatePostSubmit({ loadingTitle: e.target.value })} placeholder="Processing your response…" /></div>
                  <div className="space-y-2 sm:col-span-2"><Label>Loading description</Label><Input value={postSubmit.loadingMessage || ''} onChange={(e) => updatePostSubmit({ loadingMessage: e.target.value })} placeholder="Your response is safe. This will only take a moment." /></div>
                </section>

                <section className="space-y-4 rounded-xl border border-border p-4">
                  <Label className="text-sm font-semibold">Response details and actions</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm"><UICheckbox checked={postSubmit.showSubmissionId || false} onCheckedChange={(checked: boolean) => updatePostSubmit({ showSubmissionId: checked })} />Show response reference</label>
                    <label className="flex items-center gap-2 text-sm"><UICheckbox checked={postSubmit.showTimestamp || false} onCheckedChange={(checked: boolean) => updatePostSubmit({ showTimestamp: checked })} />Show received time</label>
                  </div>
                  {(['primaryAction', 'secondaryAction'] as const).map((key, index) => { const action = postSubmit[key] ?? { enabled: false }; return <div key={key} className="grid gap-2 border-t border-border/70 pt-3 sm:grid-cols-[auto_1fr_1.4fr]"><label className="flex items-center gap-2 text-sm"><UICheckbox checked={action.enabled} onCheckedChange={(checked: boolean) => updatePostSubmit({ [key]: { ...action, enabled: checked } })} />{index === 0 ? 'Primary' : 'Secondary'} action</label><Input value={action.label || ''} onChange={(e) => updatePostSubmit({ [key]: { ...action, label: e.target.value } })} placeholder={index === 0 ? 'Continue' : 'Back to website'} /><Input value={action.url || ''} onChange={(e) => updatePostSubmit({ [key]: { ...action, url: e.target.value } })} placeholder="https://example.com/next" /></div>; })}
                </section>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Redirect URL (Optional)</Label>
                  <Input value={builder.settings.redirectUrl || ''} onChange={(e) => dispatch(updateSettings({ redirectUrl: e.target.value || null }))} placeholder="https://example.com/thank-you" />
                  <p className="text-xs text-muted-foreground">A redirect replaces the customized after-submit experience entirely.</p>
                </div>
              </TabsContent>

              {/* Who inside the organization may edit this form and read its
                  responses. Distinct from "Access & Security", which governs the
                  public visitors filling it in. */}
              <TabsContent value="team" className="m-0 space-y-7">
                <div className="border-b border-border/70 pb-5">
                  <h2 className="text-base font-semibold text-foreground">Team and sharing</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Choose the owning team and control who can work with this form and its responses.</p>
                </div>
                {formId ? (
                  <FormAccessPanel formId={formId} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Save the form once and its team and sharing options will appear here.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="access" className="m-0 space-y-7">
                <div className="border-b border-border/70 pb-5">
                  <h2 className="text-base font-semibold text-foreground">Access and security</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Configure storage and safeguards for public respondents.</p>
                </div>

                {/* Bot protection. On by default, because a public form that
                    anyone can post to will eventually be found by a script.
                    It can still be turned off — an internal form behind a VPN,
                    or a page embedded where the challenge cannot render. */}
                <div className="rounded-xl border bg-card p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Label htmlFor="bot-protection-toggle" className="cursor-pointer text-sm font-medium">Bot protection</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Powered by Cloudflare. Every public submission is checked for automated traffic. Most people
                        never see anything — it runs in the background.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${botProtectionOn ? 'text-primary' : 'text-muted-foreground'}`}>
                        {botProtectionOn ? 'On' : 'Off'}
                      </span>
                      <UICheckbox
                        id="bot-protection-toggle"
                        checked={botProtectionOn}
                        onCheckedChange={(checked: boolean) => dispatch(updateSettings({ botProtection: checked }))}
                      />
                    </div>
                  </div>
                  {!botProtectionOn && (
                    <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium leading-5 text-amber-900">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Anyone — including automated scripts — can submit this form. Turn this back on if you start
                        seeing junk responses.
                      </span>
                    </p>
                  )}
                </div>

                {/* File uploads. Every uploaded file goes to the Document
                    Management System; there is no second storage mode to
                    choose between, so this only asks for the limits. */}
                <div className="rounded-xl border bg-card p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Label className="text-sm font-medium">File uploads</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Files people attach to this form are stored in the Document Management System. These limits
                        are applied in the browser and checked again on the server.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-primary/15 bg-primary/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      DMS storage
                    </span>
                  </div>

                  <div className="mt-5 space-y-5 border-t pt-5">
                    <div className="space-y-2">
                      <Label htmlFor="dms-max-size" className="text-xs font-medium text-foreground">Largest file allowed</Label>
                      <div className="flex max-w-xs items-center gap-2">
                        <Input
                          id="dms-max-size"
                          type="number"
                          min={1}
                          max={DMS_MAX_FILE_SIZE_MB}
                          value={builder.settings.dms?.maxFileSize ?? ''}
                          onChange={(e) => {
                            const raw = Number(e.target.value);
                            const next = e.target.value === '' || !Number.isFinite(raw)
                              ? undefined
                              : Math.min(Math.max(Math.round(raw), 1), DMS_MAX_FILE_SIZE_MB);
                            dispatch(updateSettings({ dms: { ...builder.settings.dms, maxFileSize: next } }));
                          }}
                          placeholder={String(DMS_DEFAULT_MAX_FILE_SIZE_MB)}
                        />
                        <span className="text-xs font-medium text-muted-foreground">MB</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Currently {uploadRules.maxFileSizeMb} MB per file. Leave blank for the {DMS_DEFAULT_MAX_FILE_SIZE_MB} MB
                        default; {DMS_MAX_FILE_SIZE_MB} MB is the most any form can accept.
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <Label className="text-xs font-medium text-foreground">Which files people may attach</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {DMS_FILE_TYPE_GROUPS.map((group) => {
                          const current = builder.settings.dms?.allowedMimeTypes || [];
                          const isSelected = group.mimeTypes.every((mime) => current.includes(mime));
                          return (
                            <button
                              key={group.value}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => {
                                const next = isSelected
                                  ? current.filter((t: string) => !group.mimeTypes.includes(t))
                                  : [...new Set([...current, ...group.mimeTypes])];
                                dispatch(updateSettings({
                                  dms: { ...builder.settings.dms, allowedMimeTypes: next.length ? next : undefined },
                                }));
                              }}
                              className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                                isSelected
                                  ? 'border-primary/40 bg-primary/[0.05]'
                                  : 'border-input bg-background hover:bg-muted/60'
                              }`}
                            >
                              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'
                              }`}>
                                {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-xs font-semibold text-foreground">{group.label}</span>
                                <span className="block text-[11px] text-muted-foreground">{group.description}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {uploadRules.allowedMimeTypes.length === 0
                          ? 'Nothing selected, so every file type is accepted.'
                          : `People can attach ${describeAllowedTypes(uploadRules.allowedMimeTypes)}. Anything else is refused before it uploads.`}
                      </p>
                    </div>
                  </div>
                </div>

              </TabsContent>

              <TabsContent value="authentication" className="m-0 space-y-7">
                <div className="border-b border-border/70 pb-5">
                  <h2 className="text-base font-semibold text-foreground">Authentication</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Verify respondents and configure secure save-and-resume behavior.</p>
                </div>
                {(() => {
                  const fields = builder.schema?.fields || [];
                  const auth = builder.settings.authentication;
                  const partial = builder.settings.partialSubmission;
                  const updateAuth = (updates: Partial<FormAuthentication>) =>
                    dispatch(updateSettings({ authentication: { enabled: false, method: 'email', ...auth, ...updates } }));
                  const updatePartial = (updates: Partial<PartialSubmissionConfig>) =>
                    dispatch(updateSettings({ partialSubmission: { enabled: false, ...partial, ...updates } }));

                  return (
                    <>
                      {/* OTP Authentication */}
                      <div className="space-y-3 p-3 border rounded-lg bg-card">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-semibold">OTP Verification</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">Verify users via OTP before they can view or fill the form.</p>
                          </div>
                          <UICheckbox
                            checked={auth?.enabled || false}
                            onCheckedChange={(checked: boolean) => {
                              updateAuth({ enabled: checked });
                              // disable partial submission if auth is turned off
                              if (!checked) updatePartial({ enabled: false });
                            }}
                          />
                        </div>

                        {auth?.enabled && (
                          <div className="space-y-3 pt-2 border-t">
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Method</Label>
                              <div className="flex gap-2">
                                {(['email', 'phone', 'both'] as const).map(m => (
                                  <button key={m} type="button" onClick={() => updateAuth({ method: m })}
                                    className={`flex-1 py-2 px-3 rounded border text-sm font-medium transition-colors ${(auth?.method ?? 'email') === m ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted'}`}>
                                    {m === 'email' ? 'Email OTP' : m === 'phone' ? 'Phone OTP' : 'Both'}
                                  </button>
                                ))}
                              </div>
                              {auth?.method === 'both' && (
                                <p className="text-xs text-muted-foreground">User must verify email first, then phone number.</p>
                              )}
                            </div>

                            {(auth?.method === 'email' || auth?.method === 'both' || !auth?.method) && (
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Email Field to Prefill & Lock</Label>
                                <select value={auth?.emailFieldId || ''} onChange={(e) => updateAuth({ emailFieldId: e.target.value })}
                                  className="w-full h-9 rounded border border-input px-3 text-sm bg-background">
                                  <option value="">— select field —</option>
                                  {fields.filter(f => ['email', 'text'].includes(f.type)).map(f => (
                                    <option key={f.id} value={f.id}>{f.label}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {(auth?.method === 'phone' || auth?.method === 'both') && (
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Phone Field to Prefill & Lock</Label>
                                <select value={auth?.phoneFieldId || ''} onChange={(e) => updateAuth({ phoneFieldId: e.target.value })}
                                  className="w-full h-9 rounded border border-input px-3 text-sm bg-background">
                                  <option value="">— select field —</option>
                                  {fields.filter(f => ['phone', 'text', 'number'].includes(f.type)).map(f => (
                                    <option key={f.id} value={f.id}>{f.label}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Partial Submission */}
                      <div className={`space-y-3 p-3 border rounded-lg ${auth?.enabled ? 'bg-card' : 'bg-muted/40 opacity-60'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-semibold">Partial Submission (Save &amp; Resume)</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Auto-save progress so users can continue where they left off.
                              {!auth?.enabled && <span className="text-amber-600"> Requires authentication to be enabled.</span>}
                            </p>
                          </div>
                          <UICheckbox
                            checked={partial?.enabled || false}
                            disabled={!auth?.enabled}
                            onCheckedChange={(checked: boolean) => updatePartial({ enabled: checked })}
                          />
                        </div>
                        {partial?.enabled && auth?.enabled && (
                          <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
                            <p>✓ Form data auto-saves every 3 seconds after the user is verified.</p>
                            <p>✓ On next visit, verified users will see their saved progress restored.</p>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </TabsContent>

              <TabsContent value="appearance" className="m-0 space-y-7">
                <div className="border-b border-border/70 pb-5">
                  <h2 className="text-base font-semibold text-foreground">Appearance</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Set the theme, branding, and respondent review experience.</p>
                </div>
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
                          <Check className="h-4 w-4 ml-auto text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label className="text-sm font-medium">Header & Footer</Label>
                    <p className="text-xs text-muted-foreground">Add an image and/or text above and below the form, with responsive sizing and placement controls.</p>
                  </div>
                  <BrandingSectionEditor
                    label="Form Header"
                    description="Logo and/or text shown above the form."
                    value={builder.settings.header}
                    onChange={(header) => dispatch(updateSettings({ header }))}
                    showLogo
                    dmsEnabled
                    orgId={currentOrg?.id}
                    formId={formId}
                  />
                  <BrandingSectionEditor
                    label="Form Footer"
                    description="Image and/or text shown below the form."
                    value={builder.settings.footer}
                    onChange={(footer) => dispatch(updateSettings({ footer }))}
                    showLogo
                    dmsEnabled
                    orgId={currentOrg?.id}
                    formId={formId}
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
              </TabsContent>

              <TabsContent value="payment" className="m-0 space-y-7">
                <div className="border-b border-border/70 pb-5">
                  <h2 className="text-base font-semibold text-foreground">Payment</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Collect and process payments as part of the submission flow.</p>
                </div>
                {(() => {
                  const fields = builder.schema?.fields || [];
                  const payment = builder.settings.payment;
                  const [onboarding, setOnboarding] = useState(false);
                  const [onboardError, setOnboardError] = useState<string | null>(null);

                  const updatePayment = (updates: Partial<PaymentConfig>) => {
                    dispatch(updateSettings({
                      payment: {
                        enabled: false,
                        gateway: 'razorpay' as const,
                        amountType: 'static',
                        ...payment,
                        ...updates,
                      }
                    }));
                  };

                  const handleOnboard = async () => {
                    if (!payment?.tenantName || !payment?.gateway) {
                      setOnboardError('Tenant name and gateway are required.');
                      return;
                    }
                    const gw = payment.gateway;
                    if (gw === 'razorpay' && (!payment.razorpayKeyId || !payment.razorpaySecretKey)) {
                      setOnboardError('Razorpay Key ID and Secret Key are required.');
                      return;
                    }
                    if (gw === 'paytm' && (!payment.paytmMid || !payment.paytmMerchantKey)) {
                      setOnboardError('Paytm MID and Merchant Key are required.');
                      return;
                    }
                    if (gw === 'payu' && (!payment.payuKey || !payment.payuSalt)) {
                      setOnboardError('PayU Key and Salt are required.');
                      return;
                    }
                    setOnboarding(true);
                    setOnboardError(null);
                    try {
                      const provider_specification =
                        gw === 'razorpay'
                          ? { key_id: payment.razorpayKeyId, secret_key: payment.razorpaySecretKey, webhook_secret: payment.razorpayWebhookSecret || '' }
                          : gw === 'paytm'
                          ? { mid: payment.paytmMid, Website: payment.paytmWebsite || 'DEFAULT', industry_type_id: payment.paytmIndustryTypeId || 'Retail', merchant_key: payment.paytmMerchantKey }
                          : { key: payment.payuKey, salt: payment.payuSalt };
                      const res = await fetch(`${POS_BASE}/tenant/onboard`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          tenant_name: payment.tenantName,
                          parent_tenant: 'Sify Forms',
                          gateway: gw,
                          redirect_url: paymentRedirectUrl,
                          cancel_url: paymentCancelUrl,
                          provider_specification,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Onboarding failed');
                      updatePayment({ tenantId: data.data?.tenant_id });
                    } catch (e: any) {
                      setOnboardError(e.message || 'Onboarding failed. Check credentials and try again.');
                    } finally {
                      setOnboarding(false);
                    }
                  };

                  return (
                    <>
                      {/* Enable toggle */}
                      <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                        <div>
                          <Label className="text-sm font-medium">Enable Payment Collection</Label>
                          <p className="text-xs text-muted-foreground">Collect payment from users after form submission.</p>
                        </div>
                        <UICheckbox
                          checked={payment?.enabled || false}
                          onCheckedChange={(checked: boolean) => updatePayment({ enabled: checked })}
                        />
                      </div>

                      {payment?.enabled && (
                        <>
                          {/* Gateway selector */}
                          <div className="space-y-2 p-3 border rounded-lg bg-card">
                            <Label className="text-sm font-semibold">Payment Gateway</Label>
                            <select
                              value={payment?.gateway ?? ''}
                              onChange={(e) => updatePayment({ gateway: e.target.value as PaymentConfig['gateway'], tenantId: undefined })}
                              className="w-full h-9 rounded border border-input px-3 text-sm bg-background"
                            >
                              <option value="" disabled>Select a gateway…</option>
                              <option value="razorpay">Razorpay</option>
                              <option value="paytm">Paytm</option>
                              <option value="payu">PayU</option>
                            </select>
                          </div>

                          {/* POS Tenant Onboarding */}
                          {payment?.gateway && (
                            <div className="space-y-3 p-3 border rounded-lg bg-card">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">POS Tenant Registration</Label>
                                {payment?.tenantId && (
                                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                    <Check className="h-3.5 w-3.5" /> Registered
                                  </span>
                                )}
                              </div>

                              {payment?.tenantId ? (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground">Tenant ID</p>
                                  <div className="flex items-center gap-2">
                                    <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono truncate">{payment.tenantId}</code>
                                    <Button type="button" variant="ghost" size="sm" className="text-xs h-7"
                                      onClick={() => updatePayment({ tenantId: undefined })}>
                                      Re-register
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <p className="text-xs text-muted-foreground">Register this form with the Payment Orchestration Service to obtain a Tenant ID. This is required before accepting payments.</p>

                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Tenant Name</Label>
                                    <Input value={payment?.tenantName || ''} onChange={(e) => updatePayment({ tenantName: e.target.value })} placeholder="e.g. MyOrg_FormName" />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Redirect URL (on success)</Label>
                                    <Input value={paymentRedirectUrl} readOnly className="bg-muted text-muted-foreground cursor-not-allowed select-all" />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Cancel URL (on failure)</Label>
                                    <Input value={paymentCancelUrl} readOnly className="bg-muted text-muted-foreground cursor-not-allowed select-all" />
                                  </div>

                                  {/* Razorpay credentials */}
                                  {payment?.gateway === 'razorpay' && (
                                    <>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Key ID</Label>
                                        <Input value={payment?.razorpayKeyId || ''} onChange={(e) => updatePayment({ razorpayKeyId: e.target.value })} placeholder="rzp_live_xxxxxxxxxxxxxx" />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Secret Key</Label>
                                        <Input type="password" value={payment?.razorpaySecretKey || ''} onChange={(e) => updatePayment({ razorpaySecretKey: e.target.value })} placeholder="••••••••••••••••" />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Webhook Secret (optional)</Label>
                                        <Input type="password" value={payment?.razorpayWebhookSecret || ''} onChange={(e) => updatePayment({ razorpayWebhookSecret: e.target.value })} placeholder="••••••••••••••••" />
                                      </div>
                                    </>
                                  )}

                                  {/* Paytm credentials */}
                                  {payment?.gateway === 'paytm' && (
                                    <>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">MID</Label>
                                        <Input value={payment?.paytmMid || ''} onChange={(e) => updatePayment({ paytmMid: e.target.value })} placeholder="PaytmMerchantID" />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Merchant Key</Label>
                                        <Input type="password" value={payment?.paytmMerchantKey || ''} onChange={(e) => updatePayment({ paytmMerchantKey: e.target.value })} placeholder="••••••••••••••••" />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Website</Label>
                                        <Input value={payment?.paytmWebsite || ''} onChange={(e) => updatePayment({ paytmWebsite: e.target.value })} placeholder="DEFAULT" />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Industry Type ID</Label>
                                        <Input value={payment?.paytmIndustryTypeId || ''} onChange={(e) => updatePayment({ paytmIndustryTypeId: e.target.value })} placeholder="Retail" />
                                      </div>
                                    </>
                                  )}

                                  {/* PayU credentials */}
                                  {payment?.gateway === 'payu' && (
                                    <>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Key</Label>
                                        <Input value={payment?.payuKey || ''} onChange={(e) => updatePayment({ payuKey: e.target.value })} placeholder="gtKFFx" />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Salt</Label>
                                        <Input type="password" value={payment?.payuSalt || ''} onChange={(e) => updatePayment({ payuSalt: e.target.value })} placeholder="••••••••••••••••••••••••••••••••" />
                                      </div>
                                    </>
                                  )}

                                  {onboardError && <p className="text-xs text-destructive">{onboardError}</p>}
                                  <Button type="button" className="w-full" onClick={handleOnboard} disabled={onboarding}>
                                    {onboarding ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Registering…</> : 'Register Tenant with POS'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Amount configuration — only shown once tenant registered */}
                          {payment?.tenantId && (
                            <>
                              <div className="space-y-3 p-3 border rounded-lg bg-card">
                                <Label className="text-sm font-semibold">Amount Configuration</Label>
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Amount Type</Label>
                                  <select
                                    value={payment?.amountType || 'static'}
                                    onChange={(e) => updatePayment({ amountType: e.target.value as PaymentConfig['amountType'] })}
                                    className="w-full h-9 rounded border border-input px-3 text-sm bg-background"
                                  >
                                    <option value="static">Static Amount</option>
                                    <option value="field">From a Field</option>
                                    <option value="variable">Calculated Variable</option>
                                  </select>
                                </div>
                                {payment?.amountType === 'static' && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Amount (INR)</Label>
                                    <Input value={payment?.staticAmount || ''} onChange={(e) => updatePayment({ staticAmount: e.target.value })} placeholder="e.g. 500.00" type="number" min="0" step="0.01" />
                                  </div>
                                )}
                                {payment?.amountType === 'field' && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Amount Field</Label>
                                    <select value={payment?.amountFieldId || ''} onChange={(e) => updatePayment({ amountFieldId: e.target.value })} className="w-full h-9 rounded border border-input px-3 text-sm bg-background">
                                      <option value="">— select field —</option>
                                      {fields.filter(f => f.type === 'number').map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                    </select>
                                  </div>
                                )}
                                {payment?.amountType === 'variable' && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Calculated Variable</Label>
                                    <select value={payment?.amountVariableId || ''} onChange={(e) => updatePayment({ amountVariableId: e.target.value })} className="w-full h-9 rounded border border-input px-3 text-sm bg-background">
                                      <option value="">— select variable —</option>
                                      {(builder.schema?.variables || []).filter(v => v.type === 'number').map(v => <option key={v.id} value={v.id}>{v.name}{v.description ? ` — ${v.description}` : ''}</option>)}
                                    </select>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-3 p-3 border rounded-lg bg-card">
                                <Label className="text-sm font-semibold">Customer Info Fields</Label>
                                <p className="text-xs text-muted-foreground">Map form fields to pass customer details to the payment gateway.</p>
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Email Field</Label>
                                  <select value={payment?.emailFieldId || ''} onChange={(e) => updatePayment({ emailFieldId: e.target.value })} className="w-full h-9 rounded border border-input px-3 text-sm bg-background">
                                    <option value="">— select field —</option>
                                    {fields.filter(f => ['email', 'text'].includes(f.type)).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Mobile Field</Label>
                                  <select value={payment?.mobileFieldId || ''} onChange={(e) => updatePayment({ mobileFieldId: e.target.value })} className="w-full h-9 rounded border border-input px-3 text-sm bg-background">
                                    <option value="">— select field —</option>
                                    {fields.filter(f => ['phone', 'text', 'number'].includes(f.type)).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                  </select>
                                </div>
                              </div>

                            </>
                          )}
                        </>
                      )}
                    </>
                  );
                })()}
              </TabsContent>
              <TabsContent value="assessment" className="m-0 space-y-7">
                <div className="border-b border-border/70 pb-5">
                  <h2 className="text-base font-semibold text-foreground">Assessment</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Score responses and control how assessment results are presented.</p>
                </div>
                {(() => {
                  const assessment = builder.settings.assessment;
                  const updateAssessment = (updates: Partial<NonNullable<typeof assessment>>) =>
                    dispatch(updateSettings({
                      formType: 'assessment',
                      assessment: { passThreshold: 60, showScoreAfterSubmit: true, showCorrectAnswers: false, ...assessment, ...updates },
                    }));
                  const isAssessment = builder.settings.formType === 'assessment';

                  return (
                    <>
                      <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                        <div>
                          <Label className="text-sm font-semibold">Enable Assessment Mode</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Auto-score submissions based on correct answers defined per field.</p>
                        </div>
                        <UICheckbox
                          checked={isAssessment}
                          onCheckedChange={(checked: boolean) =>
                            dispatch(updateSettings({ formType: checked ? 'assessment' : undefined }))
                          }
                        />
                      </div>

                      {isAssessment && (
                        <>
                          <div className="space-y-3 p-3 border rounded-lg bg-card">
                            <Label className="text-sm font-semibold">Pass Threshold</Label>
                            <p className="text-xs text-muted-foreground">Minimum percentage score required to pass.</p>
                            <div className="flex items-center gap-3">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={assessment?.passThreshold ?? 60}
                                onChange={(e) => updateAssessment({ passThreshold: Number(e.target.value) })}
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
                                checked={assessment?.showScoreAfterSubmit !== false}
                                onCheckedChange={(checked: boolean) => updateAssessment({ showScoreAfterSubmit: checked })}
                              />
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t">
                              <div>
                                <Label className="text-sm cursor-pointer">Show correct answers</Label>
                                <p className="text-xs text-muted-foreground">Reveal the correct answer for each question in the scorecard.</p>
                              </div>
                              <UICheckbox
                                checked={assessment?.showCorrectAnswers || false}
                                onCheckedChange={(checked: boolean) => updateAssessment({ showCorrectAnswers: checked })}
                              />
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground space-y-1">
                            <p className="font-medium text-foreground">How to configure questions</p>
                            <p>Select any Radio, Select, or Checkbox field in the builder and set its <strong>Correct Answer</strong> and <strong>Points</strong> in the field inspector panel.</p>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </TabsContent>

              <TabsContent value="voting" className="m-0 space-y-7">
                <div className="border-b border-border/70 pb-5">
                  <h2 className="text-base font-semibold text-foreground">Voting</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Configure poll participation, duplicate prevention, and result visibility.</p>
                </div>
                {(() => {
                  const voting = builder.settings.voting;
                  const updateVoting = (updates: Partial<NonNullable<typeof voting>>) =>
                    dispatch(updateSettings({
                      formType: 'voting',
                      voting: { duplicatePrevention: 'ip', showResultsAfterVoting: true, showResultsPublic: false, ...voting, ...updates },
                    }));
                  const isVoting = builder.settings.formType === 'voting';

                  return (
                    <>
                      <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                        <div>
                          <Label className="text-sm font-semibold">Enable Voting / Poll Mode</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Aggregate votes per option and show results after submission.</p>
                        </div>
                        <UICheckbox
                          checked={isVoting}
                          onCheckedChange={(checked: boolean) =>
                            dispatch(updateSettings({ formType: checked ? 'voting' : undefined }))
                          }
                        />
                      </div>

                      {isVoting && (
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
                                  onClick={() => updateVoting({ duplicatePrevention: opt.value })}
                                  className={`flex items-start gap-3 w-full p-2.5 rounded border text-left transition-colors ${(voting?.duplicatePrevention ?? 'ip') === opt.value ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted'}`}
                                >
                                  <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${(voting?.duplicatePrevention ?? 'ip') === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
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
                                checked={voting?.showResultsAfterVoting !== false}
                                onCheckedChange={(checked: boolean) => updateVoting({ showResultsAfterVoting: checked })}
                              />
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t">
                              <div>
                                <Label className="text-sm cursor-pointer">Show results publicly (before voting)</Label>
                                <p className="text-xs text-muted-foreground">Anyone can view live results without voting.</p>
                              </div>
                              <UICheckbox
                                checked={voting?.showResultsPublic || false}
                                onCheckedChange={(checked: boolean) => updateVoting({ showResultsPublic: checked })}
                              />
                            </div>
                          </div>
                        </>
                      )}

                    </>
                  );
                })()}
              </TabsContent>

              <TabsContent value="survey" className="m-0 space-y-7">
                <div className="border-b border-border/70 pb-5">
                  <h2 className="text-base font-semibold text-foreground">Survey</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Configure respondent identity, navigation, and survey-specific behavior.</p>
                </div>
                {(() => {
                  const isSurvey = builder.settings.formType === 'survey';
                  const survey = builder.settings.survey ?? { identityMode: 'anonymous' as const, saveIncomplete: true as const };
                  const updateSurvey = (updates: Partial<typeof survey>) => dispatch(updateSettings({
                    formType: 'survey', survey: { ...survey, ...updates, saveIncomplete: true },
                  }));
                  return <>
                    <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                      <div><Label className="text-sm font-semibold">Enable Survey Mode</Label><p className="mt-0.5 text-xs text-muted-foreground">Adds survey questions, anonymous partial saving, and survey reports.</p></div>
                      <UICheckbox checked={isSurvey} onCheckedChange={(checked: boolean) => dispatch(updateSettings({ formType: checked ? 'survey' : undefined, survey: checked ? survey : undefined }))} />
                    </div>
                    {isSurvey && <>
                      <div className="space-y-3 rounded-lg border bg-card p-3">
                        <Label className="text-sm font-semibold">Respondent identity</Label>
                        <p className="text-xs text-muted-foreground">Strict anonymous is the safest default and stores no direct identity, raw IP, or browser user-agent.</p>
                        <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={survey.identityMode} onChange={(event) => {
                          const identityMode = event.target.value as 'anonymous' | 'pseudonymous' | 'identified';
                          updateSurvey({ identityMode });
                          if (identityMode === 'anonymous') dispatch(updateSettings({
                            authentication: builder.settings.authentication ? { ...builder.settings.authentication, enabled: false } : undefined,
                            payment: builder.settings.payment ? { ...builder.settings.payment, enabled: false } : undefined,
                          }));
                        }}>
                          <option value="anonymous">Strict anonymous (recommended)</option>
                          <option value="pseudonymous">Pseudonymous</option>
                          <option value="identified">Identified</option>
                        </select>
                        {survey.identityMode === 'anonymous' && <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">Authentication, payment, email, phone, signatures, and uploads conflict with strict anonymity and are blocked by server validation.</p>}
                      </div>
                      <div className="space-y-3 rounded-lg border bg-card p-3">
                        {([
                          ['showQuestionNumbers', 'Show question numbers'],
                          ['showProgress', 'Show survey progress'],
                          ['allowBackNavigation', 'Allow back navigation'],
                          ['randomizeQuestions', 'Randomize question order'],
                        ] as const).map(([key, label]) => <div key={key} className="flex items-center justify-between"><Label>{label}</Label><UICheckbox checked={key === 'randomizeQuestions' ? survey[key] === true : survey[key] !== false} onCheckedChange={(checked: boolean) => updateSurvey({ [key]: checked })} /></div>)}
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><strong>Incomplete responses are always saved.</strong> They remain separate from completed submissions and are excluded from completion metrics.</div>
                    </>}
                  </>;
                })()}
              </TabsContent>
            </div>
          </Tabs>
  );
}
