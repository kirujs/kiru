import { Derive, useComputed, useEffect, useRef, useSignal } from "kiru"

interface Album {
  id: number
  title: string
  artist: string
  url: string
}

const albums: Album[] = [
  {
    id: 1,
    title: "First album",
    artist: "Album artist",
    url: "#",
  },
  {
    id: 2,
    title: "Second album",
    artist: "Album artist",
    url: "#",
  },
  {
    id: 3,
    title: "Third album",
    artist: "Album artist",
    url: "#",
  },
  {
    id: 4,
    title: "Fourth album",
    artist: "Album artist",
    url: "#",
  },
  {
    id: 5,
    title: "Fifth album",
    artist: "Album artist",
    url: "#",
  },
]

export default function FilteredListExample() {
  const sort = useSignal<"asc" | "desc">("asc")
  const inputText = useSignal("")
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filteredAlbums = useComputed(() => {
    return albums
      .filter(
        (a) => a.title.toLowerCase().indexOf(inputText.value.toLowerCase()) > -1
      )
      .sort((a, b) => {
        if (sort.value === "asc") {
          return a.id - b.id
        } else {
          return b.id - a.id
        }
      })
  })

  return (
    <div>
      <div className="max-w-[340px] p-0 overflow-hidden">
        <div className=" p-4">
          <div className="flex w-full justify-between">
            <h2 className="mb-4 font-bold text-lg">Albums</h2>
            <button
              onclick={() =>
                (sort.value = sort.peek() === "asc" ? "desc" : "asc")
              }
              className="text-sm underline"
            >
              Sort ({sort})
            </button>
          </div>
          <div className="sticky top-0 bg-stone-700 mb-4 flex rounded z-10 shadow-md shadow-stone-900">
            <input
              ref={inputRef}
              bind:value={inputText}
              type="text"
              className="bg-transparent pl-8 w-full text-sm py-1 "
              placeholder="Search"
            />
          </div>
          <Derive from={filteredAlbums}>
            {(albums) => (
              <>
                {albums.length === 0 ? (
                  <span data-test className="text-muted">
                    No albums found
                  </span>
                ) : albums.length % 2 === 0 ? (
                  <i data-test className="text-muted">
                    Even
                  </i>
                ) : (
                  <p data-test className="text-muted">
                    Odd
                  </p>
                )}
                <>
                  {albums.map((album) => (
                    <AlbumItem key={"album-" + album.id} album={album} />
                  ))}
                </>
              </>
            )}
          </Derive>
        </div>
      </div>
    </div>
  )
}

function AlbumItem({ album }: { album: Album }) {
  return (
    <div className="flex items-center gap-4">
      <button key="1" role="none" className="p-2 border-2 border-light rounded">
        PlayIcon
      </button>
      <div key="2" className="flex-grow">
        <h4 className="font-bold">{album.title}</h4>
        <span className="text-muted">{album.artist}</span>
      </div>
      <p key="3">LikeButton</p>
    </div>
  )
}
