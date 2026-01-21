# Requirements Document

## Introduction

This specification defines the advanced refactoring phase for a WhatsApp Business CRM React/TypeScript application. Building on the successful first phase that created utility functions and common components, this phase focuses on eliminating remaining code duplication, consolidating business logic, and establishing consistent patterns across the codebase.

## Glossary

- **CRUD_Factory**: Generic factory function that generates create, read, update, delete operations for any entity type
- **Query_Hook_Factory**: Generic factory that creates TanStack Query hooks for any Supabase table
- **Form_Dialog_System**: Unified system for managing entity creation and editing dialogs
- **Business_Logic_Layer**: Centralized layer containing reusable business operations
- **Pattern_Consistency_System**: Standardized approaches for modals, error handling, and API interactions
- **Entity**: Any data model in the system (Customer, Lead, Product, Sale, etc.)
- **Mutation_Hook**: React hook that handles data modification operations using TanStack Query
- **Query_Hook**: React hook that handles data fetching operations using TanStack Query

## Requirements

### Requirement 1: Generic CRUD Operations

**User Story:** As a developer, I want generic CRUD factories that eliminate duplication across mutation hooks, so that I can maintain consistent data operations with minimal code.

#### Acceptance Criteria

1. WHEN creating a CRUD factory for any entity type, THE CRUD_Factory SHALL generate create, update, and delete functions with identical behavior patterns
2. WHEN using the CRUD factory with different entity types, THE CRUD_Factory SHALL maintain type safety through TypeScript generics
3. WHEN a CRUD operation completes successfully, THE CRUD_Factory SHALL invalidate relevant queries and show success notifications
4. WHEN a CRUD operation fails, THE CRUD_Factory SHALL handle errors consistently and display appropriate error messages
5. THE CRUD_Factory SHALL support optimistic updates for improved user experience
6. WHEN integrating existing mutation hooks, THE CRUD_Factory SHALL maintain backward compatibility with current API contracts

### Requirement 2: Generic Query Hook Factory

**User Story:** As a developer, I want a query hook factory that generates standardized data fetching hooks, so that I can eliminate duplication across all query hooks.

#### Acceptance Criteria

1. WHEN creating a query hook for any Supabase table, THE Query_Hook_Factory SHALL generate hooks with consistent patterns for fetching, filtering, and pagination
2. WHEN using generated query hooks, THE Query_Hook_Factory SHALL maintain full TypeScript type safety based on table schemas
3. WHEN query operations encounter errors, THE Query_Hook_Factory SHALL handle them consistently across all generated hooks
4. THE Query_Hook_Factory SHALL support common query patterns including filtering, sorting, and real-time subscriptions
5. WHEN integrating with existing query hooks, THE Query_Hook_Factory SHALL preserve current functionality while reducing code duplication
6. THE Query_Hook_Factory SHALL generate hooks that work seamlessly with TanStack Query caching and invalidation

### Requirement 3: Unified Form Dialog System

**User Story:** As a developer, I want a unified form dialog system that consolidates entity creation and editing, so that I can eliminate the 400+ lines of duplicated code across form dialogs.

#### Acceptance Criteria

1. WHEN creating or editing any entity, THE Form_Dialog_System SHALL provide a single, reusable dialog component that adapts to different entity types
2. WHEN rendering form fields, THE Form_Dialog_System SHALL dynamically generate appropriate input components based on entity schema
3. WHEN form validation occurs, THE Form_Dialog_System SHALL apply consistent validation rules and error display patterns
4. WHEN form submission happens, THE Form_Dialog_System SHALL handle create and update operations through the generic CRUD system
5. THE Form_Dialog_System SHALL support entity-specific customizations while maintaining the core unified structure
6. WHEN integrating existing form dialogs, THE Form_Dialog_System SHALL preserve current user experience and functionality

### Requirement 4: Centralized Business Logic

**User Story:** As a developer, I want centralized business logic for complex operations like sale creation, so that I can eliminate scattered duplicate logic and ensure consistency.

#### Acceptance Criteria

1. WHEN performing sale creation operations, THE Business_Logic_Layer SHALL provide a single, reusable function that handles all sale creation scenarios
2. WHEN business logic executes, THE Business_Logic_Layer SHALL coordinate multiple related operations (customer updates, inventory changes, notifications) atomically
3. WHEN business operations fail, THE Business_Logic_Layer SHALL provide detailed error information and rollback capabilities
4. THE Business_Logic_Layer SHALL support different sale creation contexts (quick sale, customer sale, lead conversion) through a unified interface
5. WHEN integrating existing business logic, THE Business_Logic_Layer SHALL maintain current functionality while eliminating duplication
6. THE Business_Logic_Layer SHALL provide clear separation between business rules and UI concerns

### Requirement 5: Pattern Consistency System

**User Story:** As a developer, I want standardized patterns for modals, error handling, and API calls, so that the codebase follows consistent approaches throughout.

#### Acceptance Criteria

1. WHEN managing modal state, THE Pattern_Consistency_System SHALL provide standardized hooks and patterns for opening, closing, and data passing
2. WHEN handling errors, THE Pattern_Consistency_System SHALL apply consistent error display, logging, and user feedback across all components
3. WHEN making API calls, THE Pattern_Consistency_System SHALL ensure consistent request/response handling, loading states, and error recovery
4. THE Pattern_Consistency_System SHALL provide TypeScript types and interfaces that enforce consistent patterns
5. WHEN refactoring existing components, THE Pattern_Consistency_System SHALL guide migration to standardized patterns while preserving functionality
6. THE Pattern_Consistency_System SHALL include documentation and examples for each standardized pattern

### Requirement 6: Type Safety and Developer Experience

**User Story:** As a developer, I want comprehensive TypeScript support throughout the refactored system, so that I can catch errors at compile time and have excellent IDE support.

#### Acceptance Criteria

1. WHEN using any factory or generated hook, THE system SHALL provide full TypeScript type inference and checking
2. WHEN working with entity types, THE system SHALL generate accurate types from Supabase schemas automatically
3. WHEN making API calls, THE system SHALL ensure request and response types are properly typed and validated
4. THE system SHALL provide clear TypeScript error messages that guide developers to correct usage
5. WHEN using IDE features, THE system SHALL support full autocomplete, go-to-definition, and refactoring capabilities
6. THE system SHALL maintain strict TypeScript configuration without compromising type safety

### Requirement 7: Performance and Optimization

**User Story:** As a developer, I want the refactored system to maintain or improve performance, so that the user experience remains excellent while code quality improves.

#### Acceptance Criteria

1. WHEN using generic factories, THE system SHALL not introduce performance overhead compared to current implementations
2. WHEN rendering forms and dialogs, THE system SHALL optimize re-renders and maintain responsive user interactions
3. WHEN managing query cache, THE system SHALL efficiently invalidate and update cached data without unnecessary refetches
4. THE system SHALL support code splitting and lazy loading for improved bundle size and load times
5. WHEN handling large datasets, THE system SHALL maintain current pagination and virtualization performance
6. THE system SHALL provide performance monitoring hooks for measuring and optimizing critical operations