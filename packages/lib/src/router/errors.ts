export class FileRouterDataLoadError extends Error {
  constructor(cause: unknown) {
    super("An error occurred while loading route data")
    this.cause = cause
  }
}
