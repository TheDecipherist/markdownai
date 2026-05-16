@markdownai

# MarkdownAI Configuration Showcase

This document demonstrates reading structured data from JSON and CSV files.

## Project Configuration

### Project Name

@read ./data/config.json path="project"

### Version

@read ./data/config.json path="version"

### Description

@read ./data/config.json path="description"

## Feature Matrix

@read ./data/features.json | @render type="table"

## Team Members

@read ./data/team.csv | @render type="table"

## Conditional Section — Always Visible

@if true
The configuration file was read successfully. All values above reflect the current
state of `data/config.json` at render time.
@endif

## Conditional Section — Else Branch

@if false
This section should never appear in the rendered output.
@else
Conditional logic working — the else branch rendered correctly.
@endif
