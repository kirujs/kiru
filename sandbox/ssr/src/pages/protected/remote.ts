import { getRequestContext } from "vite-plugin-kiru/server"

let count = 0

export async function double(n: number) {
  await requireUser()
  console.log("double", typeof n)
  return n * 2
}

export async function increment() {
  await requireUser()
  return { count: ++count }
}

export async function getCount() {
  await requireUser()
  if (Math.random() > 0.95) {
    throw new Error("Random error")
  }
  return count
}

async function requireUser() {
  await new Promise((resolve) => setTimeout(resolve, 300))
  const { user } = getRequestContext()
  if (user === null) throw new Error("Unauthorized")
}
