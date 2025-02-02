# TSMIS Developer Manual & Implementation Roadmap
Version 2.0.0

## Table of Contents
1. [Getting Started](#1-getting-started)
2. [Development Stack](#2-development-stack)
3. [Standards](#3-Standards)
4. [Implementation Roadmap](#4-implementation-roadmap)
5. [Architecture Guide](#5-architecture-guide)
6. [Module Development](#6-module-development)
7. [Event System](#7-event-system)
8. [Database Management](#8-database-management)
9. [Testing Strategy](#9-testing-strategy)
10. [Security Implementation](#10-security-implementation)
11. [Performance Optimization](#11-performance-optimization)
12. [DevOps & Deployment](#12-devops--deployment)
13. [Troubleshooting Guide](#13-troubleshooting-guide)
14. [Contributing Guidelines](#14-contributing-guidelines)

## 1. Getting Started

### Prerequisites
```bash
# Required software
Node.js >= 18.0.0
PostgreSQL >= 14.0
RabbitMQ >= 3.8

# Optional but recommended
pgAdmin 4
Postman/Insomnia
VS Code + Extensions
```

## 2. Development Stack

### Core Technologies
| Category | Technology | Purpose |
|----------|------------|----------|
| Runtime | Node.js | Server runtime |
| Database | PostgreSQL | Data storage |
| Message Queue | RabbitMQ | Event system |
| Frontend | Marko.js | UI/SSR |
| Build Tool | Vite | Dev server/bundling |
| Testing | Jest | Testing framework |


## 3. Standards

### Standards
- Consistent file naming
- Clear error handling
- Comprehensive testing
- Documented interfaces
- Type-safe operations

### Implementation Focus
- Modularity
- Encapsulation
- Performance
- Maintainability
- Testability


## 4. Implementation Roadmap

### Phase 1: Foundation (Current)
- [x] Project structure
- [x] Core architecture
- [ ] Basic components
  - [ ] Container system
  - [ ] Module system
  - [ ] Event system
  - [ ] Error system
  - [ ] Database integration

### Phase 2: Core Services
- [ ] Authentication and Authorization system/framework
- [ ] File management
- [ ] Email system/framewok
- [ ] Basic UI components
- [ ] Development tools

### Phase 3: Base Modules
- [ ] User management
- [ ] Basic inventory
- [ ] Document system
- [ ] Audit logging
- [ ] Simple CRM

### Phase 4: Advanced Features
- [ ] Advanced inventory
- [ ] HR system
- [ ] Scheduling system
- [ ] Document management
- [ ] Advanced CRM

### Phase 5: Integration & Scale
- [ ] Performance optimization
- [ ] Advanced caching
- [ ] Search optimization
- [ ] Reporting system
- [ ] Analytics

### Phase 6: Enterprise Features
- [ ] Advanced security
- [ ] Workflow engine
- [ ] Business rules engine
- [ ] Integration framework
- [ ] Advanced analytics

### Phase 7: Enhancement & Extension
- [ ] Plugin system
- [ ] API marketplace
- [ ] Custom workflows
- [ ] Mobile support
- [ ] White-labeling

## 5. Architecture Guide

### System Architecture
```mermaid
graph TB
    subgraph Frontend
        UI[Marko UI Components]
        SSR[Server-Side Rendering]
    end
    
    subgraph Core Services
        API[API Gateway]
        Auth[Authentication]
        Events[Event Bus]
        Files[File Manager]
    end
    
    subgraph Business Modules
        INV[Inventory]
        CRM[Customer Management]
        HR[Human Resources]
        DOC[Documentation]
        PM[Project Management]
    end
    
    subgraph Data Layer
        DB[(PostgreSQL)]
        MQ[RabbitMQ]
        FS[File Storage]
    end

    UI --> SSR
    SSR --> API
    API --> Auth
    API --> Core Services
    Core Services --> Business Modules
    Business Modules --> Data Layer
```

### Directory Structure
```
tsmis/
├── src/
│   ├── core/               # Core system
│   │   ├── container/      # DI container
│   │   ├── events/         # Event system
│   │   ├── database/       # Database
│   │   └── security/       # Security
│   ├── modules/            # Business modules
│   │   ├── inventory/
│   │   ├── crm/
│   │   └── hr/
│   ├── services/           # Shared services
│   └── utils/              # Utilities
├── tests/                  # Test files
├── docs/                   # Documentation
└── scripts/                # Utility scripts
```

## 6. Module Development

### Module Structure
```javascript
// src/modules/inventory/index.js
import { Module } from '@core/Module';

export class InventoryModule extends Module {
  static dependencies = ['database', 'eventBus', 'auth'];
  
  constructor(deps) {
    super(deps);
    this.services = new Map();
  }

  async initialize() {
    await this.validateConfig();
    await this.setupDatabase();
    await this.registerEventHandlers();
    await this.initializeServices();
  }

  async setupDatabase() {
    await this.deps.database.query(`
      CREATE SCHEMA IF NOT EXISTS inventory;
      
      CREATE TABLE IF NOT EXISTS inventory.items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async registerEventHandlers() {
    await this.deps.eventBus.subscribe(
      'order.created',
      this.handleOrderCreated.bind(this)
    );
  }

  getRoutes() {
    return {
      '/api/inventory/items': {
        get: {
          handler: this.getItems.bind(this),
          schema: {
            response: {
              200: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    name: { type: 'string' },
                    quantity: { type: 'number' }
                  }
                }
              }
            }
          }
        },
        post: {
          handler: this.createItem.bind(this),
          schema: {
            body: {
              type: 'object',
              required: ['name', 'quantity'],
              properties: {
                name: { type: 'string' },
                quantity: { type: 'number' }
              }
            }
          }
        }
      }
    };
  }
}
```

### Service Implementation
```javascript
// src/modules/inventory/services/ItemService.js
export class ItemService {
  constructor(database, eventBus) {
    this.db = database;
    this.eventBus = eventBus;
  }

  async createItem(data) {
    const result = await this.db.query(
      'INSERT INTO inventory.items (name, quantity) VALUES ($1, $2) RETURNING *',
      [data.name, data.quantity]
    );

    await this.eventBus.publish('inventory.item.created', {
      item: result.rows[0]
    });

    return result.rows[0];
  }

  async updateStock(itemId, quantity) {
    return await this.db.transaction(async (client) => {
      const result = await client.query(
        'UPDATE inventory.items SET quantity = quantity + $2 WHERE id = $1 RETURNING *',
        [itemId, quantity]
      );

      if (result.rows[0].quantity < 0) {
        throw new Error('Insufficient stock');
      }

      return result.rows[0];
    });
  }
}
```

## 7. Event System

### Event Patterns
```javascript
// Publishing events
await eventBus.publish('inventory.updated', {
  itemId: 123,
  quantity: 50,
  metadata: {
    timestamp: new Date(),
    user: 'system',
    source: 'InventoryModule'
  }
});

// Subscribing to events
await eventBus.subscribe('inventory.updated', 
  async (data, metadata) => {
    try {
      await this.handleInventoryUpdate(data);
    } catch (error) {
      // Error handling with retry mechanism
      throw error;
    }
  },
  {
    queue: 'inventory-updates',
    retries: 3,
    backoff: {
      type: 'exponential',
      initial: 1000
    }
  }
);
```

### Event Schema
```javascript
// Event schema definition
const eventSchema = {
  type: 'object',
  required: ['type', 'data', 'metadata'],
  properties: {
    type: { type: 'string' },
    data: { type: 'object' },
    metadata: {
      type: 'object',
      required: ['timestamp', 'source'],
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        source: { type: 'string' },
        user: { type: 'string' },
        correlationId: { type: 'string' }
      }
    }
  }
};
```

## 8. Database Management

### Query Patterns
```javascript
// Basic queries
const items = await db.query(
  'SELECT * FROM inventory.items WHERE quantity > $1',
  [0]
);

// Transactions
await db.transaction(async (client) => {
  await client.query('UPDATE inventory.items SET quantity = quantity - 1');
  await client.query('INSERT INTO audit.log ...');
});

// Batch operations
await db.batch([
  {
    text: 'UPDATE inventory.items SET quantity = $1 WHERE id = $2',
    values: [10, 1]
  },
  {
    text: 'INSERT INTO audit.log (action, data) VALUES ($1, $2)',
    values: ['update', { itemId: 1, quantity: 10 }]
  }
]);
```

### Schema Management
```sql
-- Schema versioning
CREATE TABLE IF NOT EXISTS system.migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Example migration
CREATE OR REPLACE FUNCTION inventory.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inventory_timestamp
    BEFORE UPDATE ON inventory.items
    FOR EACH ROW
    EXECUTE FUNCTION inventory.update_timestamp();
```

## 9. Testing Strategy

### Test Categories

1. **Unit Tests**
```javascript
// Service test
describe('ItemService', () => {
  let service;
  let mockDb;
  let mockEventBus;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn()
    };
    mockEventBus = {
      publish: jest.fn()
    };
    service = new ItemService(mockDb, mockEventBus);
  });

  it('should create item', async () => {
    const item = { name: 'Test Item', quantity: 10 };
    mockDb.query.mockResolvedValue({ rows: [{ ...item, id: 1 }] });

    const result = await service.createItem(item);
    
    expect(mockDb.query).toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'inventory.item.created',
      expect.any(Object)
    );
    expect(result).toHaveProperty('id', 1);
  });
});
```

2. **Integration Tests**
```javascript
// Module integration test
describe('InventoryModule Integration', () => {
  let module;
  let container;

  beforeAll(async () => {
    container = await setupTestContainer();
    module = await container.resolve('inventory');
  });

  it('should handle order creation', async () => {
    const order = {
      items: [{ id: 1, quantity: 2 }]
    };

    await container.get('eventBus').publish('order.created', order);
    
    // Wait for event processing
    await new Promise(r => setTimeout(r, 100));
    
    const item = await module.getItem(1);
    expect(item.quantity).toBe(8); // Initial 10 - 2
  });
});
```

3. **E2E Tests**
```javascript
// API endpoint test
describe('Inventory API', () => {
  let app;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  it('should create item', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/inventory/items',
      payload: {
        name: 'Test Item',
        quantity: 10
      }
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toHaveProperty('id');
  });
});
```

## 10. Security Implementation

### Authentication 
```javascript
// JWT authentication configuration
fastify.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET,
  sign: {
    expiresIn: '1h',
    issuer: 'tsmis'
  },
  verify: {
    issuer: 'tsmis'
  }
});

// Authentication decorator
fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
});
```

### Authorization
```javascript
// Role-based access control
const rbac = {
  roles: {
    admin: {
      can: ['manage:all']
    },
    manager: {
      can: ['read:all', 'write:own', 'manage:department']
    },
    user: {
      can: ['read:own', 'write:own']
    }
  }
};

