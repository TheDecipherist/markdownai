@markdownai v1.0

# Shared Macro Definitions (for @import tests)

@define sharedGreet(name)
Greetings from shared library, {{ name }}!
@end

@define sharedBadge(label)
<<{{ label }}>>
@end
