# Implementation Plan: Collapsible Component

## Overview

This plan implements a headless Collapsible component for the headless-ui package using TypeScript and the Kiru framework. The component follows the compound component pattern established by Accordion and Tabs, with three main parts: Root (state management), Trigger (interactive toggle), and Content (expandable region with animations). The implementation includes proper accessibility attributes, keyboard navigation, and smooth CSS-based transitions.

## Tasks

- [x] 1. Set up component structure and type definitions
  - Create `packages/headless-ui/src/components/collapsible.tsx`
  - Define TypeScript types for Root, Trigger, and Content props
  - Define context types for state sharing between components
  - Import required utilities from Kiru and utils module
  - _Requirements: 7.2, 7.3, 7.5, 8.4_

- [ ] 2. Implement Root component with state management
  - [x] 2.1 Create Root component with controlled/uncontrolled state logic
    - Implement setup hook and derive open state from props
    - Support both `open` Signal prop and `defaultOpen` boolean prop
    - Generate unique component ID for ARIA relationships
    - Create context value with id, open state, disabled state, and toggle function
    - Implement asChild composition pattern
    - _Requirements: 1.1, 1.2, 1.5, 1.6_

  - [ ]\* 2.2 Write property test for Root state management
    - **Property 1: State Change Callback Invocation**
    - **Property 2: Context Propagation to Children**
    - **Property 3: Unique Component IDs**
    - **Validates: Requirements 1.3, 1.4, 1.6**

- [ ] 3. Implement Trigger component with interaction handling
  - [x] 3.1 Create Trigger component with toggle functionality
    - Consume context from Root component
    - Implement click handler to toggle open state (respecting disabled)
    - Implement keyboard handler for Space/Enter keys (respecting disabled)
    - Set ARIA attributes: aria-expanded, aria-controls, aria-disabled
    - Set data attributes: data-state, data-disabled
    - Implement asChild composition pattern
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]\* 3.2 Write property tests for Trigger interaction
    - **Property 4: Click Toggle Behavior**
    - **Property 5: Disabled State Prevents Interaction**
    - **Property 6: State Attribute Consistency**
    - **Property 7: ARIA Relationship Attributes**
    - **Property 8: Disabled Attribute Consistency**
    - **Property 10: Keyboard Toggle Behavior**
    - **Validates: Requirements 2.1, 2.2, 2.5, 2.6, 2.7, 2.8, 5.2, 6.2, 6.3, 6.4, 6.5**

  - [ ]\* 3.3 Write unit tests for Trigger component
    - Test default button rendering with type="button"
    - Test asChild composition merges attributes correctly
    - Test keyboard focus and tab navigation
    - Test disabled state prevents all interactions
    - _Requirements: 2.3, 2.4, 5.1_

- [ ] 4. Implement Content component with animation support
  - [ ] 4.1 Create Content component with visibility and animation logic
    - Consume context from Root component
    - Implement hidden signal to control DOM visibility
    - Track initial open state to prevent animation on mount
    - Implement ref proxy to capture element reference
    - Set ARIA attributes: role="region", aria-labelledby
    - Set data attributes: data-state, data-disabled
    - Implement asChild composition pattern
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 4.2 Add CSS custom properties and animation handling
    - Capture and prevent animation styles on initial mount
    - Subscribe to open state changes and handle transitions
    - Apply CSS custom properties (--collapsible-content-height, --collapsible-content-width)
    - Wait for animations to complete before hiding content
    - Use epoch counter to prevent race conditions
    - Restore captured animation styles after transition setup
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]\* 4.3 Write property tests for Content visibility and animations
    - **Property 9: Content Visibility Matches State**
    - **Property 11: CSS Custom Properties During Transitions**
    - **Property 12: Animation Completion Before Hiding**
    - **Property 13: Animation Style Preservation**
    - **Validates: Requirements 3.1, 3.2, 4.1, 4.2, 4.3, 4.4**

  - [ ]\* 4.4 Write unit tests for Content component
    - Test default div rendering with role="region"
    - Test asChild composition merges attributes correctly
    - Test content visibility when open vs closed
    - Test no animation on initial mount
    - Test hidden attribute set correctly
    - _Requirements: 3.3, 3.4, 3.7_

- [ ] 5. Checkpoint - Ensure all components work together
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Export component and integrate with package
  - [ ] 6.1 Create namespace export and set display names
    - Set displayName for context and all components
    - Export Collapsible namespace object with Root, Trigger, Content
    - Export TypeScript type definitions
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 6.2 Add Collapsible to package exports
    - Export Collapsible from `packages/headless-ui/src/index.ts`
    - Export type definitions from index file
    - _Requirements: 8.2, 8.3_

  - [ ]\* 6.3 Write integration tests
    - Test multiple Collapsible instances don't interfere
    - Test nested Collapsibles work independently
    - Test context propagation across all components
    - Test rapid state changes during animations
    - _Requirements: 1.4, 1.6_

- [ ] 7. Final checkpoint - Verify complete integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The component follows the same patterns as Accordion and Tabs for consistency
- Property tests validate universal correctness properties across randomized inputs
- Unit tests validate specific examples, edge cases, and integration points
- Animation handling uses the same approach as Accordion (CSS custom properties, epoch counter)
- All ARIA attributes ensure accessibility for screen readers and keyboard navigation
