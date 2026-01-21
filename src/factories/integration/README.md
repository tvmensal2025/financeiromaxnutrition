# Integrated Systems Layer

This directory contains the complete integration layer that wires all refactored systems together to work cohesively across the entire application. The integration layer combines CRUD factories, query factories, unified form dialogs, business logic layer, and pattern consistency systems into a unified, easy-to-use interface.

## Overview

The integrated systems layer provides:

- **Unified Entity Management**: Complete CRUD operations with consistent patterns
- **Form Integration**: Dynamic form dialogs that integrate with CRUD operations
- **Business Logic Integration**: Centralized business operations with atomic transactions
- **Pattern Consistency**: Standardized modal management, error handling, and API calls
- **Type Safety**: Full TypeScript support with generated types
- **Performance Optimization**: Efficient caching, query management, and UI rendering
- **Real-time Updates**: Live data synchronization across components

## Architecture

```
Integration Layer
├── systemIntegration.ts      # Core integration logic
├── entityConfigurations.ts   # Pre-configured entity setups
├── useIntegratedSystems.ts   # React hooks for easy access
├── IntegratedSystemsDemo.tsx # Demo component showing all features
└── index.ts                  # Main exports
```

## Quick Start

### 1. Basic Usage

```tsx
import { useIntegratedSystems } from '@/factories/integration';

function CustomerManagement() {
  const { entities, status } = useIntegratedSystems();
  
  if (status.isLoading) return <div>Loading...</div>;
  if (status.error) return <div>Error: {status.error}</div>;
  
  // Use integrated customer system
  const customers = entities.customers.queries.useEntities();
  const createCustomer = entities.customers.crud.useCreate();
  const { FormDialogWithCRUD } = entities.customers.forms;
  
  return (
    <div>
      <h1>Customers</h1>
      {customers.data?.map(customer => (
        <div key={customer.id}>{customer.name}</div>
      ))}
      
      <FormDialogWithCRUD
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        mode="create"
        onSuccess={(customer) => console.log('Created:', customer)}
      />
    </div>
  );
}
```

### 2. Business Logic Integration

```tsx
import { useBusinessLogic } from '@/factories/integration';

function SaleCreation() {
  const businessLogic = useBusinessLogic();
  
  const handleCreateSale = async () => {
    if (!businessLogic) return;
    
    const result = await businessLogic.sales.createSale({
      products: [{ productId: 'prod-1', quantity: 2, unitPrice: 100 }],
      paymentMethod: 'pix',
      customerId: 'customer-123'
    });
    
    if (result.success) {
      console.log('Sale created:', result.data);
    } else {
      console.error('Sale failed:', result.error);
    }
  };
  
  return (
    <button onClick={handleCreateSale}>
      Create Sale
    </button>
  );
}
```

### 3. Error Handling Integration

```tsx
import { useGlobalErrorHandler } from '@/factories/integration';

function MyComponent() {
  const errorHandler = useGlobalErrorHandler();
  
  const handleRiskyOperation = async () => {
    try {
      await someRiskyOperation();
    } catch (error) {
      errorHandler?.handleError(error, {
        action: 'risky_operation',
        component: 'MyComponent'
      });
    }
  };
  
  return <button onClick={handleRiskyOperation}>Do Something</button>;
}
```

## Entity Systems

Each entity system provides a complete set of integrated functionality:

### Available Entities

- **Customers**: Customer management with CRM features
- **Leads**: Lead tracking and conversion
- **Products**: Product catalog management
- **Services**: Service catalog management
- **Transactions**: Financial transaction tracking

### Entity System Structure

