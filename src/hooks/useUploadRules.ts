import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { resolveUploadRules, type UploadRules } from '../lib/formPolicy';
import type { DmsSettings } from '../types';

/**
 * The form-level upload limits, made available to every upload control on the
 * page without threading a prop through each renderer.
 *
 * Field-level settings (this question accepts up to three PDFs) still live on
 * the field. These are the form-wide ceiling that applies on top: whatever a
 * single question asks for, nothing larger or of a different kind than the form
 * allows may be attached. The API applies the identical rules, so a file that
 * passes here is one the server will also accept.
 */
const UploadRulesContext = createContext<UploadRules>(resolveUploadRules(undefined));

export function UploadRulesProvider({
  dms,
  children,
}: {
  dms: DmsSettings | null | undefined;
  children: ReactNode;
}) {
  const rules = useMemo(() => resolveUploadRules(dms), [dms]);
  return createElement(UploadRulesContext.Provider, { value: rules }, children);
}

export function useUploadRules(): UploadRules {
  return useContext(UploadRulesContext);
}
