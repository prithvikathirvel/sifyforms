import React, { useState, useRef } from 'react';
import { Button } from './button';
import { Label } from './label';
import { Card } from './card';
import { Upload, X, File, Image, FileText, Download, CheckCircle2 } from 'lucide-react';
import type { FormField, FormFileValue } from '../../types';
import {
  getDownloadUrl,
  getPublicDownloadUrl,
  createPendingLocalFile,
  isPendingLocalFile,
  isDmsFileReference,
  downloadLocalFile,
  triggerBrowserDownload,
  resolveMaxSizeBytes,
} from '../../lib/dms';

interface DmsFileUploadProps {
  field: FormField;
  value: FormFileValue[] | null;
  onChange: (files: FormFileValue[] | null) => void;
  formId: string;
  error?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  /** When true (default), files stay local until final form submission. */
  deferUpload?: boolean;
  /** Public form respondents must use the public download endpoint. */
  publicDownload?: boolean;
}

export default function DmsFileUpload({
  field,
  value,
  onChange,
  formId,
  error,
  disabled,
  hideLabel = false,
  deferUpload = true,
  publicDownload = false,
}: DmsFileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileConfig = field.fileConfig || {};
  const accept = fileConfig.accept?.join(',') || '*/*';
  const maxSizeBytes = resolveMaxSizeBytes(fileConfig.maxSize) || 10 * 1024 * 1024;
  const minSizeBytes = fileConfig.minSize
    ? (fileConfig.minSize > 1024 ? fileConfig.minSize : fileConfig.minSize * 1024 * 1024)
    : 0;
  const multiple = fileConfig.multiple || false;
  const maxFiles = fileConfig.maxFiles || 1;
  const currentFiles = value || [];
  const maxSizeMb = Math.max(1, Math.round(maxSizeBytes / (1024 * 1024)));

  const validateFile = (file: File): string | null => {
    if (minSizeBytes && file.size < minSizeBytes) {
      return `File size must be at least ${(minSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${maxSizeMb} MB`;
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

  const handleFiles = (files: FileList | null) => {
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

    const pending = validFiles.map(createPendingLocalFile);
    const updated = multiple ? [...currentFiles, ...pending] : pending;
    onChange(updated);
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

  const handleDownload = async (ref: FormFileValue) => {
    try {
      if (isPendingLocalFile(ref)) {
        downloadLocalFile(ref.file);
        return;
      }
      if (!isDmsFileReference(ref)) return;
      const url = publicDownload
        ? await getPublicDownloadUrl(ref.documentId, formId)
        : await getDownloadUrl(ref.documentId);
      await triggerBrowserDownload(url, ref.filename);
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
    if (mimeType?.startsWith('image/')) return Image;
    if (mimeType?.includes('pdf') || mimeType?.includes('document')) return FileText;
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
          {getAcceptedTypesText()} • Max size: {maxSizeMb} MB
          {multiple && ` • Max ${maxFiles} files`}
        </p>
      </div>

      {currentFiles.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            {currentFiles.length === 1 ? 'Selected file' : `Selected files (${currentFiles.length})`}
          </div>
          {currentFiles.map((ref, index) => {
            const mime = isPendingLocalFile(ref) ? ref.mimeType : ref.mimeType;
            const name = isPendingLocalFile(ref) ? ref.filename : ref.filename;
            const size = isPendingLocalFile(ref) ? ref.size : ref.size;
            const pending = isPendingLocalFile(ref);
            const FileIcon = getFileIcon(mime);
            return (
              <Card key={pending ? ref.pendingId : ref.documentId} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{formatFileSize(size)}</p>
                      <CheckCircle2 className={`h-3 w-3 ${pending ? 'text-amber-500' : 'text-green-500'}`} />
                      <span className={`text-xs ${pending ? 'text-amber-700' : 'text-green-600'}`}>
                        {pending ? (deferUpload ? 'Ready — uploads on submit' : 'Ready') : 'Uploaded'}
                      </span>
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