// Authorization middleware
const authorize = (permission) => async (request, reply) => {
  const user = request.user;
  const role = rbac.roles[user.role];
  
  if (!role || !can(role, permission)) {
    reply.code(403).send({
      error: 'Forbidden',
      message: 'Insufficient permissions'
    });
  }
};

// Usage in routes
fastify.get('/api/inventory',
  { 
    preHandler: [
      fastify.authenticate,
      authorize('read:inventory')
    ]
  },
  async (request, reply) => {
    // Route handler
  }
);
```

### Input Validation
```javascript
// Request validation schema
const createItemSchema = {
  body: {
    type: 'object',
    required: ['name', 'quantity'],
    properties: {
      name: { 
        type: 'string',
        minLength: 1,
        maxLength: 255,
        pattern: '^[a-zA-Z0-9-_. ]+$'
      },
      quantity: {
        type: 'integer',
        minimum: 0
      },
      category: {
        type: 'string',
        enum: ['raw', 'finished', 'maintenance']
      }
    },
    additionalProperties: false
  }
};

// Validation in route
fastify.post('/api/inventory/items', {
  schema: createItemSchema,
  handler: async (request, reply) => {
    // Handler logic
  }
});
```

## 11. Performance Optimization

### Query Optimization
```javascript
// Using prepared statements
const preparedQueries = {
  getItem: {
    text: 'SELECT * FROM inventory.items WHERE id = $1',
    name: 'get-item'
  },
  updateQuantity: {
    text: 'UPDATE inventory.items SET quantity = $2 WHERE id = $1',
    name: 'update-quantity'
  }
};

