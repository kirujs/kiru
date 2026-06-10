/** Browser stubs — real implementation is server-only in {@link ./revalidate.js}. */

export async function revalidatePath(
  _path: string,
  _opts?: { type?: "page" | "layout" }
): Promise<void> {
  throw new Error("revalidatePath must only be called on the server")
}

export async function revalidateTag(_tag: string | string[]): Promise<void> {
  throw new Error("revalidateTag must only be called on the server")
}
