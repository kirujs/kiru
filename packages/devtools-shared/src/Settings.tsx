import { createContext, useContext, useState } from "kiru"
import { ValueEditor } from "./ValueEditor"
import { applyObjectChangeFromKeys } from "./utils"

type UserSettings = {
  arrayChunkSize: number
  objectKeysChunkSize: number
}

const defaultSettings: UserSettings = {
  arrayChunkSize: 10,
  objectKeysChunkSize: 100,
}

function recursiveObjectValidate(
  obj: Record<string, any>,
  subject: Record<string, any>
) {
  if (Object.keys(obj).length !== Object.keys(subject).length) {
    return false
  }
  const keys = new Set([...Object.keys(obj), ...Object.keys(subject)])
  for (const key in keys) {
    if (typeof subject[key] !== typeof obj[key]) {
      return false
    }
    if (typeof obj[key] === "object") {
      if (!recursiveObjectValidate(obj[key], subject[key])) {
        return false
      }
    }
  }
  return true
}

export function recursiveObjectAssign(
  obj: Record<string, any>,
  defaultObj: Record<string, any>,
  assign: (obj: Record<string, any>, key: string, value: any) => void
) {
  for (const key in defaultObj) {
    if (typeof obj[key] === "undefined") {
      obj[key] = structuredClone(defaultObj[key])
    }
  }
  for (const key in obj) {
    if (typeof obj[key] === "object") {
      recursiveObjectAssign(obj[key], defaultObj[key], assign)
    } else {
      assign(obj, key, obj[key])
    }
  }
}

let userSettings: UserSettings = { ...defaultSettings }
const storageData = localStorage.getItem("kiru.devtools.userSettings")
if (storageData) {
  try {
    const parsed = JSON.parse(storageData)
    if (recursiveObjectValidate(defaultSettings, parsed)) {
      userSettings = parsed
    }
  } catch (error) {
    console.error("kiru.devtools.userSettings error", error)
  }
}

type SettingsContext = {
  userSettings: UserSettings
  saveUserSettings: (newSettings: UserSettings) => void
}

const SettingsContext = createContext<SettingsContext>({
  userSettings: null as any as UserSettings,
  saveUserSettings: () => {},
})

export const useSettings = () => useContext(SettingsContext)

export function SettingsProvider({
  children,
}: {
  children: JSX.Children | ((settingsCtx: SettingsContext) => JSX.Element)
}) {
  const [_userSettings, setUserSettings] = useState<UserSettings>(userSettings)

  const saveUserSettings = (newSettings: UserSettings) => {
    localStorage.setItem(
      "kiru.devtools.userSettings",
      JSON.stringify(newSettings)
    )
    setUserSettings(newSettings)
  }

  return (
    <SettingsContext.Provider
      value={{
        userSettings: _userSettings,
        saveUserSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function SettingsEditor() {
  const { userSettings, saveUserSettings } = useSettings()
  return (
    <div className="rounded bg-neutral-400 bg-opacity-5 border border-white border-opacity-10 overflow-hidden">
      <ValueEditor
        border={false}
        data={userSettings}
        onChange={(keys, value) => {
          const newSettings = {
            ...userSettings,
          }
          applyObjectChangeFromKeys(newSettings, keys, value)
          recursiveObjectAssign(
            newSettings,
            defaultSettings,
            (obj, key, value) => {
              obj[key] = value < 1 ? 1 : value
            }
          )
          saveUserSettings(newSettings)
        }}
        mutable={true}
        objectRefAcc={[]}
      />
    </div>
  )
}
