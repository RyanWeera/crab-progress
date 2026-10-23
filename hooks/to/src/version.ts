// The plugin the status bar ships in, shared by the pure modules and register.tsx.
// Its state lives under this name; Claude Code refuses writes under any other.
// Pure module: imports nothing from 'claude-code'.
export const PLUGIN_NAME = 'token-optimizer'
