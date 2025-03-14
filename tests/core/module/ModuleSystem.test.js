// tests/core/module/ModuleSystem.test.js

import { ModuleSystem, createModuleSystem } from '../../../src/core/module/ModuleSystem.js';
import { CoreModule } from '../../../src/core/module/Module.js';
import { ModuleError } from '../../../src/core/errors/index.js';

// Simple test module implementations without memory leaks
class SimpleModule extends CoreModule {
  static dependencies = ['errorSystem', 'eventBusSystem', 'config'];
  
  constructor(deps) {
    super(deps);
    this.initializeCount = 0;
    this.shutdownCount = 0;
  }
  
  async onInitialize() {
    this.initializeCount++;
    return Promise.resolve();
  }
  
  async onShutdown() {
    this.shutdownCount++;
    return Promise.resolve();
  }
}

class DependentModule extends CoreModule {
  static dependencies = ['errorSystem', 'eventBusSystem', 'config', 'simple'];
  
  constructor(deps) {
    super(deps);
    this.initializeCount = 0;
    this.shutdownCount = 0;
  }
  
  async onInitialize() {
    if (!this.deps.simple) {
      throw new Error('Missing simple dependency');
    }
    this.initializeCount++;
    return Promise.resolve();
  }
  
  async onShutdown() {
    this.shutdownCount++;
    return Promise.resolve();
  }
}

class CircularA extends CoreModule {
  static dependencies = ['errorSystem', 'eventBusSystem', 'config', 'circularB'];
}

class CircularB extends CoreModule {
  static dependencies = ['errorSystem', 'eventBusSystem', 'config', 'circularA'];
}

