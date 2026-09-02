import React, { useState, useRef } from 'react';
import { Upload, Check, AlertCircle, Loader2, Table, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import api from '../../lib/api';

interface CSVImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (options: { label: string; value: string }[]) => void;
}

export default function CSVImportModal({ open, onClose, onImport }: CSVImportModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: any[] } | null>(null);
  const [mapping, setMapping] = useState({ label: '', value: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please upload a valid CSV file');
      return;
    }

    setError(null);
    await parseFile(selectedFile);
  };

  const parseFile = async (fileToParse: File) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', fileToParse);

    try {
      const response = await api.post('/forms/parse-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setCsvData(response.data);
      if (response.data.headers.length > 0) {
        setMapping({
          label: response.data.headers[0],
          value: response.data.headers[1] || response.data.headers[0]
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to parse CSV file');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!csvData || !mapping.label || !mapping.value) return;

    const seenValues = new Set<string>();
    const options: { label: string; value: string }[] = [];
    for (const row of csvData.rows) {
      const label = String(row[mapping.label] ?? '').trim();
      const value = String(row[mapping.value] ?? '').trim();
      // Skip rows missing a label or value, and de-duplicate by value so option
      // values stay unique (empty/duplicate values previously broke React keys
      // and made assessment scoring ambiguous).
      if (!label || !value) continue;
      if (seenValues.has(value)) continue;
      seenValues.add(value);
      options.push({ label, value });
    }

    onImport(options);
    onClose();
    reset();
  };

  const reset = () => {
    setCsvData(null);
    setError(null);
    setMapping({ label: '', value: '' });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="flex h-[min(46rem,90dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.07] text-primary">
              <Table className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Bulk import options</h2>
              <p className="mt-0.5 text-xs font-medium leading-5 text-muted-foreground">Upload a CSV file and map its columns to option labels and values.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-muted/30 px-5 py-4">
          {!csvData ? (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-brand-400 hover:bg-brand-50 transition-all cursor-pointer bg-muted group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="p-4 bg-white rounded-full w-16 h-16 mx-auto mb-4 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="h-8 w-8 text-brand-600" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">CSV files only (max 5MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              {loading && (
                <div className="flex items-center justify-center gap-3 py-4 text-sm font-medium text-muted-foreground bg-white rounded-lg border border-border shadow-sm animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                  Processing your CSV file...
                </div>
              )}
              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-center gap-3 shadow-sm">
                  <div className="p-1.5 bg-red-100 rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <span className="font-medium">{error}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Label Column</Label>
                  <select
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all text-sm font-medium"
                    value={mapping.label}
                    onChange={(e) => setMapping(prev => ({ ...prev, label: e.target.value }))}
                  >
                    {csvData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Value Column</Label>
                  <select
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all text-sm font-medium"
                    value={mapping.value}
                    onChange={(e) => setMapping(prev => ({ ...prev, value: e.target.value }))}
                  >
                    {csvData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Table className="h-4 w-4 text-brand-500" />
                    Preview (First 5 rows)
                  </Label>
                  <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-[10px] font-bold">
                    {csvData.rows.length} Total Rows Found
                  </span>
                </div>
                <div className="overflow-hidden border border-border rounded-xl shadow-sm bg-white">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-muted border-b border-border">
                        <th className="p-3 font-bold text-muted-foreground">Label ({mapping.label})</th>
                        <th className="p-3 font-bold text-muted-foreground">Value ({mapping.value})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-50">
                      {csvData.rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="hover:bg-muted/50 transition-colors">
                          <td className="p-3 text-muted-foreground font-medium">{String(row[mapping.label] || '')}</td>
                          <td className="p-3 text-muted-foreground">{String(row[mapping.value] || '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-5 py-3.5">
          {csvData ? (
             <Button variant="ghost" onClick={reset} className="text-muted-foreground hover:text-brand-600 hover:bg-brand-50 font-medium">
              Upload different file
            </Button>
          ) : (
            <div></div> /* Spacer */
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="rounded-lg font-medium border-border">
              Cancel
            </Button>
            {csvData && (
              <Button onClick={handleImport} className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold shadow-lg shadow-brand-200">
                <Check className="h-4 w-4 mr-2" />
                Import {csvData.rows.length} Options
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
