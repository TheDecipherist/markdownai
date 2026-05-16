@markdownai

@define badge(label, value)
**{{ label }}:** {{ value }}
@end

@define section_header(title, subtitle)
## {{ title }}

_{{ subtitle }}_
@end

@define feature_status(name, status)
- **{{ name }}** — `{{ status }}`
@end
