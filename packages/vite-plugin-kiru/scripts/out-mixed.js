import { _template, createHoledTemplate } from "kiru/template";

import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const n = signal(0)

const $k0 = jsxDEV("span", { children: n }, void 0, true, void 0, this)
$k0.meta={ flags: ($k0.meta?.flags??0)|32 }
const $t0 = _template("<div><span>A</span><!--#--></div>", 1)


const Mixed = () =>
  Object.assign(
    createHoledTemplate($t0, [$k0]),
    { meta: { dynamicIndices: [1] } }
  )
