# Design Document: Collapsible Component

## Overview

The Collapsible component is a headless UI primitive that provides expandable/collapsible content functionality with proper accessibility support. It follows the compound component pattern established by other headless-ui components (Accordion, Tabs) and integrates seamlessly with the Kiru reactive framework.

The component consists of three main parts:

- **Root**: Manages the open/closed state and provides context to child components
- **Trigger**: An interactive button that toggles the visibility of content
- **Content**: The expandable/collapsible content region with smooth transitions

The design prioritizes accessibility (ARIA attributes, keyboard navigation), flexibility (controlled/uncontrolled modes, asChild composition), and smooth animations using CSS custom properties.

## Architecture

### Component Structure

```
Collapsible
├── Root (state management, context provider)
├── Trigger (interactive toggle button)
└── Content (expandable content region)
```

### State Management

The Collapsible uses Kiru's signal-based reactivity for state management:

1. **Controlled Mode**: Parent component provides an `open` Signal and manages state externally
2. **Uncontrolled Mode**: Component manages internal state using `defaultOpen` prop

State flow:

```
User Interaction → Trigger onClick → toggle() → Update Signal → Context Propagation → UI Update
```

### Context Architecture

The Root component creates a context that provides:

- Unique component ID for ARIA relationships
- Open state signal
- Toggle function
- Disabled state

Child components (Trigger, Content) consume this context to coordinate behavior and maintain accessibility attributes.

## Components and Interfaces

### Root Component

**Purpose**: Container that manages collapsible state and provides context to children.

**Props**:

```typescript
type CollapsibleRootProps<AsChild extends boolean = false> = {
  onOpenChange?: (open: boolean) => void
  disabled?: boolean | Kiru.Signal<boolean>
  children?: JSX.Children
  asChild?: AsChild
} & (
  | { open: Kiru.Signal<boolean>; defaultOpen?: never }
  | { open?: never; defaultOpen?: boolean }
) &
  (AsChild extends true ? {} : JSX.IntrinsicElements["div"])
```

**Behavior**:

- Creates a unique ID for ARIA relationships
- Manages open/closed state (controlled or uncontrolled)
- Provides context to Trigger and Content components
- Calls `onOpenChange` callback when state changes
- Supports `asChild` for composition

**Attributes**:

- `data-state`: "open" | "closed"
- `data-disabled`: present when disabled

### Trigger Component

**Purpose**: Interactive button that toggles content visibility.

**Props**:

```typescript
type CollapsibleTriggerProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["button"])
```

**Behavior**:

- Renders as `<button type="button">` by default
- Toggles open state on click (unless disabled)
- Toggles open state on Space/Enter key press (unless disabled)
- Respects disabled state from Root context
- Supports `asChild` for composition

**Attributes**:

- `id`: `{rootId}:trigger` (for ARIA relationships)
- `type`: "button"
- `aria-expanded`: "true" | "false"
- `aria-controls`: references Content ID
- `data-state`: "open" | "closed"
- `data-disabled`: present when disabled
- `aria-disabled`: "true" | "false"
- `disabled`: boolean (when not using asChild)

### Content Component

**Purpose**: Expandable/collapsible content region with animation support.

**Props**:

```typescript
type CollapsibleContentProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["div"])
```

**Behavior**:

- Shows children when open, hides when closed
- Applies CSS custom properties for height/width during transitions
- Waits for CSS animations to complete before hiding content
- Prevents animation on initial mount
- Supports `asChild` for composition

**Attributes**:

- `id`: `{rootId}:content` (for ARIA relationships)
- `role`: "region"
- `aria-labelledby`: references Trigger ID
- `data-state`: "open" | "closed"
- `data-disabled`: present when disabled
- `hidden`: boolean (when closed and animations complete)
- CSS custom properties: `--collapsible-content-height`, `--collapsible-content-width`

## Data Models

### Context Type

```typescript
interface CollapsibleRootContextType {
  id: Kiru.Signal<string>
  open: Kiru.Signal<boolean>
  disabled: Kiru.Signal<boolean>
  toggle: () => void
}
```

### Animation State

The Content component tracks animation state internally:

- `hidden`: Signal controlling DOM visibility
- `wasOpenInitially`: Boolean flag to prevent initial animation
- `capturedAnimationStyles`: Temporary storage for user-defined animations
- `epoch`: Counter to prevent race conditions in async animation handling

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property Reflection

After analyzing all acceptance criteria, several redundancies were identified:

**Redundant Properties**:

- 5.3 (aria-expanded) is redundant with 2.5
- 5.4 (aria-controls) is redundant with 2.6
- 5.5 (role="region") is redundant with 3.7
- 5.6 (aria-labelledby) is redundant with 3.8
- 6.2 (disabled click) is redundant with 2.2
- 6.4 (data-disabled) is redundant with 2.8
- 6.5 (aria-disabled) is redundant with 2.8
- 7.6 (asChild pattern) is covered by 1.5, 2.4, 3.4

**Combined Properties**:

- 2.5, 2.7, 3.5 all test that data attributes match state - can be combined into one comprehensive property
- 2.6, 3.6, 3.8 all test ARIA relationship attributes - can be combined into one property
- 3.1 and 3.2 test visibility in opposite states - can be combined into one property
- 4.1 and 4.2 test CSS properties in both directions - can be combined into one property

### Property 1: State Change Callback Invocation

_For any_ state transition (open to closed or closed to open), the `onOpenChange` callback should be invoked with the new state value.

**Validates: Requirements 1.3**

### Property 2: Context Propagation to Children

_For any_ state change in the Root component, all child components (Trigger and Content) should reflect the updated state immediately.

**Validates: Requirements 1.4**

### Property 3: Unique Component IDs

_For any_ set of Collapsible Root components rendered simultaneously, each should have a unique ID to prevent ARIA relationship conflicts.

**Validates: Requirements 1.6**

### Property 4: Click Toggle Behavior

_For any_ initial state (open or closed), clicking the Trigger should toggle to the opposite state.

**Validates: Requirements 2.1**

### Property 5: Disabled State Prevents Interaction

_For any_ Collapsible with disabled=true, clicking or pressing Space/Enter on the Trigger should not change the open state.

**Validates: Requirements 2.2, 6.2, 6.3**

### Property 6: State Attribute Consistency

_For any_ open state value, the `data-state` attribute on Root, Trigger, and Content should all reflect the same state ("open" or "closed"), and `aria-expanded` on Trigger should match ("true" or "false").

**Validates: Requirements 2.5, 2.7, 3.5**

### Property 7: ARIA Relationship Attributes

_For any_ Collapsible instance, the Trigger's `aria-controls` should reference the Content's `id`, and the Content's `aria-labelledby` should reference the Trigger's `id`.

**Validates: Requirements 2.6, 3.6, 3.8**

### Property 8: Disabled Attribute Consistency

_For any_ disabled state value, the `data-disabled` and `aria-disabled` attributes on the Trigger should consistently reflect the disabled state.

**Validates: Requirements 2.8**

### Property 9: Content Visibility Matches State

_For any_ open state value, the Content should display its children when open=true and hide them when open=false.

**Validates: Requirements 3.1, 3.2**

### Property 10: Keyboard Toggle Behavior

_For any_ initial state, pressing Space or Enter on a focused Trigger should toggle the open state (unless disabled).

**Validates: Requirements 5.2**

### Property 11: CSS Custom Properties During Transitions

_For any_ state transition (open to closed or closed to open), the Content should set CSS custom properties `--collapsible-content-height` and `--collapsible-content-width` with the element's dimensions.

**Validates: Requirements 4.1, 4.2**

### Property 12: Animation Completion Before Hiding

_For any_ transition from open to closed with CSS animations defined, the Content should remain visible (not hidden) until all animations complete.

**Validates: Requirements 4.3**

### Property 13: Animation Style Preservation

_For any_ user-defined animation styles on the Content element, those styles should be preserved and reapplied after internal animation handling.

**Validates: Requirements 4.4**

## Error Handling

### Invalid Props

- **Missing required props**: TypeScript types enforce required props at compile time
- **Invalid prop types**: TypeScript types prevent invalid prop types at compile time
- **Conflicting props**: Type system prevents both `open` and `defaultOpen` from being set simultaneously

### Runtime Errors

