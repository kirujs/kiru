/** E2E only — proves the server process is Bun, not Node. */
export default function RuntimeCheck() {
  const label =
    typeof Bun !== "undefined" ? `bun@${Bun.version}` : "not-bun"
  return <pre data-testid="runtime">{label}</pre>
}
