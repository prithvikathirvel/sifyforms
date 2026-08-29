import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
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
  reorderSteps,
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
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold">Layout settings</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                Control how your form is structured and how respondents move through it.
              </DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 shrink-0 p-0" aria-label="Close layout settings">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
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
            onReorderStep={(oldIndex, newIndex) => dispatch(reorderSteps({ oldIndex, newIndex }))}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
