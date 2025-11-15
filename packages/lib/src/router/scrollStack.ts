const storageKey = "kiru:filerouter:scroll"

export const scrollStack = {
  get(): [number, number][] {
    const fromStorage = sessionStorage.getItem(storageKey)
    if (fromStorage) {
      return JSON.parse(fromStorage)
    }
    return []
  },
  getItem(index: number): [number, number] | undefined {
    const scrollStack = this.get()
    return scrollStack[index]
  },
  push(x: number, y: number): void {
    this.save([...this.get(), [x, y]])
  },
  replace(index: number, x: number, y: number): void {
    const scrollStack = this.get()
    scrollStack[index] = [x, y]
    this.save(scrollStack)
  },
  save(scrollStack: [number, number][]): void {
    sessionStorage.setItem(storageKey, JSON.stringify(scrollStack))
  },
}
