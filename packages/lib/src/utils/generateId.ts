const DEFAULT_CHARACTERS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-" as const

/**
 * Generates a random id
 * @param {number} [size=10] size of the id (in number of characters)
 * @param {string} [characterSet=defaultCharacterSet] set of characters to be used in the generation of the id
 * @returns {string} random id of length {@link size}
 */
export function generateRandomID(
  size: number = 10,
  characterSet: string = DEFAULT_CHARACTERS
): string {
  let id = ""
  for (let i = 0; i < size; i++) {
    id += characterSet[(Math.random() * characterSet.length) | 0] // bitwise OR `|` is faster than `Math.floor()`
  }
  return id
}