```typescript
interface IntegratedEntitySystem<T> {
  // Configuration
  config: EntityConfig<T>;
  
  // Data fetching
  queries: {
    useEntities(): UseQueryResult<T[]>;
    useEntity(id: string): UseQueryResult<T>;
    useEntitiesInfinite(): UseInfiniteQueryResult<PaginatedResult<T>>;
    useEntitiesCount(): UseQueryResult<number>;
  };
  
  // Data mutations
  crud: {
    useCreate(): UseMutationResult<T, Error, CreateData<T>>;
    useUpdate(): UseMutationResult<T, Error, UpdateVariables<T>>;
    useDelete(): UseMutationResult<void, Error, string>;
  };
  
  // Form integration
  forms: {
    FormDialogWithCRUD: React.FC<FormCRUDDialogProps<T>>;
    getCRUDFactory(): CRUDFactory<T>;
  };
  
  // Business logic
  businessLogic: BusinessLogicLayer;
  
  // UI patterns
  modal: ModalState & ModalActions;
  errorHandler: ErrorHandlerState & ErrorHandlerActions;
  apiUtils: ApiUtilities;
}
```

## Business Logic Operations

The integrated business logic layer provides centralized operations:

### Sale Operations

```typescript
// Create a complete sale
const result = await businessLogic.sales.createSale({
  customerId: 'customer-123',
  products: [{ productId: 'prod-1', quantity: 2, unitPrice: 100 }],
  services: [{ serviceId: 'serv-1', quantity: 1, unitPrice: 200 }],
  paymentMethod: 'pix',
  discount: 50,
  notes: 'Special discount applied'
});

// Create a quick sale with customer creation
const quickSaleResult = await businessLogic.sales.createQuickSale({
  customerName: 'John Doe',
  customerPhone: '(11) 99999-9999',
  amount: 150,
  paymentMethod: 'credit_card',
  description: 'Quick consultation'
});

// Convert lead to sale
const conversionResult = await businessLogic.sales.convertLeadToSale({
  leadId: 'lead-123',
  saleData: {
    products: [{ productId: 'prod-1', quantity: 1, unitPrice: 100 }],
    paymentMethod: 'pix'
  }
});
```

### Customer Operations

```typescript
// Create customer with validation
const customerResult = await businessLogic.customers.createCustomer({
  name: 'Jane Smith',
  email: 'jane@example.com',
  phone: '(11) 88888-8888'
});

// Update customer with business rules
const updateResult = await businessLogic.customers.updateCustomer(
  'customer-123',
  { email: 'newemail@example.com' }
);
```

### Lead Operations

```typescript
// Create lead with validation
const leadResult = await businessLogic.leads.createLead({
  name: 'Potential Customer',
  source: 'website',
  status: 'new',
  temperature: 'warm'
});
```

## Form Integration

The unified form system automatically generates forms based on entity configurations:

### Form Dialog Usage

```tsx
function EntityFormExample() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);
  
  const { entities } = useIntegratedSystems();
  const { FormDialogWithCRUD } = entities.customers.forms;
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Create Customer
      </button>
      
      <FormDialogWithCRUD
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        mode={selectedEntity ? 'edit' : 'create'}
        initialData={selectedEntity}
        entityId={selectedEntity?.id}
        onSuccess={(customer, mode) => {
          console.log(`Customer ${mode}d:`, customer);
          setIsOpen(false);
          setSelectedEntity(null);
        }}
        onError={(error, mode) => {
          console.error(`${mode} failed:`, error);
        }}
      />
    </>
  );
}
```

### Custom Form Configurations

```typescript
const customFormFields: FormFieldConfig[] = [
  {
    name: 'name',
    type: 'text',
    label: 'Name',
    required: true,
    validation: [
      {
        type: 'required',
        message: 'Name is required',
        validate: (value) => !value ? 'Name is required' : null
      }
    ]
  },
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    required: false,
    validation: [
      {
        type: 'email',
        message: 'Invalid email format',
        validate: (value) => {
          if (!value) return null;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Invalid email';
        }
      }
    ]
  }
];
```

## Pattern Consistency

### Modal Management

