import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import type { FormField, FormVariable } from '../../types';

interface DisplayFieldProps {
  field: FormField;
  variables: FormVariable[];
  className?: string;
}

export function DisplayField({ field, variables, className = '' }: DisplayFieldProps) {
  const variable = variables.find(v => v.id === field.displayConfig?.variableId);

  if (!variable) {
    return (
      <div className={`space-y-2 ${className}`}>
        <Label>{field.label}</Label>
        <Card className="p-3">
          <div className="text-muted-foreground text-sm">
            No variable selected
          </div>
        </Card>
      </div>
    );
  }

  const displayValue = variable.value !== undefined ? variable.value : 'Not calculated';
  const formattedValue = formatValue(displayValue, variable.type, field.displayConfig?.format);

  return (
    <div className={className}>
      <Card className="p-3">
        <div className="space-y-2">
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
            <div className="text-[10px] text-muted-foreground opacity-50">
              Var: {variable.name}
            </div>
          )}

          {variable.description && (
            <div className="text-xs text-muted-foreground">
              {variable.description}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function formatValue(value: any, type: string, format?: string): string {
  if (value === null || value === undefined || value === 'Not calculated') {
    return 'Not set';
  }

  switch (type) {
    case 'number':
      if (format) {
        // Handle common number formats
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
}

// Configuration component for display field in the form builder
export function DisplayFieldConfig({
  field,
  variables,
  onUpdate
}: {
  field: FormField;
  variables: FormVariable[];
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const handleUpdateDisplayConfig = (updates: any) => {
    onUpdate({
      displayConfig: {
        ...field.displayConfig,
        ...updates
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Variable to Display</Label>
        <select
          value={field.displayConfig?.variableId || ''}
          onChange={(e) => handleUpdateDisplayConfig({ variableId: e.target.value })}
          className="w-full rounded border px-3 py-2 text-sm"
        >
          <option value="">Select a variable</option>
          {variables.map(variable => (
            <option key={variable.id} value={variable.id}>
              {variable.name} ({variable.type})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4 border-t pt-4">
        <h5 className="text-sm font-semibold">Key (Label) Styling</h5>
        <div className="space-y-2">
          <Label>Display Label (e.g., "Age is")</Label>
          <Input
            value={field.displayConfig?.label || ''}
            onChange={(e) => handleUpdateDisplayConfig({ label: e.target.value })}
            placeholder="Defaults to variable name"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Font Size</Label>
            <Input
              value={field.displayConfig?.labelFontSize || '0.875rem'}
              onChange={(e) => handleUpdateDisplayConfig({ labelFontSize: e.target.value })}
              placeholder="e.g., 14px, 1rem"
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={field.displayConfig?.textColor || '#6b7280'}
                onChange={(e) => handleUpdateDisplayConfig({ textColor: e.target.value })}
                className="w-8 h-8 rounded shrink-0"
              />
              <Input
                value={field.displayConfig?.textColor || '#6b7280'}
                onChange={(e) => handleUpdateDisplayConfig({ textColor: e.target.value })}
                className="text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t pt-4">
        <h5 className="text-sm font-semibold">Value Styling</h5>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Font Size</Label>
            <Input
              value={field.displayConfig?.valueFontSize || '1.125rem'}
              onChange={(e) => handleUpdateDisplayConfig({ valueFontSize: e.target.value })}
              placeholder="e.g., 18px, 1.2rem"
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={field.displayConfig?.valueColor || '#1f2937'}
                onChange={(e) => handleUpdateDisplayConfig({ valueColor: e.target.value })}
                className="w-8 h-8 rounded shrink-0"
              />
              <Input
                value={field.displayConfig?.valueColor || '#1f2937'}
                onChange={(e) => handleUpdateDisplayConfig({ valueColor: e.target.value })}
                className="text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t pt-4">
        <Label>Value Format</Label>
        <select
          value={field.displayConfig?.format || ''}
          onChange={(e) => handleUpdateDisplayConfig({ format: e.target.value })}
          className="w-full rounded border px-3 py-2 text-sm"
        >
          <option value="">Default</option>
          <option value="currency">Currency ($1,234.56)</option>
          <option value="percentage">Percentage (12.34%)</option>
          <option value="decimal">Decimal (1.23)</option>
          <option value="date">Date (January 1, 2024)</option>
        </select>
      </div>

      <div className="pt-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-variable-name"
            className="h-4 w-4"
            checked={field.displayConfig?.showVariableName || false}
            onChange={(e) => handleUpdateDisplayConfig({ showVariableName: e.target.checked })}
          />
          <Label htmlFor="show-variable-name" className="text-xs">
            Show variable name (metadata)
          </Label>
        </div>
      </div>


      {/* Preview */}
      {field.displayConfig?.variableId && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Preview</Label>
          <div className="border rounded p-3 bg-muted">
            <DisplayField field={field} variables={variables} />
          </div>
        </div>
      )}
    </div>
  );
}
