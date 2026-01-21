# Factory Infrastructure

This directory contains the advanced refactoring factory system that eliminates code duplication through generic factories, consolidates business logic, and establishes consistent patterns across the React/TypeScript WhatsApp Business CRM application.

## Overview

The factory system provides:

1. **Generic CRUD Operations** - Factory functions that generate type-safe create, update, delete operations
2. **Query Hook Factory** - Automated generation of TanStack Query hooks for any Supabase table
3. **Unified Form Dialog System** - Single, adaptable dialog component for all entity forms
4. **Centralized Business Logic** - Consolidated layer for complex operations like sale creation
5. **Pattern Consistency** - Standardized approaches for modals, errors, and API interactions

## Directory Structure

```
src/factories/
├── index.ts                    # Main entry point and exports
├── types/                      # TypeScript type definitions
│   ├── core.ts                # Base interfaces and types
│   ├── crud.ts                # CRUD factory types
│   ├── query.ts               # Query factory types
│   ├── form.ts                # Form factory types
│   └── business-logic.ts      # Business logic types
├── utils/                      # Utility functions
│   ├── type-helpers.ts        # Type utilities and guards
│   └── validation-helpers.ts  # Validation utilities
├── factories.test.ts          # Infrastructure tests
└── README.md                  # This file
```

## Core Concepts

### Base Entity Types

All entities in the system extend from `BaseEntity` or `BusinessEntity`:

```typescript
interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

interface BusinessEntity extends BaseEntity {
  business_id: string;
}
```

### Factory Configuration

Factories are configured using options objects that extend `BaseFactoryOptions`:

```typescript
interface BaseFactoryOptions {
  onSuccess?: SuccessCallback;
  onError?: ErrorCallback;
  optimisticUpdates?: boolean;
  cacheTime?: number;
  debug?: boolean;
}
```

### Type Safety

The system maintains full TypeScript type safety through:

- Generic type parameters for entity types
- Utility types for create/update data
- Type guards for runtime validation
- Comprehensive type inference

## Usage Examples

### Type Helpers

```typescript
import { isBaseEntity, isBusinessEntity, omit, pick } from './utils/type-helpers';

// Type guards
if (isBaseEntity(data)) {
  // data is now typed as BaseEntity
}

// Object manipulation
const createData = omit(entity, ['id', 'created_at', 'updated_at']);
const publicData = pick(entity, ['name', 'email']);
```

### Validation Helpers

```typescript
import { ValidationRules, validateObject } from './utils/validation-helpers';

// Create validation rules
const fieldRules = {
  name: [ValidationRules.required()],
  email: [ValidationRules.required(), ValidationRules.email()],
  phone: [ValidationRules.phone()]
};

// Validate data
const result = validateObject(data, fieldRules);
if (!result.isValid) {
  console.log('Validation errors:', result.fieldErrors);
}
```

## Property-Based Testing

The system includes comprehensive property-based testing using fast-check:

```typescript
import { createPropertyTest, Arbitraries } from '../test/fast-check.config';

createPropertyTest(
  'UUID arbitrary should generate valid UUIDs',
  Arbitraries.uuid(),
  (uuid) => isUUID(uuid)
);
```

### Available Arbitraries

- `uuid()` - Valid UUID strings
- `email()` - Valid email addresses
- `phone()` - Valid phone numbers
- `customerData()` - Customer entity data
- `leadData()` - Lead entity data
- `productData()` - Product entity data
- `saleData()` - Sale entity data

## Testing

Run the infrastructure tests:

```bash
npm test src/factories/factories.test.ts
```

The tests verify:

- Type helper functions work correctly
- Validation helpers validate data properly
- Property-based testing arbitraries generate valid data
- All type exports are working correctly
- Type constraints are properly enforced

## TypeScript Configuration

The factory system requires strict TypeScript configuration for optimal type safety:

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## Next Steps

This infrastructure provides the foundation for:

1. **Task 2**: Implement CRUD Factory System
2. **Task 3**: Implement Query Hook Factory System
3. **Task 5**: Implement Unified Form Dialog System
4. **Task 6**: Implement Centralized Business Logic Layer
5. **Task 7**: Implement Pattern Consistency System

Each subsequent task will build upon this foundation to create the complete advanced refactoring system.

## Requirements Validation

This infrastructure satisfies the following requirements:

- **Requirement 1.1**: Generic CRUD operations foundation
- **Requirement 2.1**: Query hook factory foundation
- **Requirement 6.2**: TypeScript configuration for generic factory support
- **Property-based testing setup**: Fast-check configuration and test infrastructure

The factory infrastructure is now ready for the implementation of specific factory systems in subsequent tasks.