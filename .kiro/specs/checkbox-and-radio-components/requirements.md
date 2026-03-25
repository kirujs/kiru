# Requirements Document

## Introduction

This document specifies the requirements for implementing two new headless UI components for the headless-ui package: Checkbox and Radio Group. These components will follow the existing patterns established in the package (as seen in Accordion, Collapsible, and Tabs components) and will be based on the Radix UI primitives API design. The components will use the Kiru framework with signal-based reactivity, support composition through the asChild prop, and provide proper accessibility attributes.

## Glossary

- **Checkbox_Component**: A headless checkbox component that provides state management and accessibility for checkbox inputs
- **RadioGroup_Component**: A headless radio group component that manages a set of mutually exclusive radio options
- **Kiru_Framework**: A React-like framework that uses signals for reactivity instead of hooks
- **Signal**: A reactive primitive in Kiru that holds a value and notifies dependents when the value changes
- **asChild_Prop**: A composition pattern that allows the component to merge its functionality with a child element instead of rendering its own DOM element
- **ARIA_Attributes**: Accessibility attributes that provide semantic information to assistive technologies
- **Context**: A Kiru mechanism for passing data through the component tree without prop drilling
- **Root_Component**: The top-level component that provides context and manages state for child components
- **Indicator_Component**: A component that renders visual feedback based on the checked state
- **Item_Component**: A component representing a single selectable option within a group
- **Controlled_Mode**: When the component's state is managed by the parent through a signal prop
- **Uncontrolled_Mode**: When the component manages its own internal state using a default value

## Requirements

### Requirement 1: Checkbox Component Structure

**User Story:** As a developer, I want a composable Checkbox component with Root and Indicator sub-components, so that I can build accessible checkbox inputs with custom styling.

#### Acceptance Criteria

1. THE Checkbox_Component SHALL export a Root sub-component that manages checkbox state
2. THE Checkbox_Component SHALL export an Indicator sub-component that renders based on checked state
3. THE Checkbox.Root SHALL support the asChild_Prop for composition
4. THE Checkbox.Indicator SHALL support the asChild_Prop for composition
5. THE Checkbox.Root SHALL render as a button element with type="button" WHEN asChild is false
6. THE Checkbox.Indicator SHALL render as a span element WHEN asChild is false

### Requirement 2: Checkbox State Management

**User Story:** As a developer, I want the Checkbox to support both controlled and uncontrolled modes, so that I can manage state externally or let the component handle it internally.

#### Acceptance Criteria

1. WHEN a checked Signal prop is provided, THE Checkbox.Root SHALL operate in Controlled_Mode
2. WHEN a defaultChecked value is provided, THE Checkbox.Root SHALL operate in Uncontrolled_Mode with initial state
3. WHEN neither checked nor defaultChecked is provided, THE Checkbox.Root SHALL default to unchecked state
4. WHEN the checked state changes, THE Checkbox.Root SHALL invoke the onCheckedChange callback with the new boolean value
5. THE Checkbox.Root SHALL support a checked state of type boolean or "indeterminate"
6. WHEN checked is "indeterminate", THE Checkbox.Root SHALL set aria-checked to "mixed"

### Requirement 3: Checkbox Interaction Handling

**User Story:** As a developer, I want the Checkbox to handle user interactions properly, so that users can toggle the checkbox state through clicks and keyboard.

#### Acceptance Criteria

1. WHEN the Checkbox.Root is clicked, THE Checkbox.Root SHALL toggle the checked state
2. WHEN the Space key is pressed on focused Checkbox.Root, THE Checkbox.Root SHALL toggle the checked state
3. WHEN the Checkbox.Root is disabled, THE Checkbox.Root SHALL NOT respond to click or keyboard events
4. THE Checkbox.Root SHALL prevent default behavior for Space key to avoid page scrolling
5. WHEN user event handlers are provided via props, THE Checkbox.Root SHALL invoke them before internal handlers

### Requirement 4: Checkbox Accessibility

**User Story:** As a developer, I want the Checkbox to provide proper ARIA attributes, so that the component is accessible to users with assistive technologies.

#### Acceptance Criteria

1. THE Checkbox.Root SHALL set role="checkbox"
2. THE Checkbox.Root SHALL set aria-checked to "true" WHEN checked is true
3. THE Checkbox.Root SHALL set aria-checked to "false" WHEN checked is false
4. THE Checkbox.Root SHALL set aria-checked to "mixed" WHEN checked is "indeterminate"
5. THE Checkbox.Root SHALL set aria-disabled to "true" WHEN disabled is true
6. THE Checkbox.Root SHALL set data-state attribute to "checked", "unchecked", or "indeterminate"
7. THE Checkbox.Root SHALL set data-disabled attribute to empty string WHEN disabled is true
8. THE Checkbox.Indicator SHALL inherit data-state and data-disabled attributes from Root context

