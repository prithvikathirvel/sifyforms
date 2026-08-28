import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { DataTable, type DataTableColumn } from '../ui/data-table';
import { Tooltip } from '../ui/tooltip';

interface FormWorkspaceTableProps {
  forms: Form[];
  orgSlug: string;
  getTeamName: (form: Form) => string;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function FormWorkspaceTable({ forms, orgSlug, getTeamName }: FormWorkspaceTableProps) {
  const columns: DataTableColumn<Form>[] = [
    {
      id: 'form',
      header: 'Form',
      headerClassName: 'min-w-40 sm:min-w-52',
      cellClassName: 'min-w-40 sm:min-w-52',
      cell: (form) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/[0.05] text-primary">
            <FileText className="h-3.5 w-3.5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="max-w-64 truncate text-[12px] font-semibold text-foreground" title={form.name}>{form.name}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[9px] font-medium text-muted-foreground md:hidden">
              <Users className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{getTeamName(form)}</span>
              <span className="sm:hidden" aria-hidden="true">·</span>
              <span className="shrink-0 sm:hidden">{form.isPublished ? 'Published' : 'Draft'}</span>
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      headerClassName: 'hidden sm:table-cell',
      cellClassName: 'hidden sm:table-cell',
      cell: (form) => (
        <Badge
          variant="outline"
          className={form.isPublished
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-border bg-ink-50 text-ink-500'}
        >
          {form.isPublished ? 'Published' : 'Draft'}
        </Badge>
      ),
    },
    {
      id: 'team',
      header: 'Team',
      headerClassName: 'hidden md:table-cell',
      cellClassName: 'hidden md:table-cell',
      cell: (form) => (
        <span className="flex max-w-40 items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Users className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
          <span className="truncate" title={getTeamName(form)}>{getTeamName(form)}</span>
        </span>
      ),
    },
    {
      id: 'responses',
      header: 'Responses',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      cell: (form) => <span className="font-display text-[13px] font-bold tabular-nums text-foreground">{form.submissionCount || 0}</span>,
    },
    {
      id: 'fields',
      header: 'Fields',
      headerClassName: 'hidden text-right sm:table-cell',
      cellClassName: 'hidden text-right sm:table-cell',
      cell: (form) => <span className="font-display text-[13px] font-semibold tabular-nums text-ink-700">{form.schema?.fields?.length ?? 0}</span>,
    },
    {
      id: 'updated',
      header: 'Updated',
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden whitespace-nowrap lg:table-cell',
      cell: (form) => <span className="text-[11px] font-medium text-muted-foreground">{formatDate(form.updatedAt)}</span>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      headerClassName: 'w-28 text-right',
      cellClassName: 'w-28',
      cell: (form) => <FormRowActions form={form} orgSlug={orgSlug} />,
    },
  ];

  return (
    <DataTable
      data={forms}
      columns={columns}
      getRowId={(form) => form.id}
      ariaLabel="Forms"
      tableClassName="table-fixed sm:table-auto"
    />
  );
}

function FormRowActions({ form, orgSlug }: { form: Form; orgSlug: string }) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const publicUrl = `${import.meta.env.VITE_PUBLIC_URL || window.location.origin}/${orgSlug}/${form.slug}`;
  const canEdit = form.access?.canEdit !== false;
  const canDelete = form.access?.canDelete !== false;
  const canOpenResponses = form.access?.canViewResponses !== false || form.access?.canViewResults === true;
  const responseLabel = form.access && !form.access.canViewResponses ? 'Results' : 'Responses';

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setMenuOpen(false);
    };
    const closeOnViewportChange = () => setMenuOpen(false);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [menuOpen]);

  const toggleMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = 176;
      const menuHeight = form.isPublished ? (canDelete ? 164 : 132) : (canDelete ? 132 : 100);
      const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
      const top = rect.bottom + menuHeight > window.innerHeight - 8
        ? Math.max(8, rect.top - menuHeight - 6)
        : rect.bottom + 6;
      setMenuPosition({ top, left });
    }
    setMenuOpen(true);
  };

  const remove = () => {
    setMenuOpen(false);
    if (window.confirm(`Are you sure you want to delete "${form.name}"?`)) {
      dispatch(deleteForm(form.id));
    }
  };

  return (
    <div className="flex items-center justify-end gap-0.5">
      {canEdit && (
        <Tooltip content="Edit form" side="top" tone="dark">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(`/forms/${form.id}/edit`)} aria-label={`Edit ${form.name}`} className="h-8 w-8 rounded-md text-ink-600 hover:bg-muted">
            <Edit className="h-3.5 w-3.5" strokeWidth={1.8} />
          </Button>
        </Tooltip>
      )}
      {canOpenResponses && (
        <Tooltip content={`Open ${responseLabel.toLowerCase()}`} side="top" tone="dark">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(`/forms/${form.id}/submissions`)} aria-label={`${responseLabel} for ${form.name}`} className="h-8 w-8 rounded-md text-ink-600 hover:bg-muted">
            <BarChart3 className="h-3.5 w-3.5" strokeWidth={1.8} />
          </Button>
        </Tooltip>
      )}
      <Tooltip content="More actions" side="top" tone="light">
        <Button ref={buttonRef} type="button" variant="ghost" size="icon" onClick={toggleMenu} aria-label={`More actions for ${form.name}`} aria-expanded={menuOpen} className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </Tooltip>

      {menuOpen && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[120] w-44 overflow-hidden rounded-xl border border-border bg-popover py-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.14)]"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          {form.isPublished && (
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); window.open(publicUrl, '_blank'); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted">
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); void navigator.clipboard.writeText(publicUrl); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted">
            <Copy className="h-3.5 w-3.5" /> Copy link
          </button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); window.open(publicUrl, '_blank'); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted">
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
          {canDelete && (
            <button type="button" role="menuitem" onClick={remove} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-destructive hover:bg-destructive/[0.06]">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default FormWorkspaceTable;
