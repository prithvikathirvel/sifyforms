import { Input } from './input';
import CountrySelect from './CountrySelect';
import type { Country } from '../../lib/countries';

/**
 * A phone number input: a country-code picker joined to the number field, as
 * one control. Shared by the builder's preview and the published form so both
 * render it identically — same heights, same corners, one focus ring around
 * the pair instead of two mismatched ones.
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
    <div className="flex w-full rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
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
        className="rounded-l-none border-l-0 focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}
