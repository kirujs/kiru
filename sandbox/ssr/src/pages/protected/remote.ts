import { getRequestContext } from "vite-plugin-kiru/server"

let count = 0

export async function increment() {
  console.log("increment 123 456")
  await new Promise((resolve) => setTimeout(resolve, 150))
  return { count: ++count }
}

export async function getCount() {
  const user = getUser()
  console.log("getCount 123", user)
  await new Promise((resolve) => setTimeout(resolve, 150))
  return count
}

function getUser() {
  const { user } = getRequestContext()
  return user
}