```tsx
function ModalExample() {
  const { entities } = useIntegratedSystems();
  const modal = entities.customers.modal;
  
  const handleOpenModal = () => {
    modal.open(
      { customerId: '123' }, // data
      { size: 'lg', closeOnOutsideClick: false } // config
    );
  };
  
  return (
    <div>
      <button onClick={handleOpenModal}>Open Modal</button>
      
      {modal.isOpen && (
        <div>
          Modal is open with data: {JSON.stringify(modal.data)}
          <button onClick={modal.close}>Close</button>
        </div>
      )}
    </div>
  );
}
```

### Error Handling

```tsx
function ErrorHandlingExample() {
  const { entities } = useIntegratedSystems();
  const errorHandler = entities.customers.errorHandler;
  
  const handleOperation = async () => {
    try {
      await riskyOperation();
    } catch (error) {
      const standardizedError = errorHandler.handleError(error, {
        action: 'risky_operation',
        component: 'ErrorHandlingExample'
      });
      
      // Error is automatically displayed as toast
      // and logged according to configuration
    }
  };
  
  // Display error statistics
  const errorStats = errorHandler.getErrorStats();
  
  return (
    <div>
      <button onClick={handleOperation}>Risky Operation</button>
      <div>Total Errors: {errorStats.total}</div>
      <div>Critical Errors: {errorStats.bySeverity.critical}</div>
    </div>
  );
}
```

### API Call Patterns

```tsx
function ApiCallExample() {
  const { entities } = useIntegratedSystems();
  const { apiUtils } = entities.customers;
  
  // API call with loading state
  const apiWithLoading = apiUtils.withLoading(async (params) => {
    return await fetch('/api/data', { method: 'POST', body: JSON.stringify(params) });
  });
  
  // API call with error handling
  const apiWithErrorHandling = apiUtils.withErrorHandling(async (params) => {
    return await fetch('/api/data', { method: 'POST', body: JSON.stringify(params) });
  });
  
  // API call with optimistic updates
  const apiWithOptimistic = apiUtils.withOptimisticUpdate(
    async (params) => fetch('/api/data', { method: 'POST', body: JSON.stringify(params) }),
    { id: 'temp-id', name: 'Optimistic Data' } // optimistic data
  );
  
  return (
    <div>
      <button onClick={() => apiWithLoading.execute({ test: 'data' })}>
        Call API with Loading
      </button>
      {apiWithLoading.isLoading && <div>Loading...</div>}
      {apiWithLoading.error && <div>Error: {apiWithLoading.error}</div>}
    </div>
  );
}
```

## System Health Monitoring

```tsx
function SystemHealthMonitor() {
  const health = useSystemHealth();
  
  if (!health) return null;
  
  const statusColor = {
    healthy: 'green',
    degraded: 'yellow',
    unhealthy: 'red'
  }[health.status];
  
  return (
    <div style={{ color: statusColor }}>
      <h3>System Status: {health.status}</h3>
      
      <h4>Entity Systems:</h4>
      <ul>
        {Object.entries(health.entities).map(([name, status]) => (
          <li key={name}>
            {name}: <span style={{ color: status === 'active' ? 'green' : 'red' }}>
              {status}
            </span>
          </li>
        ))}
      </ul>
      
      {health.errors.length > 0 && (
        <div>
          <h4>Errors:</h4>
          <ul>
            {health.errors.map((error, i) => (
              <li key={i} style={{ color: 'red' }}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Advanced Usage

### Custom Entity Configuration

```typescript
interface CustomEntity extends BaseEntity {
  name: string;
  customField: string;
}

const customEntityConfig: EntityConfig<CustomEntity> = {
  entityName: 'customEntity',
  tableName: 'custom_entities',
  formFields: [
    {
      name: 'name',
      type: 'text',
      label: 'Name',
      required: true
    },
    {
      name: 'customField',
      type: 'text',
      label: 'Custom Field',
      required: false
    }
  ],
  successMessages: {
    create: 'Custom entity created!',
    update: 'Custom entity updated!',
    delete: 'Custom entity deleted!'
  }
};

