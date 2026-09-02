import type { FormField } from '../../types';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { normalizeSurveyAnswer, stableSurveyShuffle, surveyScale } from '../../lib/survey';

interface Props {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export default function SurveyFieldControl({ field, value, onChange, disabled = false }: Props) {
  const config = field.surveyConfig;
  const scale = surveyScale(field);
  const values = Array.from({ length: scale.max - scale.min + 1 }, (_, index) => scale.min + index);

  if (['nps', 'csat', 'ces'].includes(field.type)) {
    return (
      <fieldset disabled={disabled} className="space-y-2">
        <legend className="sr-only">Choose a score from {scale.min} to {scale.max}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${field.label} score`}>
          {values.map((score) => (
            <button key={score} type="button" role="radio" aria-checked={Number(value) === score}
              onClick={() => onChange(normalizeSurveyAnswer(field, score))}
              className={`min-h-11 min-w-11 rounded-md border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${Number(value) === score ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:border-primary/50'}`}>
              {score}
            </button>
          ))}
        </div>
        <div className="flex justify-between gap-4 text-xs text-muted-foreground">
          <span>{config?.scale?.minLabel}</span><span className="text-right">{config?.scale?.maxLabel}</span>
        </div>
      </fieldset>
    );
  }

  if (field.type === 'likert') {
    const answer = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, number | null> : {};
    return (
      <div className="overflow-x-auto rounded-md border border-border" role="group" aria-label={field.label}>
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead><tr className="bg-muted/50"><th className="p-3 text-left font-medium">Statement</th>{values.map((score) => <th key={score} className="p-2 text-center font-medium">{score}</th>)}</tr></thead>
          <tbody>{(config?.rows ?? []).map((row) => <tr key={row.id} className="border-t"><th scope="row" className="p-3 text-left font-normal">{row.label}</th>{values.map((score) => {
            const selected = Number(answer[row.id]) === score;
            return <td key={score} className="p-1.5 text-center">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${row.label}: ${score}`}
                disabled={disabled}
                onClick={() => onChange(normalizeSurveyAnswer(field, { ...answer, [row.id]: score }))}
                className={`mx-auto flex h-11 w-11 items-center justify-center rounded-md border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background text-foreground hover:border-primary/60 hover:bg-primary/[0.04]'}`}
              >
                {score}
              </button>
            </td>;
          })}</tr>)}</tbody>
        </table>
        <div className="flex justify-between bg-muted/30 px-3 py-2 text-xs text-muted-foreground"><span>{config?.scale?.minLabel}</span><span>{config?.scale?.maxLabel}</span></div>
      </div>
    );
  }

  if (field.type === 'ranking') {
    const rawOptions = field.options ?? [];
    const seedKey = 'sifyforms:survey-order-seed';
    let seed = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(seedKey) : null;
    if (!seed && typeof sessionStorage !== 'undefined') { seed = crypto.randomUUID(); sessionStorage.setItem(seedKey, seed); }
    const options = config?.randomize?.enabled ? stableSurveyShuffle(rawOptions, `${seed || 'preview'}:${field.id}`) : rawOptions;
    const selected = Array.isArray(value) ? value as string[] : [];
    const orderedIds = [...selected, ...options.map((option) => option.value).filter((id) => !selected.includes(id))];
    const move = (index: number, by: number) => {
      const next = [...orderedIds];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      onChange(normalizeSurveyAnswer(field, next));
    };
    return <ol className="space-y-2" aria-label="Ranking order">{orderedIds.map((id, index) => {
      const option = options.find((item) => item.value === id);
      return <li key={id} className="flex min-h-12 items-center gap-3 rounded-md border border-input bg-background px-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">{index + 1}</span>
        <span className="flex-1 text-sm">{option?.label ?? id}</span>
        <button type="button" disabled={disabled || index === 0} aria-label={`Move ${option?.label} up`} onClick={() => move(index, -1)} className="rounded p-2 hover:bg-muted disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
        <button type="button" disabled={disabled || index === orderedIds.length - 1} aria-label={`Move ${option?.label} down`} onClick={() => move(index, 1)} className="rounded p-2 hover:bg-muted disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
      </li>;
    })}</ol>;
  }

  return null;
}
