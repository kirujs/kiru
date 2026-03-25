# Design Document: Checkbox and Radio Group Components

## Overview

This design specifies the implementation of two new headless UI components for the headless-ui package: Checkbox and RadioGroup. These components provide accessible, composable primitives for building checkbox and radio button interfaces using the Kiru framework.

Both components follow the established patterns in the headless-ui package:

- Signal-based reactivity for state management
- Context API for sharing state between parent and child components
- asChild prop for flexible composition
- Ref forwarding via createRefProxy utility
- Comprehensive TypeScript types with conditional type support
- Full ARIA attribute support for accessibility

The Checkbox component consists of Root and Indicator sub-components, while the RadioGroup component includes Root, Item, and Indicator sub-components. Both support controlled and uncontrolled modes, allowing developers to manage state externally or let the component handle it internally.

## Architecture

### Component Hierarchy

**Checkbox:**

```
Checkbox.Root (manages state, provides context)
  └── Checkbox.Indicator (renders based on checked state)
```

**RadioGroup:**

```
RadioGroup.Root (manages group state, provides context, handles keyboard navigation)
  └── RadioGroup.Item (represents individual option, provides item context)
      └── RadioGroup.Indicator (renders based on selection state)
```

### State Management Pattern

Both components use Kiru signals for reactive state management:

1. **Controlled Mode**: Parent provides a Signal prop (checked/value), component reads and updates it
2. **Uncontrolled Mode**: Parent provides defaultChecked/defaultValue, component creates internal signal
3. **Hybrid Approach**: Component uses $.derive() to create a unified signal that works in both modes

### Context Architecture

**Checkbox Context Flow:**

- CheckboxRootContext provides: checked state, disabled state, shared data attributes
- CheckboxIndicator consumes context to determine visibility

**RadioGroup Context Flow:**

- RadioGroupRootContext provides: selected value, orientation, trigger controller
- RadioGroupItemContext provides: item value, selection state, disabled state, shared attributes
- RadioGroupIndicator consumes item context to determine visibility

### Keyboard Navigation

RadioGroup uses the createTriggerController utility for roving tabindex navigation:

- Arrow keys move focus between enabled items
- Home/End keys jump to first/last item
- Space key selects the focused item
- Orientation prop determines which arrow keys are active (horizontal: Left/Right, vertical: Up/Down)

## Components and Interfaces

### Checkbox Component

#### Checkbox.Root

**Purpose:** Manages checkbox state and provides context to child components.

**Props:**

```typescript
type CheckboxRootProps<AsChild extends boolean = false> = {
  checked?: Kiru.Signal<boolean | "indeterminate">
  defaultChecked?: boolean | "indeterminate"
  onCheckedChange?: (checked: boolean | "indeterminate") => void
  disabled?: Kiru.Signalable<boolean>
  required?: Kiru.Signalable<boolean>
  name?: string
  value?: string
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["button"])
```

**Behavior:**

- Renders as button[type="button"] by default, or merges with child element if asChild=true
- Toggles checked state on click or Space key press
- Supports three states: true, false, "indeterminate"
- Prevents interaction when disabled
- Calls user event handlers before internal handlers

**Attributes:**

- role="checkbox"
- aria-checked: "true" | "false" | "mixed"
- aria-disabled: "true" | "false"
- data-state: "checked" | "unchecked" | "indeterminate"
- data-disabled: "" | undefined

#### Checkbox.Indicator

**Purpose:** Renders visual feedback based on checked state.

**Props:**

```typescript
type CheckboxIndicatorProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["span"])
```

**Behavior:**

- Renders children only when checked is true or "indeterminate"
- Renders as span by default, or merges with child element if asChild=true
- Inherits data-state and data-disabled from context

**Attributes:**

- data-state: inherited from context
- data-disabled: inherited from context

### RadioGroup Component

#### RadioGroup.Root

**Purpose:** Manages group state, provides context, and handles keyboard navigation.

**Props:**

```typescript
type RadioGroupRootProps<AsChild extends boolean = false> = {
  value?: Kiru.Signal<string>
  defaultValue?: string
  onValueChange?: (value: string) => void
  orientation?: Orientation
  disabled?: Kiru.Signalable<boolean>
  required?: Kiru.Signalable<boolean>
  name?: string
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["div"])
```

