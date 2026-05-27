@markdownai

## Implementation Phase

@define status(module)
Module **{{module}}** is currently being implemented.
@define-end

This is the core implementation phase.
Write the main logic and connect all components together.

@call status(module=engine) /
@call status(module=parser) /

Implementation checklist:
- Core directive parsing
- AST node execution
- Output rendering pipeline
