export const $SIGNAL = Symbol.for("kaioken.signal")
export const $CONTEXT = Symbol.for("kaioken.context")
export const $CONTEXT_PROVIDER = Symbol.for("kaioken.contextProvider")
export const $FRAGMENT = Symbol.for("kaioken.fragment")
export const $KAIOKEN_ERROR = Symbol.for("kaioken.error")
export const $HMR_ACCEPT = Symbol.for("kaioken.hmrAccept")
export const $MEMO = Symbol.for("kaioken.memo")

export const CONSECUTIVE_DIRTY_LIMIT = 50

export const FLAG = {
  UPDATE: 1,
  PLACEMENT: 2,
  DELETION: 3,
} as const

export const ELEMENT_TYPE = {
  text: "#text",
} as const

export const REGEX_UNIT = {
  AMP_G: /&/g,
  LT_G: /</g,
  GT_G: />/g,
  SQT_G: /'/g,
  DBLQT_G: /"/g,
  SLASH_G: /\//g,
  SLASHN_SLASHR_G: /[\n\r]+/g,
  ALPHA_UPPER_G: /[A-Z]/g,
} as const