**Behavior:**

- Renders as div with role="radiogroup" by default
- Maintains selected value in signal
- Creates trigger controller for keyboard navigation
- Orientation defaults to "vertical"

**Attributes:**

- role="radiogroup"
- aria-orientation: "horizontal" | "vertical"
- data-orientation: "horizontal" | "vertical"

#### RadioGroup.Item

**Purpose:** Represents an individual radio option within the group.

**Props:**

```typescript
type RadioGroupItemProps<AsChild extends boolean = false> = {
  value: Kiru.Signalable<string>
  disabled?: Kiru.Signalable<boolean>
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["button"])
```

**Behavior:**

- Renders as button[type="button"] by default
- Selects this item on click or Space key press
- Registers with trigger controller for keyboard navigation
- Prevents interaction when disabled or group is disabled

**Attributes:**

- role="radio"
- aria-checked: "true" | "false"
- aria-disabled: "true" | "false"
- data-state: "checked" | "unchecked"
- data-disabled: "" | undefined
- data-orientation: inherited from root

#### RadioGroup.Indicator

**Purpose:** Renders visual feedback for the selected radio item.

**Props:**

```typescript
type RadioGroupIndicatorProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["span"])
```

**Behavior:**

- Renders children only when this item is selected
- Renders as span by default
- Inherits data attributes from item context

**Attributes:**

- data-state: inherited from context
- data-disabled: inherited from context
- data-orientation: inherited from context

## Data Models

### Checkbox State Model

```typescript
interface CheckboxRootContextType {
  id: Signal<string>
  checked: Signal<boolean | "indeterminate">
  disabled: Signal<boolean>
  toggle: () => void
  sharedAttrs: {
    "data-state": Signal<"checked" | "unchecked" | "indeterminate">
    "data-disabled": Signal<string | undefined>
  }
}
```

**State Transitions:**

- false → true (on toggle)
- true → false (on toggle)
- "indeterminate" → true (on toggle)

### RadioGroup State Model

```typescript
interface RadioGroupRootContextType {
  id: Signal<string>
  value: Signal<string | null>
  orientation: Signal<Orientation>
  disabled: Signal<boolean>
  select: (value: string) => void
  triggers: TriggerController
}

interface RadioGroupItemContextType {
  value: Signal<string>
  isChecked: Signal<boolean>
  disabled: Signal<boolean>
  sharedAttrs: {
    "data-state": Signal<"checked" | "unchecked">
    "data-disabled": Signal<string | undefined>
    "data-orientation": Signal<Orientation>
  }
  select: () => void
}
```

**State Transitions:**

- null → "value1" (first selection)
- "value1" → "value2" (change selection)
- Selection is permanent (no deselection in radio groups)

### Signal Derivation Pattern

Both components use the same pattern for handling controlled/uncontrolled modes:

```typescript
const checked = $.derive(({ checked, defaultChecked }) => {
  if (Kiru.Signal.isSignal(checked)) {
    return checked.value
  }
  return defaultChecked ?? false
})
```

This creates a derived signal that:

- Reads from the controlled signal if provided
- Falls back to defaultValue for uncontrolled mode
- Can be updated internally, with changes propagated to controlled signal if present

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Checkbox Toggle Behavior

_For any_ checkbox with any initial checked state (true, false, or "indeterminate"), when the user toggles the checkbox (via click or Space key press), the checked state should transition according to the rules: false → true, true → false, indeterminate → true.

**Validates: Requirements 3.1, 3.2**

### Property 2: Checkbox Disabled State Prevents Interaction

_For any_ disabled checkbox, user interactions (clicks or keyboard events) should not change the checked state.

**Validates: Requirements 3.3**

### Property 3: Checkbox State Change Callback

_For any_ checkbox with an onCheckedChange callback, when the checked state changes, the callback should be invoked with the new checked value.

**Validates: Requirements 2.4**

### Property 4: Checkbox User Event Handler Priority

