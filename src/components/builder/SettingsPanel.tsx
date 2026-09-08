import { useAppSelector } from '../../hooks/useAppDispatch';
import FormSettingsContent from './FormSettingsContent';
import { usePersistentScroll } from '../../hooks/usePersistentState';

/**
 * The settings workspace shown in place of the editor canvas.
 *
 * One side nav, one content area: "Layout and steps" leads the sections, then
 * General, After submission, Access & Security and the rest — no top-level
 * tabs. Switching to the preview or back to the canvas unmounts this panel,
 * so the scroll offset is kept outside React, keyed per form, and returning
 * to settings lands exactly where the person left off.
 */
export default function SettingsPanel({ formId }: { formId?: string }) {
  useAppSelector((state) => state.builder);
  const scrollRef = usePersistentScroll<HTMLDivElement>(`sifyforms.builder.${formId ?? 'draft'}.settingsScroll`);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-background">
        <FormSettingsContent formId={formId} />
      </div>
    </div>
  );
}
