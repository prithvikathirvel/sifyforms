import { Input } from './input';
import CountrySelect from './CountrySelect';
import type { Country } from '../../lib/countries';

/**
 * A phone number input: a country-code picker joined to the number field, as
 * one control.
 *
 * The group itself owns the only border and the only focus ring; the two
 * pieces inside are borderless and separated by a hairline divider. Nothing
 * is rounded or bordered at the seam, so it cannot render as two stacked
 * inputs — it is one 40px-high control by construction. Shared by the
 * builder's preview and the published form so both render it identically.
 */
export default function PhoneControl({
  countries,
  iso2,
  national,
  placeholder,
  disabled,
  onCountryChange,
  onNationalChange,
  onBlur,
}: {
  countries: Country[];
  iso2: string | undefined;
  national: string;
  placeholder?: string;
  disabled?: boolean;
  onCountryChange: (iso2: string) => void;
  onNationalChange: (national: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div
      className={[
        'flex h-10 w-full items-stretch overflow-hidden rounded-md border border-input bg-background',
        'transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        disabled ? 'opacity-50' : '',
      ].join(' ')}
    >
      <CountrySelect
        variant="inline"
        joined
        countries={countries}
        value={iso2}
        disabled={disabled}
        onChange={(next) => next && onCountryChange(next)}
      />
      <Input
        type="tel"
        inputMode="tel"
        value={national}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onNationalChange(e.target.value)}
        onBlur={onBlur}
        className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}
