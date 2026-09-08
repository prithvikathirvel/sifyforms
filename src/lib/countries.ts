/**
 * Country calling codes, as one compact table.
 *
 * Stored as tuples (ISO code, name, dial code) so the list stays small; the
 * flag is derived from the ISO code as emoji at runtime, so no image assets
 * are shipped. One source serves the builder (pick a default / allowed
 * countries) and the public form (the respondent's country picker).
 */

export interface Country {
  iso2: string;
  name: string;
  dial: string;
}

const RAW: readonly (readonly [string, string, string])[] = [
  ['AF', 'Afghanistan', '93'], ['AL', 'Albania', '355'], ['DZ', 'Algeria', '213'],
  ['AD', 'Andorra', '376'], ['AO', 'Angola', '244'], ['AR', 'Argentina', '54'],
  ['AM', 'Armenia', '374'], ['AU', 'Australia', '61'], ['AT', 'Austria', '43'],
  ['AZ', 'Azerbaijan', '994'], ['BH', 'Bahrain', '973'], ['BD', 'Bangladesh', '880'],
  ['BB', 'Barbados', '1-246'], ['BY', 'Belarus', '375'], ['BE', 'Belgium', '32'],
  ['BZ', 'Belize', '501'], ['BJ', 'Benin', '229'], ['BT', 'Bhutan', '975'],
  ['BO', 'Bolivia', '591'], ['BA', 'Bosnia and Herzegovina', '387'], ['BW', 'Botswana', '267'],
  ['BR', 'Brazil', '55'], ['BN', 'Brunei', '673'], ['BG', 'Bulgaria', '359'],
  ['BF', 'Burkina Faso', '226'], ['KH', 'Cambodia', '855'], ['CM', 'Cameroon', '237'],
  ['CA', 'Canada', '1'], ['CV', 'Cape Verde', '238'], ['TD', 'Chad', '235'],
  ['CL', 'Chile', '56'], ['CN', 'China', '86'], ['CO', 'Colombia', '57'],
  ['CG', 'Congo', '242'], ['CR', 'Costa Rica', '506'], ['HR', 'Croatia', '385'],
  ['CU', 'Cuba', '53'], ['CY', 'Cyprus', '357'], ['CZ', 'Czechia', '420'],
  ['DK', 'Denmark', '45'], ['DO', 'Dominican Republic', '1-809'], ['EC', 'Ecuador', '593'],
  ['EG', 'Egypt', '20'], ['SV', 'El Salvador', '503'], ['EE', 'Estonia', '372'],
  ['ET', 'Ethiopia', '251'], ['FJ', 'Fiji', '679'], ['FI', 'Finland', '358'],
  ['FR', 'France', '33'], ['GA', 'Gabon', '241'], ['GM', 'Gambia', '220'],
  ['GE', 'Georgia', '995'], ['DE', 'Germany', '49'], ['GH', 'Ghana', '233'],
  ['GR', 'Greece', '30'], ['GL', 'Greenland', '299'], ['GT', 'Guatemala', '502'],
  ['GN', 'Guinea', '224'], ['GY', 'Guyana', '592'], ['HT', 'Haiti', '509'],
  ['HN', 'Honduras', '504'], ['HK', 'Hong Kong', '852'], ['HU', 'Hungary', '36'],
  ['IS', 'Iceland', '354'], ['IN', 'India', '91'], ['ID', 'Indonesia', '62'],
  ['IR', 'Iran', '98'], ['IQ', 'Iraq', '964'], ['IE', 'Ireland', '353'],
  ['IL', 'Israel', '972'], ['IT', 'Italy', '39'], ['CI', 'Ivory Coast', '225'],
  ['JM', 'Jamaica', '1-876'], ['JP', 'Japan', '81'], ['JO', 'Jordan', '962'],
  ['KZ', 'Kazakhstan', '7'], ['KE', 'Kenya', '254'], ['KW', 'Kuwait', '965'],
  ['KG', 'Kyrgyzstan', '996'], ['LA', 'Laos', '856'], ['LV', 'Latvia', '371'],
  ['LB', 'Lebanon', '961'], ['LY', 'Libya', '218'], ['LI', 'Liechtenstein', '423'],
  ['LT', 'Lithuania', '370'], ['LU', 'Luxembourg', '352'], ['MO', 'Macau', '853'],
  ['MG', 'Madagascar', '261'], ['MW', 'Malawi', '265'], ['MY', 'Malaysia', '60'],
  ['MV', 'Maldives', '960'], ['ML', 'Mali', '223'], ['MT', 'Malta', '356'],
  ['MR', 'Mauritania', '222'], ['MU', 'Mauritius', '230'], ['MX', 'Mexico', '52'],
  ['MD', 'Moldova', '373'], ['MC', 'Monaco', '377'], ['MN', 'Mongolia', '976'],
  ['ME', 'Montenegro', '382'], ['MA', 'Morocco', '212'], ['MZ', 'Mozambique', '258'],
  ['MM', 'Myanmar', '95'], ['NA', 'Namibia', '264'], ['NP', 'Nepal', '977'],
  ['NL', 'Netherlands', '31'], ['NZ', 'New Zealand', '64'], ['NI', 'Nicaragua', '505'],
  ['NE', 'Niger', '227'], ['NG', 'Nigeria', '234'], ['KP', 'North Korea', '850'],
  ['MK', 'North Macedonia', '389'], ['NO', 'Norway', '47'], ['OM', 'Oman', '968'],
  ['PK', 'Pakistan', '92'], ['PS', 'Palestine', '970'], ['PA', 'Panama', '507'],
  ['PG', 'Papua New Guinea', '675'], ['PY', 'Paraguay', '595'], ['PE', 'Peru', '51'],
  ['PH', 'Philippines', '63'], ['PL', 'Poland', '48'], ['PT', 'Portugal', '351'],
  ['QA', 'Qatar', '974'], ['RO', 'Romania', '40'], ['RU', 'Russia', '7'],
  ['RW', 'Rwanda', '250'], ['SA', 'Saudi Arabia', '966'], ['SN', 'Senegal', '221'],
  ['RS', 'Serbia', '381'], ['SG', 'Singapore', '65'], ['SK', 'Slovakia', '421'],
  ['SI', 'Slovenia', '386'], ['SO', 'Somalia', '252'], ['ZA', 'South Africa', '27'],
  ['KR', 'South Korea', '82'], ['SS', 'South Sudan', '211'], ['ES', 'Spain', '34'],
  ['LK', 'Sri Lanka', '94'], ['SD', 'Sudan', '249'], ['SR', 'Suriname', '597'],
  ['SE', 'Sweden', '46'], ['CH', 'Switzerland', '41'], ['SY', 'Syria', '963'],
  ['TW', 'Taiwan', '886'], ['TJ', 'Tajikistan', '992'], ['TZ', 'Tanzania', '255'],
  ['TH', 'Thailand', '66'], ['TG', 'Togo', '228'], ['TT', 'Trinidad and Tobago', '1-868'],
  ['TN', 'Tunisia', '216'], ['TR', 'Türkiye', '90'], ['TM', 'Turkmenistan', '993'],
  ['UG', 'Uganda', '256'], ['UA', 'Ukraine', '380'], ['AE', 'United Arab Emirates', '971'],
  ['GB', 'United Kingdom', '44'], ['US', 'United States', '1'], ['UY', 'Uruguay', '598'],
  ['UZ', 'Uzbekistan', '998'], ['VE', 'Venezuela', '58'], ['VN', 'Vietnam', '84'],
  ['YE', 'Yemen', '967'], ['ZM', 'Zambia', '260'], ['ZW', 'Zimbabwe', '263'],
];

