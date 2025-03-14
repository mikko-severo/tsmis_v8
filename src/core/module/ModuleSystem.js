// src/core/module/ModuleSystem.js

import { EventEmitter } from 'events';
import { CoreModule } from './Module.js';
import { ModuleError, ValidationError } from '../errors/index.js';
import { CoreEventBus } from '../event/EventBus.js';

export class ModuleSystem extends EventEmitter {
  static dependencies = ['errorSystem', 'eventBusSystem', 'config'];

  constructor(deps) {
    super();
    this.deps = deps || {};
    this.modules = new Map();
    this.initialized = false;
    
    // Simplified state without health monitoring
    this.state = {
      status: 'created',
      startTime: null,
      errors: []
    };

    // Validate core dependencies
    this.validateCoreDependencies();
  }

  validateCoreDependencies() {
    const coreDeps = ['errorSystem', 'eventBusSystem', 'config'];
    const missing = coreDeps.filter(dep => !this.deps[dep]);

    if (missing.length > 0) {
      throw new ModuleError(
        'MISSING_CORE_DEPENDENCIES',
        `Missing required core dependencies: ${missing.join(', ')}`
      );
    }

    if (!this.deps.eventBusSystem?.getEventBus) {
      throw new ModuleError(
        'INVALID_EVENTBUS_SYSTEM',
        'EventBusSystem missing required methods'
      );
    }

    if (!this.deps.errorSystem?.handleError) {
      throw new ModuleError(
        'INVALID_ERROR_SYSTEM',
        'ErrorSystem missing required methods'
      );
    }
  }

  async emit(eventName, ...args) {
    // Local EventEmitter emission
    const localEmitResult = super.emit(eventName, ...args);
    
    // Use eventBusSystem for global events
    if (this.deps.eventBusSystem) {
      const eventBus = this.deps.eventBusSystem.getEventBus();
      await eventBus.emit(eventName, ...args);
    }
    
    return localEmitResult;
  }

  async register(name, ModuleClass, config = {}) {
    if (!(ModuleClass.prototype instanceof CoreModule)) {
      throw new ValidationError(
        'INVALID_MODULE',
        'Module must extend CoreModule'
      );
    }

    if (this.modules.has(name)) {
      throw new ModuleError(
        'DUPLICATE_MODULE',
        `Module ${name} is already registered`
      );
    }

    try {
      // Create the module with just the core dependencies
      const module = new ModuleClass({
        errorSystem: this.deps.errorSystem,
        eventBusSystem: this.deps.eventBusSystem,
        config: {
          ...this.deps.config?.[name],
          ...config
        }
      });

      this.modules.set(name, module);

      // Setup error listener
      module.on('module:error', async (errorData) => {
        await this.handleModuleError(name, errorData.error);
      });

      await this.emit('module:registered', {
        name,
        timestamp: new Date().toISOString()
      });

      return module;
    } catch (error) {
      throw new ModuleError(
        'REGISTRATION_FAILED',
        `Failed to register module ${name}`,
        { originalError: error }
      );
    }
  }

