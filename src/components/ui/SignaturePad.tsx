import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from './button';
import { Label } from './label';
import { Trash2 } from 'lucide-react';
import type { FormField, DmsFileReference } from '../../types';

interface SignaturePadProps {
  field: FormField;
  value: DmsFileReference | string | null;
  onChange: (value: DmsFileReference | string | null) => void;
  formId?: string;
  dmsEnabled?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
}

export default function SignaturePad({
  field,
  value,
  onChange,
  disabled = false,
  hideLabel = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1a1a';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange(null);
  };

  const saveSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    // Capture locally only. DMS upload happens on final form submission.
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  }, [hasSignature, onChange]);

  const isConfirmed =
    (value && typeof value === 'object' && 'documentId' in value) ||
    (typeof value === 'string' && value.startsWith('data:'));

  return (
    <div className="space-y-2">
      {!hideLabel && (
        <Label>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {isConfirmed ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-green-50">
            <span className="text-sm font-medium text-green-700">Signature captured</span>
            <Button type="button" variant="ghost" size="sm" onClick={clearSignature} disabled={disabled}>
              <Trash2 className="h-4 w-4" />
              Re-sign
            </Button>
          </div>
          {typeof value === 'string' && value.startsWith('data:') && (
            <div className="border rounded-md p-2 bg-white inline-block">
              <img src={value} alt="Signature" className="max-h-[100px] object-contain" />
            </div>
          )}
        </div>
      ) : (
        <>
          <div className={`border-2 rounded-lg bg-white ${disabled ? 'opacity-50' : ''}`}>
            <canvas
              ref={canvasRef}
              width={500}
              height={200}
              className="w-full h-[150px] cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearSignature}
              disabled={disabled || !hasSignature}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={saveSignature}
              disabled={disabled || !hasSignature}
            >
              Confirm Signature
            </Button>
          </div>
        </>
      )}

      {field.helpText && <p className="text-sm text-muted-foreground">{field.helpText}</p>}
    </div>
  );
}
