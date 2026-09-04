import React, { useState, useRef } from 'react';
import { Button } from './button';
import { Label } from './label';
import { Card } from './card';
import { Upload, X, File, Image, FileText, Download, Eye } from 'lucide-react';
import { toast } from './toast';
import type { FormField } from '../../types';
import { useUploadRules } from '../../hooks/useUploadRules';
import { acceptAttribute, describeAllowedTypes, describeUploadRejection } from '../../lib/formPolicy';

interface FileUploadProps {
  field: FormField;
  value: FileList | File[] | null;
  onChange: (files: FileList | File[] | null) => void;
  error?: string;
  disabled?: boolean;
  hideLabel?: boolean; // Add option to hide label when rendered by parent
}

interface FilePreview {
  file: File;
  id: string;
  url: string;
}

export default function FileUpload({ field, value, onChange, error, disabled, hideLabel = false }: FileUploadProps) {
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form-wide upload rules, matching what the API enforces.
  const uploadRules = useUploadRules();

  const fileConfig = field.fileConfig || {};
  // The question's own list wins for the picker because it is the narrower,
  // more specific one; the form's list is still applied on validation.
  const accept = fileConfig.accept?.length
    ? fileConfig.accept.join(',')
    : acceptAttribute(uploadRules.allowedMimeTypes) ?? '*/*';
  const minSize = fileConfig.minSize || 0;
  const formLimitBytes = uploadRules.maxFileSizeMb * 1024 * 1024;
  const maxSize = Math.min(fileConfig.maxSize || formLimitBytes, formLimitBytes);
  const multiple = fileConfig.multiple || false;
  const maxFiles = fileConfig.maxFiles || 1;

  // Generate preview URLs for files
  React.useEffect(() => {
    const newPreviews: FilePreview[] = [];
    
    const files = value instanceof FileList ? Array.from(value) : (value as File[]) || [];
    
    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        newPreviews.push({
          file,
          id: `${file.name}-${file.size}-${file.lastModified}`,
          url,
        });
      } else {
        newPreviews.push({
          file,
          id: `${file.name}-${file.size}-${file.lastModified}`,
          url: '', // No preview for non-image files
        });
      }
    });

    // Cleanup old URLs
    previews.forEach((preview) => {
      if (preview.url && !newPreviews.find((p) => p.id === preview.id)) {
        URL.revokeObjectURL(preview.url);
      }
    });

    setPreviews(newPreviews);
  }, [value]);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size < minSize) {
      return `File size must be at least ${formatFileSize(minSize)}`;
    }
    if (file.size > maxSize) {
      return `File size exceeds ${formatFileSize(maxSize)}`;
    }

    // Check file type
    if (fileConfig.accept && fileConfig.accept.length > 0) {
      const isAccepted = fileConfig.accept.some((acceptType) => {
        if (acceptType.startsWith('.')) {
          return file.name.toLowerCase().endsWith(acceptType.toLowerCase());
        }
        if (acceptType.includes('*')) {
          const mimePattern = acceptType.replace('*', '');
          return file.type.startsWith(mimePattern);
        }
        return file.type === acceptType;
      });

      if (!isAccepted) {
        return `File type ${file.type} is not allowed. Accepted types: ${fileConfig.accept.join(', ')}`;
      }
    }

    // The form's own rules, worded exactly as the API words them.
    const rejection = describeUploadRejection(
      { name: file.name, size: file.size, type: file.type },
      uploadRules,
    );
    if (rejection) return rejection;

    return null;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Check max files limit
    const currentFiles = value instanceof FileList ? Array.from(value) : (value as File[]) || [];
    if (currentFiles.length + fileArray.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate each file
    fileArray.forEach((file) => {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      toast.error({ title: 'Some files could not be added', description: errors.join('\n') });
      return;
    }

    if (multiple) {
      const newFiles = [...currentFiles, ...validFiles];
      onChange(newFiles);
    } else {
      onChange(validFiles);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (index: number) => {
    const currentFiles = value instanceof FileList ? Array.from(value) : (value as File[]) || [];
    const newFiles = currentFiles.filter((_, i) => i !== index);
    
    if (multiple) {
      onChange(newFiles.length > 0 ? newFiles : null);
    } else {
      onChange(null);
    }
  };

  const downloadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image;
    if (file.type.includes('pdf') || file.type.includes('document')) return FileText;
    return File;
  };

  const getAcceptedTypesText = () => {
    if (fileConfig.accept && fileConfig.accept.length > 0) return fileConfig.accept.join(', ');
    return describeAllowedTypes(uploadRules.allowedMimeTypes);
  };

  return (
    <div className="space-y-2">
      {!hideLabel && (
        <Label>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
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
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
        
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-1">
          {multiple ? 'Drop files here or click to browse' : 'Drop file here or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground">
          {getAcceptedTypesText()}
          {minSize > 0 && <> • Min size: {formatFileSize(minSize)}</>}
          • Max size: {formatFileSize(maxSize)}
          {multiple && ` • Max ${maxFiles} files`}
        </p>
      </div>

      {/* File Previews */}
      {previews.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            {previews.length === 1 ? 'Uploaded file' : `Uploaded files (${previews.length})`}
          </div>
          <div className="space-y-2">
            {previews.map((preview, index) => {
              const FileIcon = getFileIcon(preview.file);
              return (
                <Card key={preview.id} className="p-3">
                  <div className="flex items-center gap-3">
                    {preview.url ? (
                      <div className="relative w-12 h-12 rounded overflow-hidden bg-muted">
                        <img
                          src={preview.url}
                          alt={preview.file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                        <FileIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{preview.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(preview.file.size)}
                      </p>
                    </div>
                    
                    <div className="flex gap-1">
                      {preview.url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(preview.url, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadFile(preview.file)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={disabled}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Help text is printed by the field wrapper that owns the label. When
          that wrapper hides this component's label it renders both, so
          repeating it here produced the duplicate line under the control. */}
      {!hideLabel && field.helpText && (
        <p className="text-sm text-muted-foreground">{field.helpText}</p>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
