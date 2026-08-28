import { Card } from './card';
import { Button } from './button';
import { Label } from './label';
import { Download, Eye, EyeOff, File, Image, FileText } from 'lucide-react';
import type { FormField } from '../../types';
import { getDownloadUrl, triggerBrowserDownload } from '../../lib/dms';

interface SubmissionData {
  [key: string]: any;
}

interface SubmissionViewerProps {
  fields: FormField[];
  data: SubmissionData;
  /** Keys the server masked for this viewer, from the submission payload. */
  redactedFields?: string[];
}

export default function SubmissionViewer({ fields, data, redactedFields }: SubmissionViewerProps) {
  const renderFieldValue = (field: FormField, value: any) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground italic">Not provided</span>;
    }

    const optionLabel = (optionValue: unknown) =>
      field.options?.find((option) => option.value === String(optionValue))?.label ?? String(optionValue);

    switch (field.type) {
      case 'checkbox':
        if (Array.isArray(value)) {
          return value.map(optionLabel).join(', ');
        }
        if (field.options?.length) return optionLabel(value);
        return value ? 'Yes' : 'No';

      case 'select':
      case 'radio':
        if (Array.isArray(value)) {
          return value.map(optionLabel).join(', ');
        }
        return optionLabel(value);

      case 'textarea':
        return (
          <div className="whitespace-pre-wrap text-sm bg-muted p-3 rounded">
            {value}
          </div>
        );

      case 'file':
        return renderFileValue(field, value);

      case 'rating':
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <div
                key={star}
                className={`w-5 h-5 ${
                  star <= value
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-muted-foreground'
                }`}
              >
                ★
              </div>
            ))}
          </div>
        );

      case 'date':
      case 'time':
        return value;

      case 'table': {
        const cfg = field.tableConfig;
        if (!cfg || !cfg.columns || cfg.columns.length === 0) {
          return <span className="text-muted-foreground italic text-sm">No columns configured</span>;
        }

        const tableValue = value as { rows?: Record<string, string | number>[] } | undefined;
        const rows = tableValue?.rows ?? [];

        if (rows.length === 0) {
          return <span className="text-muted-foreground italic text-sm">No rows</span>;
        }

        // Evaluate formula for calculated columns
        const evalFormula = (formula: string, row: Record<string, string | number>): number => {
          try {
            const colMap = new Map(cfg.columns.map((c) => [c.id, c]));
            const expr = formula.replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (match) => {
              const mathFuncs = new Set(['round','abs','min','max','floor','ceil','sqrt','yearsBetween','monthsBetween','daysBetween','ageInYears']);
              if (mathFuncs.has(match)) return match;
              const col = colMap.get(match);
              if (!col) return '0';
              const raw = row[match];
              if (col.type === 'date') return `'${String(raw ?? '')}'`;
              const v = Number(raw);
              return isNaN(v) ? '0' : String(v);
            });
            // eslint-disable-next-line no-new-func
            const fn = new Function('round','abs','min','max','floor','ceil','sqrt',
              'yearsBetween','monthsBetween','daysBetween','ageInYears',
              `return (${expr})`);
            const result = fn(
              (x: number, d = 0) => Math.round(x * 10**d) / 10**d,
              Math.abs, Math.min, Math.max, Math.floor, Math.ceil, Math.sqrt,
              (d1: string, d2: string) => { const a = new Date(d1), b = new Date(d2); if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0; let y = b.getFullYear()-a.getFullYear(); const m=b.getMonth()-a.getMonth(); if(m<0||(m===0&&b.getDate()<a.getDate()))y--; return y; },
              (d1: string, d2: string) => { const a = new Date(d1), b = new Date(d2); if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0; return (b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth()); },
              (d1: string, d2: string) => { const a = new Date(d1), b = new Date(d2); if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0; return Math.floor((b.getTime()-a.getTime())/86400000); },
              (dob: string) => { const a = new Date(dob), b = new Date(); if (isNaN(a.getTime())) return 0; let y=b.getFullYear()-a.getFullYear(); const m=b.getMonth()-a.getMonth(); if(m<0||(m===0&&b.getDate()<a.getDate()))y--; return y; },
            );
            return typeof result === 'number' && isFinite(result) ? result : 0;
          } catch { return 0; }
        };

        const formatNum = (v: number, col: { decimals?: number; prefix?: string; suffix?: string }) => {
          const num = col.decimals !== undefined ? v.toFixed(col.decimals) : String(v);
          return `${col.prefix ?? ''}${num}${col.suffix ?? ''}`;
        };

        // Grand total
        const grandTotalColId = cfg.grandTotalColumn;
        const grandTotalCol = grandTotalColId ? cfg.columns.find((c) => c.id === grandTotalColId) : undefined;
        const grandTotal = grandTotalCol
          ? rows.reduce((sum, row) => {
              const v = grandTotalCol.type === 'calculated'
                ? evalFormula(grandTotalCol.formula ?? '', row)
                : Number(row[grandTotalColId!]);
              return sum + (isNaN(v) ? 0 : v);
            }, 0)
          : null;

        return (
          <div className="overflow-x-auto rounded-md border border-input">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-input">
                  {cfg.columns.map((col) => (
                    <th
                      key={col.id}
                      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-input last:border-0">
                    {cfg.columns.map((col) => {
                      let display: string;
                      if (col.type === 'calculated') {
                        display = formatNum(evalFormula(col.formula ?? '', row), col);
                      } else if (col.type === 'number') {
                        const num = Number(row[col.id]);
                        display = formatNum(isNaN(num) ? 0 : num, col);
                      } else {
                        display = String(row[col.id] ?? '');
                      }
                      return (
                        <td key={col.id} className="px-3 py-2 text-xs">
                          {display || <span className="text-muted-foreground/50">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              {grandTotal !== null && grandTotalCol && (
                <tfoot>
                  <tr className="bg-muted/50 border-t border-input">
                    {cfg.columns.map((col, idx) => (
                      <td key={col.id} className="px-3 py-2 text-xs font-semibold">
                        {idx === 0
                          ? (cfg.grandTotalLabel || 'Grand Total')
                          : col.id === grandTotalColId
                          ? formatNum(grandTotal, grandTotalCol)
                          : ''}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        );
      }

      case 'signature': {
        if (value && typeof value === 'object' && 'documentId' in value) {
          return renderDmsFile(value as any, field.id);
        }
        if (typeof value === 'string' && value.startsWith('data:')) {
          return (
            <div className="border rounded-md p-2 bg-white inline-block">
              <img src={value} alt="Signature" className="max-h-[100px] object-contain" />
            </div>
          );
        }
        return <span className="text-muted-foreground italic text-sm">No signature</span>;
      }

      default:
        return <span className="text-sm">{typeof value === 'object' ? JSON.stringify(value) : value}</span>;
    }
  };

  const renderFileValue = (field: FormField, value: any) => {
    // Handle file data - could be base64, URL, or file info
    if (Array.isArray(value)) {
      return (
        <div className="space-y-2">
          {value.map((file, index) => renderSingleFile(file, `${field.id}_${index}`))}
        </div>
      );
    } else {
      return renderSingleFile(value, field.id);
    }
  };

  const renderSingleFile = (fileData: any, key: string) => {
    if (!fileData) {
      return null;
    }

    // DMS file reference: { documentId, filename, mimeType, size, status }
    if (typeof fileData === 'object' && fileData.documentId) {
      return renderDmsFile(fileData, key);
    }

    // Handle different file data formats
    let fileInfo: {
      name: string;
      size?: number;
      type?: string;
      url?: string;
      base64?: string;
    };

    if (typeof fileData === 'string') {
      // If it's a string, it could be a URL or base64
      if (fileData.startsWith('data:')) {
        // Base64 data
        const matches = fileData.match(/^data:(.+?);base64,(.+)$/);
        if (matches) {
          fileInfo = {
            name: `file_${key}`,
            type: matches[1],
            base64: fileData
          };
        } else {
          fileInfo = { name: fileData };
        }
      } else {
        // URL or filename
        fileInfo = { name: fileData, url: fileData };
      }
    } else if (typeof fileData === 'object') {
      // File object with metadata - NEW FORMAT
      if (fileData.base64 && fileData.name) {
        // New format: { name, size, type, base64 }
        fileInfo = {
          name: fileData.name,
          size: fileData.size,
          type: fileData.type,
          base64: fileData.base64
        };
      } else if (fileData.url || fileData.base64) {
        // Legacy format with url/base64 properties
        fileInfo = {
          name: fileData.name || `file_${key}`,
          size: fileData.size,
          type: fileData.type,
          url: fileData.url,
          base64: fileData.base64
        };
      } else {
        // Just a name or other object
        fileInfo = { name: fileData.name || `file_${key}` };
      }
    } else {
      fileInfo = { name: `file_${key}` };
    }

    const getFileIcon = () => {
      if (fileInfo.type?.startsWith('image/')) return Image;
      if (fileInfo.type?.includes('pdf') || fileInfo.type?.includes('document')) return FileText;
      return File;
    };

    const formatFileSize = (bytes?: number): string => {
      if (!bytes) return '';
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const FileIcon = getFileIcon();
    const isImage = fileInfo.type?.startsWith('image/');
    const fileUrl = fileInfo.url || fileInfo.base64;

    return (
      <Card key={key} className="p-3">
        <div className="flex items-center gap-3">
          {isImage && fileUrl ? (
            <div className="relative w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
              <img
                src={fileUrl}
                alt={fileInfo.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
              <FileIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileInfo.name}</p>
            {fileInfo.size && (
              <p className="text-xs text-muted-foreground">
                {formatFileSize(fileInfo.size)}
              </p>
            )}
          </div>

          <div className="flex gap-1 flex-shrink-0">
            {isImage && fileUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (fileInfo.base64) {
                    // For base64 images, open in new tab
                    const newWindow = window.open();
                    if (newWindow) {
                      newWindow.document.write(`<img src="${fileInfo.base64}" />`);
                    }
                  } else if (fileInfo.url) {
                    window.open(fileInfo.url, '_blank');
                  }
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => downloadFile(fileInfo)}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  const downloadFile = (fileInfo: {
    name: string;
    url?: string;
    base64?: string;
  }) => {
    try {
      // Method 1: Handle base64 data
      if (fileInfo.base64) {
        const matches = fileInfo.base64.match(/^data:(.+?);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = fileInfo.name;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          return;
        }
      }
      
      // Method 2: Handle URL files
      if (fileInfo.url) {
        // Check if it's a data URL disguised as a URL
        if (fileInfo.url.startsWith('data:')) {
          const matches = fileInfo.url.match(/^data:(.+?);base64,(.+)$/);
          if (matches) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = fileInfo.name;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            return;
          }
        }
        
        // Regular URL download
        const a = document.createElement('a');
        a.href = fileInfo.url;
        a.download = fileInfo.name;
        a.target = '_blank';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      
      // Method 3: Fallback - create a text file with file info
      const fallbackContent = `File: ${fileInfo.name}\n\nNo file data available for download.\n\nFile info:\n${JSON.stringify(fileInfo, null, 2)}`;
      const blob = new Blob([fallbackContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileInfo.name}_info.txt`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Download failed: ${errorMessage}. Please check the console for details.`);
    }
  };

  const renderDmsFile = (fileData: { documentId: string; filename: string; mimeType: string; size: number }, key: string) => {
    const getIcon = () => {
      if (fileData.mimeType?.startsWith('image/')) return Image;
      if (fileData.mimeType?.includes('pdf') || fileData.mimeType?.includes('document')) return FileText;
      return File;
    };
    const formatSize = (bytes: number) => {
      if (!bytes) return '';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    const FileIcon = getIcon();

    const handleDmsDownload = async () => {
      try {
        const url = await getDownloadUrl(fileData.documentId);
        await triggerBrowserDownload(url, fileData.filename || 'download');
      } catch {
        alert('Failed to get download link.');
      }
    };

    return (
      <Card key={key} className="p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDmsDownload}
            className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0 hover:bg-muted/80"
            title="Download file"
          >
            <FileIcon className="h-6 w-6 text-muted-foreground" />
          </button>
          <button type="button" onClick={handleDmsDownload} className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate hover:underline">{fileData.filename}</p>
            <p className="text-xs text-muted-foreground">{formatSize(fileData.size)}</p>
          </button>
          <Button type="button" variant="ghost" size="sm" onClick={handleDmsDownload} title="Download">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map((field) => {
        const value = data[field.id];
        const isRedacted = redactedFields?.includes(field.id) ?? false;
        const isWide = ['textarea', 'file', 'table', 'signature', 'html'].includes(field.type);
        if (isRedacted) {
          return (
            <div key={field.id} className={`rounded-xl border border-border/70 bg-ink-50/45 p-3.5 ${isWide ? 'md:col-span-2' : ''}`}>
              <p className="text-[10px] font-semibold text-muted-foreground">{field.label}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs italic text-muted-foreground">
                <EyeOff className="h-3.5 w-3.5" />
                Hidden — identifying field
              </p>
            </div>
          );
        }
        return (
          <div key={field.id} className={`min-w-0 rounded-xl border border-border/70 bg-ink-50/45 p-3.5 ${isWide ? 'md:col-span-2' : ''}`}>
            <Label className="text-[10px] font-semibold text-muted-foreground">
              {field.label}
              {field.required && <span className="ml-1 text-destructive">*</span>}
            </Label>
            <div className="mt-2 min-h-6 text-xs text-foreground">
              {renderFieldValue(field, value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
