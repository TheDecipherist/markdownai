@markdownai

# Prompt Instructions Demo

@prompt role="context"
This document describes the MarkdownAI rendering pipeline.
Parse the AST, execute directives, then render output.
All file paths are relative to the document root.
@prompt-end

@prompt role="constraint"
Always validate file paths before include or read directives.
Never expose credential values in rendered output.
Use vm.runInNewContext for all expression evaluation.
@prompt-end

## Core Documentation

The MarkdownAI engine transforms `.md` files with embedded directives
into clean markdown output suitable for both human and AI consumers.

The pipeline stages are:
1. Parse: source markdown → AST
2. Execute: walk AST, resolve directives
3. Render: produce final markdown output
