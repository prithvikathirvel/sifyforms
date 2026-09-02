import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  Copy,
  Edit,
  Eye,
  FileText,
  LayoutGrid,
  MoreHorizontal,
  Share2,
  Trash2,
  Users,
} from 'lucide-react';
import type { Form } from '../../types';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { deleteForm } from '../../store/formsSlice';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tooltip } from '../ui/tooltip';

interface FormWorkspaceCardProps {
  form: Form;
  orgSlug: string;
  teamName?: string;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Shared, information-focused form card used by Dashboard and Forms. */
export function FormWorkspaceCard({ form, orgSlug, teamName }: FormWorkspaceCardProps) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const publicUrl = `${import.meta.env.VITE_PUBLIC_URL || window.location.origin}/${orgSlug}/${form.slug}`;
  const fieldCount = form.schema?.fields?.length ?? 0;
  const canEdit = form.access?.canEdit !== false;
  const canDelete = form.access?.canDelete !== false;
  const canOpenResponses = form.access?.canViewResponses !== false || form.access?.canViewResults === true;
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

  return (
    <Card className="group flex min-h-[12.5rem] flex-col overflow-visible rounded-xl border-border/90 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.035),0_4px_14px_rgba(15,23,42,0.025)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-ink-300 hover:shadow-[0_2px_4px_rgba(15,23,42,0.045),0_8px_22px_rgba(15,23,42,0.04)]">
      <CardHeader className="shrink-0 px-4 pb-3.5 pt-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary/[0.055] text-primary">
            <FileText className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </span>

          <div className="min-w-0 flex-1 pt-0.5">
            <CardTitle className="line-clamp-1 font-display text-[13px] font-bold leading-5 text-foreground">
              <button
                type="button"
                onClick={() => navigate(`/forms/${form.id}/edit`)}
                className="max-w-full truncate text-left transition-colors hover:text-primary"
                title={`Edit ${form.name}`}
              >
                {form.name}
              </button>
            </CardTitle>
            <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
              <span className="truncate">{teamName || 'No team'}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Badge
              variant="outline"
              className={form.isPublished
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-border bg-ink-50 text-ink-500'}
            >
              {form.isPublished ? 'Published' : 'Draft'}
            </Badge>

            <div ref={menuRef} className="relative">
              <Tooltip content="More actions" side="top" tone="light" delay="short">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-label="More form actions"
                  aria-expanded={menuOpen}
                  className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </Tooltip>
              {menuOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg shadow-ink-950/[0.07]">
                  {form.isPublished && (
                    <button type="button" onClick={() => { setMenuOpen(false); window.open(publicUrl, '_blank'); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted">
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </button>
                  )}
                  <button type="button" onClick={() => { setMenuOpen(false); void navigator.clipboard.writeText(publicUrl); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted">
                    <Copy className="h-3.5 w-3.5" /> Copy link
                  </button>
                  <button type="button" onClick={() => { setMenuOpen(false); window.open(publicUrl, '_blank'); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted">
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </button>
                  {canDelete && (
                    <button type="button" onClick={remove} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-destructive hover:bg-destructive/[0.06]">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid flex-1 grid-cols-3 divide-x divide-border/80 border-y border-border/75 bg-ink-50/45 p-0">
        <div className="min-w-0 px-3 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
            <span>Responses</span>
          </div>
          <p className="mt-1.5 font-display text-base font-bold tabular-nums text-foreground">
            {form.submissionCount || 0}
          </p>
        </div>
        <div className="min-w-0 px-3 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
            <LayoutGrid className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
            <span>Fields</span>
          </div>
          <p className="mt-1.5 font-display text-base font-bold tabular-nums text-foreground">{fieldCount}</p>
        </div>
        <div className="min-w-0 px-3 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-ink-500" strokeWidth={1.8} />
            <span>Updated</span>
          </div>
          <p className="mt-1.5 truncate text-[11px] font-semibold leading-5 text-foreground" title={formatDate(form.updatedAt)}>
            {formatDate(form.updatedAt)}
          </p>
        </div>
      </CardContent>

      {(canEdit || canOpenResponses) && (
        <div className="flex min-h-11 shrink-0 items-center px-2.5 py-1.5">
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => navigate(`/forms/${form.id}/edit`)} className="h-8 rounded-md px-2.5 text-xs text-ink-700 hover:bg-muted">
              <Edit className="mr-1.5 h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
              Edit
            </Button>
          )}
          {canEdit && canOpenResponses && <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />}
          {canOpenResponses && (
            <Button variant="ghost" size="sm" onClick={() => navigate(`/forms/${form.id}/submissions`)} className="h-8 rounded-md px-2.5 text-xs text-ink-700 hover:bg-muted">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5 text-ink-500" strokeWidth={1.8} />
              {responseLabel}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export default FormWorkspaceCard;
