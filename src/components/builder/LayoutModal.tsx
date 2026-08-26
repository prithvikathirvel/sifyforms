import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { X } from 'lucide-react';
import LayoutConfigPanel from './LayoutConfigPanel';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import {
  setLayoutMode,
  updateLayout,
  addStep,
  removeStep,
  updateStep,
  assignFieldsToStep,
} from '../../store/builderSlice';

interface LayoutModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LayoutModal({ open, onClose }: LayoutModalProps) {
  const dispatch = useAppDispatch();
  const builder = useAppSelector((state) => state.builder);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] flex flex-col max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Layout Settings</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-6">
          <LayoutConfigPanel
            layout={builder.layout}
            fields={builder.schema.fields}
            onSetLayoutMode={(mode) => dispatch(setLayoutMode(mode))}
            onUpdateLayout={(updates) => dispatch(updateLayout(updates))}
            onAddStep={() => dispatch(addStep())}
            onRemoveStep={(id) => dispatch(removeStep(id))}
            onUpdateStep={(id, updates) => dispatch(updateStep({ id, updates }))}
            onAssignFieldsToStep={(stepId, fieldIds) =>
              dispatch(assignFieldsToStep({ stepId, fieldIds }))
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
