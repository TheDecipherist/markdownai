import type { ParseModule } from './types.js'
import header from './directives/header.js'
import include from './directives/include.js'
import importDir from './directives/import.js'
import env from './directives/env.js'
import define from './directives/define.js'
import call from './directives/call.js'
import phase from './directives/phase.js'
import connect from './directives/connect.js'
import list from './directives/list.js'
import read from './directives/read.js'
import query from './directives/query.js'
import db from './directives/db.js'
import http from './directives/http.js'
import tree from './directives/tree.js'
import date from './directives/date.js'
import count from './directives/count.js'
import mkdir from './directives/mkdir.js'
import touch from './directives/touch.js'
import copy from './directives/copy.js'
import appendIfMissing from './directives/append-if-missing.js'
import updateFrontmatter from './directives/update-frontmatter.js'
import readFrontmatter from './directives/read-frontmatter.js'
import renderTemplate from './directives/render-template.js'
import test from './directives/test.js'
import check from './directives/check.js'
import hash from './directives/hash.js'
import foreach from './directives/foreach.js'
import setDir from './directives/set.js'
import switchDir from './directives/switch.js'
import render from './directives/render.js'
import ifDir from './directives/if.js'
import graph from './directives/graph.js'
import pipe from './directives/pipe.js'
import prompt from './directives/prompt.js'
import section from './directives/section.js'
import chunkBoundary from './directives/chunk-boundary.js'
import defineConcept from './directives/define-concept.js'
import constraint from './directives/constraint.js'
import note from './directives/note.js'
import eventDir from './directives/event.js'
import pluginMeta from './directives/plugin-meta.js'
import pluginDetect from './directives/plugin-detect.js'
import pluginLayout from './directives/plugin-layout.js'
import pluginConventions from './directives/plugin-conventions.js'
import markdownaiDetect from './directives/markdownai-detect.js'
import pluginData from './directives/plugin-data.js'
import onComplete from './directives/on-complete.js'

const modules: ParseModule[] = [
  header, include, importDir, env, define, call, phase, connect,
  list, read, query, db, http, tree, date, count, mkdir, touch, copy, appendIfMissing,
  updateFrontmatter, readFrontmatter, renderTemplate, test, check, hash,
  foreach, setDir, switchDir,
  render, ifDir, graph, pipe,
  prompt, section, chunkBoundary, defineConcept, constraint, note, eventDir,
  pluginMeta, pluginDetect, pluginLayout, pluginConventions,
  markdownaiDetect, pluginData, onComplete,
]

const registry = new Map<string, ParseModule>(
  modules.map(m => [m.name, m])
)

export function getModule(name: string): ParseModule | undefined {
  return registry.get(name)
}

export interface DirectiveInfo {
  name: string
}

export function getAvailableDirectives(): DirectiveInfo[] {
  return [...registry.values()]
    .map(m => ({ name: m.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
