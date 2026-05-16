@markdownai

# Macros Demo

@define greet(name)
Hello, **{{name}}**! Welcome to MarkdownAI.
@end

@define describe(feature, detail)
### {{feature}}

{{detail}}
@end

## Macro Calls

@call greet(name=Claude)

@call describe(feature=Parser, detail=Converts markdown source to an AST node tree.)

@call describe(feature=Engine, detail=Walks the AST and executes each directive node.)
