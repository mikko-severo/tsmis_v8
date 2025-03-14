// tests/core/module/Module.test.js
import { CoreModule } from '../../../src/core/module/Module.js';
import { ModuleError } from '../../../src/core/errors/index.js';
import { EventEmitter } from 'events';

describe('CoreModule', () => {
  let module;
  let errorSystem;
  let eventBus;
  let eventBusSystem;
  
  beforeEach(() => {
    // Simple mocks that track the minimum needed
    eventBus = new EventEmitter();
    eventBus.emit = function(eventName, ...args) {
      return EventEmitter.prototype.emit.call(this, eventName, ...args);
    };
    
    errorSystem = {
      handleError: function() {}
    };
    
    eventBusSystem = {
      getEventBus: function() {
        return eventBus;
      }
    };
    
    // Suppress intervals for testing
    global.setInterval = function() { return 123; };
    global.clearInterval = function() {};
    
    module = new CoreModule({
      errorSystem,
      eventBusSystem,
      config: {}
    });
  });
  
  afterEach(() => {
    module = null;
    eventBus = null;
    errorSystem = null;
    eventBusSystem = null;
  });
  
  test('should initialize with default state', () => {
    expect(module.initialized).toBe(false);
    expect(module.state.status).toBe('created');
  });
  
  test('should throw on missing dependencies', () => {
    expect(() => {
      new CoreModule({
        errorSystem
        // Missing eventBusSystem
      });
    }).toThrow(ModuleError);
  });
  
  test('should go through initialization and shutdown lifecycle', async () => {
    await module.initialize();
    
    expect(module.initialized).toBe(true);
    expect(module.state.status).toBe('running');
    
    await module.shutdown();
    
    expect(module.initialized).toBe(false);
    expect(module.state.status).toBe('shutdown');
  });
  
  test('should register health checks', async () => {
    await module.initialize();
    
    // Core module always has a state health check
    expect(module.state.healthChecks.has('state')).toBe(true);
    
    // Add a custom health check
    module.registerHealthCheck('custom', async () => {
      return { status: 'healthy' };
    });
    
    expect(module.state.healthChecks.has('custom')).toBe(true);
    
    const health = await module.checkHealth();
    expect(health.status).toBe('healthy');
  });
  
  test('should record metrics', () => {
    module.recordMetric('test-metric', 42);
    
    const metric = module.state.metrics.get('test-metric');
    expect(metric.value).toBe(42);
  });
  
  test('should handle errors', async () => {
    const error = new Error('Test error');
    await module.handleError(error);
    
    expect(module.state.errors.length).toBe(1);
    expect(module.state.errors[0].error).toBe('Test error');
  });
});