/**
 * Parse builderman Task begin/complete lines from a log file.
 * Usage: node scripts/parse-builderman-timings.mjs test.log
 */
import fs from "node:fs"

const logPath = process.argv[2]
if (!logPath) {
  console.error("Usage: node scripts/parse-builderman-timings.mjs <logfile>")
  process.exit(1)
}

const lines = fs.readFileSync(logPath, "utf8").split("\n")
const beginRe = /^~~~~~ Task begin: (.+)$/
const completeRe = /^~~~~~ Task complete: (.+)$/

/** @type {Map<string, number>} */
const stack = new Map()
/** @type {Map<string, number>} */
const durations = new Map()

let lineNo = 0
for (const line of lines) {
  lineNo++
  const b = line.match(beginRe)
  if (b) {
    stack.set(b[1], lineNo)
    continue
  }
  const c = line.match(completeRe)
  if (c) {
    const start = stack.get(c[1])
    if (start !== undefined) {
      durations.set(c[1], lineNo - start)
      stack.delete(c[1])
    }
  }
}

const sorted = [...durations.entries()].sort((a, b) => b[1] - a[1])
console.log("Task durations (line-span proxy, higher = longer):\n")
for (const [name, span] of sorted.slice(0, 40)) {
  console.log(`${String(span).padStart(6)}  ${name}`)
}

const statsMatch = lines.join("\n").match(/durationMs: (\d+)/)
if (statsMatch) {
  console.log(`\nReported pipeline durationMs: ${statsMatch[1]} (${(Number(statsMatch[1]) / 1000).toFixed(1)}s)`)
}
