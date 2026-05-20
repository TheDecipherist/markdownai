@markdownai

# MarkdownAI Example Project Report

## Generated

@date format="YYYY-MM-DD"

## Section Count

Number of included section files:

@count ./sections match="*.md"

## Data Directory Structure

@tree ./data

## Section Files

@list ./sections match="*.md" | sort | @render type="list"

## Data Files

@list ./data match="*.json" | sort | @render type="numbered"

## Environment

Build environment:

@env CI fallback="local"