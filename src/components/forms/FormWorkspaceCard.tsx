import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Copy,
  Edit,
  Eye,
  FileText,
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

/** A shared, compact form card used by Dashboard and the full Forms view. */
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
    <Card className="group flex min-h-[14rem] flex-col overflow-visible rounded-xl border-border/80 bg-card shadow-none transition-colors hover:border-ink-300">
      <CardHeader className="shrink-0 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/45 text-ink-600">
              <FileText className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 pt-0.5">
              <CardTitle className="line-clamp-2 font-display text-[15px] font-bold leading-5 text-foreground sm:text-base">
                {form.name}
              </CardTitle>
              <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                {teamName && (
                  <>
                    <Users className="h-3 w-3 shrink-0" strokeWidth={1.8} />
                    <span className="max-w-28 truncate">{teamName}</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span className="shrink-0">Updated {formatDate(form.updatedAt)}</span>
              </div>
            </div>
          </div>
          <Badge
            variant="outline"
            className={form.isPublished
              ? 'shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'shrink-0 border-border bg-muted/50 text-muted-foreground'}
          >
            {form.isPublished ? 'Published' : 'Draft'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col px-4 pb-0 pt-1 sm:px-5">
        <div className="grid grid-cols-2 divide-x divide-border/70 rounded-lg border border-border/70 bg-muted/20 py-2.5">
          <div className="px-3">
            <p className="font-display text-lg font-bold tabular-nums text-foreground">{form.submissionCount || 0}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Responses</p>
          </div>
          <div className="px-3">
            <p className="font-display text-lg font-bold tabular-nums text-foreground">{fieldCount}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fields</p>
          </div>
        </div>
      </CardContent>

      <div className="mt-4 flex items-center border-t border-border/70 p-2">
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={() => navigate(`/forms/${form.id}/edit`)} className="h-8 rounded-md px-2.5 text-xs text-ink-700 hover:bg-muted">
            <Edit className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
            Edit
          </Button>
        )}
        {canOpenResponses && (
          <Button variant="ghost" size="sm" onClick={() => navigate(`/forms/${form.id}/submissions`)} className="h-8 rounded-md px-2.5 text-xs text-ink-700 hover:bg-muted">
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
            {responseLabel}
          </Button>
        )}

        <div ref={menuRef} className="relative ml-auto">
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
          {menuOpen && (
            <div className="absolute bottom-full right-0 z-30 mb-1 w-44 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg">
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
    </Card>
  );
}

export default FormWorkspaceCard;
