```tsx
import { memo } from "kiru"

type User = {
  name: string
  avatarUrl: string
}

const MemoizedUserAvatar = memo(
  ({ user }: { user: User }) => {
    // Component logic here
    return (
      <div className="user-avatar">
        <img src={user.avatarUrl} alt={`${user.name}'s avatar`} />
        <span>{user.name}</span>
      </div>
    )
  },
  (prevProps, nextProps) =>
    prevProps.user.name === nextProps.user.name &&
    prevProps.user.avatarUrl === nextProps.user.avatarUrl
)
```
