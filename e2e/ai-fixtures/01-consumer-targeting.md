@markdownai

# Consumer Targeting Demo

@include ./sections/intro.md /

@if consumer="ai"
## AI-Only Section

This content is visible to AI consumers only.
Automated analysis pipeline active.
Structured data processing enabled.
@if-end

@if consumer="human"
## Human-Only Section

This content is visible to human readers only.
Please explore the documentation interactively.
Use the navigation sidebar to find what you need.
@if-end

@if consumer="ai"
## AI Metadata

Processing mode: automated analysis pipeline.
Token budget awareness: active.
@else
## Reader Guide

Welcome, developer! This document explains the system architecture.
Explore each section at your own pace.
@if-end

Standard content visible to all consumers.
This paragraph always appears regardless of consumer setting.