// Register custom entity
const { system } = useIntegratedSystems();
const customEntitySystem = system.utils.registerEntity(customEntityConfig);
```

### Atomic Business Operations

```typescript
function AtomicOperationsExample() {
  const businessLogic = useBusinessLogic();
  
  const handleComplexOperation = async () => {
    if (!businessLogic) return;
    
    const operations = [
      {
        id: 'create-customer',
        priority: 1,
        execute: async () => {
          return await businessLogic.customers.createCustomer({
            name: 'New Customer',
            email: 'customer@example.com'
          });
        },
        rollback: async () => {
          // Rollback logic if needed
        }
      },
      {
        id: 'create-sale',
        priority: 2,
        execute: async () => {
          return await businessLogic.sales.createSale({
            customerId: 'new-customer-id',
            products: [{ productId: 'prod-1', quantity: 1, unitPrice: 100 }],
            paymentMethod: 'pix'
          });
        },
        rollback: async () => {
          // Rollback logic if needed
        }
      }
    ];
    
    const results = await businessLogic.executeAtomic(operations);
    
    results.forEach((result, index) => {
      if (result.success) {
        console.log(`Operation ${operations[index].id} succeeded:`, result.data);
      } else {
        console.error(`Operation ${operations[index].id} failed:`, result.error);
      }
    });
  };
  
  return (
    <button onClick={handleComplexOperation}>
      Execute Complex Operation
    </button>
  );
}
```

## Testing

The integration layer includes comprehensive tests:

```bash
# Run integration tests
npm test src/factories/integration/systemIntegration.test.ts

# Run all factory tests
npm test src/factories/
```

### Test Examples

```typescript
import { createSystemIntegration, entityConfigurations } from '@/factories/integration';

describe('Integration Tests', () => {
  it('should create complete entity system', () => {
    const system = createSystemIntegration('test-business');
    const customerSystem = system.utils.registerEntity(entityConfigurations.customer);
    
    expect(customerSystem.queries).toBeDefined();
    expect(customerSystem.crud).toBeDefined();
    expect(customerSystem.forms).toBeDefined();
    expect(customerSystem.businessLogic).toBeDefined();
  });
});
```

## Performance Considerations

- **Query Caching**: Automatic caching with configurable TTL
- **Optimistic Updates**: Optional optimistic updates for better UX
- **Real-time Subscriptions**: Configurable real-time data synchronization
- **Bundle Splitting**: Lazy loading of entity systems
- **Memory Management**: Automatic cleanup of resources

## Migration Guide

### From Legacy Components

1. **Replace individual hooks**:
   ```tsx
   // Before
   const customers = useCustomers();
   const createCustomer = useCreateCustomer();
   
   // After
   const { entities } = useIntegratedSystems();
   const customers = entities.customers.queries.useEntities();
   const createCustomer = entities.customers.crud.useCreate();
   ```

2. **Replace form dialogs**:
   ```tsx
   // Before
   <CustomerFormDialog {...props} />
   
   // After
   const { FormDialogWithCRUD } = entities.customers.forms;
   <FormDialogWithCRUD {...props} />
   ```

3. **Replace business logic**:
   ```tsx
   // Before
   const saleService = useSaleService();
   
   // After
   const businessLogic = useBusinessLogic();
   await businessLogic.sales.createSale(...);
   ```

## Troubleshooting

### Common Issues

1. **System not initializing**: Check business context is available
2. **Entity not found**: Ensure entity is registered before use
3. **Form validation errors**: Check form field configurations
4. **Business logic failures**: Check atomic operation rollback logs

### Debug Mode

```tsx
const { system, status } = useIntegratedSystems();

// Check system health
console.log('System health:', status.health);

// Check registered entities
console.log('Registered entities:', system.utils.getAllEntities());

// Monitor errors
const errorHandler = useGlobalErrorHandler();
console.log('Error stats:', errorHandler?.getErrorStats());
```

## Contributing

When adding new entities or extending the integration layer:

1. Create entity configuration in `entityConfigurations.ts`
2. Add form field configurations
3. Update type definitions
4. Add integration tests
5. Update documentation

## License

This integration layer is part of the WhatsApp Business CRM project and follows the same license terms.