### Requirement 5: Checkbox Indicator Visibility

**User Story:** As a developer, I want the Indicator to show or hide based on checked state, so that I can provide visual feedback to users.

#### Acceptance Criteria

1. WHEN checked is true, THE Checkbox.Indicator SHALL render its children
2. WHEN checked is false, THE Checkbox.Indicator SHALL NOT render its children
3. WHEN checked is "indeterminate", THE Checkbox.Indicator SHALL render its children
4. THE Checkbox.Indicator SHALL use data-state attribute for styling hooks

### Requirement 6: RadioGroup Component Structure

**User Story:** As a developer, I want a composable RadioGroup component with Root, Item, and Indicator sub-components, so that I can build accessible radio button groups with custom styling.

#### Acceptance Criteria

1. THE RadioGroup_Component SHALL export a Root sub-component that manages group state
2. THE RadioGroup_Component SHALL export an Item sub-component representing individual radio options
3. THE RadioGroup_Component SHALL export an Indicator sub-component that renders based on selected state
4. THE RadioGroup.Root SHALL support the asChild_Prop for composition
5. THE RadioGroup.Item SHALL support the asChild_Prop for composition
6. THE RadioGroup.Indicator SHALL support the asChild_Prop for composition
7. THE RadioGroup.Root SHALL render as a div element with role="radiogroup" WHEN asChild is false
8. THE RadioGroup.Item SHALL render as a button element with type="button" WHEN asChild is false
9. THE RadioGroup.Indicator SHALL render as a span element WHEN asChild is false

### Requirement 7: RadioGroup State Management

**User Story:** As a developer, I want the RadioGroup to support both controlled and uncontrolled modes, so that I can manage the selected value externally or let the component handle it internally.

#### Acceptance Criteria

1. WHEN a value Signal prop is provided, THE RadioGroup.Root SHALL operate in Controlled_Mode
2. WHEN a defaultValue is provided, THE RadioGroup.Root SHALL operate in Uncontrolled_Mode with initial selection
3. WHEN neither value nor defaultValue is provided, THE RadioGroup.Root SHALL have no initial selection
4. WHEN the selected value changes, THE RadioGroup.Root SHALL invoke the onValueChange callback with the new string value
5. THE RadioGroup.Root SHALL maintain the selected value in a Signal accessible to all Item components via Context

### Requirement 8: RadioGroup Interaction Handling

**User Story:** As a developer, I want the RadioGroup to handle user interactions properly, so that users can select radio options through clicks and keyboard navigation.

#### Acceptance Criteria

1. WHEN a RadioGroup.Item is clicked, THE RadioGroup.Root SHALL set the selected value to that Item's value
2. WHEN a RadioGroup.Item is disabled, THE RadioGroup.Item SHALL NOT respond to click events
3. WHEN the Space key is pressed on a focused RadioGroup.Item, THE RadioGroup.Root SHALL select that item
4. WHEN arrow keys are pressed, THE RadioGroup.Root SHALL move focus to the next or previous enabled Item
5. WHEN the orientation is "horizontal", THE RadioGroup.Root SHALL use Left/Right arrow keys for navigation
6. WHEN the orientation is "vertical", THE RadioGroup.Root SHALL use Up/Down arrow keys for navigation
7. THE RadioGroup.Root SHALL support an orientation prop with values "horizontal" or "vertical", defaulting to "vertical"
8. WHEN focus moves to a new Item via arrow keys, THE RadioGroup.Root SHALL automatically select that item
9. WHEN user event handlers are provided via props, THE RadioGroup.Item SHALL invoke them before internal handlers

### Requirement 9: RadioGroup Accessibility

**User Story:** As a developer, I want the RadioGroup to provide proper ARIA attributes, so that the component is accessible to users with assistive technologies.

#### Acceptance Criteria

1. THE RadioGroup.Root SHALL set role="radiogroup"
2. THE RadioGroup.Root SHALL set aria-orientation to the orientation value
3. THE RadioGroup.Item SHALL set role="radio"
4. THE RadioGroup.Item SHALL set aria-checked to "true" WHEN the item is selected
5. THE RadioGroup.Item SHALL set aria-checked to "false" WHEN the item is not selected
6. THE RadioGroup.Item SHALL set aria-disabled to "true" WHEN the item is disabled
7. THE RadioGroup.Root SHALL set data-orientation attribute to the orientation value
8. THE RadioGroup.Item SHALL set data-state attribute to "checked" or "unchecked"
9. THE RadioGroup.Item SHALL set data-disabled attribute to empty string WHEN disabled is true
10. THE RadioGroup.Indicator SHALL inherit data-state and data-disabled attributes from Item context

