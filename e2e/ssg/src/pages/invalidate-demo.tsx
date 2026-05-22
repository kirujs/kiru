import { clientLoader, useRouter, type PageProps } from "kiru/router"

let loaderInvocations = 0

export const load = clientLoader(async () => {
  loaderInvocations += 1
  return { invocations: loaderInvocations }
})

export default function SsgInvalidateDemoPage() {
  const router = useRouter()
  return ({ data }: PageProps<typeof load>) => (
    <section data-testid="ssg-invalidate-demo">
      <p data-testid="ssg-invalidate-invocations">{data?.invocations ?? ""}</p>
      <button
        type="button"
        data-testid="ssg-invalidate-trigger"
        onClick={() => {
          void router.invalidate()
        }}
      >
        Invalidate
      </button>
    </section>
  )
}