- **Missing context**: Child components (Trigger, Content) will throw an error if rendered outside a Root component. This is intentional to catch developer errors early.
- **Invalid ref forwarding**: The `createRefProxy` utility handles ref forwarding safely, preventing errors when refs are not provided.

### Animation Errors

- **Animation race conditions**: The Content component uses an epoch counter to prevent race conditions when multiple state changes occur rapidly during animations.
- **Missing element ref**: Animation logic checks for element existence before accessing DOM APIs, preventing null reference errors.

### Accessibility Errors

- **Missing IDs**: Component generates unique IDs automatically, ensuring ARIA relationships are always valid.
- **Invalid ARIA attributes**: All ARIA attributes are computed from valid state, preventing invalid values.

## Testing Strategy

### Unit Testing

Unit tests should focus on specific examples, edge cases, and integration points:

**Examples to test**:

- Default rendering: Verify Root renders as div, Trigger as button, Content as div
- Initial state with `defaultOpen=true`: Verify Content is visible on mount
- Initial state with `defaultOpen=false`: Verify Content is hidden on mount
- asChild composition: Verify attributes merge correctly with child elements
- Trigger keyboard focus: Verify Trigger is in tab order
- Content role attribute: Verify role="region" is always set
- No animation on initial mount: Verify animation styles are prevented during first render

**Edge cases to test**:

- Rapid state changes: Multiple clicks in quick succession
- State change during animation: Toggling while animation is in progress
- Missing animation styles: Content without CSS animations
- Disabled state changes: Enabling/disabling while open or closed

**Integration tests**:

- Multiple Collapsible instances: Verify they don't interfere with each other
- Nested Collapsibles: Verify parent/child Collapsibles work independently
- Context propagation: Verify all child components receive context updates

### Property-Based Testing

Property-based tests verify universal properties across randomized inputs. Each test should run a minimum of 100 iterations.

**Testing Library**: Use `fast-check` for TypeScript/JavaScript property-based testing.

**Test Configuration**:

```typescript
import fc from 'fast-check'

fc.assert(
  fc.property(/* generators */, (/* inputs */) => {
    // property assertion
  }),
  { numRuns: 100 }
)
```

**Property Test Implementations**:

Each correctness property should be implemented as a property-based test with the following tag format in a comment:

```typescript
// Feature: collapsible-component, Property 1: State Change Callback Invocation
```

**Generators needed**:

- `arbBoolean()`: Random boolean for open/disabled states
- `arbCollapsibleState()`: Random Collapsible state (open, disabled)
- `arbKeyboardEvent()`: Random keyboard events (Space, Enter, other keys)
- `arbAnimationStyles()`: Random CSS animation properties

**Property tests to implement**:

1. **Property 1**: Generate random state transitions, verify callback is invoked with correct value
2. **Property 2**: Generate random state changes, verify child components reflect updates
3. **Property 3**: Generate multiple Root instances, verify all IDs are unique
4. **Property 4**: Generate random initial states, click Trigger, verify state toggles
5. **Property 5**: Generate random states with disabled=true, interact with Trigger, verify state unchanged
6. **Property 6**: Generate random states, verify all data-state and aria-expanded attributes match
7. **Property 7**: Generate random instances, verify ARIA relationship attributes reference correct IDs
8. **Property 8**: Generate random disabled states, verify data-disabled and aria-disabled match
9. **Property 9**: Generate random open states, verify Content visibility matches state
10. **Property 10**: Generate random initial states, press Space/Enter, verify state toggles
11. **Property 11**: Generate random state transitions, verify CSS custom properties are set
12. **Property 12**: Generate transitions with animations, verify Content remains visible until complete
13. **Property 13**: Generate random animation styles, verify they're preserved after transitions

### Test Organization

```
packages/headless-ui/src/components/__tests__/
├── collapsible.unit.test.tsx        # Unit tests and examples
└── collapsible.property.test.tsx    # Property-based tests
```

### Coverage Goals

- **Line coverage**: >90% for all component code
- **Branch coverage**: >85% for conditional logic
- **Property coverage**: 100% of correctness properties implemented as tests
- **Accessibility coverage**: All ARIA attributes and keyboard interactions tested