describe('ModuleSystem', () => {
  // Simple mock creator
  const createMocks = () => {
    const eventBus = {
      emitHistory: [],
      emit: async function(eventName, data) {
        this.emitHistory.push({ eventName, data });
        return true;
      }
    };

    const errorSystem = {
      errorHistory: [],
      handleError: async function(error, context) {
        this.errorHistory.push({ error, context });
      }
    };

    const eventBusSystem = {
      getEventBus: () => eventBus
    };
    
    const config = {
      moduleA: { configA: true },
      moduleB: { configB: true }
    };

    return { eventBus, errorSystem, eventBusSystem, config };
  };

  let mocks;
  let moduleSystem;

  beforeEach(() => {
    mocks = createMocks();
    moduleSystem = new ModuleSystem({
      errorSystem: mocks.errorSystem,
      eventBusSystem: mocks.eventBusSystem,
      config: mocks.config
    });
  });

  afterEach(async () => {
    // Clean up to avoid memory leaks
    if (moduleSystem && moduleSystem.initialized) {
      try {
        await moduleSystem.shutdown();
      } catch (e) {
        // Ignore shutdown errors during cleanup
      }
    }
    
    // Clean up event listeners
    if (moduleSystem) {
      moduleSystem.removeAllListeners();
    }
    
    // Clear references
    moduleSystem = null;
    mocks = null;
  });

  // Constructor tests
  describe('constructor', () => {
    test('should initialize with default state', () => {
      expect(moduleSystem.initialized).toBe(false);
      expect(moduleSystem.state.status).toBe('created');
      expect(moduleSystem.modules.size).toBe(0);
    });
    
    // Changed test to match actual behavior
    test('should require core dependencies', () => {
      let error;
      try {
        new ModuleSystem();
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toContain('Missing required core dependencies');
    });
    
    test('should throw error if missing core dependencies', () => {
      let error;
      try {
        new ModuleSystem({ 
          // Missing dependencies 
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toContain('Missing required core dependencies');
    });
    
    test('should throw error if eventBusSystem is invalid', () => {
      let error;
      try {
        new ModuleSystem({
          errorSystem: mocks.errorSystem,
          eventBusSystem: {}, // Missing getEventBus
          config: {}
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toContain('missing required methods');
    });
    
    test('should throw error if errorSystem is invalid', () => {
      let error;
      try {
        new ModuleSystem({
          errorSystem: {}, // Missing handleError
          eventBusSystem: mocks.eventBusSystem,
          config: {}
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toContain('missing required methods');
    });
  });

  // Event emission tests
  describe('event emission', () => {
    test('should emit events locally', async () => {
      let localCalled = false;
      moduleSystem.on('test', () => { localCalled = true; });
      
      await moduleSystem.emit('test', { data: 'value' });
      
      expect(localCalled).toBe(true);
    });
    
    test('should emit events through eventBus', async () => {
      await moduleSystem.emit('test', { data: 'value' });
      
      expect(mocks.eventBus.emitHistory.length).toBe(1);
      expect(mocks.eventBus.emitHistory[0].eventName).toBe('test');
    });
    
    // Test rewritten to match behavior - eventBusSystem is required
    test('should check for eventBusSystem existence', () => {
      let error;
      try {
        new ModuleSystem({
          errorSystem: mocks.errorSystem,
          // Missing eventBusSystem
          config: {}
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toContain('Missing required core dependencies');
    });
  });

  // Module registration tests  
  describe('module registration', () => {
    test('should register a module successfully', async () => {
      const module = await moduleSystem.register('test', SimpleModule);
      
      expect(moduleSystem.modules.size).toBe(1);
      expect(moduleSystem.modules.get('test')).toBe(module);
      expect(mocks.eventBus.emitHistory.length).toBeGreaterThan(0);
    });
    
    test('should pass config to module', async () => {
      const module = await moduleSystem.register('moduleA', SimpleModule);
      
      expect(module.config).toEqual({ configA: true });
    });
    
    test('should merge configs', async () => {
      const module = await moduleSystem.register('moduleA', SimpleModule, { 
        extraConfig: true 
      });
      
      expect(module.config.configA).toBe(true);
      expect(module.config.extraConfig).toBe(true);
    });
    
    test('should throw error when registering non-CoreModule', async () => {
      class InvalidModule {}
      
      let error;
      try {
        await moduleSystem.register('invalid', InvalidModule);
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.message).toMatch(/must extend CoreModule/);
    });
    
    test('should throw error when registering duplicate module', async () => {
      await moduleSystem.register('test', SimpleModule);
      
      let error;
      try {
        await moduleSystem.register('test', SimpleModule);
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.message).toMatch(/already registered/);
    });
    
    test('should set up error listener on module', async () => {
      const module = await moduleSystem.register('test', SimpleModule);
      
      // Trigger a module error
      const testError = new Error('Test error from module');
      await module.emit('module:error', {
        module: 'test',
        error: testError
      });
      
      // Error should be forwarded
      expect(mocks.errorSystem.errorHistory.length).toBeGreaterThan(0);
    });
  });

  // Module unregistration tests
  describe('module unregistration', () => {
    test('should unregister a module', async () => {
      await moduleSystem.register('test', SimpleModule);
      await moduleSystem.unregister('test');
      
      expect(moduleSystem.modules.size).toBe(0);
      expect(mocks.eventBus.emitHistory.some(e => 
        e.eventName === 'module:unregistered')).toBe(true);
    });
    
    test('should shutdown module if initialized during unregister', async () => {
      const module = await moduleSystem.register('test', SimpleModule);
      await moduleSystem.initialize();
      
      await moduleSystem.unregister('test');
      
      expect(module.shutdownCount).toBe(1);
      expect(moduleSystem.modules.size).toBe(0);
    });
    
    test('should do nothing if module not registered', async () => {
      await moduleSystem.unregister('nonexistent');
    });
    
    // Fixed test for proper error catching
    test('should handle errors during unregister', async () => {
      const module = await moduleSystem.register('test', SimpleModule);
      await moduleSystem.initialize();
      
      // Make shutdown throw
      const originalShutdown = module.shutdown;
      module.shutdown = async () => {
        throw new Error('Shutdown error');
      };
      
      let error;
      try {
        await moduleSystem.unregister('test');
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.message).toContain('Failed to unregister module');
      
      // Restore for cleanup
      module.shutdown = originalShutdown;
    });
  });

  // Module resolution tests
  describe('module resolution', () => {
    test('should resolve a registered module', async () => {
      const registered = await moduleSystem.register('test', SimpleModule);
      const resolved = await moduleSystem.resolve('test');
      
      expect(resolved).toBe(registered);
    });
    
    test('should throw error when resolving unregistered module', async () => {
      let error;
      try {
        await moduleSystem.resolve('nonexistent');
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.message).toMatch(/not registered/);
    });
  });

  // Dependency resolution tests
  describe('dependency resolution', () => {
    test('should initialize modules in dependency order', async () => {
      await moduleSystem.register('simple', SimpleModule);
      await moduleSystem.register('dependent', DependentModule);
      
      const order = moduleSystem.resolveDependencyOrder();
      
      expect(order.indexOf('simple')).toBeLessThan(order.indexOf('dependent'));
    });
    
    test('should detect circular dependencies', async () => {
      await moduleSystem.register('circularA', CircularA);
      await moduleSystem.register('circularB', CircularB);
      
      let error;
      try {
        moduleSystem.resolveDependencyOrder();
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.message).toMatch(/Circular dependency/);
    });
    
    test('should detect missing module dependencies', async () => {
      // Register dependent without its dependency
      await moduleSystem.register('dependent', DependentModule);
      
      let error;
      try {
        moduleSystem.resolveDependencyOrder();
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.message).toMatch(/missing module/);
    });
    
    test('should handle empty dependencies array', async () => {
      // Create module with empty dependencies
      class EmptyDepsModule extends CoreModule {
        static dependencies = [];
      }
      
      await moduleSystem.register('empty', EmptyDepsModule);
      const order = moduleSystem.resolveDependencyOrder();
      
      expect(order).toContain('empty');
    });
    
    test('should handle module with no static dependencies property', async () => {
      // Create module with no dependencies property
      class NoDepsModule extends CoreModule {
        // No static dependencies property
      }
      
      await moduleSystem.register('nodeps', NoDepsModule);
      const order = moduleSystem.resolveDependencyOrder();
      
      expect(order).toContain('nodeps');
    });
  });

  // Wire module dependencies tests
  describe('wireModuleDependencies', () => {
    test('should wire dependencies between modules', async () => {
      const simple = await moduleSystem.register('simple', SimpleModule);
      const dependent = await moduleSystem.register('dependent', DependentModule);
      
      await moduleSystem.wireModuleDependencies();
      
      expect(dependent.deps.simple).toBe(simple);
    });
    
    test('should skip core dependencies when wiring', async () => {
      const simple = await moduleSystem.register('simple', SimpleModule);
      
      // The original errorSystem should be preserved 
      const originalErrorSystem = simple.deps.errorSystem;
      await moduleSystem.wireModuleDependencies();
      
      expect(simple.deps.errorSystem).toBe(originalErrorSystem);
    });
  });

  // Initialization tests
  describe('initialization', () => {
    test('should initialize modules in dependency order', async () => {
      const simple = await moduleSystem.register('simple', SimpleModule);
      const dependent = await moduleSystem.register('dependent', DependentModule);
      
      await moduleSystem.initialize();
      
      expect(moduleSystem.initialized).toBe(true);
      expect(simple.initializeCount).toBe(1);
      expect(dependent.initializeCount).toBe(1);
      expect(mocks.eventBus.emitHistory.some(e => 
        e.eventName === 'system:initialized')).toBe(true);
    });
    
    test('should throw error if already initialized', async () => {
      await moduleSystem.initialize();
      
      let error;
      try {
        await moduleSystem.initialize();
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.message).toMatch(/already initialized/);
    });
    
    test('should handle errors during wireModuleDependencies', async () => {
      // Override wireModuleDependencies to throw
      const original = moduleSystem.wireModuleDependencies;
      moduleSystem.wireModuleDependencies = async () => {
        throw new Error('Wiring error');
      };
      
      let error;
      try {
        await moduleSystem.initialize();
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.message).toContain('initialize module system');
      expect(moduleSystem.state.status).toBe('error');
      
      // Restore for cleanup
      moduleSystem.wireModuleDependencies = original;
    });
    
    test('should handle errors during resolveDependencyOrder', async () => {
      // Create circular dependency to trigger error
      await moduleSystem.register('circularA', CircularA);
      await moduleSystem.register('circularB', CircularB);
      
      let error;
      try {
        await moduleSystem.initialize();
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.message).toContain('initialize module system');
      expect(moduleSystem.state.status).toBe('error');
    });
    
    test('should handle errors during module initialization', async () => {
      // Create module that throws during initialization
      class FailingModule extends CoreModule {
        async onInitialize() {
          throw new Error('Initialization failure');
        }
      }
      
      await moduleSystem.register('failing', FailingModule);
      
      let error;
      try {
        await moduleSystem.initialize();
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.message).toContain('initialize module system');
      expect(moduleSystem.state.status).toBe('error');
    });
  });

  // Error handling tests
  describe('error handling', () => {
    test('should handle module errors', async () => {
      const error = new Error('Test module error');
      
      await moduleSystem.handleModuleError('test', error);
      
      expect(moduleSystem.state.errors.length).toBe(1);
      expect(mocks.errorSystem.errorHistory.length).toBe(1);
      expect(mocks.eventBus.emitHistory.some(e => 
        e.eventName === 'module:error')).toBe(true);
    });
    
    test('should trim error history', async () => {
      // Add more errors than the limit
      for (let i = 0; i < 101; i++) {
        await moduleSystem.handleModuleError('test', new Error(`Error ${i}`));
      }
      
      expect(moduleSystem.state.errors.length).toBe(100);
    });
  });

  // Shutdown tests
  describe('shutdown', () => {
    test('should shutdown modules in reverse dependency order', async () => {
      const simple = await moduleSystem.register('simple', SimpleModule);
      const dependent = await moduleSystem.register('dependent', DependentModule);
      
      await moduleSystem.initialize();
      await moduleSystem.shutdown();
      
      expect(moduleSystem.initialized).toBe(false);
      expect(moduleSystem.state.status).toBe('shutdown');
      expect(simple.shutdownCount).toBe(1);
      expect(dependent.shutdownCount).toBe(1);
      expect(moduleSystem.modules.size).toBe(0);
      expect(mocks.eventBus.emitHistory.some(e => 
        e.eventName === 'system:shutdown')).toBe(true);
    });
    
    test('should do nothing if not initialized', async () => {
      await moduleSystem.shutdown();
      
      expect(moduleSystem.initialized).toBe(false);
    });
    
    // Fixed test for dependency resolution errors
    test('should handle errors during dependency resolution', async () => {
      // Register circular dependencies
      await moduleSystem.register('circularA', CircularA);
      await moduleSystem.register('circularB', CircularB);
      
      // Force initialized state
      moduleSystem.initialized = true;
      
      // Attempt shutdown should throw due to circular dependencies
      let error;
      try {
        await moduleSystem.shutdown();
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.message).toContain('Failed to shutdown module system');
      expect(moduleSystem.state.status).toBe('error');
      
      // Reset initialized state to avoid cleanup errors
      moduleSystem.initialized = false;
    });
    
    // Fixed test for module shutdown errors
    test('should handle errors during module shutdown', async () => {
      // Register a simple module
      const module = await moduleSystem.register('test', SimpleModule);
      await moduleSystem.initialize();
      
      // Replace shutdown with failing method - on the instance not the class
      const originalShutdown = module.shutdown;
      module.shutdown = async () => {
        throw new Error('Shutdown error');
      };
      
      let error;
      try {
        await moduleSystem.shutdown();
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeDefined();
      expect(error.message).toContain('Failed to shutdown module system');
      
      // Restore original for cleanup
      module.shutdown = originalShutdown;
    });
  });

  // Factory function tests
  describe('factory function', () => {
    test('should create module system with default dependencies', () => {
      const system = createModuleSystem();
      
      expect(system).toBeInstanceOf(ModuleSystem);
      expect(system.deps.errorSystem).toBeDefined();
      expect(system.deps.eventBusSystem).toBeDefined();
      expect(system.deps.config).toBeDefined();
      
      // Clean up
      system.removeAllListeners();
    });
    
    test('should merge provided dependencies with defaults', () => {
      const customConfig = { custom: true };
      const system = createModuleSystem({ config: customConfig });
      
      expect(system.deps.config).toBe(customConfig);
      expect(system.deps.errorSystem).toBeDefined();
      expect(system.deps.eventBusSystem).toBeDefined();
      
      // Clean up
      system.removeAllListeners();
    });
    
    test('should create eventBus with provided dependencies', () => {
      const system = createModuleSystem();
      const eventBus = system.deps.eventBusSystem.getEventBus();
      
      expect(eventBus).toBeDefined();
      
      // Clean up
      system.removeAllListeners();
    });
  });
});