export default function BreakLeafPage() {
  return () => {
    if (typeof window !== "undefined") {
      throw new Error("SSG break leaf")
    }
    return <p data-testid="ssg-break-placeholder">Break (client-only)</p>
  }
}