### Requirement 10: RadioGroup Indicator Visibility

**User Story:** As a developer, I want the Indicator to show only for the selected radio item, so that users can see which option is currently selected.

#### Acceptance Criteria

1. WHEN a RadioGroup.Item is selected, THE RadioGroup.Indicator within that Item SHALL render its children
2. WHEN a RadioGroup.Item is not selected, THE RadioGroup.Indicator within that Item SHALL NOT render its children
3. THE RadioGroup.Indicator SHALL use data-state attribute for styling hooks

### Requirement 11: Component Context Management

**User Story:** As a developer, I want the components to use Kiru Context for state sharing, so that child components can access parent state without prop drilling.

#### Acceptance Criteria

1. THE Checkbox.Root SHALL create a Context providing checked state and shared attributes
2. THE Checkbox.Indicator SHALL consume the Checkbox Context to access checked state
3. THE RadioGroup.Root SHALL create a Context providing selected value, orientation, and trigger controller
4. THE RadioGroup.Item SHALL create a Context providing item-specific state and attributes
5. THE RadioGroup.Indicator SHALL consume the RadioGroup Item Context to access selection state
6. WHEN a component is used outside its required Context, THE component SHALL throw an error

### Requirement 12: Component TypeScript Types

**User Story:** As a developer, I want comprehensive TypeScript types for all component props, so that I get proper type checking and IDE autocomplete.

#### Acceptance Criteria

1. THE Checkbox.Root SHALL define a CheckboxRootProps type with all supported props
2. THE Checkbox.Indicator SHALL define a CheckboxIndicatorProps type with all supported props
3. THE RadioGroup.Root SHALL define a RadioGroupRootProps type with all supported props
4. THE RadioGroup.Item SHALL define a RadioGroupItemProps type with all supported props
5. THE RadioGroup.Indicator SHALL define a RadioGroupIndicatorProps type with all supported props
6. THE component prop types SHALL use conditional types to handle asChild prop correctly
7. WHEN asChild is true, THE component props SHALL not include default element props
8. WHEN asChild is false, THE component props SHALL include appropriate HTML element props
9. THE component prop types SHALL use Kiru.Signalable type for props that accept signals or plain values

### Requirement 13: Component Ref Forwarding

**User Story:** As a developer, I want to attach refs to the components, so that I can access the underlying DOM elements for measurements or imperative operations.

#### Acceptance Criteria

1. THE Checkbox.Root SHALL support ref forwarding using createRefProxy utility
2. THE RadioGroup.Item SHALL support ref forwarding using createRefProxy utility
3. THE ref forwarding SHALL work correctly with the asChild prop
4. WHEN a ref is provided via props, THE component SHALL call the ref with the DOM element
5. WHEN the component unmounts or ref changes, THE component SHALL call the previous ref with null

### Requirement 14: Component Display Names

**User Story:** As a developer, I want components to have display names, so that I can identify them easily in React DevTools and error messages.

#### Acceptance Criteria

1. THE Checkbox.Root SHALL have displayName set to "CheckboxRoot"
2. THE Checkbox.Indicator SHALL have displayName set to "CheckboxIndicator"
3. THE RadioGroup.Root SHALL have displayName set to "RadioGroupRoot"
4. THE RadioGroup.Item SHALL have displayName set to "RadioGroupItem"
5. THE RadioGroup.Indicator SHALL have displayName set to "RadioGroupIndicator"
6. THE Context objects SHALL have descriptive displayName values

### Requirement 15: Component Integration with Existing Package

**User Story:** As a developer, I want the new components to follow existing package patterns, so that they are consistent with other components in the library.

#### Acceptance Criteria

1. THE Checkbox_Component SHALL be exported from a file at packages/headless-ui/src/components/checkbox.tsx
2. THE RadioGroup_Component SHALL be exported from a file at packages/headless-ui/src/components/radio-group.tsx
3. THE components SHALL use the same code structure as the Accordion component
4. THE components SHALL use Kiru.setup() for component initialization
5. THE components SHALL use Kiru.derive() for derived signals from props
6. THE components SHALL use Kiru.computed() for computed signals
7. THE components SHALL use createRefProxy utility from ../utils.js for ref handling
8. THE RadioGroup SHALL use createTriggerController for keyboard navigation
9. THE components SHALL follow the same naming conventions for contexts and hooks
10. THE components SHALL export a namespace object with sub-components (e.g., Checkbox.Root, Checkbox.Indicator)
