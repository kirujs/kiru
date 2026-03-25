export function rotate(selected: Kiru.Signal<string>, items: string[]) {
  const idx = items.indexOf(selected.value)
  selected.value = items[(idx + 1) % items.length]
}
