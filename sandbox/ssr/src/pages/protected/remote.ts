import { getRequestContext } from "vite-plugin-kiru/server"

let count = 0

export async function increment() {
  await requireUser()
  return { count: ++count }
}

export async function getCount() {
  await requireUser()
  if (Math.random() > 0.5) {
    throw new Error("Random error")
  }
  return count
}

async function requireUser() {
  const { user } = getRequestContext()
  if (user === null) throw new Error("Unauthorized")
}
