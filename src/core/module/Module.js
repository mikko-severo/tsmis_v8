// src/core/module/Module.js

import { EventEmitter } from 'events';
import { ModuleError } from '../errors/index.js';

export class CoreModule extends EventEmitter {
  static dependencies = ['errorSystem', 'eventBus', 'config'];
  static version = '1.0.0';

  constructor(deps = {}) {
    super();
    this.deps = deps;
    this.initialized = false;
    this.config = null;
    this.state = {
      status: 'created',
      startTime: null,
      errors: [],
      metrics: new Map()
    };

    // Validate required dependencies
    this.validateDependencies();
  }

  validateDependencies() {
    const missing = this.constructor.dependencies.filter(
      dep => !this.deps[dep]
    );

    if (missing.length > 0) {
      throw new ModuleError(
        'MISSING_DEPENDENCIES',
        `Missing required dependencies: ${missing.join(', ')}`
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

      // Added more explicit initialization steps
      await this.onConfigure();
      await this.setupEventHandlers();
      await this.onInitialize();
      
      this.initialized = true;
      this.state.status = 'running';

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

  async onConfigure() {
    // Cover lines 62-68: Explicit configuration handling
    if (this.config === null || this.config === undefined) {
      // Ensure config is always an object
      this.config = {};
    }

    // Optional additional configuration logic
    if (Object.keys(this.config).length === 0) {
      // Default configuration if empty
      this.config.default = true;
    }

    return Promise.resolve();
  }

  async setupEventHandlers() {
    // Default event handler setup
    // Can be overridden or extended by child classes
    return Promise.resolve();
  }

  async onInitialize() {
    // Default initialization logic
    // Can be overridden by child classes
    return Promise.resolve();
  }

  async handleError(error, context = {}) {
    // Ensure context is an object
    const safeContext = context || {};

    // Add error to state
    this.state.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message,
      context: safeContext
    });

    // Trim error history if needed
    if (this.state.errors.length > 100) {
      this.state.errors.shift();
    }

    // Forward to error system with enhanced error handling
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

    return this;
  }

  async emit(eventName, ...args) {
    // Emit through local EventEmitter
    const localEmitResult = super.emit(eventName, ...args);

    // Broadcast through eventBus
    if (this.deps.eventBus && typeof this.deps.eventBus.emit === 'function') {
      await this.deps.eventBus.emit(eventName, ...args);
    }

    return localEmitResult;
  }

  async shutdown() {
    try {
      // Cover line 188: Explicit shutdown handling
      if (!this.initialized) {
        // Early return if not initialized
        return this;
      }

      this.state.status = 'shutting_down';
      
      // Ensure onShutdown is called
      await this.onShutdown();
      
      // Reset state
      this.initialized = false;
      this.state.status = 'shutdown';
      this.state.startTime = null;
      
      return this;
    } catch (error) {
      // Enhanced error handling
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

  async onShutdown() {
    // Default shutdown logic
    // Can be overridden by child classes
    return Promise.resolve();
  }

  async getHealth() {
    try {
      // Cover line 119: Explicit metrics handling
      const metricsData = this.state.metrics instanceof Map 
        ? Object.fromEntries(this.state.metrics) 
        : {};

      return {
        name: this.constructor.name,
        version: this.constructor.version,
        status: this.state.status,
        uptime: this.state.startTime ? Date.now() - this.state.startTime : 0,
        initialized: this.initialized,
        errorCount: this.state.errors.length,
        lastError: this.state.errors[this.state.errors.length - 1],
        metrics: metricsData
      };
    } catch (error) {
      // Fallback error handling
      return {
        name: this.constructor.name,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
        metrics: {}
      };
    }
  }


  // Optional metric recording method
  recordMetric(name, value) {
    this.state.metrics.set(name, {
      value,
      timestamp: Date.now()
    });
  }
}

export function createModule(deps = {}) {
    // Provide default dependencies if not supplied
    const defaultDeps = {
      errorSystem: {
        handleError: async () => {} // No-op error handler
      },
      eventBus: new EventEmitter(), // Default event emitter
      config: {} // Empty configuration object
    };
  
    // Merge provided deps with defaults, giving priority to provided deps
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