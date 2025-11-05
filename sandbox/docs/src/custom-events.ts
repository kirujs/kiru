export const customEvents = {
  scrollHashChangeEvent: ("window" in globalThis
    ? createCustomHashChangeEventClass()
    : null) as ReturnType<typeof createCustomHashChangeEventClass>,
}

function createCustomHashChangeEventClass() {
  return class extends HashChangeEvent {
    constructor() {
      super("hashchange")
    }
  }
}
