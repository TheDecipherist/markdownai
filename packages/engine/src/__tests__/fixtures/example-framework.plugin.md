---
markdownai_plugin: "1.0"
plugin_name: example-framework
plugin_version: 1.0.0
description: ExampleFramework project integration
homepage: https://example-framework.dev
---
@markdownai v1.0

# ExampleFramework Plugin

This plugin registers ExampleFramework projects so MarkdownAI can detect them.

@plugin-meta
  framework_name: ExampleFramework
  framework_version: ">=1.0.0"
  marker_version: exf-v1
@end

@plugin-detect
  required_dirs:
    - .exf
  required_files:
    - exf.config.json
@end

@plugin-layout
  directories:
    .exf/: ExampleFramework root directory
    .exf/templates/: Template files
  files:
    exf.config.json: Main configuration file
@end

@plugin-conventions
  naming:
    template_files: kebab-case with .exf.md extension
@end
