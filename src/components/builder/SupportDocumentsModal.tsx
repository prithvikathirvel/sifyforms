import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Trash2, Plus, X, FileText, ExternalLink, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import type { FormField } from '../../types';
import { uploadFileAuthenticated } from '../../lib/dms';

interface SupportDocument {
    id: string;
    label: string;
    mode: 'link' | 'upload' | 'dms';
    url?: string;
    fileName?: string;
    fileType?: string;
    fileData?: string;
    documentId?: string;
    pendingFile?: File;
}

const isValidUrl = (value: string): boolean => {
    if (!value) return false;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
};

interface SupportDocumentsModalProps {
    field: FormField;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (updates: Partial<FormField>) => void;
    orgId?: string;
    formId?: string;
    dmsEnabled?: boolean;
}

export function SupportDocumentsModal({
    field,
    isOpen,
    onClose,
    onUpdate,
    orgId,
    formId,
    dmsEnabled = false,
}: SupportDocumentsModalProps) {
    const [localDocuments, setLocalDocuments] = useState<SupportDocument[]>([]);
    const [saving, setSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setLocalDocuments((field.supportDocuments || []).map(doc => ({
                ...doc,
                mode: doc.mode || (doc.documentId ? 'dms' : doc.fileData ? 'upload' : 'link') as 'link' | 'upload' | 'dms'
            })));
            setSaving(false);
            setSaveProgress(0);
            setUploadError(null);
            setSaveError(null);
        }
    }, [isOpen, field.supportDocuments]);

    const handleFileUpload = (index: number, file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            updateDocument(index, {
                fileName: file.name,
                fileType: file.type,
                fileData: base64,
                url: '',
            });
        };
        reader.readAsDataURL(file);
    };

    const handleDmsFileSelect = (index: number, file: File) => {
        setUploadError(null);
        updateDocument(index, {
            fileName: file.name,
            fileType: file.type,
            pendingFile: file,
            fileData: undefined,
            url: undefined,
        });
    };

    if (!isOpen) return null;

    const persistableDoc = (doc: SupportDocument) => {
        const { pendingFile: _pending, ...rest } = doc;
        return rest;
    };

    const handleSave = async () => {
        const missingLabel = localDocuments.some((doc) => !doc.label.trim());
        if (missingLabel) {
            setSaveError('Display Label is required for all documents.');
            return;
        }

        const invalidUrl = localDocuments.some((doc) => doc.mode === 'link' && doc.url && !isValidUrl(doc.url));
        if (invalidUrl) {
            setSaveError('One or more URLs are invalid. Use a full http(s) link.');
            return;
        }

        setSaveError(null);

        const pending = localDocuments.filter((doc) => doc.mode === 'dms' && doc.pendingFile);
        if (pending.length > 0) {
            if (!orgId || !formId) {
                setUploadError('Organization or form context is missing. Save the form first, then attach DMS documents.');
                return;
            }
            setSaving(true);
            setSaveProgress(0);
            setUploadError(null);
            try {
                const uploaded: SupportDocument[] = [];
                for (let i = 0; i < localDocuments.length; i++) {
                    const doc = localDocuments[i];
                    if (doc.mode === 'dms' && doc.pendingFile) {
                        const ref = await uploadFileAuthenticated(
                            doc.pendingFile,
                            'support-doc',
                            orgId,
                            formId,
                            (pct) => {
                                const base = (i / localDocuments.length) * 100;
                                setSaveProgress(Math.round(base + pct / localDocuments.length));
                            },
                        );
                        uploaded.push({
                            ...persistableDoc(doc),
                            documentId: ref.documentId,
                            fileName: ref.filename,
                            fileType: ref.mimeType,
                            fileData: undefined,
                            url: undefined,
                            mode: 'dms',
                        });
                    } else {
                        uploaded.push(persistableDoc(doc));
                    }
                }
                onUpdate({ supportDocuments: uploaded });
                onClose();
            } catch (err: any) {
                setUploadError(err.response?.data?.error || err.message || 'Upload failed');
            } finally {
                setSaving(false);
                setSaveProgress(0);
            }
            return;
        }

        onUpdate({ supportDocuments: localDocuments.map(persistableDoc) });
        onClose();
    };

    const addDocument = () => {
        const newDoc: SupportDocument = {
            id: `doc_${Date.now()}`,
            label: '',
            mode: 'link',
            url: ''
        };
        setLocalDocuments([...localDocuments, newDoc]);
    };

    const removeDocument = (index: number) => {
        setLocalDocuments(localDocuments.filter((_, i) => i !== index));
    };

    const updateDocument = (index: number, updates: Partial<SupportDocument>) => {
        const updated = [...localDocuments];
        updated[index] = { ...updated[index], ...updates };
        setLocalDocuments(updated);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <Card className="flex h-[min(46rem,90dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.07] text-primary">
                            <FileText className="h-4 w-4" strokeWidth={1.9} />
                        </span>
                        <div>
                            <CardTitle className="font-display text-base font-bold text-foreground">Support documents</CardTitle>
                            <p className="mt-0.5 text-xs font-medium leading-5 text-muted-foreground">Add reference documents or links for the respondent to review.</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" disabled={saving}>
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>

                <CardContent className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-muted/30 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Configured Documents</Label>
                        <Button variant="outline" size="sm" onClick={addDocument} className="bg-plum-50 text-plum-700 border-plum-200 hover:bg-plum-100" disabled={saving}>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add Document
                        </Button>
                    </div>

                    {localDocuments.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-muted">
                            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">No documents configured</p>
                            <p className="text-xs text-muted-foreground mb-4">Add a link or upload a file to give candidates extra context for this field.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {localDocuments.map((doc, index) => (
                                <div key={doc.id} className="p-4 bg-muted/20 border border-border rounded-lg shadow-md">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <Label className="text-xs font-semibold text-muted-foreground block mb-2">
                                                Display Label <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                value={doc.label}
                                                onChange={(e) => updateDocument(index, { label: e.target.value })}
                                                placeholder="e.g. Guidelines"
                                                className={`h-9 text-sm font-medium ${!doc.label.trim() ? 'border-red-400' : ''}`}
                                                disabled={saving}
                                            />
                                            {!doc.label.trim() && (
                                                <p className="text-xs text-red-500 mt-1">Display label is required</p>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeDocument(index)}
                                            className="ml-2 h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full"
                                            disabled={saving}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <Label className="text-xs font-semibold text-muted-foreground block mb-2">Content Type</Label>
                                            <select
                                                value={doc.mode}
                                                disabled={saving}
                                                onChange={(e) => {
                                                    const mode = e.target.value as 'link' | 'upload' | 'dms';
                                                    if (mode === 'link') {
                                                        updateDocument(index, { mode: 'link', fileData: undefined, fileName: undefined, fileType: undefined, documentId: undefined, pendingFile: undefined, url: '' });
                                                    } else if (mode === 'upload') {
                                                        updateDocument(index, { mode: 'upload', url: '', documentId: undefined, pendingFile: undefined, fileData: undefined, fileName: undefined });
                                                    } else {
                                                        updateDocument(index, { mode: 'dms', url: '', fileData: undefined, documentId: undefined, pendingFile: undefined, fileName: undefined });
                                                    }
                                                }}
                                                className="w-full h-9 rounded border border-border px-3 text-sm bg-white font-medium"
                                            >
                                                <option value="link">External URL</option>
                                                <option value="upload">Upload File (Inline)</option>
                                                {dmsEnabled && <option value="dms">Upload File (DMS)</option>}
                                            </select>
                                        </div>

                                        {doc.mode === 'dms' ? (
                                            <div className="space-y-2 bg-white p-3 rounded border border-dashed border-border">
                                                {(doc.documentId || doc.pendingFile || doc.fileName) && (
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle2 className={`h-4 w-4 ${doc.pendingFile ? 'text-amber-500' : 'text-green-500'}`} />
                                                        <span className="text-sm font-semibold text-muted-foreground">{doc.fileName || 'Selected file'}</span>
                                                        <span className={`text-xs ${doc.pendingFile ? 'text-amber-700' : 'text-green-600'}`}>
                                                            {doc.pendingFile ? '(uploads when you save)' : '(stored in DMS)'}
                                                        </span>
                                                    </div>
                                                )}
                                                <label className="block">
                                                    <div className="px-3 py-2 bg-plum-50 hover:bg-plum-100 border border-plum-200 rounded cursor-pointer text-center text-sm font-semibold text-plum-700 transition-colors flex items-center justify-center gap-2">
                                                        <Upload className="h-4 w-4" />
                                                        {doc.documentId || doc.pendingFile ? 'Replace File' : 'Choose File'}
                                                    </div>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        disabled={saving}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleDmsFileSelect(index, file);
                                                            e.target.value = '';
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        ) : doc.mode === 'upload' ? (
                                            <div className="space-y-2 bg-white p-3 rounded border border-dashed border-border">
                                                {doc.fileData && (
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm font-semibold text-muted-foreground">{doc.fileName || 'untitled'}</span>
                                                        <span className="text-xs text-muted-foreground">({doc.fileType})</span>
                                                    </div>
                                                )}
                                                <label className="block">
                                                    <div className="px-3 py-2 bg-plum-50 hover:bg-plum-100 border border-plum-200 rounded cursor-pointer text-center text-sm font-semibold text-plum-700 transition-colors">
                                                        {doc.fileData ? 'Replace File' : 'Choose File'}
                                                    </div>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        disabled={saving}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleFileUpload(index, file);
                                                        }}
                                                    />
                                                </label>
                                            </div>
                        ) : (
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground block mb-2">URL</Label>
                                <Input
                                    value={doc.url || ''}
                                    onChange={(e) => updateDocument(index, { url: e.target.value })}
                                    placeholder="https://example.com/document.pdf"
                                    className={`h-9 text-sm ${doc.url && !isValidUrl(doc.url) ? 'border-red-400 focus:border-red-500' : ''}`}
                                    disabled={saving}
                                />
                                {doc.url && !isValidUrl(doc.url) && (
                                    <p className="text-xs text-red-600 font-medium mt-1">Enter a valid http(s) URL.</p>
                                )}
                                                {doc.url && (
                                                    <a
                                                        href={doc.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 mt-2 text-xs text-plum-600 hover:text-plum-800 font-medium"
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                        Preview
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {uploadError && (
                        <p className="text-sm text-destructive">{uploadError}</p>
                    )}
                </CardContent>

                <CardFooter className="flex shrink-0 flex-col gap-3 border-t border-border/70 bg-muted/20 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    {saveError ? (
                        <p className="text-xs text-red-600 font-medium">{saveError}</p>
                    ) : (
                        <span className="text-xs text-muted-foreground">Documents are shown to the candidate next to this field.</span>
                    )}
                    <div className="flex shrink-0 gap-2">
                        <Button variant="outline" onClick={onClose} disabled={saving} className="h-9 rounded-lg px-3.5">Cancel</Button>
                        <Button onClick={handleSave} disabled={saving} className="h-9 rounded-lg px-4">
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Uploading{saveProgress ? ` ${saveProgress}%` : ''}...
                            </>
                        ) : (
                            'Save Documents'
                        )}
                    </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
