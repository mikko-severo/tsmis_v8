// tests/core/module/Module.test.js

import { CoreModule, createModule } from "../../../src/core/module/Module.js";
// import ModuleDefault from '../../../src/core/module/Module.js';
import { ModuleError } from "../../../src/core/errors/index.js";
import { EventEmitter } from "events";
import assert from "assert";

describe("CoreModule", () => {
  let mockDeps;
  let errorHandlerCalls;
  let loggerCalls;

  beforeEach(() => {
    // Reset call trackers
    errorHandlerCalls = [];
    loggerCalls = [];

    // Setup complete mock dependencies
    mockDeps = {
      errorSystem: {
        handleError: async (error, context) => {
          errorHandlerCalls.push({ error, context });
        },
      },
      eventBus: new EventEmitter(),
      config: {
        modules: {},
      },
      logger: {
        info: (...args) => loggerCalls.push({ level: "info", args }),
        error: (...args) => loggerCalls.push({ level: "error", args }),
        warn: (...args) => loggerCalls.push({ level: "warn", args }),
      },
    };
  });

  describe("Construction", () => {
    test("should create instance with dependencies", () => {
      const module = new CoreModule(mockDeps);
      expect(module.deps).toBeDefined();
      expect(module.initialized).toBe(false);
    });

    test("should throw if error system is missing", () => {
      const invalidDeps = { ...mockDeps };
      delete invalidDeps.errorSystem;

      expect(() => new CoreModule(invalidDeps)).toThrow(ModuleError);
    });
    test("should create instance with no dependencies", () => {
      expect(() => new CoreModule()).toThrow(ModuleError);
    });
  });

  describe("Module Registration", () => {
    let module;

    beforeEach(() => {
      module = new CoreModule(mockDeps);
    });

    test("should register a module", async () => {
      const result = await module.initialize();
      expect(result).toBeDefined();
    });

    test("should not register duplicate module", async () => {
      await module.initialize();
      await expect(module.initialize()).rejects.toThrow(ModuleError);
    });

    test("should check version compatibility", async () => {
      class TestModule extends CoreModule {
        static version = "2.0.0";
      }

      const testModule = new TestModule(mockDeps);
      await expect(testModule.initialize()).resolves.not.toThrow();
    });
  });

  describe("Dependencies Resolution", () => {
    test("should resolve dependencies", async () => {
      class TestModule extends CoreModule {
        static dependencies = ["errorSystem"];
      }

      const module = new TestModule(mockDeps);
      await expect(module.initialize()).resolves.not.toThrow();
    });

    test("should throw on missing dependencies", () => {
      class TestModule extends CoreModule {
        static dependencies = ["nonexistent"];
      }

      expect(() => new TestModule(mockDeps)).toThrow(ModuleError);
    });
  });

  describe("Event Broadcasting", () => {
    let module;
    let eventCalls;

    beforeEach(() => {
      module = new CoreModule(mockDeps);
      eventCalls = [];
    });

    test("should broadcast events to modules", async () => {
      mockDeps.eventBus.on("test:event", (data) => {
        eventCalls.push(data);
      });

      await module.initialize();
      await module.emit("test:event", { data: "test" });

      expect(eventCalls.length).toBe(1);
      expect(eventCalls[0].data).toBe("test");
    });
  });

  describe("Hooks System", () => {
    let module;
    let hookCalls;

    beforeEach(() => {
      module = new CoreModule(mockDeps);
      hookCalls = [];
    });

    test("should register and run hooks", async () => {
      await module.initialize();

      // Register hook
      module.on("test:hook", (data) => {
        hookCalls.push(data);
      });

      // Emit hook event
      module.emit("test:hook", { data: "test" });

      expect(hookCalls.length).toBe(1);
      expect(hookCalls[0].data).toBe("test");
    });
  });

  describe("State Management", () => {
    let module;

    beforeEach(() => {
      module = new CoreModule(mockDeps);
    });

    test("should track module state", async () => {
      expect(module.state.status).toBe("created");

      await module.initialize();
      expect(module.state.status).toBe("running");

      await module.shutdown();
      expect(module.state.status).toBe("shutdown");
    });
  });

  describe("Lifecycle", () => {
    let module;

    beforeEach(() => {
      module = new CoreModule(mockDeps);
    });

    test("should handle initialization and shutdown", async () => {
      // Test initialization
      await module.initialize();
      expect(module.initialized).toBe(true);
      expect(module.state.status).toBe("running");

      // Test shutdown
      await module.shutdown();
      expect(module.initialized).toBe(false);
      expect(module.state.status).toBe("shutdown");
    });
  });

  describe("Error Handling", () => {
    let module;

    beforeEach(() => {
      module = new CoreModule(mockDeps);
    });

    test("should handle errors properly", async () => {
      const testError = new Error("Test error");

      await module.handleError(testError, { context: "test" });

      expect(errorHandlerCalls.length).toBe(1);
      expect(errorHandlerCalls[0].error).toBe(testError);
      expect(errorHandlerCalls[0].context.context).toBe("test");
    });

    test("should track error history", async () => {
      const testError = new Error("Test error");

      await module.handleError(testError);

      expect(module.state.errors.length).toBe(1);
      expect(module.state.errors[0].error).toBe(testError.message);
    });
    //Line 106, 121
    test("should handle undefined error context", async () => {
      const module = new CoreModule(mockDeps);
      await module.handleError(new Error("test"), undefined);
      expect(module.state.errors[0].context).toEqual({});
    });
  });

  describe("Health Checks", () => {
    let module;

    beforeEach(() => {
      module = new CoreModule(mockDeps);
    });

    test("should return health status", async () => {
      await module.initialize();
      const health = await module.getHealth();

      expect(health).toMatchObject({
        name: "CoreModule",
        status: "running",
        initialized: true,
      });
    });
  });

  describe("Additional Coverage Tests", () => {
    let module;

    beforeEach(() => {
      module = new CoreModule(mockDeps);
    });

    test("should record metrics", () => {
      module.recordMetric("test_metric", 42);
      const metrics = module.state.metrics;

      expect(metrics.has("test_metric")).toBe(true);
      const metric = metrics.get("test_metric");
      expect(metric.value).toBe(42);
      expect(metric.timestamp).toBeDefined();
    });

    test("should handle configuration", async () => {
      class ConfigurableModule extends CoreModule {
        async onConfigure() {
          // Custom configuration logic
          this.config = { configured: true };
        }
      }

      const configurableModule = new ConfigurableModule(mockDeps);
      await configurableModule.initialize();

      expect(configurableModule.config).toEqual({ configured: true });
    });

    test("should handle shutdown errors", async () => {
      class UnreliableModule extends CoreModule {
        async onShutdown() {
          throw new Error("Shutdown failed");
        }
      }

      const unreliableModule = new UnreliableModule(mockDeps);
      await unreliableModule.initialize();

      await expect(unreliableModule.shutdown()).rejects.toThrow(ModuleError);
      expect(unreliableModule.state.status).toBe("error");
      expect(unreliableModule.state.errors.length).toBe(1);
    });
  });

  describe("Uncovered Lines Coverage", () => {
    let module;

    beforeEach(() => {
      module = new CoreModule(mockDeps);
    });

    test("should handle event bus without emit method", async () => {
      // Modify deps to have eventBus without emit method
      const modifiedDeps = {
        ...mockDeps,
        eventBus: {
          // No emit method
          on: () => {},
        },
      };

      const modifiedModule = new CoreModule(modifiedDeps);

      // This should not throw an error
      await expect(
        modifiedModule.emit("test:event", { data: "test" })
      ).resolves.toBeDefined();
    });

    test("should handle multiple error trackings", async () => {
      // Create many errors to test trimming
      for (let i = 0; i < 110; i++) {
        await module.handleError(new Error(`Error ${i}`));
      }

      // Verify error history is trimmed
      expect(module.state.errors.length).toBe(100);
      expect(module.state.errors[0].error).toBe("Error 10");
    });

    test("should handle getHealth with no metrics", async () => {
      await module.initialize();
      const health = await module.getHealth();

      expect(health.metrics).toEqual({});
    });

    test("should handle shutdown when not initialized", async () => {
      const result = await module.shutdown();
      expect(result).toBe(module);
    });

    test("should handle context-less error handling", async () => {
      const testError = new Error("Contextless error");

      await module.handleError(testError);

      expect(module.state.errors.length).toBe(1);
      expect(module.state.errors[0].context).toEqual({});
    });

    test("should handle configuration without explicit config", async () => {
      class TestConfigModule extends CoreModule {
        async onConfigure() {
          // Line 62-68 coverage
          if (!this.config) {
            this.config = {};
          }
        }
      }

      const testModule = new TestConfigModule(mockDeps);
      await testModule.initialize();

      expect(testModule.config).toEqual({});
    });
  });

  describe("Ultra-Specific Line Coverage", () => {
    let module;
    let mockDeps;

    beforeEach(() => {
      mockDeps = {
        errorSystem: {
          handleError: async () => {},
        },
        eventBus: new EventEmitter(),
        config: {
          modules: {},
        },
      };
      module = new CoreModule(mockDeps);
    });

    test("should handle null metrics during health check", async () => {
      // Cover line 119 (metrics tracking)
      class NullMetricsModule extends CoreModule {
        async getHealth() {
          // Explicitly set metrics to null
          this.state.metrics = null;
          return super.getHealth();
        }
      }

      const nullMetricsModule = new NullMetricsModule(mockDeps);
      await nullMetricsModule.initialize();

      const health = await nullMetricsModule.getHealth();
      expect(health.metrics).toEqual({});
    });

    test("should handle configuration initialization edge case", async () => {
      // Cover lines 62-68
      class ConfigInitModule extends CoreModule {
        async onConfigure() {
          // Explicit null/undefined config handling
          if (this.config === null || this.config === undefined) {
            this.config = { initialized: true };
          }
        }
      }

      const configInitModule = new ConfigInitModule(mockDeps);
      await configInitModule.initialize();

      expect(configInitModule.config).toEqual({ initialized: true });
    });

    test("should handle shutdown with specific error scenarios", async () => {
      // Cover line 187
      class ErrorShutdownModule extends CoreModule {
        async onShutdown() {
          // Simulate a specific shutdown scenario that might cause an error
          if (this.initialized) {
            throw new Error("Intentional shutdown error");
          }
        }
      }

      const errorShutdownModule = new ErrorShutdownModule(mockDeps);
      await errorShutdownModule.initialize();

      // This should trigger the error handling in shutdown
      await expect(errorShutdownModule.shutdown()).rejects.toThrow(ModuleError);

      // Verify error state
      expect(errorShutdownModule.state.status).toBe("error");
      expect(errorShutdownModule.state.errors.length).toBe(1);
    });

    test("should handle module creation with minimal dependencies", () => {
      const minimalDeps = {};
      const module = createModule(minimalDeps);

      expect(module).toBeInstanceOf(CoreModule);
      expect(module.deps.errorSystem).toBeDefined();
      expect(module.deps.eventBus).toBeDefined();
      expect(module.deps.config).toBeDefined();
    });
    test("should handle configuration initialization with null config", async () => {
      class NullConfigModule extends CoreModule {
        constructor(deps) {
          super(deps);
          this.config = null; // Explicitly set config to null
        }
      }

      const nullConfigModule = new NullConfigModule(mockDeps);
      await nullConfigModule.initialize();

      expect(nullConfigModule.config).toEqual({ default: true });
    });

    test("should handle metrics in health check with non-Map metrics", async () => {
      class NonMapMetricsModule extends CoreModule {
        async getHealth() {
          // Simulate non-Map metrics
          this.state.metrics = { key: "value" };
          return super.getHealth();
        }
      }

      const nonMapModule = new NonMapMetricsModule(mockDeps);
      await nonMapModule.initialize();

      const health = await nonMapModule.getHealth();
      expect(health.metrics).toEqual({});
    });

    test("should handle shutdown with no initialization", async () => {
      const result = await module.shutdown();

      expect(result).toBe(module);
      expect(module.initialized).toBe(false);
      expect(module.state.status).toBe("created");
    });
    test("should test error handling path in initialization", async () => {
      class FailingInitModule extends CoreModule {
        async onInitialize() {
          // Simulate initialization failure
          throw new Error("Intentional initialization failure");
        }
      }

      const failingModule = new FailingInitModule(mockDeps);

      await expect(failingModule.initialize()).rejects.toThrow(ModuleError);
      expect(failingModule.state.status).toBe("error");
      expect(failingModule.state.errors.length).toBe(1);
    });
  });
  describe("CoreModule Error Handling and Shutdown", () => {
    // Test for line 129: Error in error system handling
    test("should handle errors when errorSystem.handleError fails", async () => {
      let errorHandlerCalled = false;

      const mockErrorSystem = {
        handleError: async () => {
          errorHandlerCalled = true;
          throw new Error("Error system failure");
        },
      };

      const module = new CoreModule({
        errorSystem: mockErrorSystem,
        eventBus: new EventEmitter(),
        config: {},
      });

      const originalConsoleError = console.error;
      let consoleErrorCalled = false;
      let errorMessage = "";

      console.error = (msg, error) => {
        consoleErrorCalled = true;
        errorMessage = msg;
      };

      try {
        await module.handleError(new Error("Test error"));
        assert.strictEqual(
          errorHandlerCalled,
          true,
          "Error handler should have been called"
        );
        assert.strictEqual(
          consoleErrorCalled,
          true,
          "Console.error should have been called"
        );
        assert.strictEqual(
          errorMessage,
          "Error in error handling:",
          "Console.error should have correct message"
        );
      } finally {
        console.error = originalConsoleError;
      }
    });
    test("should properly execute shutdown process", async () => {
      const module = new CoreModule({
        errorSystem: { handleError: async () => {} },
        eventBus: new EventEmitter(),
        config: {},
      });

      await module.initialize();
      assert.strictEqual(
        module.initialized,
        true,
        "Module should be initialized"
      );

      await module.shutdown();
      assert.strictEqual(
        module.initialized,
        false,
        "Module should not be initialized after shutdown"
      );
      assert.strictEqual(
        module.state.status,
        "shutdown",
        "Module status should be shutdown"
      );
      assert.strictEqual(
        module.state.startTime,
        null,
        "Start time should be null"
      );
    });

    test("onShutdown base implementation with sync work", async () => {
      // Create a module that will need actual shutdown work
      class TestModule extends CoreModule {
        constructor(deps) {
          super(deps);
          this.shutdownCalled = false;
        }

        // Override initialize to set up state that needs cleanup
        async initialize() {
          await super.initialize();
          this.shutdownCalled = false;
          return this;
        }

        // Override shutdown to force base onShutdown call
        async shutdown() {
          // Call base onShutdown directly
          await Object.getPrototypeOf(TestModule.prototype).onShutdown.call(
            this
          );
          return super.shutdown();
        }
      }

      const module = new TestModule({
        errorSystem: { handleError: async () => {} },
        eventBus: new EventEmitter(),
        config: {},
      });

      // Initialize and then shutdown
      await module.initialize();
      assert.strictEqual(
        module.shutdownCalled,
        false,
        "Should not be shutdown initially"
      );

      await module.shutdown();

      // Verify shutdown completed
      assert.strictEqual(
        module.state.status,
        "shutdown",
        "Should be in shutdown state"
      );
    });
    test("getHealth should handle errors gracefully", async () => {
      const module = new CoreModule({
        errorSystem: { handleError: async () => {} },
        eventBus: new EventEmitter(),
        config: {},
      });

      // Force metrics to be invalid to trigger error
      Object.defineProperty(module.state, "metrics", {
        get() {
          throw new Error("Metrics access error");
        },
      });

      // Call getHealth and verify error response
      const health = await module.getHealth();

      assert.strictEqual(health.status, "error");
      assert.strictEqual(health.name, module.constructor.name);
      assert.strictEqual(health.error, "Metrics access error");
      assert(health.timestamp);
      assert.deepStrictEqual(health.metrics, {});
    });
  });
// Lines 78-84
  describe("Configuration Edge Cases", () => {
    test("should handle null config", async () => {
      const module = new CoreModule(mockDeps);
      module.config = null;
      await module.onConfigure();
      expect(module.config.default).toBe(true);
    });
  
    test("should handle undefined config", async () => {
      const module = new CoreModule(mockDeps);
      module.config = undefined;
      await module.onConfigure();
      expect(module.config.default).toBe(true);
    });
  
    test("should handle empty config", async () => {
      const module = new CoreModule(mockDeps);
      module.config = {};
      await module.onConfigure();
      expect(module.config.default).toBe(true);
    });
  });
  describe("Module Factory", () => {
    test("should create module with no dependencies", () => {
      const module = createModule();
      expect(module).toBeInstanceOf(CoreModule);
      expect(module.deps.errorSystem).toBeDefined();
      expect(module.deps.eventBus).toBeDefined();
      expect(module.deps.config).toBeDefined();
    });
  
    test("should merge dependencies correctly", () => {
      const customDeps = {
        errorSystem: { handleError: () => "custom" },
        customDep: true
      };
      const module = createModule(customDeps);
      expect(module.deps.customDep).toBe(true);
      expect(module.deps.errorSystem.handleError()).toBe("custom");
      expect(module.deps.eventBus).toBeDefined();
    });
  });
  describe("Uncovered Branches", () => {
    test("should handle non-empty config", async () => {
      const module = new CoreModule(mockDeps);
      module.config = { existingConfig: true };
      await module.onConfigure();
      expect(module.config.default).toBeUndefined(); // Should not add default flag
      expect(module.config.existingConfig).toBe(true);
    });
  
    test("should handle error with null context directly", async () => {
      const module = new CoreModule(mockDeps);
      await module.handleError(new Error("test"), null); // Test null specifically
      expect(module.state.errors[0].context).toEqual({});
    });
  
    test("should handle missing error system during error", async () => {
      const module = new CoreModule(mockDeps);
      module.deps.errorSystem = undefined;
      await module.handleError(new Error("test"));
      expect(module.state.errors[0].error).toBe("test");
    });
  
    test("should handle shutdown on uninitialized module", async () => {
      const module = new CoreModule(mockDeps);
      // Module hasn't been initialized yet
      expect(module.initialized).toBe(false);
      // Call shutdown directly on uninitialized module
      const result = await module.shutdown();
      // Should return the module instance without doing shutdown
      expect(result).toBe(module);
      // Status should remain 'created'
      expect(module.state.status).toBe('created');
    });

    test("should handle health check with no start time", async () => {
      const module = new CoreModule(mockDeps);
      // Force startTime to be null
      module.state.startTime = null;
      
      const health = await module.getHealth();
      expect(health.uptime).toBe(0);
    });
    test("should use default error handler when no deps provided", async () => {
      const module = createModule(); // Create with no deps
      // Get the default error handler
      const handler = module.deps.errorSystem.handleError;
      // Call it to cover the function
      await handler(new Error("test"));
    });
  });
});
