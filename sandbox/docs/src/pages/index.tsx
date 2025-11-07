import { Container } from "$/components/atoms/Container"
import { TodoListDemo } from "$/components/demos/todos/TodoListDemo"
import { LandingSection } from "$/components/landing-page/LandingSection"
import PackageJSONKiru from "$/components/landing-page/package-json.kiru.mdx"
import PackageJSONReact from "$/components/landing-page/package-json.react.mdx"
import { Arrow } from "$/components/landing-page/Arrow"
import { Head, Link } from "kiru/router"

export default function Page() {
  return (
    <>
      <Head.Content>
        <title>Kiru</title>
        <meta
          name="keywords"
          content="Kiru, KiruJS, Kiru JS, Typescript, Javascript, library, framework, frontend"
        />
        <meta
          name="description"
          content="A batteries-included, easy-to-use rendering library with a tiny footprint"
        />
      </Head.Content>
      <div className="w-full h-full overflow-x-hidden">
        <section>
          <Container className="min-h-screen flex flex-col items-center justify-center h-full pt-60">
            <h1 className="text-6xl xs:text-8xl sm:text-9xl font-bold leading-snug! text-shadow text-light">
              Kiru
            </h1>
            <p className="text-lg xs:text-xl sm:text-2xl font-light text-center text-shadow text-light mb-6">
              A batteries-included, easy-to-use rendering library with a tiny
              footprint
            </p>
            <Link to="/docs/getting-started" className="link-button mb-40">
              Get Started
            </Link>
            <LandingSection />
          </Container>
        </section>
        <div className="flex flex-col gap-20 py-20">
          <section>
            <Container className="pb-6">
              <h2 className="text-3xl font-medium leading-snug mb-4">
                Do more with less... Actually, just do less.
              </h2>
              <p className="text-lg font-light">
                Kiru makes it easy to create optimized web apps by embracing a{" "}
                <i>'reactivity where it matters'</i> approach.
              </p>
            </Container>
            <Container breakpoint="md" mobilePadding={false}>
              <TodoListDemo />
            </Container>
          </section>
          <section>
            <Container className="pb-6">
              <h2 className="text-3xl font-medium leading-snug mb-4">
                Say goodbye to dependency hell.
              </h2>
              <p className="text-lg font-light">
                Kiru aims to embody the word 'framework' in a literal sense.
                Routing, state management, responsive forms, asynchronous state
                and more - Kiru makes it possible to build incredible web apps
                without any other libraries.
              </p>
            </Container>
            <Container breakpoint="md" mobilePadding={false}>
              <div
                id="package-json-comparison"
                className="flex flex-wrap gap-4 md:gap-8 items-center justify-center md:rounded-lg py-12 prose max-w-none"
              >
                <div className="flex flex-col gap-2">
                  <PackageJSONReact />
                </div>
                <Arrow
                  className="text-neutral-300 rotate-90 md:rotate-0 w-full md:w-auto"
                  width={40}
                  height={40}
                />
                <div className="flex flex-col gap-2">
                  <PackageJSONKiru />
                </div>
              </div>
            </Container>
          </section>
        </div>
        <section className="bg-[#371d3b2e] p-12 md:p-16">
          <Container className="flex flex-col gap-6">
            <h2 className="text-3xl md:text-5xl font-light leading-snug text-center">
              Let's build the modern web!
            </h2>
            <hr className="opacity-10" />
            <div className="flex justify-center items-center w-full">
              <Link
                to="/docs/getting-started"
                className="link-button bg-primary text-light"
              >
                Get Started
              </Link>
            </div>
          </Container>
        </section>
      </div>
    </>
  )
}
