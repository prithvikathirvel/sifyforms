import type { FormField } from '../../types';
import {
  Type, Mail, Phone, Hash, ChevronDown, Circle, CheckSquare, Calendar, Clock,
  AlignLeft, Upload, Star, PenTool, Code, Calculator, ListPlus, Table2,
} from 'lucide-react';

export const FIELD_ICONS: Record<string, React.ElementType> = {
  text: Type,
  email: Mail,
  phone: Phone,
  number: Hash,
  select: ChevronDown,
  radio: Circle,
  checkbox: CheckSquare,
  multiselect: ListPlus,
  date: Calendar,
  time: Clock,
  textarea: AlignLeft,
  file: Upload,
  rating: Star,
  signature: PenTool,
  html: Code,
  display: Calculator,
  table: Table2,
};

export function getFieldTypeLabel(type: FormField['type']): string {
  const labels: Record<string, string> = {
    text: 'Text Input', email: 'Email', phone: 'Phone', number: 'Number',
    select: 'Dropdown', radio: 'Radio Buttons', checkbox: 'Checkboxes',
    multiselect: 'Multi-Select', date: 'Date', time: 'Time', textarea: 'Long Text',
    file: 'File Upload', rating: 'Rating', signature: 'Signature', html: 'Custom HTML',
    display: 'Display Value', table: 'Table Grid',
  };
  return labels[type] || type;
}
