import { _template, createHoledTemplate, markHoisted } from "kiru/template";

import { jsxDEV } from "kiru/jsx-dev-runtime"
import { signal } from "kiru"

const n = signal(0)

const $k0 = markHoisted(jsxDEV("span", { children: n }, void 0, true, void 0, this))
const $t0 = _template("<div><span>A</span><!--#--></div>", 1)


const Mixed = () =>
  createHoledTemplate($t0, [$k0], [{ kind: "text", anchor: 0 }])
