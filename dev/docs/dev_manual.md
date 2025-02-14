# TSMIS Developer Manual 
Version 2.1.0

## Table of Contents
1. [Getting Started](#1-getting-started)
2. [Development Stack](#2-development-stack)
3. [Architecture Overview](#3-architecture-overview) 
4. [Implementing a Business Module](#4-implementing-a-business-module)
5. [Using the Container for DI](#5-using-the-container-for-di)
6. [Error Handling](#6-error-handling)
7. [Event Publishing and Handling](#7-event-publishing-and-handling)
8. [Writing Tests](#8-writing-tests)
9. [Coding Guidelines](#9-coding-guidelines)
10. [Troubleshooting](#10-troubleshooting)

## 1. Getting Started

### Prerequisites
- Node.js >= 18.0.0
- PostgreSQL >= 14.0
- Redis >= 6.0

## 2. Development Stack
- Runtime: Node.js
- API Framework: Fastify 
- Database: PostgreSQL
- Cache: Redis
- Frontend: Marko.js
- Build: Vite

## 3. Architecture Overview
The system follows a hybrid modular architecture with a modular core and event-driven services. Key components include:

- **CoreContainer**: Manages dependency injection and component lifecycle
- **ErrorSystem**: Standardizes error handling across the system
- **ModuleSystem**: Provides the base class for business modules
- **EventBus**: Enables inter-module communication via events

Business modules encapsulate domain-specific functionality and are integrated through the ModuleSystem and EventBus.

## 4. Implementing a Business Module
Business modules should extend the CoreModule class:

```javascript
import { CoreModule } from '@core/module/Module';

class HRModule extends CoreModule {
  // Implement lifecycle methods
  async onConfigure() {}
  async setupEventHandlers() {}
  async onInitialize() {}
  
  // Implement business logic
  async processEmployee(data) {}
}

export default HRModule;
```

Register the module with the ModuleSystem:

```javascript
container.register('hrModule', HRModule);
```

## 5. Using the Container for DI
The CoreContainer handles dependency injection. Inject dependencies in the module constructor:

```javascript
class HRModule extends CoreModule {
  constructor(deps) {
    super();
    this.databaseService = deps.database;
    this.authService = deps.auth;
  }
}
```

Resolve dependencies from the container:

```javascript
const hrModule = await container.resolve('hrModule');
```

## 6. Error Handling
Use the ErrorSystem to create and handle errors:

```javascript
import { ErrorSystem, ErrorCodes, ValidationError } from '@core/errors';

// Create an error
const error = new ValidationError(
  ErrorCodes.VALIDATION.INVALID_EMPLOYEE_ID,
  'Invalid employee ID'
);

// Handle an error
try {
  // Operation that may throw
} catch (err) {
  await this.handleError(err, { employeeId });
}
```

## 7. Event Publishing and Handling
Publish events using the CoreModule's emit method:

```javascript
await this.emit('employee.created', { id: employee.id });
```

Handle events by implementing the setupEventHandlers method:

```javascript
async setupEventHandlers() {
  this.on('project.assigned', this.handleProjectAssignment);  
}

async handleProjectAssignment(event) {
  // Handle the event
}
```

## 8. Writing Tests
Write unit tests for modules using Jest:

```javascript
describe('HRModule', () => {
  let hrModule;
  
  beforeEach(() => {
    hrModule = new HRModule({
      database: mockDatabaseService
    });
  });

  test('should create employee', async () => {
    await hrModule.createEmployee(employeeData);
    expect(mockDatabaseService.query).toHaveBeenCalled();
  });
});
```

## 9. Coding Guidelines
- Follow the error handling conventions
- Use the CoreContainer for dependency injection
- Publish events for important state changes
- Write unit tests for modules
- Follow the file naming and organization standards

## 10. Troubleshooting
- Check the logs for error details
- Verify module registration with the container
- Ensure event handlers are set up correctly
- Debug with breakpoints in VS Code