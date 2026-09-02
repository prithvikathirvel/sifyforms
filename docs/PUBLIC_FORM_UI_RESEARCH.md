# Public Form UI Research — Minimal Direction

**Reviewed:** 2 September 2026  
**Scope:** Respondent-facing form presentation, not builder UI

## Products/designs reviewed

The redesign was checked against more than the requested 25 distinct form experiences and established form patterns:

1. Typeform — focused/conversational progression
2. Tally — document-like minimalism
3. Fillout — clean modern multi-step forms
4. Paperform — editorial hierarchy and content-led forms
5. Jotform — dense, complex workflow forms
6. Google Forms — simple bordered reading surface
7. Microsoft Forms — restrained card and progress treatment
8. SurveyMonkey — survey legibility and answer rhythm
9. Cognito Forms — long forms and calculations
10. Zoho Forms — enterprise workflow forms
11. Formstack — regulated/enterprise forms
12. FormAssembly — data-heavy enterprise forms
13. forms.app — mobile-first forms
14. Heyflow — interactive multi-step flows
15. Formaloo — form/database flows
16. Formbricks — compact survey presentation
17. Airtable Forms — structured data entry
18. Notion Forms — quiet document aesthetics
19. HubSpot Forms — conversion-oriented embedded forms
20. Wufoo — conventional long-form layout
21. 123FormBuilder — configurable business forms
22. Feathery — complex multi-step application flows
23. involve.me — interactive funnel forms
24. Perspective — mobile-first lead flows
25. FormGrid — visual layouts and columns
26. AidaForm — conversational forms
27. Youform — focused one-question flows
28. WPForms — conventional website forms
29. GOV.UK question pages — accessibility-first labels/errors
30. Shopify form guidance — checkout and mobile form patterns

Research references included comparative reviews from Free Form Builders, Full Fabric, FormGrid, Jotform, Perspective, Zapier, and current form UX guidance from Shopify, GOV.UK patterns, and specialist UX publications.

## Repeated patterns in the strongest designs

- Neutral backgrounds and white reading surfaces dominate; brand color is used for actions, focus, and progress.
- Strong designs use either no shadow or an extremely restrained elevation. Borders and whitespace provide structure more reliably.
- Persistent top-aligned labels remain easier to scan than placeholder-only labels.
- Single-column is the safest default. Columns are reserved for strongly related, short values and collapse on mobile.
- Controls have neutral fill, visible 1px borders, 44–48 px height, and a clear focus state.
- Long forms use meaningful steps and retain answers when navigating backward.
- Help text is short, lower contrast, and placed immediately after the relevant control.
- Error messages appear beside the field and explain the correction; the page is not replaced by a generic failure state.
- One obvious primary action is used per step.
- Product attribution is quiet footer text/wordmark, not a badge competing with the author’s form.
- Decorative gradients, glass effects, oversized radii, floating cards, and repeated shadows age quickly and distract from completion.

## Direction selected for Sify Forms

Sify Forms should use a **flat enterprise-document** model:

- quiet theme-tinted page canvas;
- neutral form surface with one subtle border;
- no decorative shadows;
- 12 px card radius and 8 px control radius;
- wider but readable 768 px default content measure;
- 44 px controls;
- 13 px semibold labels with clear 12–14 px helper/error text;
- responsive columns that always collapse to one column on small screens;
- theme color restricted to CTA, focus, selected states, and progress;
- plain “Powered by” plus the grey Sify parent wordmark below all author content.

This direction deliberately avoids copying any single product. It combines Tally’s restraint, Fillout’s practical form density, Google/Microsoft Forms’ familiarity, and GOV.UK’s clarity for labels, errors, and responsive reading order.
