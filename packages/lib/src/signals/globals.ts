import type { SignalSubscriber } from "./types.js"

export const effectQueue = new Map<string, Function>()
export const signalSubsMap: Map<string, Set<SignalSubscriber<any>>> = new Map()
