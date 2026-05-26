@markdownai

# Concepts and Constraints Demo

@define-concept jailRoot "the document root directory, used to confine file include and read paths"
@define-concept strictMode "when --strict is active, any warning becomes a fatal error"
@define-concept aiFilter "the token-efficient output mode that removes decorative chrome from markdown"

@constraint id="no-eval" severity="critical"
eval() is never used anywhere in the codebase. Use vm.runInNewContext() for all expression evaluation.
@constraint-end

@constraint id="no-traversal" severity="critical"
File paths must never escape the jailRoot. ../ sequences are always blocked by checkFilePath.
@constraint-end

## Document Content

MarkdownAI provides structured documentation optimized for AI consumption.
The glossary and constraint table appear at the document top for AI consumers.
Human readers see concept definitions inline and constraints as callout blockquotes.

The system enforces both concepts and constraints at runtime, ensuring documentation accuracy.
