import { CalloutBlock } from "$/components/atoms/CalloutBlock"
import { Head } from "kiru/router"
import DuplicateKeysExample from "./duplicateKeysExample.md"
import MissingKeyExample from "./missingKeyExample.md"

export default function KeysWarningPage() {
  return (
    <>
      <Head.Content>
        <title>Kiru - Keys Warning</title>
        <meta name="keywords" content="error, keys warning, keys, warning" />
      </Head.Content>
      <div className="flex justify-center pt-30 pb-5">
        <div className="w-full max-w-3xl flex flex-col gap-4 relative px-5 mt-(--navbar-height)">
          <h1 className="text-5xl font-bold">Keys Warning</h1>
          <h2 className="text-xl">
            If you're here, one of the following is probably true:
          </h2>
          <CalloutBlock variant="info">
            <div className="text-left flex flex-col gap-2">
              <p>
                You've rendered an element (or list) for which there are
                multiple child elements that share the same key:
              </p>
              <DuplicateKeysExample />
            </div>
          </CalloutBlock>
          <h2 className="text-xl">or:</h2>
          <CalloutBlock variant="info">
            <div className="text-left flex flex-col gap-2">
              <p>
                You've rendered a list/array for which there is at least one key
                and one missing key:
              </p>
              <MissingKeyExample />
            </div>
          </CalloutBlock>
          <CalloutBlock variant="default">
            <div className="text-base">
              In general, items in a list/array should <b>always</b> have a{" "}
              <b>stable</b> <code>key</code> prop (
              <i>i.e. a unique identifier, not the item's index</i>). This is
              how Kiru persists state across re-renders when the order of the
              items change.
            </div>
          </CalloutBlock>
        </div>
      </div>
    </>
  )
}