_For any_ checkbox with user-provided event handlers (onclick, onkeydown), the user handlers should be invoked before internal handlers and should be able to prevent default behavior.

**Validates: Requirements 3.5**

### Property 5: Checkbox ARIA Checked Attribute Mapping

_For any_ checkbox, the aria-checked attribute should correctly reflect the checked state: "true" when checked is true, "false" when checked is false, and "mixed" when checked is "indeterminate".

**Validates: Requirements 4.2, 4.3, 4.4, 2.6**

### Property 6: Checkbox ARIA Disabled Attribute Mapping

_For any_ checkbox, the aria-disabled attribute should be "true" when disabled is true, and "false" otherwise.

**Validates: Requirements 4.5**

### Property 7: Checkbox Data State Attribute Mapping

_For any_ checkbox, the data-state attribute should correctly reflect the checked state: "checked" when true, "unchecked" when false, and "indeterminate" when "indeterminate".

**Validates: Requirements 4.6**

### Property 8: Checkbox Data Disabled Attribute Mapping

_For any_ checkbox, the data-disabled attribute should be an empty string when disabled is true, and undefined otherwise.

**Validates: Requirements 4.7**

### Property 9: Checkbox Indicator Inherits Attributes

_For any_ checkbox indicator, it should inherit data-state and data-disabled attributes from the checkbox root context.

**Validates: Requirements 4.8**

### Property 10: Checkbox Indicator Visibility

_For any_ checkbox indicator, it should render its children if and only if the checked state is true or "indeterminate".

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 11: RadioGroup Item Selection

_For any_ radio group with multiple items, when an enabled item is clicked, that item's value should become the selected value of the group.

**Validates: Requirements 8.1**

### Property 12: RadioGroup Disabled Item Prevents Selection

_For any_ radio group item that is disabled, clicking the item should not change the group's selected value.

**Validates: Requirements 8.2**

### Property 13: RadioGroup Space Key Selection

_For any_ focused radio group item, pressing the Space key should select that item.

**Validates: Requirements 8.3**

### Property 14: RadioGroup Arrow Key Navigation

_For any_ radio group with multiple enabled items, pressing arrow keys should move focus to the next or previous enabled item, with the active arrow keys determined by orientation (Left/Right for horizontal, Up/Down for vertical).

**Validates: Requirements 8.4, 8.5, 8.6**

### Property 15: RadioGroup Arrow Key Auto-Selection

_For any_ radio group, when focus moves to a new item via arrow key navigation, that item should automatically become selected.

**Validates: Requirements 8.8**

### Property 16: RadioGroup Value Change Callback

_For any_ radio group with an onValueChange callback, when the selected value changes, the callback should be invoked with the new value.

**Validates: Requirements 7.4**

### Property 17: RadioGroup User Event Handler Priority

_For any_ radio group item with user-provided event handlers (onclick, onkeydown), the user handlers should be invoked before internal handlers and should be able to prevent default behavior.

**Validates: Requirements 8.9**

### Property 18: RadioGroup ARIA Orientation Attribute

_For any_ radio group, the aria-orientation attribute should match the orientation prop value.

**Validates: Requirements 9.2**

### Property 19: RadioGroup Item ARIA Checked Attribute

_For any_ radio group item, the aria-checked attribute should be "true" when the item is selected, and "false" otherwise.

**Validates: Requirements 9.4, 9.5**

### Property 20: RadioGroup Item ARIA Disabled Attribute

_For any_ radio group item, the aria-disabled attribute should be "true" when the item is disabled, and "false" otherwise.

**Validates: Requirements 9.6**

### Property 21: RadioGroup Data Orientation Attribute

_For any_ radio group, the data-orientation attribute should match the orientation prop value.

**Validates: Requirements 9.7**

### Property 22: RadioGroup Item Data State Attribute

_For any_ radio group item, the data-state attribute should be "checked" when the item is selected, and "unchecked" otherwise.

**Validates: Requirements 9.8**

### Property 23: RadioGroup Item Data Disabled Attribute

_For any_ radio group item, the data-disabled attribute should be an empty string when disabled is true, and undefined otherwise.

**Validates: Requirements 9.9**

