import { isVNode } from "../utils.js"

interface RouteProps {
  /**
   * The path to match.
   * @example
   * ```tsx
   * <Router>
   *   <Route path="/" element={<h1>Home</h1>} />
   *   <Route path="/:id" element={<UserProfile />} />
   * </Router>
   * //
   * const UserProfile = () => {
   *   const router = useRouter()
   *   const { id } = router.params
   *   return <h1>{id}</h1>
   * }
   * ```
   */
  path: string
  /**
   * Allow url with additional segments being matched. Useful with nested routers.
   * @example
   * ```tsx
   * <Route path="/profile" fallthrough element={<UserProfile />} />
   * //
   * const UserProfile = () => {
   *   return (
   *     <Router>
   *       <Route path="/" element={<UserDetails />} />
   *       <Route path="/update" element={<UserUpdateForm />} />
   *     </Router>
   *   )
   * }
   * ```
   */
  fallthrough?: boolean
  /**
   * The element to render.
   */
  element: JSX.Element
}
export function Route({ element }: RouteProps) {
  return element
}

export function isRoute(
  thing: unknown
): thing is Kaioken.VNode & { props: RouteProps } {
  return isVNode(thing) && thing.type === Route
}
