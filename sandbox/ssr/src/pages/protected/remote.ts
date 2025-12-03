import { getRequestContext } from "vite-plugin-kiru/server"

let count = 0

export async function increment() {
  if (!(await getUser())) throw new Error("Unauthorized")
  return { count: ++count }
}

export async function getCount() {
  if (!(await getUser())) throw new Error("Unauthorized")
  return count
}

async function getUser() {
  await new Promise((resolve) => setTimeout(resolve, 300))
  const { user } = getRequestContext()
  return user
}