  async unregister(name) {
    const module = this.modules.get(name);
    if (!module) return;

    try {
      if (module.initialized) {
        await module.shutdown();
      }
      
      this.modules.delete(name);
      
      await this.emit('module:unregistered', {
        name,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      throw new ModuleError(
        'UNREGISTER_FAILED',
        `Failed to unregister module ${name}`,
        { originalError: error }
      );
    }
  }

  async resolve(name) {
    const module = this.modules.get(name);
    if (!module) {
      throw new ModuleError(
        'MODULE_NOT_FOUND',
        `Module ${name} is not registered`
      );
    }
    return module;
  }

  async initialize() {
    if (this.initialized) {
      throw new ModuleError(
        'ALREADY_INITIALIZED',
        'ModuleSystem is already initialized'
      );
    }

    try {
      this.state.startTime = Date.now();
      this.state.status = 'initializing';

      // Connect module dependencies
      await this.wireModuleDependencies();
      
      // Check for circular dependencies
      const initOrder = this.resolveDependencyOrder();
      
      // Initialize modules in the correct order
      for (const name of initOrder) {
        const module = this.modules.get(name);
        await module.initialize();
      }

      this.initialized = true;
      this.state.status = 'running';

      await this.emit('system:initialized', {
        timestamp: new Date().toISOString(),
        modules: Array.from(this.modules.keys())
      });

    } catch (error) {
      this.state.status = 'error';
      throw new ModuleError(
        'INITIALIZATION_FAILED',
        'Failed to initialize module system',
        { originalError: error }
      );
    }
  }

  async wireModuleDependencies() {
    // For each module, inject its module dependencies
    for (const [name, module] of this.modules.entries()) {
      const deps = module.constructor.dependencies || [];
      
      // For each dependency that's another module
      for (const dep of deps) {
        // Skip core dependencies
        if (dep === 'errorSystem' || dep === 'eventBusSystem' || dep === 'config') {
          continue;
        }
        
        // Check if dependency is a registered module
        if (this.modules.has(dep)) {
          // Inject the module reference
          module.deps[dep] = this.modules.get(dep);
        }
      }
    }
  }

  resolveDependencyOrder() {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    const visit = (name) => {
      if (visited.has(name)) return;
      
      // Detect circular dependencies
      if (visiting.has(name)) {
        throw new ModuleError(
          'CIRCULAR_DEPENDENCY',
          `Circular dependency detected for module: ${name}`
        );
      }

      visiting.add(name);

      const module = this.modules.get(name);
      const deps = module.constructor.dependencies || [];

      // Check module dependencies
      for (const dep of deps) {
        // Skip core dependencies
        if (dep === 'errorSystem' || dep === 'eventBusSystem' || dep === 'config') {
          continue;
        }
        
        // Check if module dependency exists
        if (!this.modules.has(dep)) {
          throw new ModuleError(
            'MISSING_DEPENDENCY',
            `Module ${name} requires missing module: ${dep}`
          );
        }
        
        // Recursively visit dependencies
        visit(dep);
      }

      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    // Visit all modules to build dependency order
    for (const name of this.modules.keys()) {
      visit(name);
    }

    return order;
  }

  async handleModuleError(moduleName, error) {
    this.state.errors.push({
      timestamp: new Date().toISOString(),
      module: moduleName,
      error: error.message
    });

    // Trim error history
    if (this.state.errors.length > 100) {
      this.state.errors.shift();
    }

    // Forward to error system
    await this.deps.errorSystem.handleError(error, {
      source: 'ModuleSystem',
      module: moduleName
    });

    await this.emit('module:error', {
      module: moduleName,
      error,
      timestamp: new Date().toISOString()
    });
  }

  async shutdown() {
    if (!this.initialized) return;

    try {
      this.state.status = 'shutting_down';

      // Shutdown modules in reverse dependency order
      const shutdownOrder = this.resolveDependencyOrder().reverse();

      for (const name of shutdownOrder) {
        const module = this.modules.get(name);
        await module.shutdown();
      }

      this.modules.clear();
      this.initialized = false;
      this.state.status = 'shutdown';

      await this.emit('system:shutdown', {
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.state.status = 'error';
      throw new ModuleError(
        'SHUTDOWN_FAILED',
        'Failed to shutdown module system',
        { originalError: error }
      );
    }
  }
}

export function createModuleSystem(deps = {}) {
  const defaultDeps = {
    errorSystem: {
      handleError: async () => {} // No-op error handler
    },
    eventBusSystem: {
      getEventBus: () => new CoreEventBus({
        errorSystem: deps.errorSystem, 
        config: deps.config
      })
    },
    config: {} // Empty configuration object
  };
  
  return new ModuleSystem({
    ...defaultDeps,
    ...deps
  });
}

export default {
  ModuleSystem,
  createModuleSystem
};