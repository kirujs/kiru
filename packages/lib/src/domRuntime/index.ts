export { computed, signal } from "../signals/index.js"
export type { Signal } from "../signals/base.js"

export { on, setProp, setText, insertText, bindValue, bindChecked, bindProp } from "./bind.js"
export { createComponent, isComponentHandle } from "./component.js"
export { setupDom } from "./instance.js"
export type { DomSetup, DomComponentInstance } from "./instance.js"
export { domEffect } from "./effect.js"
export {
  mountAfter,
  mountBefore,
  replaceChildren,
  resolveRoot,
} from "./insert.js"
export { For } from "./for.js"
export { mount } from "./mount.js"
export { createRegion, domShow } from "./region.js"
export type { DomAppHandle } from "./types.js"
export type {
  ComponentHandle,
  DomAnchoredComponent,
  DomComponent,
  DomComponentResult,
  DomForProps,
  DomMountContent,
  DomMountNode,
  Region,
} from "./types.js"
export {
  createOwner,
  disposeOwner,
  getCurrentOwner,
  owner,
  registerOwnerCleanup,
  runWithOwner,
} from "./owner.js"
export { clone, project, template } from "./template.js"
export type { TemplateRoot } from "./template.js"
