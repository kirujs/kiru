# Requirements Document

## Introduction

This document specifies the requirements for a Collapsible component in the headless-ui package. The Collapsible component allows users to show and hide content sections with smooth transitions and proper accessibility attributes. It follows the Radix UI Collapsible primitive pattern and integrates with the existing headless-ui package structure using the Kiru framework.

## Glossary

- **Collapsible**: The complete component system that manages expandable/collapsible content
- **Root**: The container component that manages the open/closed state
- **Trigger**: The interactive button element that toggles the visibility of content
- **Content**: The expandable/collapsible content region
- **Kiru**: A reactive framework similar to React but using signals for state management
- **asChild**: A composition pattern that merges component props with a child element instead of rendering a wrapper
- **Signal**: A reactive primitive in Kiru that holds state and notifies subscribers of changes

## Requirements

### Requirement 1: Root Component State Management

**User Story:** As a developer, I want a Root component that manages collapsible state, so that I can control whether content is expanded or collapsed.

#### Acceptance Criteria

1. THE Root SHALL accept an "open" prop as a Signal to control the open/closed state externally
2. THE Root SHALL accept a "defaultOpen" prop as a boolean to set the initial state when uncontrolled
3. THE Root SHALL accept an "onOpenChange" callback that receives the new open state when it changes
4. WHEN the open state changes, THE Root SHALL notify all child components through context
5. THE Root SHALL support the "asChild" prop to merge with a child element instead of rendering a div wrapper
6. THE Root SHALL provide a unique identifier through context for ARIA relationships

### Requirement 2: Trigger Component Interaction

**User Story:** As a developer, I want a Trigger component that toggles content visibility, so that users can expand and collapse content sections.

#### Acceptance Criteria

1. WHEN the Trigger is clicked, THE Trigger SHALL toggle the open state
2. WHEN the Trigger is clicked and disabled, THE Trigger SHALL NOT toggle the open state
3. THE Trigger SHALL render as a button element with type="button" by default
4. THE Trigger SHALL support the "asChild" prop to merge with a child element
5. THE Trigger SHALL set "aria-expanded" to "true" when open and "false" when closed
6. THE Trigger SHALL set "aria-controls" to reference the Content component's ID
7. THE Trigger SHALL set "data-state" to "open" when expanded and "closed" when collapsed
8. WHEN disabled, THE Trigger SHALL set "data-disabled" attribute and "aria-disabled" to "true"

### Requirement 3: Content Component Visibility

**User Story:** As a developer, I want a Content component that shows or hides based on state, so that I can display collapsible content to users.

#### Acceptance Criteria

1. WHEN the open state is true, THE Content SHALL display its children
2. WHEN the open state is false, THE Content SHALL hide its children
3. THE Content SHALL render as a div element by default
4. THE Content SHALL support the "asChild" prop to merge with a child element
5. THE Content SHALL set "data-state" to "open" when visible and "closed" when hidden
6. THE Content SHALL set the "id" attribute for ARIA relationships with the Trigger
7. THE Content SHALL set "role" to "region" for accessibility
8. THE Content SHALL set "aria-labelledby" to reference the Trigger component's ID

### Requirement 4: Animation Support

**User Story:** As a developer, I want smooth transitions when content expands or collapses, so that the user experience feels polished.

#### Acceptance Criteria

1. WHEN the Content transitions from closed to open, THE Content SHALL apply CSS custom properties for the content height
2. WHEN the Content transitions from open to closed, THE Content SHALL apply CSS custom properties for the content height
3. WHEN animations are defined in CSS, THE Content SHALL wait for animations to complete before hiding content
4. THE Content SHALL capture and preserve user-defined animation styles during state transitions
5. THE Content SHALL prevent animation styles during initial mount to avoid unwanted transitions

### Requirement 5: Accessibility and Keyboard Navigation

**User Story:** As a user with accessibility needs, I want proper ARIA attributes and keyboard support, so that I can use the component with assistive technologies.

#### Acceptance Criteria

1. THE Trigger SHALL be keyboard focusable with standard tab navigation
2. WHEN the Trigger receives Space or Enter key press, THE Trigger SHALL toggle the open state
3. THE Trigger SHALL set "aria-expanded" to reflect the current open/closed state
4. THE Trigger SHALL set "aria-controls" to reference the Content region
5. THE Content SHALL set "role" to "region" for screen reader identification
6. THE Content SHALL set "aria-labelledby" to reference the Trigger for context

### Requirement 6: Disabled State Handling

**User Story:** As a developer, I want to disable the collapsible interaction, so that I can prevent users from toggling content in certain conditions.

#### Acceptance Criteria

1. THE Root SHALL accept a "disabled" prop as a boolean or Signal
2. WHEN disabled is true, THE Trigger SHALL NOT respond to click events
3. WHEN disabled is true, THE Trigger SHALL NOT respond to keyboard events
4. WHEN disabled is true, THE Trigger SHALL set "data-disabled" attribute
5. WHEN disabled is true, THE Trigger SHALL set "aria-disabled" to "true"

### Requirement 7: Component Composition and Export

**User Story:** As a developer, I want a consistent API with other headless-ui components, so that I can use familiar patterns across the package.

#### Acceptance Criteria

1. THE Collapsible SHALL export a namespace object with Root, Trigger, and Content properties
2. THE Collapsible SHALL export TypeScript type definitions for all component props
3. THE Collapsible SHALL follow the same compound component pattern as Accordion and Tabs
4. THE Collapsible SHALL be exported from the main package index file
5. THE Collapsible SHALL use Kiru's context API for state sharing between components
6. THE Collapsible SHALL support the "asChild" pattern consistently across all subcomponents

### Requirement 8: Integration with Existing Package

**User Story:** As a developer, I want the Collapsible component integrated into the headless-ui package, so that I can import and use it alongside other components.

#### Acceptance Criteria

1. THE Collapsible component file SHALL be created at "packages/headless-ui/src/components/collapsible.tsx"
2. THE Collapsible SHALL be exported from "packages/headless-ui/src/index.ts"
3. THE Collapsible type definitions SHALL be exported from "packages/headless-ui/src/index.ts"
4. THE Collapsible SHALL use the same utility functions as Accordion and Tabs (createRefProxy, isElement, etc.)
5. THE Collapsible SHALL follow the same code structure and naming conventions as existing components
