declare module '@plugins/*/client' {
  const mod: Record<string, unknown>
  export default mod
}

declare module '@plugins/*/plugin.meta.json' {
  const manifest: Record<string, unknown>
  export default manifest
}