export const COUNTRIES: Country[] = RAW.map(([iso2, name, dial]) => ({ iso2, name, dial }));

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso2, c]));

export function countryByIso(iso2: string | undefined | null): Country | undefined {
  return iso2 ? BY_ISO.get(iso2.toUpperCase()) : undefined;
}

/** The flag emoji for an ISO 3166-1 alpha-2 code. */
export function flagForIso(iso2: string): string {
  return String.fromCodePoint(
    ...iso2.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/** The display label, e.g. "🇮🇳 +91 India". */
export function countryLabel(c: Country): string {
  return `${flagForIso(c.iso2)} +${c.dial} ${c.name}`;
}

/**
 * The countries a phone field offers: the allowed list when one is set,
 * otherwise every country. The default country always makes the list.
 */
export function phoneCountries(config?: { defaultCountry?: string; allowedCountries?: string[] }): Country[] {
  const allowed = config?.allowedCountries?.length
    ? config.allowedCountries.map((iso) => countryByIso(iso)).filter((c): c is Country => !!c)
    : null;
  if (!allowed) return COUNTRIES;
  const def = countryByIso(config?.defaultCountry);
  if (def && !allowed.some((c) => c.iso2 === def.iso2)) return [def, ...allowed];
  return allowed;
}

/** Split a stored value like "+91 98765 43210" into its dial code and the rest. */
export function splitPhoneValue(value: string | undefined, fallbackDial: string): { dial: string; national: string } {
  const v = (value ?? '').trim();
  const match = v.match(/^\+(\d{1,4})[\s-]?(.*)$/);
  if (match) return { dial: match[1], national: match[2] };
  // No country code in the value yet — treat the whole thing as the national part.
  return { dial: fallbackDial, national: v };
}
