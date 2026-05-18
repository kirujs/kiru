/** RIFF….WEBP */
export function isWebpBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
}

/** ISO-BMFF `ftyp` box with `avif` brand */
export function isAvifBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false
  const box = buf.toString("ascii", 4, 8)
  if (box !== "ftyp") return false
  const major = buf.toString("ascii", 8, 12)
  return major === "avif" || major === "avis" || buf.includes("avif")
}

export function isJpegBuffer(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
}
