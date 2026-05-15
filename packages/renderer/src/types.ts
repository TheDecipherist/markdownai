export type RenderType =
  | 'list'
  | 'numbered'
  | 'links'
  | 'table'
  | 'code'
  | 'inline'
  | 'bar'
  | 'flow'
  | 'tree'
  | 'timeline'
  | 'json'

export interface RendererInput {
  type: RenderType
  data: string[]
  columns?: string[]
  options?: Record<string, string>
}

export interface FormatModule {
  name: RenderType
  render(input: RendererInput): string
}