### Property 24: RadioGroup Indicator Inherits Attributes

_For any_ radio group indicator, it should inherit data-state, data-disabled, and data-orientation attributes from the item context.

**Validates: Requirements 9.10**

### Property 25: RadioGroup Indicator Visibility

_For any_ radio group indicator, it should render its children if and only if its parent item is selected.

**Validates: Requirements 10.1, 10.2**

### Property 26: Checkbox Ref Forwarding

_For any_ checkbox root with a ref prop, the ref should be called with the DOM element when mounted, and with null when unmounted or when the ref changes.

**Validates: Requirements 13.1, 13.4, 13.5**

### Property 27: RadioGroup Item Ref Forwarding

_For any_ radio group item with a ref prop, the ref should be called with the DOM element when mounted, and with null when unmounted or when the ref changes.

**Validates: Requirements 13.2, 13.4, 13.5**

### Property 28: Ref Forwarding with asChild

_For any_ component (Checkbox.Root or RadioGroup.Item) with both ref and asChild props, the ref should correctly receive the child element's DOM node.

**Validates: Requirements 13.3**

## Error Handling

### Invalid Context Usage

Components that depend on context (Checkbox.Indicator, RadioGroup.Item, RadioGroup.Indicator) will throw an error if used outside their required context provider. This is handled by Kiru's context system, which throws when `useContext` is called without a matching provider.

**Error Message Pattern:**

```
Cannot read context "CheckboxRootContext" outside of provider
Cannot read context "RadioGroupRootContext" outside of provider
Cannot read context "RadioGroupItemContext" outside of provider
```

### Invalid Prop Combinations

The TypeScript type system prevents invalid prop combinations at compile time:

- Cannot provide both `checked` and `defaultChecked` to Checkbox.Root
- Cannot provide both `value` and `defaultValue` to RadioGroup.Root

These are enforced through discriminated union types in the prop definitions.

### Event Handler Errors

If user-provided event handlers throw errors, the error will propagate and prevent internal handlers from executing. This is by design—the try-finally pattern ensures user handlers run first, but errors are not caught.

### Ref Callback Errors

If a ref callback throws an error, it will propagate and may prevent subsequent refs from being called. This follows standard React ref behavior.

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** focus on:

- Specific examples and edge cases (e.g., default rendering, indeterminate state, context errors)
- Integration between components (e.g., Checkbox.Root with Checkbox.Indicator)
- Specific attribute values (e.g., role="checkbox", displayName values)
- Error conditions (e.g., using components outside context)

**Property-Based Tests** focus on:

- Universal properties that hold across all inputs (e.g., toggle behavior, attribute mappings)
- State transitions with randomized initial states
- Interaction handling with generated event sequences
- Ref forwarding with various component configurations

### Property-Based Testing Configuration

**Library:** fast-check (for TypeScript/JavaScript)

**Configuration:**

- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: checkbox-and-radio-components, Property {N}: {property description}`

**Example Test Structure:**

```typescript
import fc from "fast-check"

test("Feature: checkbox-and-radio-components, Property 1: Checkbox Toggle Behavior", () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.constant(true),
        fc.constant(false),
        fc.constant("indeterminate")
      ),
      (initialChecked) => {
        // Create checkbox with initialChecked state
        // Simulate toggle action
        // Assert state transitions correctly
      }
    ),
    { numRuns: 100 }
  )
})
```

### Test Organization

**File Structure:**

```
packages/headless-ui/src/components/__tests__/
  checkbox.test.tsx          # Unit tests for Checkbox
  checkbox.property.test.tsx # Property-based tests for Checkbox
  radio-group.test.tsx       # Unit tests for RadioGroup
  radio-group.property.test.tsx # Property-based tests for RadioGroup
```

### Coverage Goals

- 100% of correctness properties implemented as property-based tests
- All edge cases covered by unit tests
- All error conditions tested
- All accessibility attributes verified
- Integration between sub-components tested

### Testing Dependencies

The tests will use:

- Kiru's testing utilities for component rendering
- fast-check for property-based testing
- DOM testing utilities for simulating user interactions
- Custom generators for creating random component configurations
