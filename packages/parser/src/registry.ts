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

const modules: ParseModule[] = [
  header, include, importDir, env, define, call, phase, connect,
  list, read, query, db, http, tree, date, count, render, ifDir, graph, pipe,
  prompt, section, chunkBoundary, defineConcept, constraint, note,
]

const registry = new Map<string, ParseModule>(
  modules.map(m => [m.name, m])
)

export function getModule(name: string): ParseModule | undefined {
  return registry.get(name)
}
