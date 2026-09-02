import { useEffect, useState, type CSSProperties } from 'react';
import { getPublicDownloadUrl } from '../../lib/dms';
import type { BrandingPosition, FormBrandingSection } from '../../types';
import { cn } from '../../lib/utils';

const justify: Record<BrandingPosition, string> = {
  left: 'justify-start text-left',
  center: 'justify-center text-center',
  right: 'justify-end text-right',
};

function BrandingImage({ section, variant, src }: {
  section: FormBrandingSection;
  variant: 'header' | 'footer';
  src: string;
}) {
  const [failed, setFailed] = useState(false);
  const width = Math.min(1200, Math.max(24, section.imageWidth ?? (variant === 'header' ? 180 : 120)));
  const height = Math.min(400, Math.max(24, section.imageHeight ?? (variant === 'header' ? 64 : 48)));
  const style: CSSProperties = {
    width: `${width}px`,
    height: `${height}px`,
    maxWidth: '100%',
    objectFit: section.imageFit ?? 'contain',
    padding: `${Math.min(48, Math.max(0, section.imagePadding ?? 0))}px`,
    borderRadius: `${Math.min(999, Math.max(0, section.imageRadius ?? 0))}px`,
    backgroundColor: section.imageBackground || 'transparent',
  };

  if (failed) return (
    <span role="img" aria-label="Brand image could not be loaded" className="inline-flex h-10 items-center rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground">
      Image unavailable
    </span>
  );

  return (
    <img
      src={src}
      alt={section.imageAlt?.trim() || `${variant === 'header' ? 'Header' : 'Footer'} brand image`}
      className="block shrink-0"
      style={style}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * The single branding renderer used by both builder preview and public submit
 * view. Keeping layout and image rules here prevents preview/published drift.
 */
export function FormBranding({ section, variant, formId, preview = false }: {
  section?: FormBrandingSection;
  variant: 'header' | 'footer';
  formId?: string;
  preview?: boolean;
}) {
  const [resolvedDmsImage, setResolvedDmsImage] = useState<{ documentId: string; url: string } | null>(null);

  useEffect(() => {
    let active = true;
    if (section?.logoDocumentId && formId) {
      getPublicDownloadUrl(section.logoDocumentId, formId)
        .then((url) => { if (active) setResolvedDmsImage({ documentId: section.logoDocumentId!, url }); })
        .catch(() => { /* the persisted fallback URL is used below */ });
    }
    return () => { active = false; };
  }, [section?.logoDocumentId, formId]);

  if (!section || section.enabled === false) return null;
  const resolvedImage = resolvedDmsImage && resolvedDmsImage.documentId === section.logoDocumentId
    ? resolvedDmsImage.url
    : section.logoUrl;
  const hasImage = Boolean(resolvedImage);
  const hasText = Boolean(section.text?.trim());
  if (!hasImage && !hasText) return null;

  const imagePosition = section.logoPosition ?? 'center';
  const textPosition = section.textPosition ?? 'center';
  const image = hasImage ? <BrandingImage section={section} variant={variant} src={resolvedImage!} /> : null;
  const text = hasText ? (
    <p className={cn('min-w-0 whitespace-pre-line break-words font-semibold text-foreground', variant === 'header' ? 'text-base sm:text-lg' : 'text-sm')}>
      {section.text}
    </p>
  ) : null;

  const content = (!hasImage || !hasText || imagePosition === textPosition) ? (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-3', justify[hasImage ? imagePosition : textPosition])}>
      {image}{text}
    </div>
  ) : (
    <div className="grid min-w-0 grid-cols-1 items-center gap-3 sm:grid-cols-3">
      {(['left', 'center', 'right'] as BrandingPosition[]).map((position) => (
        <div key={position} className={cn('flex min-w-0 flex-wrap items-center gap-2', justify[position])}>
          {imagePosition === position && image}
          {textPosition === position && text}
        </div>
      ))}
    </div>
  );

  return (
    <div
      className={cn(
        'w-full border-border px-4 py-3 sm:px-6',
        variant === 'header' ? 'sticky top-0 z-40 border-b bg-card' : 'mt-6 border-t bg-transparent',
        preview && 'relative top-auto z-10'
      )}
    >
      <div className="mx-auto w-full max-w-[1400px]">{content}</div>
    </div>
  );
}

export default FormBranding;
