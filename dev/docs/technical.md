# Toro_SM Information System - Technical Documentation
Version 1.1.0

## Table of Contents
1. [System Overview](#1-system-overview)
2. [System Architecture](#2-system-architecture) 
3. [Core Components](#3-core-components)
   - [Container (Dependency Injection)](#container-dependency-injection)
   - [Error System](#error-system)
   - [Module System](#module-system)
4. [Error Types](#4-error-types)
5. [Framework Integration](#5-framework-integration)
6. [Module Lifecycle](#6-module-lifecycle)
7. [Event-Driven Communication](#7-event-driven-communication)
8. [Database Architecture](#8-database-architecture)
9. [API Layer](#9-api-layer)
10. [Security](#10-security)
11. [Development & Deployment](#11-development--deployment)
12. [Directory Structure](#12-directory-structure)

## 1. System Overview
Toro_SM is an enterprise information system built on a hybrid modular architecture. It combines a modular core with event-driven services to provide various business functionalities.

## 2. System Architecture

### High-Level Architecture Diagram
```mermaid
graph TB
    subgraph Frontend Layer
        UI[Marko UI Components]
        SSR[Server-Side Rendering]
    end
    
    subgraph Core Layer
        API[API Gateway]
        CONT[Container]
        ERR[Error System]
        MOD[Module System]
        EVT[Event Bus]
    end
    
    subgraph Module Layer
        ACC[Accounting]
        HR[HR System] 
        INV[Inventory]
        CRM[CRM]
        WIKI[Wiki]
        DOC[Documentation]
        PM[Project Mgmt]
    end
    
    subgraph Data Layer
        DB[(PostgreSQL)]
        CACHE[(Redis)]
    end

    UI --> SSR
    SSR --> API
    API --> CONT
    CONT --> ERR
    CONT --> MOD
    CONT --> EVT
    MOD --> Module Layer
    Module Layer --> Data Layer
```

## 3. Core Components

### Container (Dependency Injection)
The Container now supports both singleton and factory-based components:

```javascript
class CoreContainer {
  constructor() {
    this.components = new Map();
    this.instances = new Map();
    this.dependencies = new Map();
    this.manifests = new Map();
    this.initialized = false;
  }

  // Registration methods
  register(name, Component, options = {})
  resolve(name)
  initialize()
  shutdown()
}
```

Component registration patterns:

```javascript
// Singleton Instance
const eventBus = new EventEmitter();
container.register('eventBus', () => eventBus);

// Factory Function
container.register('moduleSystem', (deps) => {
  return createModuleSystem(deps);
});

// Class Constructor
container.register('errorSystem', ErrorSystem);
```
### Error System
The Error System standardizes error handling:

```javascript
class ErrorSystem {
  async initialize()
  registerIntegration(framework, options)
  createError(type, code, message, details, options)
  async handleError(error, context)
}
```

It defines a CoreError base class:

```javascript
class CoreError extends Error {
  constructor(code, message, details, options)
  toJSON()
  static fromJSON(data)  
}
```

And several specialized error types:
- AccessError
- AuthError
- ConfigError
- ModuleError
- NetworkError
- ServiceError
- ValidationError

Error handling remains consistent but adds enhanced context:

```javascript
class ErrorSystem {
  handleError(error, context) {
    // Enhanced error context
    this.logger.error('Error occurred:', {
      module: context.module,
      operation: context.operation,
      timestamp: new Date().toISOString(),
      error: error.toJSON()
    });
  }
}```
### Module System
The Module system provides the base class for business modules:

```javascript
class CoreModule extends EventEmitter {
  constructor(deps)
  async initialize()
  async onConfigure()
  async setupEventHandlers() 
  async onInitialize()
  async handleError(error, context)
  async emit(eventName, args)
  async shutdown()  
}
```

The ModuleSystem provides enhanced module lifecycle management:

```javascript
class ModuleSystem extends EventEmitter {
  static dependencies = ['errorSystem', 'eventBus', 'config'];

  constructor(deps) {
    this.modules = new Map();
    this.state = {
      status: 'created',
      startTime: null,
      errors: [],
      metrics: new Map(),
      moduleHealth: new Map()
    };
  }

  // Registration and lifecycle methods
  register(name, Module, config)
  initialize()
  getSystemHealth()
  shutdown()
}
```

Modules can now include health monitoring and metrics:

```javascript
class CoreModule extends EventEmitter {
  constructor(deps) {
    this.state = {
      status: 'created',
      errors: [],
      metrics: new Map(),
      healthChecks: new Map()
    };
  }

  // Health monitoring methods
  registerHealthCheck(name, checkFn)
  checkHealth()
  recordMetric(name, value, tags)
}
```
## 4. Error Types
The Error System defines several specialized error types:

- **AccessError**: Authorization and access control errors
- **AuthError**: Authentication errors
- **ConfigError**: Configuration errors
- **ModuleError**: Module system and initialization errors
- **NetworkError**: Network related errors
- **ServiceError**: Service level errors
- **ValidationError**: Input validation errors

## 5. Framework Integration
The Error System integrates with the Fastify framework through the FastifyIntegration:

```javascript
class FastifyIntegration extends IFrameworkIntegration {
  async initialize(fastify, options)
  mapError(error)
  serializeError(error, context)
}
```

It maps Fastify errors to core error types and serializes errors for API responses.

### Application Bootstrap

The application bootstrap process is now more robust:

```javascript
export async function buildApp() {
  const container = new CoreContainer();

  // Register core systems
  container.register('errorSystem', createErrorSystem);
  container.register('eventBus', () => new EventEmitter());
  container.register('config', () => ({}));
  container.register('moduleSystem', createModuleSystem);

  // Initialize container
  await container.initialize();

  return fastify;
}
```

### Module Registration

Business modules are registered through the ModuleSystem:

```javascript
class HRModule extends CoreModule {
  static dependencies = ['database', 'auth'];

  async initialize() {
    await super.initialize();
    // Module specific initialization
  }

  // Health check implementation
  registerHealthChecks() {
    this.registerHealthCheck('database', async () => {
      return this.checkDatabaseConnection();
    });
  }
}
````

## 6. Module Lifecycle
Business modules extend the CoreModule class and implement lifecycle methods:

```javascript
class HRModule extends CoreModule {
  async onConfigure()
  async setupEventHandlers()
  async onInitialize() 
  async handleError(error, context)
  async shutdown()
}
```

Key lifecycle events include:
- Configuration
- Event handler setup
- Initialization
- Error handling
- Shutdown

## 7. Event-Driven Communication
Modules communicate via events emitted through the EventBus.
Events can now be handled both locally and globally:

```javascript
// Local module events
this.emit('employee:created', data);

// Global system events
this.deps.eventBus.emit('system:employee:created', data);
```
## 8. Database Architecture
The system uses PostgreSQL as the primary data store and Redis for caching.

## 9. API Layer
The API layer is implemented using Fastify and follows a modular structure.

## 10. Security
Security features include:
- JWT Authentication
- Role-Based Access Control
- Request Validation
- Rate Limiting

## 11. Development & Deployment
The development workflow involves:
1. Local Development with Vite HMR
2. Unit and Integration Testing with Jest
3. Building and Deployment

## 12. Directory Structure
```
tsmis/
├── src/
│   ├── core/          # Core system
│   │   ├── container/ # DI container
│   │   ├── errors/    # Error system
│   │   └── module/    # Module base
│   ├── modules/       # Business modules
│   └── services/      # Shared services
├── tests/             # Test files  
└── docs/              # Documentation
```