// Usage
const result = await db.query(preparedQueries.getItem, [itemId]);

// Batch operations
const batchUpdate = items.map(item => ({
  text: preparedQueries.updateQuantity.text,
  values: [item.id, item.quantity]
}));

await db.batch(batchUpdate);
```

### Optimization Techniques
```javascript
// Event batching
class EventBatcher {
  constructor(eventBus, options = {}) {
    this.eventBus = eventBus;
    this.batchSize = options.batchSize || 100;
    this.flushInterval = options.flushInterval || 5000;
    this.events = [];
  }

  async add(event) {
    this.events.push(event);
    
    if (this.events.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush() {
    if (this.events.length === 0) return;
    
    const batch = this.events.splice(0);
    await this.eventBus.publish('batch.events', batch);
  }
}

// Query result caching in memory (for read-heavy data)
const queryCache = new Map();
const cacheTTL = 5 * 60 * 1000; // 5 minutes

async function getCachedQuery(key, queryFn) {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < cacheTTL) {
    return cached.data;
  }

  const data = await queryFn();
  queryCache.set(key, {
    data,
    timestamp: Date.now()
  });
  
  return data;
}
```

## 12. DevOps & Deployment

### Development Environment
```javascript
// vite.config.js
export default defineConfig({
  server: {
    hmr: true,
    port: 3000
  },
  plugins: [
    marko(),
  ],
  build: {
    sourcemap: true,
    outDir: './dist',
    rollupOptions: {
      input: {
        main: './src/index.js'
      }
    }
  }
});

// jest.config.js
export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest',
    '^.+\\.marko$': '@marko/jest'
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80
    }
  }
};
```

### Database Migrations
```javascript
// migrations/001_initial_schema.js
export async function up(db) {
  await db.query(`
    CREATE SCHEMA inventory;
    
    CREATE TABLE inventory.items (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      category VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX idx_items_category ON inventory.items(category);
  `);
}

