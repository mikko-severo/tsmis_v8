// src/core/module/Module.js
import { EventEmitter } from 'events';
import { CoreEventBus } from '../event/EventBus.js';
import { ModuleError, ValidationError } from '../errors/index.js';

export class CoreModule extends EventEmitter {
  static dependencies = ['errorSystem', 'eventBusSystem', 'config'];
  static version = '1.0.0';
  
  constructor(deps = {}) {
    super();
    this.deps = deps;
    this.eventBus = deps.eventBusSystem?.getEventBus();
    this.initialized = false;
    this.config = deps.config || {};
    
    // Simplified state tracking without health monitoring
    this.state = {
      status: 'created',
      startTime: null,
      errors: []
    };
    
    // Validate only core dependencies
    this.validateCoreDependencies();
  }

  // Only validate core system dependencies
  validateCoreDependencies() {
    const coreDeps = ['errorSystem', 'eventBusSystem', 'config'];
    const missing = coreDeps.filter(dep => !this.deps[dep]);

    if (missing.length > 0) {
      throw new ModuleError(
        'MISSING_CORE_DEPENDENCIES',
        `Missing required core dependencies: ${missing.join(', ')}`
      );
    }

    if (this.deps.eventBusSystem && typeof this.deps.eventBusSystem.getEventBus !== 'function') {
      throw new ModuleError(
        'INVALID_EVENTBUS_SYSTEM',
        'EventBusSystem missing required methods'
      );
    }

    if (this.deps.errorSystem && typeof this.deps.errorSystem.handleError !== 'function') {
      throw new ModuleError(
        'INVALID_ERROR_SYSTEM',
        'ErrorSystem missing required methods'
      );
    }
  }

  async validateConfig() {
    try {
      // Basic config validation
      if (this.config === null || typeof this.config !== 'object') {
        throw new ValidationError(
          'INVALID_CONFIG',
          'Configuration must be an object'
        );
      }

      // Module-specific validation
      await this.onValidateConfig();
      
      return true;
    } catch (error) {
      throw new ModuleError(
        'CONFIG_VALIDATION_FAILED',
        'Failed to validate configuration',
        { originalError: error }
      );
    }
  }

  async initialize() {
    if (this.initialized) {
      throw new ModuleError(
        'ALREADY_INITIALIZED',
        'Module is already initialized'
      );
    }

    try {
      this.state.startTime = Date.now();
      this.state.status = 'initializing';

      // Configuration phase
      await this.validateConfig();
      await this.onConfigure();

      // Setup phase
      await this.setupEventHandlers();

      // Initialize phase
      await this.onInitialize();
      
      this.initialized = true;
      this.state.status = 'running';

      await this.emit('module:initialized', {
        name: this.constructor.name,
        timestamp: new Date().toISOString()
      });

      return this;

    } catch (error) {
      this.state.status = 'error';
      this.state.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message
      });

      throw new ModuleError(
        'INITIALIZATION_FAILED',
        'Failed to initialize module',
        { originalError: error }
      );
    }
  }

  async handleError(error, context = {}) {
    const safeContext = context || {};

    // Add error to state
    this.state.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message,
      context: safeContext
    });

    // Trim error history
    if (this.state.errors.length > 100) {
      this.state.errors.shift();
    }

    // Forward to error system
    if (this.deps.errorSystem) {
      try {
        await this.deps.errorSystem.handleError(error, {
          module: this.constructor.name,
          ...safeContext
        });
      } catch (handlerError) {
        // Log error handling failure
        console.error('Error in error handling:', handlerError);
      }
    }

    // Emit error event
    await this.emit('module:error', {
      module: this.constructor.name,
      error,
      context: safeContext
    });

    return this;
  }

  async emit(eventName, ...args) {
    // Emit through local EventEmitter
    const localEmitResult = super.emit(eventName, ...args);

    // Broadcast through eventBus if available
    if (this.eventBus?.emit) {
      try {
        await this.eventBus.emit(eventName, ...args);
      } catch (error) {
        await this.handleError(error, {
          event: eventName,
          args
        });
      }
    }

    return localEmitResult;
  }

  async shutdown() {
    try {
      if (!this.initialized) {
        return this;
      }

      this.state.status = 'shutting_down';
      
      // Custom shutdown logic
      await this.onShutdown();
      
      // Reset state
      this.initialized = false;
      this.state.status = 'shutdown';
      this.state.startTime = null;
      
      await this.emit('module:shutdown', {
        name: this.constructor.name,
        timestamp: new Date().toISOString()
      });

      return this;
    } catch (error) {
      this.state.status = 'error';
      this.state.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        context: { phase: 'shutdown' }
      });

      throw new ModuleError(
        'SHUTDOWN_FAILED',
        'Failed to shutdown module',
        { originalError: error }
      );
    }
  }

  // Lifecycle hooks for derived classes
  async onValidateConfig() {
    // Override in derived classes
    return true;
  }

  async onConfigure() {
    // Override in derived classes
    return Promise.resolve();
  }

  async setupEventHandlers() {
    // Override in derived classes
    return Promise.resolve();
  }

  async onInitialize() {
    // Override in derived classes
    return Promise.resolve();
  }

  async onShutdown() {
    // Override in derived classes
    return Promise.resolve();
  }
}

export function createModule(deps = {}) {
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

  const mergedDeps = {
    ...defaultDeps,
    ...deps
  };

  return new CoreModule(mergedDeps);
}

export default {
  CoreModule,
  createModule
};