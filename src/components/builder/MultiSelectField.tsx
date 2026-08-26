import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { Trash2, Plus, X, FileSpreadsheet } from 'lucide-react';
import type { FormField } from '../../types';

interface MultiSelectFieldProps {
  field: FormField;
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  options?: { label: string; value: string }[];
}

export function MultiSelectField({
  field,
  value = [],
  onChange,
  placeholder = "Select options",
  disabled = false,
  hideLabel = false,
  options: optionsProp,
}: MultiSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const resolvedOptions = optionsProp ?? field.options ?? [];

  const selectedOptions = resolvedOptions.filter(option =>
    value.includes(option.value)
  );

  const availableOptions = resolvedOptions.filter(option =>
    !value.includes(option.value) &&
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectOption = (optionValue: string) => {
    const newValue = [...value, optionValue];
    onChange?.(newValue);
  };

  const handleRemoveOption = (optionValue: string) => {
    const newValue = value.filter(v => v !== optionValue);
    onChange?.(newValue);
  };

  const handleClearAll = () => {
    onChange?.([]);
  };

  return (
    <div className="space-y-2 relative">
      {!hideLabel && <Label>{field.label}</Label>}

      {/* Selected Options Display */}
      <div
        className="border rounded-md p-2 min-h-[40px] cursor-pointer"
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {selectedOptions.length === 0 ? (
          <div className="text-muted-foreground">
            {placeholder}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedOptions.map(option => (
              <div
                key={option.value}
                className="flex items-center gap-1 bg-brand-100 text-brand-800 px-2 py-1 rounded text-sm"
              >
                <span>{option.label}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveOption(option.value);
                    }}
                    className="hover:bg-brand-200 rounded p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(true);
                }}
                className="text-brand-600 hover:text-brand-800 text-sm font-medium"
              >
                Add more...
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <Card className="absolute top-full left-0 mt-1 z-50 w-full max-h-60 overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-2">
              {/* Search */}
              <div className="mb-2">
                <Input
                  placeholder="Search options..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Available Options */}
              <div className="space-y-1">
                {availableOptions.length === 0 ? (
                  <div className="text-muted-foreground text-sm p-2">
                    {searchTerm ? 'No options found' : 'All options selected'}
                  </div>
                ) : (
                  availableOptions.map(option => (
                    <div
                      key={option.value}
                      onClick={() => handleSelectOption(option.value)}
                      className="p-2 hover:bg-muted cursor-pointer rounded text-sm"
                    >
                      {option.label}
                    </div>
                  ))
                )}
              </div>

              {/* Actions */}
              {selectedOptions.length > 0 && (
                <div className="mt-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearAll}
                    className="w-full"
                  >
                    Clear All
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Help Text */}
      {field.helpText && (
        <p className="text-sm text-muted-foreground">{field.helpText}</p>
      )}

      {/* Required Indicator */}
      {field.required && (
        <span className="text-destructive text-xs">Required field</span>
      )}
    </div>
  );
}

// Configuration component for multi-select field in the form builder
export function MultiSelectConfig({ field, onUpdate, onBulkImport }: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onBulkImport?: () => void;
}) {
  const handleAddOption = () => {
    const newOption = { label: `Option ${field.options?.length || 0 + 1}`, value: `option_${Date.now()}` };
    const updatedOptions = [...(field.options || []), newOption];
    onUpdate({ options: updatedOptions });
  };

  const handleUpdateOption = (index: number, updates: { label?: string; value?: string }) => {
    const updatedOptions = [...(field.options || [])];
    updatedOptions[index] = { ...updatedOptions[index], ...updates };
    onUpdate({ options: updatedOptions });
  };

  const handleDeleteOption = (index: number) => {
    const updatedOptions = field.options?.filter((_, i) => i !== index) || [];
    onUpdate({ options: updatedOptions });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Options</Label>
          {onBulkImport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkImport}
              className="h-7 text-[10px] gap-1 px-2"
            >
              <FileSpreadsheet className="h-3 w-3" />
              Bulk Import (CSV)
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {field.options?.map((option, index) => (
            <div key={option.value} className="flex items-center gap-2">
              <Input
                value={option.label}
                onChange={(e) => handleUpdateOption(index, { label: e.target.value })}
                placeholder="Option label"
                className="flex-1"
              />
              <Input
                value={option.value}
                onChange={(e) => handleUpdateOption(index, { value: e.target.value })}
                placeholder="Option value"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteOption(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={handleAddOption}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Option
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Multi-Select Settings</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allow-clear-all"
              checked={field.validation?.allowClearAll || false}
              onChange={(e) => onUpdate({
                validation: {
                  ...field.validation,
                  allowClearAll: e.target.checked
                }
              })}
            />
            <Label htmlFor="allow-clear-all" className="text-sm">
              Allow "Clear All" option
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-count"
              checked={field.validation?.showCount || false}
              onChange={(e) => onUpdate({
                validation: {
                  ...field.validation,
                  showCount: e.target.checked
                }
              })}
            />
            <Label htmlFor="show-count" className="text-sm">
              Show selected count
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
