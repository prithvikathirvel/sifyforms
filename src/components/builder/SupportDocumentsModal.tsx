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
}

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
    const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setLocalDocuments((field.supportDocuments || []).map(doc => ({
                ...doc,
                mode: doc.mode || (doc.documentId ? 'dms' : doc.fileData ? 'upload' : 'link') as 'link' | 'upload' | 'dms'
            })));
            setUploadingIndex(null);
            setUploadProgress(0);
            setUploadError(null);
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

    const handleDmsUpload = async (index: number, file: File) => {
        if (!orgId || !formId) {
            setUploadError('Organization or form context is missing.');
            return;
        }
        setUploadingIndex(index);
        setUploadProgress(0);
        setUploadError(null);
        try {
            const ref = await uploadFileAuthenticated(file, 'support-doc', orgId, formId, (pct) => {
                setUploadProgress(pct);
            });
            updateDocument(index, {
                documentId: ref.documentId,
                fileName: ref.filename,
                fileType: ref.mimeType,
                fileData: undefined,
                url: undefined,
            });
        } catch (err: any) {
            setUploadError(err.response?.data?.error || err.message || 'Upload failed');
        } finally {
            setUploadingIndex(null);
            setUploadProgress(0);
        }
    };

    if (!isOpen) return null;

    const handleSave = () => {
        const missingLabel = localDocuments.some((doc) => !doc.label.trim());
        if (missingLabel) {
            alert('Display Label is required for all documents.');
            return;
        }
        onUpdate({ supportDocuments: localDocuments });
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                            <FileText className="h-5 w-5 text-plum-500" />
                            Support Documents
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">Add reference documents or links for the candidate to review.</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                        <X className="h-5 w-5" />
                    </Button>
                </CardHeader>

                <CardContent className="flex-1 p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Configured Documents</Label>
                        <Button variant="outline" size="sm" onClick={addDocument} className="bg-plum-50 text-plum-700 border-plum-200 hover:bg-plum-100">
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add Document
                        </Button>
                    </div>

                    {localDocuments.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-muted">
                            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">No documents configured</p>
                            <p className="text-xs text-muted-foreground mb-4">Add PDF links or resource URLs to help candidates fill this field.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {localDocuments.map((doc, index) => (
                                <div key={doc.id} className="p-4 bg-gradient-to-br from-ink-50 to-ink-100 border border-border rounded-lg shadow-md">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <Label className="text-[11px] font-bold uppercase text-muted-foreground block mb-2">
                                                Display Label <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                value={doc.label}
                                                onChange={(e) => updateDocument(index, { label: e.target.value })}
                                                placeholder="e.g. Guidelines"
                                                className={`h-9 text-sm font-medium ${!doc.label.trim() ? 'border-red-400' : ''}`}
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
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <Label className="text-[11px] font-bold uppercase text-muted-foreground block mb-2">Content Type</Label>
                                            <select
                                                value={doc.mode}
                                                onChange={(e) => {
                                                    const mode = e.target.value as 'link' | 'upload' | 'dms';
                                                    if (mode === 'link') {
                                                        updateDocument(index, { mode: 'link', fileData: undefined, fileName: undefined, fileType: undefined, documentId: undefined, url: '' });
                                                    } else if (mode === 'upload') {
                                                        updateDocument(index, { mode: 'upload', url: '', documentId: undefined, fileData: undefined, fileName: undefined });
                                                    } else {
                                                        updateDocument(index, { mode: 'dms', url: '', fileData: undefined, documentId: undefined, fileName: undefined });
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
                                                {doc.documentId && (
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                        <span className="text-sm font-semibold text-muted-foreground">{doc.fileName || 'Uploaded'}</span>
                                                        <span className="text-xs text-green-600">(stored in DMS)</span>
                                                    </div>
                                                )}
                                                {uploadingIndex === index ? (
                                                    <div className="flex items-center gap-2">
                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                        <div className="flex-1">
                                                            <div className="w-full bg-muted rounded-full h-1.5">
                                                                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                                                            </div>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
                                                    </div>
                                                ) : (
                                                    <label className="block">
                                                        <div className="px-3 py-2 bg-plum-50 hover:bg-plum-100 border border-plum-200 rounded cursor-pointer text-center text-sm font-semibold text-plum-700 transition-colors flex items-center justify-center gap-2">
                                                            <Upload className="h-4 w-4" />
                                                            {doc.documentId ? 'Replace File' : 'Upload to DMS'}
                                                        </div>
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) handleDmsUpload(index, file);
                                                                e.target.value = '';
                                                            }}
                                                        />
                                                    </label>
                                                )}
                                                {uploadError && uploadingIndex === null && (
                                                    <p className="text-xs text-destructive">{uploadError}</p>
                                                )}
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
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleFileUpload(index, file);
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        ) : (
                                            <div>
                                                <Label className="text-[11px] font-bold uppercase text-muted-foreground block mb-2">URL</Label>
                                                <Input
                                                    value={doc.url || ''}
                                                    onChange={(e) => updateDocument(index, { url: e.target.value })}
                                                    placeholder="https://example.com/document.pdf"
                                                    className="h-9 text-sm"
                                                />
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
                </CardContent>

                <CardFooter className="flex justify-between border-t py-4 bg-muted">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} className="bg-brand-600 hover:bg-brand-700 text-white shadow-md">
                        Save Documents
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
