export const env: Record<string, string | undefined> =
  typeof process?.env !== "undefined"
    ? process.env
    : import.meta && "env" in import.meta
      ? (
          import.meta as ImportMeta & {
            env: Record<string, string | undefined>
          }
        ).env
      : {}
