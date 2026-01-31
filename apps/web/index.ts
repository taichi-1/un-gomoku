import index from "./index.html";

const server = Bun.serve({
  port: 8080,
  routes: {
    "/": index,
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Web server running on http://localhost:${server.port}`);
