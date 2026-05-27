@markdownai

@define badge(label, value)
**{{ label }}:** {{ value }}
@define-end

@define section_header(title, subtitle)
## {{ title }}

_{{ subtitle }}_
@define-end

@define feature_status(name, status)
- **{{ name }}** — `{{ status }}`
@define-end
