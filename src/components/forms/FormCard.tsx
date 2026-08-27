import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { deleteForm } from '../../store/formsSlice';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import {
  BarChart3,
  ClipboardCheck,
  Clock3,
  Copy,
  Edit3,
  Eye,
  FileText,
  MoreHorizontal,
  Share2,
  Trash2,
  Users,
} from 'lucide-react';
import type { Form } from '../../types';

interface FormCardProps {
  form: Form;
  orgSlug: string;
  /** The list page can resolve the friendly team name from the team tree. */
  teamName?: string | null;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getPublicUrl(orgSlug: string, formSlug: string) {
  return `${import.meta.env.VITE_PUBLIC_URL || window.location.origin}/${orgSlug}/${formSlug}`;
}

function formDescription(form: Form) {
  return form.description?.trim() || 'A SifyForms workspace form';
}

/**
 * Shared form card used by the dashboard and the full forms library.
 *
 * It keeps the card intentionally focused: status, context, response volume,
 * last update and the few actions people use most. Secondary actions live in a
 * compact menu instead of competing with the primary actions.
 */
export default function FormCard({ form, orgSlug, teamName }: FormCardProps) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const publicUrl = getPublicUrl(orgSlug, form.slug);
  const questionCount = form.schema?.fields?.length ?? 0;
  const canEdit = form.access?.canEdit !== false;
  const canDelete = form.access?.canDelete !== false;
  const canShare = form.access?.canShare !== false && form.isPublished;
  const canViewResponses = form.access?.canViewResponses !== false || form.access?.canViewResults;
  const hasMenuActions = form.isPublished || canDelete;
  const hasFooterActions = canEdit || canViewResponses;
  const responseLabel = form.access && !form.access.canViewResponses ? 'Results' : 'Responses';

  useEffect(() => {
    if (!menuOpen) return;

    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [menuOpen]);

  const remove = () => {
    setMenuOpen(false);
    if (window.confirm(`Are you sure you want to delete "${form.name}"?`)) {
      dispatch(deleteForm(form.id));
    }
  };

  const copyLink = async () => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard permissions can be unavailable in an embedded preview. The
      // form remains fully usable; do not surface a blocking error for a helper.
    }
  };

  const shareForm = async () => {
    setMenuOpen(false);
    if (navigator.share) {
      try {
        await navigator.share({ title: form.name, url: publicUrl });
      } catch {
        // Closing the native share sheet is not an error.
      }
      return;
    }
    window.open(publicUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="group relative flex min-h-[18.5rem] flex-col overflow-visible rounded-2xl border-border/80 bg-card shadow-[0_8px_28px_hsl(var(--foreground)/0.035)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_16px_36px_hsl(var(--foreground)/0.08)]">
      <div
        aria-hidden="true"
        className={`h-1.5 w-full rounded-t-2xl ${form.isPublished ? 'bg-gradient-to-r from-brand-600 via-plum-500 to-pink-500' : 'bg-ink-200'}`}
      />

      <CardHeader className="space-y-4 px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${form.isPublished ? 'border-primary/15 bg-primary/[0.075] text-primary' : 'border-border bg-muted/60 text-muted-foreground'}`}
            >
              {form.settings?.formType === 'assessment' ? (
                <ClipboardCheck className="h-[18px] w-[18px]" strokeWidth={1.9} />
              ) : (
                <FileText className="h-[18px] w-[18px]" strokeWidth={1.9} />
              )}
            </span>
            <Badge
              variant="outline"
              className={form.isPublished
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-border bg-muted/60 text-muted-foreground'}
            >
              {form.isPublished ? 'Published' : 'Draft'}
            </Badge>
          </div>

          {hasMenuActions && (
            <div ref={menuRef} className="relative shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label={`More actions for ${form.name}`}
                aria-expanded={menuOpen}
                className="h-8 w-8 rounded-lg text-muted-foreground opacity-75 transition-opacity hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-popover py-1.5 shadow-xl shadow-foreground/10">
                  {form.isPublished && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        window.open(publicUrl, '_blank', 'noopener,noreferrer');
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      Preview form
                    </button>
                  )}
                  {canShare && (
                    <>
                      <button
                        type="button"
                        onClick={() => void copyLink()}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        {copied ? 'Link copied' : 'Copy link'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void shareForm()}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                        Share form
                      </button>
                    </>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={remove}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-destructive transition-colors hover:bg-destructive/[0.06]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete form
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <CardTitle className="line-clamp-2 min-h-10 font-display text-[17px] font-bold leading-5 tracking-tight text-foreground transition-colors group-hover:text-primary">
            {form.name}
          </CardTitle>
          <p className="mt-2 line-clamp-2 min-h-9 text-xs font-medium leading-4 text-muted-foreground">
            {formDescription(form)}
          </p>
        </div>

        {(teamName || form.teamId) && (
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Users className="h-3.5 w-3.5 shrink-0 text-ink-400" strokeWidth={1.8} />
            <span className="truncate">{teamName || 'Assigned team'}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="mt-auto px-5 pb-4 pt-0">
        <div className="grid grid-cols-2 divide-x divide-border/70 rounded-xl border border-border/75 bg-muted/25">
          <div className="px-3.5 py-3">
            <p className="font-display text-xl font-bold leading-none tabular-nums text-foreground">
              {form.submissionCount || 0}
            </p>
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground">
              Responses
            </p>
          </div>
          <div className="px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-xs font-bold leading-5 text-foreground">
              <Clock3 className="h-3.5 w-3.5 shrink-0 text-ink-400" strokeWidth={1.8} />
              <span className="truncate">{formatDate(form.updatedAt)}</span>
            </p>
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground">
              Updated
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] font-medium text-muted-foreground">
          {questionCount} question{questionCount === 1 ? '' : 's'}
        </p>
      </CardContent>

      {hasFooterActions && (
        <CardFooter className="gap-2 border-t border-border/70 px-5 py-3">
          {canEdit && (
            <Button
              size="sm"
              onClick={() => navigate(`/forms/${form.id}/edit`)}
              className="h-9 flex-1 rounded-lg px-3 text-xs"
            >
              <Edit3 className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
              Edit form
            </Button>
          )}
          {canViewResponses && (
            <Button
              variant={canEdit ? 'outline' : 'default'}
              size="sm"
              onClick={() => navigate(`/forms/${form.id}/submissions`)}
              className="h-9 flex-1 rounded-lg px-3 text-xs"
            >
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
              {responseLabel}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
