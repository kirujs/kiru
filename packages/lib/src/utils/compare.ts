export function deepCompare<T>(a: T, b: T): boolean {
  return compare(a, b, true)
}

export function shallowCompare<T>(a: T, b: T): boolean {
  return compare(a, b, false)
}

function compare<T>(a: T, b: T, deep = false): boolean {
  // Fast path: identity comparison
  if (a === b) return true

  // Handle primitive types and null/undefined
  if (
    a == null ||
    b == null ||
    typeof a !== "object" ||
    typeof b !== "object"
  ) {
    return false
  }

  // Handle arrays efficiently
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false

    if (deep) {
      for (let i = 0; i < a.length; i++) {
        if (!compare(a[i], b[i], true)) return false
      }
    } else {
      for (let i = 0; i < a.length; i++) {
        if (!Object.is(a[i], b[i])) return false
      }
    }
    return true
  }

  // Handle Maps
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false

    for (const [key, valueA] of a) {
      if (!b.has(key)) return false

      const valueB = b.get(key)
      if (deep) {
        if (!compare(valueA, valueB, true)) return false
      } else {
        if (!Object.is(valueA, valueB)) return false
      }
    }
    return true
  }

  // Handle Sets more efficiently
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false

    if (deep) {
      // For deep equality of Sets, we need to compare the values themselves
      // Convert to arrays and sort for comparison
      const aValues = Array.from(a)
      const bValues = Array.from(b)

      if (aValues.length !== bValues.length) return false

      // Simple compare doesn't work for objects in Sets with deep comparison
      // Using a matching algorithm instead
      for (const valueA of aValues) {
        // Find matching element in bValues
        let found = false
        for (let i = 0; i < bValues.length; i++) {
          if (compare(valueA, bValues[i], true)) {
            bValues.splice(i, 1) // Remove the matched element
            found = true
            break
          }
        }
        if (!found) return false
      }
      return true
    } else {
      // Regular Set comparison
      for (const valueA of a) {
        if (!b.has(valueA)) return false
      }
      return true
    }
  }

  // Handle Date objects
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }

  // Handle RegExp objects
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString()
  }

  // Handle plain objects
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  // Use a Set for faster key lookup
  const keySet = new Set(keysB)

  for (const key of keysA) {
    if (!keySet.has(key)) return false

    const valueA = a[key as keyof T]
    const valueB = b[key as keyof T]

    if (deep) {
      if (!compare(valueA, valueB, true)) return false
    } else {
      if (!Object.is(valueA, valueB)) return false
    }
  }

  return true
}
