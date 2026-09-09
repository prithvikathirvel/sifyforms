import { ChevronDown, Star, Upload } from 'lucide-react';
import type { FormField, FormVariable } from '../../types';
import { cn } from '../../lib/utils';
import { flagForIso, initialPhoneCountry, phoneCountries } from '../../lib/countries';

/**
 * The static, respondent-eye render of a field's answer control.
 *
 * `compact` is used on a collapsed question card (option lists are capped so
 * the card list stays scannable); `preview` is used in the field editor's
 * Preview tab, where it must look exactly like the final form.
 */
export default function LiveControl({ field, variables, variant = 'compact' }: {
  field: FormField;
  variables: FormVariable[];
  variant?: 'compact' | 'preview';
}) {
  const options = field.options ?? [];
  const cap = variant === 'compact' ? 6 : Infinity;

  const box = (children: React.ReactNode, extra?: string) => (
    <div className={cn(
      'flex items-center rounded-lg border border-input bg-background px-3 py-2 text-[13.5px] text-ink-400',
      extra
    )}>
      {children}
    </div>
  );

  const scale = field.surveyConfig?.scale;
  const scaleMax = scale?.max ?? (field.type === 'nps' ? 10 : 5);
  const scaleMin = scale?.min ?? (field.type === 'nps' ? 0 : 1);
  const scaleRow = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

  switch (field.type) {
    case 'text':
    case 'email':
      return box(<span>{field.placeholder || '\u00a0'}</span>);
    case 'phone': {
      // Mirrors the public form: only the allowed countries (or every
      // country), starting on the default when it is among them.
      const c = initialPhoneCountry(field.phoneConfig, phoneCountries(field.phoneConfig));
      return (
        <div className="flex w-full max-w-[340px] items-stretch">
          <span className="flex flex-none items-center gap-1.5 rounded-l-md border border-r-0 border-input bg-muted/40 px-2.5 text-[13.5px] text-foreground">
            <span className="text-base leading-none">{c ? flagForIso(c.iso2) : '🌐'}</span>
            <span className="text-ink-500">+{c?.dial ?? '91'}</span>
          </span>
          <span className="min-w-0 flex-1 truncate rounded-r-md border border-input bg-background px-3 py-2 text-[13.5px] text-ink-400">
            {field.placeholder || '\u00a0'}
          </span>
        </div>
      );
    }
    case 'textarea':
      return <div className="min-h-[64px] w-full rounded-lg border border-input bg-background px-3 py-2 text-[13.5px] text-ink-400">{field.placeholder || '\u00a0'}</div>;
    case 'number':
      return box(<span>{field.placeholder || '0'}</span>, 'max-w-[200px]');
    case 'date':
      return box(<span>dd / mm / yyyy</span>, 'max-w-[200px]');
    case 'time':
      return box(<span>--:--</span>, 'max-w-[140px]');
    case 'file': {
      const maxMb = Math.round((field.fileConfig?.maxSize ?? 5242880) / 1048576);
      const accept = field.fileConfig?.accept?.length ? field.fileConfig.accept.join(', ') : null;
      return (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border-[1.5px] border-dashed border-input bg-background px-4 py-6 text-center">
          <Upload className="h-5 w-5 text-muted-foreground/70" />
          <p className="text-[12.5px] font-medium text-foreground">Drag and drop or click to upload</p>
          <p className="text-[10.5px] text-muted-foreground">
            Up to {maxMb} MB{accept ? ` · ${accept}` : ''}
          </p>
        </div>
      );
    }
    case 'signature':
      return <div className="grid h-20 place-items-center rounded-lg border border-dashed border-input bg-background text-[12.5px] italic text-ink-400">Sign here</div>;
    case 'rating':
      return (
        <div className="flex gap-1.5 text-ink-300">
          {[1, 2, 3, 4, 5].map((n) => <Star key={n} className="h-4 w-4 fill-current" />)}
        </div>
      );
    case 'nps':
    case 'csat':
    case 'ces':
      return (
        <div className="flex flex-wrap gap-1">
          {scaleRow(scaleMin, scaleMax).map((n) => (
            <span key={n} className="grid h-[30px] w-[30px] place-items-center rounded-md border border-input bg-background text-xs text-ink-500">{n}</span>
          ))}
        </div>
      );
    case 'likert': {
      const cols = scaleRow(scaleMin, scaleMax);
      const rows = field.surveyConfig?.rows?.length ? field.surveyConfig.rows : [{ id: 'r1', label: 'Statement 1' }, { id: 'r2', label: 'Statement 2' }];
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th />
                {cols.map((c) => (
                  <th key={c} className="border-b border-border px-1 py-1.5 text-center text-[10.5px] font-semibold text-muted-foreground">
                    {c === scaleMin && scale?.minLabel ? scale.minLabel : c === scaleMax && scale?.maxLabel ? scale.maxLabel : c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="border-b border-border/60 py-2 pr-2 text-[12.5px] text-foreground">{r.label}</td>
                  {cols.map((c) => (
                    <td key={c} className="border-b border-border/60 py-2 text-center">
                      <span className="inline-block h-4 w-4 rounded-full border-[1.5px] border-ink-300" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'ranking':
      return options.length
        ? (
          <div className="space-y-1">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2.5 py-1 text-[13.5px]">
                <span className="w-3.5 text-[11px] text-ink-400">{i + 1}</span>
                <span className="text-foreground">{o.label || `Option ${i + 1}`}</span>
              </div>
            ))}
          </div>
        )
        : <p className="text-[12.5px] italic text-muted-foreground">No items to rank yet.</p>;
    case 'table': {
      const columns = field.tableConfig?.columns ?? [];
      return columns.length
        ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.id} className="border border-border bg-ink-50 px-2 py-1.5 text-left text-[10.5px] font-semibold text-muted-foreground">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {columns.map((c) => (
                    <td key={c.id} className="border border-border px-2 py-1.5 text-ink-400">—</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )
        : <p className="text-[12.5px] italic text-muted-foreground">No columns yet — see Advanced → Table columns.</p>;
    }
    case 'display': {
      const variable = variables.find((v) => v.id === field.displayConfig?.variableId);
      return (
        <div className="w-full rounded-lg border border-plum-200 bg-plum-50 px-3 py-2 text-[13.5px] font-medium text-plum-800">
          {variable ? `{{ ${variable.name} }}` : 'Choose a value to display — Advanced → Choose what to display'}
        </div>
      );
    }
    case 'html':
      return <div className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-ink-400">&lt;p&gt;Custom markup&lt;/p&gt;</div>;
    case 'select':
    case 'multiselect':
      return (
        <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background pl-3 pr-2.5">
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-400">{field.placeholder || 'Choose…'}</span>
          <ChevronDown className="h-4 w-4 flex-none text-muted-foreground" />
        </div>
      );
    case 'radio':
    case 'checkbox': {
      const shape = field.type === 'radio' ? 'rounded-full' : 'rounded';
      const shown = options.slice(0, cap);
      return shown.length ? (
        <div className="space-y-1">
          {shown.map((o, i) => (
            <div key={i} className="flex items-center gap-2.5 py-1 text-[13.5px]">
              <span className={cn('h-4 w-4 flex-none border-[1.5px] border-ink-300', shape)} />
              <span className="truncate text-foreground">{o.label || `Option ${i + 1}`}</span>
            </div>
          ))}
          {options.length > shown.length && (
            <p className="pl-[26px] text-[11.5px] text-muted-foreground">+{options.length - shown.length} more</p>
          )}
        </div>
      ) : <p className="text-[12.5px] italic text-muted-foreground">No options yet.</p>;
    }
    default:
      return box(<span>{field.placeholder || '\u00a0'}</span>);
  }
}
