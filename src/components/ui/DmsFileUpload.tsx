import React, { useState, useRef } from 'react';
import { Button } from './button';
import { Label } from './label';
import { Card } from './card';
import { Upload, X, File, Image, FileText, Download, Loader2, CheckCircle2 } from 'lucide-react';
import type { FormField, DmsFileReference } from '../../types';
import { uploadFilePublic, getDownloadUrl } from '../../lib/dms';

interface DmsFileUploadProps {
  field: FormField;
  value: DmsFileReference[] | null;
  onChange: (files: DmsFileReference[] | null) => void;
  formId: string;
  error?: string;
  disabled?: boolean;
  hideLabel?: boolean;
}

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  error?: string;
}

export default function DmsFileUpload({ field, value, onChange, formId, error, disabled, hideLabel = false }: DmsFileUploadProps) {
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileConfig = field.fileConfig || {};
  const accept = fileConfig.accept?.join(',') || '*/*';
  const maxSize = fileConfig.maxSize || 10; // MB
  const multiple = fileConfig.multiple || false;
  const maxFiles = fileConfig.maxFiles || 1;
  const currentFiles = value || [];

  const validateFile = (file: File): string | null => {
    if (fileConfig.minSize && file.size < fileConfig.minSize * 1024 * 1024) {
      return `File size must be at least ${fileConfig.minSize} MB`;
    }
    if (file.size > maxSize * 1024 * 1024) {
      return `File size exceeds ${maxSize} MB`;
    }
    if (fileConfig.accept && fileConfig.accept.length > 0) {
      const isAccepted = fileConfig.accept.some((acceptType: string) => {
        if (acceptType.startsWith('.')) return file.name.toLowerCase().endsWith(acceptType.toLowerCase());
        if (acceptType.endsWith('/*')) return file.type.startsWith(acceptType.replace('/*', '/'));
        return file.type === acceptType;
      });
      if (!isAccepted) return `File type not allowed. Accepted: ${fileConfig.accept.join(', ')}`;
    }
    return null;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    if (currentFiles.length + fileArray.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const validFiles: File[] = [];
    for (const file of fileArray) {
      const err = validateFile(file);
      if (err) {
        alert(`${file.name}: ${err}`);
      } else {
        validFiles.push(file);
      }
    }
    if (validFiles.length === 0) return;

    // Upload each file via DMS
    const newUploading: UploadingFile[] = validFiles.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      name: f.name,
      size: f.size,
      progress: 0,
    }));
    setUploading((prev) => [...prev, ...newUploading]);

    const results: DmsFileReference[] = [];
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const uploadState = newUploading[i];
      try {
        const ref = await uploadFilePublic(file, formId, field.id, (percent) => {
          setUploading((prev) =>
            prev.map((u) => (u.id === uploadState.id ? { ...u, progress: percent } : u)),
          );
        });
        results.push(ref);
        setUploading((prev) => prev.filter((u) => u.id !== uploadState.id));
      } catch (err: any) {
        setUploading((prev) =>
          prev.map((u) =>
            u.id === uploadState.id
              ? { ...u, error: err.response?.data?.error || err.message || 'Upload failed' }
              : u,
          ),
        );
      }
    }

    if (results.length > 0) {
      const updated = multiple ? [...currentFiles, ...results] : results;
      onChange(updated);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    const next = currentFiles.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : null);
  };

  const removeUploadingFile = (id: string) => {
    setUploading((prev) => prev.filter((u) => u.id !== id));
  };

  const handleDownload = async (ref: DmsFileReference) => {
    try {
      const url = await getDownloadUrl(ref.documentId);
      window.open(url, '_blank');
    } catch {
      alert('Failed to get download link.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
    return File;
  };

  const getAcceptedTypesText = () => {
    if (!fileConfig.accept || fileConfig.accept.length === 0) return 'All files';
    return fileConfig.accept.join(', ');
  };

  return (
    <div className="space-y-2">
      {!hideLabel && (
        <Label>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          className="hidden"
          disabled={disabled}
        />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-1">
          {multiple ? 'Drop files here or click to browse' : 'Drop file here or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground">
          {getAcceptedTypesText()} • Max size: {maxSize} MB
          {multiple && ` • Max ${maxFiles} files`}
        </p>
      </div>

      {/* Files in-progress */}
      {uploading.length > 0 && (
        <div className="space-y-2">
          {uploading.map((u) => (
            <Card key={u.id} className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                  {u.error ? <X className="h-5 w-5 text-destructive" /> : <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  {u.error ? (
                    <p className="text-xs text-destructive">{u.error}</p>
                  ) : (
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${u.progress}%` }} />
                    </div>
                  )}
                </div>
                {u.error && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeUploadingFile(u.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Uploaded DMS files */}
      {currentFiles.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            {currentFiles.length === 1 ? 'Uploaded file' : `Uploaded files (${currentFiles.length})`}
          </div>
          {currentFiles.map((ref, index) => {
            const FileIcon = getFileIcon(ref.mimeType);
            return (
              <Card key={ref.documentId} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ref.filename}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{formatFileSize(ref.size)}</p>
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-green-600">Uploaded</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleDownload(ref)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)} disabled={disabled}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {field.helpText && <p className="text-sm text-muted-foreground">{field.helpText}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
