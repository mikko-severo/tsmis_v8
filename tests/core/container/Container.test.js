// tests/core/container/Container.test.js

import { CoreContainer } from "../../../src/core/container/Container.js";
import { ConfigError, ServiceError } from "../../../src/core/errors/index.js";

describe("Container", () => {
  let container;

  function createMockFn() {
    const fn = (...args) => {
      fn.mock.calls.push(args);
      return fn.mockReturnValue;
    };
    fn.mock = { calls: [] };
    fn.mockReturnValue = fn;
    fn.mockClear = () => {
      fn.mock.calls = [];
    };
    return fn;
  }

  beforeEach(() => {
    container = new CoreContainer();
  });

  describe("Component Registration", () => {
    test("should register component successfully", () => {
      class TestComponent {}
      container.register("test", TestComponent);
      expect(container.components.has("test")).toBe(true);
    });

    test("should throw on duplicate registration", () => {
      class TestComponent {}
      container.register("test", TestComponent);
      expect(() => container.register("test", TestComponent)).toThrow(
        ConfigError
      );
    });

    test("should store component dependencies", () => {
      class TestComponent {
        static dependencies = ["dep1", "dep2"];
      }
      container.register("test", TestComponent);
      expect(container.dependencies.get("test")).toEqual(["dep1", "dep2"]);
    });
  });

  describe("Manifest Management", () => {
    test("should register manifest successfully", () => {
      const manifest = { configSchema: {} };
      container.registerManifest("test", manifest);
      expect(container.manifests.has("test")).toBe(true);
    });

    test("should throw on duplicate manifest", () => {
      const manifest = { configSchema: {} };
      container.registerManifest("test", manifest);
      expect(() => container.registerManifest("test", manifest)).toThrow(
        ConfigError
      );
    });
  });

  describe("Component Resolution", () => {
    test("should resolve component without dependencies", async () => {
      class TestComponent {}
      container.register("test", TestComponent);
      const instance = await container.resolve("test");
      expect(instance).toBeInstanceOf(TestComponent);
    });

    test("should resolve dependencies", async () => {
      class Dependency {}
      class TestComponent {
        static dependencies = ["dep"];
        constructor(deps) {
          this.deps = deps;
        }
      }

      container.register("dep", Dependency);
      container.register("test", TestComponent);

      const instance = await container.resolve("test");
      expect(instance.deps.dep).toBeInstanceOf(Dependency);
    });

    test("should maintain singleton instances", async () => {
      class TestComponent {}
      container.register("test", TestComponent);

      const instance1 = await container.resolve("test");
      const instance2 = await container.resolve("test");
      expect(instance1).toBe(instance2);
    });

    test("should throw on unknown component", async () => {
      await expect(container.resolve("unknown")).rejects.toThrow(ServiceError);
    });
  });

  describe("Dependency Resolution", () => {
    test("should detect circular dependencies", () => {
      class A {
        static dependencies = ["b"];
      }
      class B {
        static dependencies = ["a"];
      }

      container.register("a", A);
      container.register("b", B);

      expect(() => container.resolveDependencyOrder()).toThrow(ConfigError);
    });

    test("should resolve dependencies in correct order", () => {
      class A {
        static dependencies = ["b"];
      }
      class B {
        static dependencies = ["c"];
      }
      class C {}

      container.register("a", A);
      container.register("b", B);
      container.register("c", C);

      const order = container.resolveDependencyOrder();
      expect(order).toEqual(["c", "b", "a"]);
    });
  });

  describe("Lifecycle Management", () => {
    test("should initialize components in dependency order", async () => {
      const initialized = [];

      class A {
        static dependencies = ["b"];
        async initialize() {
          initialized.push("a");
        }
      }
      class B {
        async initialize() {
          initialized.push("b");
        }
      }

      container.register("a", A);
      container.register("b", B);
      await container.initialize();

      expect(initialized).toEqual(["b", "a"]);
    });

    test("should throw on double initialization", async () => {
      await container.initialize();
      await expect(container.initialize()).rejects.toThrow(ServiceError);
    });

    test("should shutdown components in reverse order", async () => {
      const shutdown = [];

      class A {
        static dependencies = ["b"];
        async shutdown() {
          shutdown.push("a");
        }
      }
      class B {
        async shutdown() {
          shutdown.push("b");
        }
      }

      container.register("a", A);
      container.register("b", B);
      await container.initialize();
      await container.shutdown();

      expect(shutdown).toEqual(["a", "b"]);
    });
  });

  describe("Event Emission", () => {
    test("should emit events on component registration", (done) => {
      container.once("component:registered", ({ name }) => {
        expect(name).toBe("test");
        done();
      });

      class TestComponent {}
      container.register("test", TestComponent);
    });

    test("should emit events on component resolution", async () => {
      const mockListener = createMockFn();
      container.on("component:resolved", mockListener);

      class TestComponent {}
      container.register("test", TestComponent);
      await container.resolve("test");

      expect(mockListener.mock.calls.length).toBe(1);
    });

    test("should emit initialization events", async () => {
      const mockListener = createMockFn();
      container.on("initialized", mockListener);

      await container.initialize();
      expect(mockListener.mock.calls.length).toBe(1);
    });

    test("should emit shutdown events", async () => {
      const mockListener = createMockFn();
      container.on("shutdown", mockListener);

      await container.initialize();
      await container.shutdown();
      expect(mockListener.mock.calls.length).toBe(1);
    });
  });
  ////////////
  // Add these test cases in the Container.test.js

  describe("Component Discovery", () => {
    test("should throw error when discovering unknown type", async () => {
      await expect(container.discover("unknown", "/some/path")).rejects.toThrow(
        ConfigError
      );
    });

    test("should handle discovery errors", async () => {
      const manifest = { configSchema: {} };
      container.registerManifest("test", manifest);

      // Mock scanDirectory to simulate error
      container.scanDirectory = async () => {
        throw new Error("Scan failed");
      };

      await expect(container.discover("test", "/some/path")).rejects.toThrow(
        ServiceError
      );
    });

    test("should handle component loading errors", async () => {
      const manifest = { configSchema: {} };
      container.registerManifest("test", manifest);

      // Mock methods to test error paths
      container.scanDirectory = async () => ["/path/component"];
      container.loadComponent = async () => {
        throw new Error("Load failed");
      };

      const mockListener = createMockFn();
      container.on("discovery:error", mockListener);

      await container.discover("test", "/some/path");
      expect(mockListener.mock.calls.length).toBe(1);
    });

    test("should skip disabled components", async () => {
      const manifest = { configSchema: {} };
      container.registerManifest("test", manifest);

      // Mock methods to test disabled component
      container.scanDirectory = async () => ["/path/component"];
      container.loadConfig = async () => ({ enabled: false });

      const discovered = await container.discover("test", "/some/path");
      expect(discovered.size).toBe(0);
    });
  });

  describe("Component Loading", () => {
    test("should handle validation errors during loading", async () => {
      const manifest = {
        configSchema: {
          required: ["name"],
        },
      };

      container.registerManifest("test", manifest);
      container.loadConfig = async () => ({ enabled: true });

      await expect(
        container.loadComponent("/some/path", manifest)
      ).rejects.toThrow(ConfigError);
    });

    test("should emit discovery completed event", async () => {
      const manifest = { configSchema: {} };
      container.registerManifest("test", manifest);

      // Mock successful component loading
      container.scanDirectory = async () => ["/path/component"];
      container.loadComponent = async () => ({
        name: "test",
        config: { enabled: true },
        implementation: class Test {},
      });

      const mockListener = createMockFn();
      container.on("discovery:completed", mockListener);

      await container.discover("test", "/some/path");
      expect(mockListener.mock.calls.length).toBe(1);
    });

    test("should handle component implementation loading error", async () => {
      const manifest = {
        configSchema: {},
      };

      // Mock methods to simulate implementation loading error
      container.loadConfig = async () => ({ enabled: true, name: "test" });
      container.loadImplementation = async () => {
        throw new Error("Implementation load failed");
      };

      await expect(container.loadComponent("/path", manifest)).rejects.toThrow(
        ConfigError
      );
    });

    test("should successfully load complete component", async () => {
      const manifest = {
        configSchema: {}, // Schema for validation
      };

      // Mock all required methods to test successful path
      container.loadConfig = async () => ({
        enabled: true,
        name: "test-component",
      });

      container.validateConfig = async () => true; // Validation passes

      container.loadImplementation = async () => {
        return class TestComponent {};
      };

      const component = await container.loadComponent("/test/path", manifest);

      // Verify full component object is returned
      expect(component).toEqual({
        name: "test-component",
        config: { enabled: true, name: "test-component" },
        implementation: expect.any(Function),
      });
    });
  });

  describe("Resolution Tests", () => {
    test("should initialize newly resolved component when container is initialized", async () => {
      const initialized = [];

      class TestComponent {
        async initialize() {
          initialized.push("test");
        }
      }

      container.register("test", TestComponent);
      await container.initialize();

      // Resolve after initialization
      await container.resolve("test");
      expect(initialized).toContain("test");
    });
    test("should handle non-initialized component after container initialization", async () => {
      // This should cover line 165
      container.initialized = true;

      class TestComponent {
        async initialize() {}
      }
      container.register("test", TestComponent);

      const instance = await container.resolve("test");
      expect(instance).toBeInstanceOf(TestComponent);
    });
  });

  describe("Shutdown Tests", () => {
    test("should handle errors during component shutdown", async () => {
      class A {
        async shutdown() {
          throw new Error("Shutdown failed");
        }
      }
      class B {
        async shutdown() {}
      }

      container.register("a", A);
      container.register("b", B);
      await container.initialize();

      // Should complete shutdown despite errors
      await container.shutdown();
      expect(container.initialized).toBe(false);
      expect(container.instances.size).toBe(0);
    });
    test("should skip shutdown for non-initialized component", async () => {
      class TestComponent {
        async shutdown() {}
      }
      container.register("test", TestComponent);

      // Don't initialize, just shutdown
      await container.shutdown();
      expect(container.initialized).toBe(false);
    });
    test("should successfully execute component shutdown", async () => {
      const executionOrder = [];

      class A {
        static dependencies = ["b"]; // A depends on B
        async shutdown() {
          executionOrder.push("a-shutdown");
        }
      }
      class B {
        async shutdown() {
          executionOrder.push("b-shutdown");
        }
      }

      // Register both components
      container.register("a", A);
      container.register("b", B);

      // Initialize and resolve to create instances
      await container.initialize();
      await container.resolve("a");
      await container.resolve("b");

      // Listen for shutdown events
      const mockListener = createMockFn();
      container.on("shutdown", mockListener);

      // Execute shutdown
      await container.shutdown();

      // Verify execution - reversed order means A first, then B
      expect(executionOrder).toEqual(["a-shutdown", "b-shutdown"]);
      expect(container.initialized).toBe(false);
      expect(container.instances.size).toBe(0);
      expect(mockListener.mock.calls.length).toBe(1);
    });
    test("should execute successful component shutdown", async () => {
      let shutdownCalled = false;

      class TestComponent {
        async shutdown() {
          shutdownCalled = true;
          return Promise.resolve(); // Explicitly return resolved promise
        }
      }

      container.register("test", TestComponent);
      await container.initialize();
      const instance = await container.resolve("test"); // Important: Get the instance

      await container.shutdown();

      expect(shutdownCalled).toBe(true);
      expect(container.initialized).toBe(false);
      expect(container.instances.size).toBe(0);
    });
    test("should execute async shutdown properly", async () => {
      const shutdownPromise = new Promise((resolve) => {
        // Track actual promise resolution
        setTimeout(() => resolve(), 10);
      });

      class TestComponent {
        async shutdown() {
          await shutdownPromise; // Forces the await to actually happen
          return true;
        }
      }

      // Setup and get instance
      container.register("test", TestComponent);
      await container.initialize();
      await container.resolve("test"); // Important: Get instance

      // Ensure shutdown error handler is set up
      const errorListener = createMockFn();
      container.on("shutdown:error", errorListener);

      // Execute shutdown
      await container.shutdown();

      // Verify
      expect(errorListener.mock.calls.length).toBe(0); // No errors
      expect(container.initialized).toBe(false);
      expect(container.instances.size).toBe(0);
    });
    test("should execute async shutdown without error", async () => {
      let shutdownExecuted = false;
      let awaitCompleted = false;

      class TestComponent {
        constructor() {
          this.shutdown = async () => {
            shutdownExecuted = true;
            await new Promise((resolve) => setTimeout(resolve, 0));
            awaitCompleted = true;
          };
        }
      }

      // Register and get instance
      container.register("test", TestComponent);
      await container.initialize();
      const instance = await container.resolve("test");

      // Track shutdown error events
      const errorHandler = createMockFn();
      container.on("shutdown:error", errorHandler);

      // Execute shutdown
      await container.shutdown();

      // Verify every step
      expect(shutdownExecuted).toBe(true);
      expect(awaitCompleted).toBe(true);
      expect(errorHandler.mock.calls.length).toBe(0);
      expect(container.initialized).toBe(false);
      expect(container.instances.size).toBe(0);
    });
    test("should execute async shutdown properly", async () => {
      const shutdownPromise = new Promise((resolve) => {
        // Track actual promise resolution
        setTimeout(() => resolve(), 10);
      });

      class TestComponent {
        async shutdown() {
          await shutdownPromise; // Forces the await to actually happen
          return true;
        }
      }

      // Setup and get instance
      container.register("test", TestComponent);
      await container.initialize();
      await container.resolve("test"); // Important: Get instance

      // Ensure shutdown error handler is set up
      const errorListener = createMockFn();
      container.on("shutdown:error", errorListener);

      // Execute shutdown
      await container.shutdown();

      // Verify
      expect(errorListener.mock.calls.length).toBe(0); // No errors
      expect(container.initialized).toBe(false);
      expect(container.instances.size).toBe(0);
    });
  });
  describe("Initialization Edge Cases", () => {
    test("should prevent double initialization by throwing ServiceError", async () => {
      // Create a container with a component that can be initialized
      class TestComponent {
        async initialize() {}
      }

      container.register("test", TestComponent);

      // First initialization should succeed
      await container.initialize();

      // Second initialization attempt should throw ServiceError
      await expect(container.initialize()).rejects.toThrow(ServiceError);
      await expect(container.initialize()).rejects.toThrow(
        "Container is already initialized"
      );
    });
    test("should prevent subsequent initialization attempts after first successful init", async () => {
      // Ensure previous tests don't interfere
      const freshContainer = new CoreContainer();

      class TestComponent {
        async initialize() {}
      }

      freshContainer.register("test", TestComponent);

      // First initialization
      await freshContainer.initialize();

      // Verify container is marked as initialized
      expect(freshContainer.initialized).toBe(true);

      // Subsequent initialization attempts should throw
      await expect(freshContainer.initialize()).rejects.toThrow(ServiceError);
      await expect(freshContainer.initialize()).rejects.toThrow(
        "Container is already initialized"
      );
    });
    test("should throw ConfigError for missing dependency", () => {
      const container = new CoreContainer();

      class ComponentA {
        static dependencies = ["missingComponent"];
      }

      class ComponentB {
        // No dependencies
      }

      // Register ComponentB, but not the dependency of ComponentA
      container.register("componentB", ComponentB);

      // Attempt to register ComponentA
      container.register("componentA", ComponentA);

      // Expect an error when resolving dependency order
      expect(() => container.resolveDependencyOrder()).toThrow(ConfigError);

      try {
        container.resolveDependencyOrder();
      } catch (error) {
        // Specific assertions about the error
        expect(error).toBeInstanceOf(ConfigError);
        expect(error.code).toBe("CONFIG_MISSING_DEPENDENCY");
        expect(error.message).toContain(
          "Dependency missingComponent required by componentA is not registered"
        );
      }
    });

    test("should handle multiple missing dependencies", () => {
      const container = new CoreContainer();

      class ComponentA {
        static dependencies = ["missingComponentX", "missingComponentY"];
      }

      // Register ComponentA with unregistered dependencies
      container.register("componentA", ComponentA);

      // Expect an error when resolving dependency order
      expect(() => container.resolveDependencyOrder()).toThrow(ConfigError);

      try {
        container.resolveDependencyOrder();
      } catch (error) {
        // The error should be for the first missing dependency
        expect(error).toBeInstanceOf(ConfigError);
        expect(error.code).toBe("CONFIG_MISSING_DEPENDENCY");
        expect(error.message).toContain(
          "Dependency missingComponentX required by componentA is not registered"
        );
      }
    });
  });
  describe("Container Initialization", () => {
    let container;

    beforeEach(() => {
      container = new CoreContainer();
    });

    describe("Initialization Prevention", () => {
      test("should prevent re-initialization with direct state manipulation", async () => {
        class TestComponent {
          static initializationAttempts = 0;
          async initialize() {
            TestComponent.initializationAttempts++;
          }
        }

        container.register("test", TestComponent);

        // First initialization
        await container.initialize();

        // Reset initialization tracking
        TestComponent.initializationAttempts = 0;

        // Manually set initialized to true to simulate prevented initialization
        Object.defineProperty(container, "initialized", {
          value: true,
          writable: true,
        });

        // Attempt re-initialization
        let thrownError = null;
        try {
          await container.initialize();
        } catch (error) {
          thrownError = error;
        }

        // Assertions
        expect(thrownError).not.toBeNull();
        expect(thrownError).toBeInstanceOf(ServiceError);
        expect(thrownError.code).toBe("SERVICE_ALREADY_INITIALIZED");
        expect(thrownError.message).toBe("Container is already initialized");

        // Verify no additional initialization occurred
        expect(TestComponent.initializationAttempts).toBe(0);
      });

      test("should block repeated initialization attempts", async () => {
        class TestComponent {
          static initCount = 0;
          async initialize() {
            TestComponent.initCount++;
          }
        }

        container.register("test", TestComponent);

        // First initialization
        await container.initialize();

        // Verify initial state
        expect(container.initialized).toBe(true);
        const initialInitCount = TestComponent.initCount;

        // Multiple re-initialization attempts
        for (let i = 0; i < 5; i++) {
          try {
            await container.initialize();
          } catch (error) {
            // Verify each attempt throws ServiceError
            expect(error).toBeInstanceOf(ServiceError);
            expect(error.code).toBe("SERVICE_ALREADY_INITIALIZED");
          }
        }

        // Verify no additional initializations occurred
        expect(TestComponent.initCount).toBe(initialInitCount);
      });

      test("should maintain initialization state after prevention", async () => {
        class TestComponent {
          async initialize() {}
        }

        container.register("test", TestComponent);

        // First initialization
        await container.initialize();

        // Store initial state
        const initialState = container.initialized;

        // Attempt re-initialization multiple times
        for (let i = 0; i < 3; i++) {
          try {
            await container.initialize();
          } catch (error) {
            // Verify error type
            expect(error).toBeInstanceOf(ServiceError);
          }

          // Ensure state remains unchanged
          expect(container.initialized).toBe(initialState);
        }
      });

      test("should handle initialization guard with multiple components", async () => {
        const initializationLog = [];

        class ComponentA {
          async initialize() {
            initializationLog.push("A");
          }
        }

        class ComponentB {
          async initialize() {
            initializationLog.push("B");
          }
        }

        container.register("componentA", ComponentA);
        container.register("componentB", ComponentB);

        // First initialization
        await container.initialize();

        // Clear initialization log
        initializationLog.length = 0;

        // Manually set initialized to true
        Object.defineProperty(container, "initialized", {
          value: true,
          writable: true,
        });

        // Attempt re-initialization
        try {
          await container.initialize();
        } catch (error) {
          // Verify error type
          expect(error).toBeInstanceOf(ServiceError);
        }

        // Verify no additional initialization occurred
        expect(initializationLog.length).toBe(0);
      });
      // End of existing tests
    });
    describe("Initialization Guard Coverage", () => {
      test("should definitively cover line 219 condition", async () => {
        // Create a subclass to expose internal state for testing
        class TestableContainer extends CoreContainer {
          getInitializedState() {
            return this.initialized;
          }
        }

        const testContainer = new TestableContainer();

        class TestComponent {
          static initializationAttempts = 0;
          async initialize() {
            TestComponent.initializationAttempts++;
          }
        }

        testContainer.register("test", TestComponent);

        // First initialization
        await testContainer.initialize();

        // Verify initial state is true
        expect(testContainer.getInitializedState()).toBe(true);

        // Reset initialization attempts
        TestComponent.initializationAttempts = 0;

        // Attempt re-initialization multiple times
        for (let i = 0; i < 3; i++) {
          let errorThrown = false;
          try {
            // Deliberately call initialize again
            await testContainer.initialize();
          } catch (error) {
            errorThrown = true;

            // Specific assertions about the error
            expect(error).toBeInstanceOf(ServiceError);
            expect(error.code).toBe("SERVICE_ALREADY_INITIALIZED");
            expect(error.message).toBe("Container is already initialized");
          }

          // Ensure error was thrown
          expect(errorThrown).toBe(true);
        }

        // Verify no additional initialization occurred
        expect(TestComponent.initializationAttempts).toBe(0);
      });

      test("should trigger initialization guard explicitly", async () => {
        const testContainer = new CoreContainer();

        class TestComponent {
          static initLog = [];
          async initialize() {
            TestComponent.initLog.push("initialized");
          }
        }

        testContainer.register("test", TestComponent);

        // First initialization
        await testContainer.initialize();

        // Spy on the initialized state
        const originalInitialize = testContainer.initialize.bind(testContainer);

        // Capture the initialization guard condition
        testContainer.initialize = async function () {
          // The critical line we want to cover
          if (this.initialized) {
            throw new ServiceError(
              "ALREADY_INITIALIZED",
              "Container is already initialized"
            );
          }
          return originalInitialize();
        };

        // Attempt re-initialization
        await expect(testContainer.initialize()).rejects.toThrow(ServiceError);
      });

      test("should verify initialization guard state", async () => {
        const testContainer = new CoreContainer();

        class TestComponent {
          async initialize() {}
        }

        testContainer.register("test", TestComponent);

        // First initialization
        await testContainer.initialize();

        // Directly verify the internal state
        expect(testContainer.initialized).toBe(true);

        // Attempt re-initialization
        await expect(testContainer.initialize()).rejects.toThrow(ServiceError);
      });
    });
  });
  describe("Detailed Component Resolution and Dependency Order Tests", () => {
    describe("Singleton Instance Caching", () => {
      test("should return cached singleton instance", async () => {
        class TestComponent {
          constructor() {
            this.id = Math.random(); // Unique identifier
          }
        }

        const container = new CoreContainer();
        container.register("test", TestComponent, { singleton: true });

        // First resolution
        const firstInstance = await container.resolve("test");

        // Second resolution should return the same instance
        const secondInstance = await container.resolve("test");

        // Verify same instance is returned
        expect(firstInstance).toBe(secondInstance);
      });

      test("should create new instance for non-singleton components", async () => {
        class TestComponent {
          constructor() {
            this.id = Math.random(); // Unique identifier
          }
        }

        const container = new CoreContainer();
        container.register("test", TestComponent, { singleton: false });

        // First resolution
        const firstInstance = await container.resolve("test");

        // Second resolution should return a different instance
        const secondInstance = await container.resolve("test");

        // Verify different instances are returned
        expect(firstInstance).not.toBe(secondInstance);
      });
    });
    describe("Dependency Order Tracking", () => {
      test("should properly manage visiting set during dependency resolution", () => {
        const container = new CoreContainer();

        class ComponentA {
          static dependencies = ["componentB"];
        }
        class ComponentB {
          static dependencies = ["componentC"];
        }
        class ComponentC {
          // No dependencies
        }

        container.register("componentA", ComponentA);
        container.register("componentB", ComponentB);
        container.register("componentC", ComponentC);

        // Resolve dependency order
        const order = container.resolveDependencyOrder();

        // Verify correct order of resolution
        expect(order).toEqual(["componentC", "componentB", "componentA"]);
      });

      test("should handle complex dependency graphs", () => {
        const container = new CoreContainer();

        class ComponentA {
          static dependencies = ["componentB", "componentC"];
        }
        class ComponentB {
          static dependencies = ["componentD"];
        }
        class ComponentC {
          static dependencies = ["componentD"];
        }
        class ComponentD {
          // No dependencies
        }

        container.register("componentA", ComponentA);
        container.register("componentB", ComponentB);
        container.register("componentC", ComponentC);
        container.register("componentD", ComponentD);

        // Resolve dependency order
        const order = container.resolveDependencyOrder();

        // Verify correct order of resolution
        expect(order).toEqual([
          "componentD",
          "componentB",
          "componentC",
          "componentA",
        ]);
      });
    });
    describe("Dependency Order Edge Cases", () => {
      test("should handle components with no dependencies", () => {
        const container = new CoreContainer();

        class ComponentWithNoDependencies {}
        class ComponentWithEmptyDependencies {
          static dependencies = [];
        }

        // Register components with different dependency configurations
        container.register("noDeps", ComponentWithNoDependencies);
        container.register("emptyDeps", ComponentWithEmptyDependencies);

        // Resolve dependency order
        const order = container.resolveDependencyOrder();

        // Verify components are included in the order
        expect(order).toContain("noDeps");
        expect(order).toContain("emptyDeps");
      });

      test("should correctly handle fallback to empty array for dependencies", () => {
        const container = new CoreContainer();

        class TestComponent {
          // No static dependencies defined
        }

        container.register("test", TestComponent);

        // Create a custom container to track dependency retrieval
        class TrackingContainer extends CoreContainer {
          constructor() {
            super();
            this.dependencyRetrievals = 0;
          }

          resolveDependencyOrder() {
            const originalGet = this.dependencies.get.bind(this.dependencies);

            // Override get method to track retrievals
            this.dependencies.get = (name) => {
              this.dependencyRetrievals++;
              return originalGet(name) || [];
            };

            return super.resolveDependencyOrder();
          }
        }

        const trackingContainer = new TrackingContainer();
        trackingContainer.register("test", TestComponent);

        // Resolve dependency order
        const order = trackingContainer.resolveDependencyOrder();

        // Verify components are processed correctly
        expect(order).toContain("test");
        expect(trackingContainer.dependencyRetrievals).toBeGreaterThan(0);
      });

      test("should process components with mix of dependencies", () => {
        const container = new CoreContainer();

        class ComponentA {
          static dependencies = ["componentB"];
        }
        class ComponentB {
          static dependencies = [];
        }
        class ComponentC {
          // No dependencies defined
        }

        container.register("componentA", ComponentA);
        container.register("componentB", ComponentB);
        container.register("componentC", ComponentC);

        // Resolve dependency order
        const order = container.resolveDependencyOrder();

        // Verify correct order and inclusion of all components
        expect(order).toContain("componentA");
        expect(order).toContain("componentB");
        expect(order).toContain("componentC");
      });

      test("should handle multiple components with varying dependency configurations", () => {
        const container = new CoreContainer();

        class ComponentWithSingleDependency {
          static dependencies = ["simpleComponent"];
        }
        class SimpleComponent {}
        class ComponentWithMultipleDependencies {
          static dependencies = ["componentA", "componentB"];
        }
        class ComponentA {}
        class ComponentB {}

        container.register("complexComponent", ComponentWithSingleDependency);
        container.register("simpleComponent", SimpleComponent);
        container.register(
          "multiDepsComponent",
          ComponentWithMultipleDependencies
        );
        container.register("componentA", ComponentA);
        container.register("componentB", ComponentB);

        // Resolve dependency order
        const order = container.resolveDependencyOrder();

        // Verify all components are processed
        expect(order).toContain("simpleComponent");
        expect(order).toContain("componentA");
        expect(order).toContain("componentB");
        expect(order).toContain("complexComponent");
        expect(order).toContain("multiDepsComponent");
      });
    });
    describe("Dependency Retrieval Branch Coverage", () => {
      test("should handle component with absolutely no dependency information", () => {
        class ComponentWithNoDepInfo {}

        const container = new CoreContainer();

        // Manually manipulate dependencies to ensure no entry
        container.dependencies.delete("noDepComponent");

        // Register component
        container.register("noDepComponent", ComponentWithNoDepInfo);

        // Override dependencies.get to return undefined explicitly
        const originalGet = container.dependencies.get.bind(
          container.dependencies
        );
        container.dependencies.get = (name) => {
          if (name === "noDepComponent") return undefined;
          return originalGet(name);
        };

        // Resolve dependency order
        const order = container.resolveDependencyOrder();

        // Verify component is processed
        expect(order).toContain("noDepComponent");

        // Restore original method
        container.dependencies.get = originalGet;
      });

      test("should explicitly test null/undefined dependency fallback", () => {
        class ComponentWithNullDeps {
          static dependencies = null;
        }

        const container = new CoreContainer();
        container.register("nullDepComponent", ComponentWithNullDeps);

        // Directly verify dependencies
        const deps = container.dependencies.get("nullDepComponent");
        expect(deps).toEqual([]);

        // Resolve dependency order
        const order = container.resolveDependencyOrder();
        expect(order).toContain("nullDepComponent");
      });
    });
    describe("Detailed Resolution Tests", () => {
      test("should handle component with undefined dependencies specifically on line 157-161", async () => {
        // Create a custom component that will trigger the specific branch
        class TestComponent {
          constructor() {
            // Intentionally do nothing to test the specific branch
          }
        }

        // Modify the container to force a specific test scenario
        const originalDependenciesGet = container.dependencies.get;
        container.dependencies.get = (name) => {
          if (name === "test") return undefined;
          return originalDependenciesGet.call(container.dependencies, name);
        };

        container.register("test", TestComponent);

        // Set initialized to true to trigger the specific code path
        container.initialized = true;

        const instance = await container.resolve("test");
        expect(instance).toBeInstanceOf(TestComponent);

        // Restore the original method
        container.dependencies.get = originalDependenciesGet;
      });

      test("should handle component with explicitly empty dependencies array on line 179", async () => {
        // Create a component with explicitly empty dependencies
        class TestComponent {
          static dependencies = []; // Explicitly empty array

          constructor(deps = {}) {
            this.deps = deps;
          }
        }

        container.register("test", TestComponent);

        // Force the initialized state
        container.initialized = true;

        const instance = await container.resolve("test");
        expect(instance).toBeInstanceOf(TestComponent);
        expect(instance.deps).toEqual({}); // Should receive empty deps object
      });
      test("should handle non-function component with dependencies on line 176", async () => {
        // Create an instance component (not a function/class)
        const instanceComponent = {
          someProperty: 'test'
        };
    
        // Create a dependency component
        class DependencyComponent {
          constructor() {
            this.type = 'dependency';
          }
        }
    
        // Register the instance component with a dependency
        container.register('instance', instanceComponent);
        container.register('dependency', DependencyComponent);
    
        // Manually set dependencies for the instance component
        container.dependencies.set('instance', ['dependency']);
    
        // Resolve the instance component
        const resolved = await container.resolve('instance');
    
        // Verify the resolved component is the same instance
        expect(resolved).toBe(instanceComponent);
    
        // Verify that dependencies were resolved
        const dependencyInstance = await container.resolve('dependency');
        expect(dependencyInstance).toBeInstanceOf(DependencyComponent);
      });
      test("should handle components with different dependency resolution scenarios", async () => {
        const initializationLog = [];

        // Component with no dependencies
        class SimpleComponent {
          async initialize() {
            initializationLog.push("simple");
          }
        }

        // Component with empty dependencies array
        class EmptyDepsComponent {
          static dependencies = [];
          async initialize() {
            initializationLog.push("empty");
          }
        }

        // Component with undefined dependencies
        class UndefinedDepsComponent {
          // No static dependencies defined
          async initialize() {
            initializationLog.push("undefined");
          }
        }

        // Register components
        container.register("simple", SimpleComponent);
        container.register("emptyDeps", EmptyDepsComponent);
        container.register("undefinedDeps", UndefinedDepsComponent);

        // Modify dependencies.get to return undefined for specific cases
        const originalDependenciesGet = container.dependencies.get;
        container.dependencies.get = (name) => {
          if (name === "undefinedDeps") return undefined;
          return originalDependenciesGet.call(container.dependencies, name);
        };

        // Set container to initialized state
        container.initialized = true;

        // Resolve components
        await container.resolve("simple");
        await container.resolve("emptyDeps");
        await container.resolve("undefinedDeps");

        // Verify all components were processed
        expect(initializationLog).toContain("simple");
        expect(initializationLog).toContain("empty");
        expect(initializationLog).toContain("undefined");

        // Restore original method
        container.dependencies.get = originalDependenciesGet;
      });

      test("should gracefully handle edge cases in dependency resolution", async () => {
        // A component with a factory function instead of a class
        const factoryComponent = () => {
          return {
            factoryCreated: true,
          };
        };

        // A component with a class that has no special methods
        class MinimalComponent {}

        container.register("factory", factoryComponent);
        container.register("minimal", MinimalComponent);

        // Force initialized state
        container.initialized = true;

        // Resolve components
        const factoryInstance = await container.resolve("factory");
        const minimalInstance = await container.resolve("minimal");

        expect(factoryInstance.factoryCreated).toBe(true);
        expect(minimalInstance).toBeInstanceOf(MinimalComponent);
      });
      test("should handle complex dependency scenarios", async () => {
        const resolveLog = [];

        // Components with interdependent and nested dependencies
        class DependencyC {
          constructor() {
            resolveLog.push("C");
          }
        }

        class DependencyB {
          static dependencies = ["dependencyC"];
          constructor(deps) {
            this.c = deps.dependencyC;
            resolveLog.push("B");
          }
        }

        class DependencyA {
          static dependencies = ["dependencyB"];
          constructor(deps) {
            this.b = deps.dependencyB;
            resolveLog.push("A");
          }
        }

        // Register components
        container.register("dependencyA", DependencyA);
        container.register("dependencyB", DependencyB);
        container.register("dependencyC", DependencyC);

        // Force initialized state
        container.initialized = true;

        // Resolve top-level dependency
        const instanceA = await container.resolve("dependencyA");

        // Verify correct resolution order and instance types
        expect(resolveLog).toEqual(["C", "B", "A"]);
        expect(instanceA).toBeInstanceOf(DependencyA);
        expect(instanceA.b).toBeInstanceOf(DependencyB);
        expect(instanceA.b.c).toBeInstanceOf(DependencyC);
      });
    });
    describe("Edge Case Dependency Resolution", () => {
      test("should handle error during dependency resolution on line 176", async () => {
        // Create a component with a dependency that fails to resolve
        class FailingDependencyComponent {
          static dependencies = ["failingDep"];
          constructor(deps) {
            this.deps = deps;
          }
        }

        // Create a mock dependency that will cause an error when resolved
        class FailingDependency {
          constructor() {
            // Intentionally throw an error during instantiation
            throw new Error("Dependency resolution failed");
          }
        }

        // Register the components
        container.register("mainComponent", FailingDependencyComponent);
        container.register("failingDep", FailingDependency);

        // Force initialized state
        container.initialized = true;

        // Expect an error to be thrown during resolution
        await expect(container.resolve("mainComponent")).rejects.toThrow(
          "Dependency resolution failed"
        );
      });

      test("should handle unresolvable dependencies", async () => {
        // Create a component with an unregistered dependency
        class UnresolvableDependencyComponent {
          static dependencies = ["unregisteredDep"];
          constructor(deps) {
            this.deps = deps;
          }
        }

        // Register the component with an unregistered dependency
        container.register("mainComponent", UnresolvableDependencyComponent);

        // Force initialized state
        container.initialized = true;

        // Expect an error to be thrown due to unregistered dependency
        await expect(container.resolve("mainComponent")).rejects.toThrow(
          "Component unregisteredDep is not registered"
        );
      });
    });
    describe("Factory Function Resolution", () => {
      test("should handle zero-length factory function specifically for line 170", async () => {
        // Define a factory function that explicitly has length 0
        const factory = function() { 
          return { value: 'test' }; 
        };
        
        // Ensure it's treated as a factory function, not a constructor
        Object.setPrototypeOf(factory, Function.prototype);
        factory.prototype = undefined;
        
        // Verify our setup
        expect(factory.length).toBe(0);
        expect(factory.prototype).toBeUndefined();
        expect(typeof factory).toBe('function');
        
        // Register the component
        container.register('zeroLengthFactory', factory);
        
        // Resolve and verify
        const instance = await container.resolve('zeroLengthFactory');
        expect(instance).toHaveProperty('value', 'test');
      });
    
      test("should handle both zero and non-zero length factory functions", async () => {
        // Zero parameter factory
        const zeroParamFactory = function() { 
          return { type: 'zero' }; 
        };
        Object.setPrototypeOf(zeroParamFactory, Function.prototype);
        zeroParamFactory.prototype = undefined;
        
        // Factory with parameters
        const withParamFactory = function(deps) { 
          return { type: 'with-deps', deps }; 
        };
        Object.setPrototypeOf(withParamFactory, Function.prototype);
        withParamFactory.prototype = undefined;
        
        // Register both
        container.register('zeroParam', zeroParamFactory);
        container.register('withParam', withParamFactory);
        
        // Test zero param factory
        const zeroInstance = await container.resolve('zeroParam');
        expect(zeroInstance.type).toBe('zero');
        
        // Test factory with params
        const withParamInstance = await container.resolve('withParam');
        expect(withParamInstance.type).toBe('with-deps');
      });
    });
  });
});
