import 'dotenv/config';

const { NODE_ENV = "development", PORT = 3000 } = process.env;
console.time("Start");

let address;

async function startServer() {
  if (NODE_ENV === "production") {
    const { buildApp } = await import("./dist/app.js");
    const app = await buildApp();
    address = await app.listen({ port: '3001', host: '0.0.0.0' });
  } else {
    const { once } = await import("events");
    const { createServer } = await import("vite");
    let appInstance;  // Store the built app instance

    const devServer = await createServer({
      appType: "custom",
      server: { middlewareMode: true },
    });

    const server = devServer.middlewares
      .use(async (req, res, next) => {
        try {
          if (!appInstance) {
            console.log('Building app for the first time.');
            const { buildApp } = await devServer.ssrLoadModule("./src/app.js");
            appInstance = await buildApp();
            await appInstance.ready();
          }

          console.log('Routing request:', req.url);
          appInstance.routing(req, res);
        } catch (err) {
          console.error('Error during request handling:', err);
          return next(err);
        }
      })
      .listen(PORT);

    await once(server, "listening");
    address = `http://localhost:${server.address().port}`;

    // Listen for file changes to trigger a rebuild
    devServer.watcher.on('change', (file) => {
      console.log(`File changed: ${file}. Rebuilding app...`);
      appInstance = null;  // This will trigger a rebuild on the next request
      console.log(`App rebuilt`);
    });
  }

  console.timeEnd("Start");
  console.log(`Env: ${NODE_ENV}`);
  console.log(`Address: ${address}`);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
