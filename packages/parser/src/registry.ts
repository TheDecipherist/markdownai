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

const modules: ParseModule[] = [
  header, include, importDir, env, define, call, phase, connect,
  list, read, query, db, http, tree, date, count, mkdir, copy, appendIfMissing,
  updateFrontmatter, readFrontmatter, renderTemplate, test, check, hash,
  foreach, setDir,
  render, ifDir, graph, pipe,
  prompt, section, chunkBoundary, defineConcept, constraint, note, eventDir,
]

const registry = new Map<string, ParseModule>(
  modules.map(m => [m.name, m])
)

export function getModule(name: string): ParseModule | undefined {
  return registry.get(name)
}
