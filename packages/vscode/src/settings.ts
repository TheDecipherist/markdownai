export interface MarkdownAISettings {
  diagnosticsEnabled: boolean;
  warnUndefinedMacros: boolean;
  stdlibPath: string;
}

const DEFAULTS: MarkdownAISettings = {
  diagnosticsEnabled: true,
  warnUndefinedMacros: true,
  stdlibPath: 'packages/engine/src/stdlib.md',
};

export function readSettings(get: (key: string) => unknown): MarkdownAISettings {
  const diagnosticsEnabled = get('diagnostics.enabled');
  const warnUndefinedMacros = get('diagnostics.warnUndefinedMacros');
  const stdlibPath = get('stdlibPath');
  return {
    diagnosticsEnabled: typeof diagnosticsEnabled === 'boolean'
      ? diagnosticsEnabled
      : DEFAULTS.diagnosticsEnabled,
    warnUndefinedMacros: typeof warnUndefinedMacros === 'boolean'
      ? warnUndefinedMacros
      : DEFAULTS.warnUndefinedMacros,
    stdlibPath: typeof stdlibPath === 'string' && stdlibPath
      ? stdlibPath
      : DEFAULTS.stdlibPath,
  };
}
