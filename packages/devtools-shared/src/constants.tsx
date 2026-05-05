import * as kiru from "kiru"
import { AppsIcon, CogIcon, GaugeIcon } from "./components"
import { ProfilingTabView, AppsTabView } from "./tabs"

export const APP_TABS = {
  Apps: {
    Icon: AppsIcon,
    View: AppsTabView,
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