export async function down(db) {
  await db.query(`
    DROP SCHEMA inventory CASCADE;
  `);
}

// Migration runner
async function runMigrations(db) {
  const migrations = await loadMigrations();
  
  for (const migration of migrations) {
    await db.transaction(async (client) => {
      await migration.up(client);
      await client.query(
        'INSERT INTO system.migrations (name) VALUES ($1)',
        [migration.name]
      );
    });
  }
}
```

### Performance Monitoring
```javascript
// Monitoring setup
import prometheus from 'prom-client';

const metrics = {
  httpRequestDuration: new prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code']
  }),
  
  eventProcessingDuration: new prometheus.Histogram({
    name: 'event_processing_duration_seconds',
    help: 'Duration of event processing in seconds',
    labelNames: ['event_type']
  }),
  
  activeConnections: new prometheus.Gauge({
    name: 'active_connections',
    help: 'Number of active connections'
  })
};

// Usage in routes
fastify.addHook('onRequest', (request, reply, done) => {
  request.metrics = {
    startTime: process.hrtime()
  };
  done();
});

fastify.addHook('onResponse', (request, reply, done) => {
  const duration = process.hrtime(request.metrics.startTime);
  metrics.httpRequestDuration.observe(
    {
      method: request.method,
      route: request.routerPath,
      status_code: reply.statusCode
    },
    duration[0] + duration[1] / 1e9
  );
  done();
});
```

## 13. Troubleshooting Guide

### Common Issues & Solutions

1. **Database Connection Issues**
```javascript
// Connection pool monitoring
const pool = new Pool({
  ...config,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// Health check query
async function checkDatabase() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
```

2. **Event Processing Issues**
```javascript
class EventMonitor {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.failures = new Map();
  }

  async monitorEvent(eventType, handler) {
    try {
      await handler();
      this.clearFailures(eventType);
    } catch (error) {
      this.recordFailure(eventType, error);
    }
  }

  recordFailure(eventType, error) {
    const failures = this.failures.get(eventType) || [];
    failures.push({
      timestamp: new Date(),
      error: error.message
    });
    
    if (failures.length > 3) {
      // Alert on repeated failures
      this.alertOperations(eventType, failures);
    }
    
    this.failures.set(eventType, failures);
  }
}
```

## 14. Contributing Guidelines

### Code Style
```javascript
// ESLint configuration
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:node/recommended'
  ],
  rules: {
    'node/exports-style': ['error', 'module.exports'],
    'node/file-extension-in-import': ['error', 'always'],
    'node/prefer-global/buffer': ['error', 'always'],
    'node/prefer-global/console': ['error', 'always'],
    'node/prefer-global/process': ['error', 'always'],
    'node/prefer-promises/dns': 'error',
    'node/prefer-promises/fs': 'error'
  }
};
```

### Pull Request Guidelines
1. Create feature branch
2. Write tests
3. Update documentation
4. Follow code style
5. Create meaningful commits
6. Write clear PR description
7. Request review
8. Address feedback

### Documentation
- Update technical documentation
- Include JSDoc comments
- Update README
- Add migration notes if needed
- Update API documentation

### Authentication
```javascript
// JWT authentication
fastify.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET,
  sign: {
    expi