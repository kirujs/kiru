import * as kiru from "kiru"
import { AppsIcon, CogIcon, FolderTreeIcon, GaugeIcon } from "./components"
import { ProfilingTabView, AppsTabView } from "./tabs"

export const APP_TABS = {
  Apps: {
    Icon: AppsIcon,
    View: AppsTabView,
  },
  FileRouter: {
    Icon: FolderTreeIcon,
    View: () => <div>FileRouter</div>,
  },
  Profiling: {
    Icon: GaugeIcon,
    View: ProfilingTabView,
  },
  Settings: {
    Icon: CogIcon,
    View: () => <div>Settings</div>,
  },
}
