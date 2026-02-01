import { startServer } from "./server";

const server = startServer(Number(process.env.PORT) || 3000);
console.log(`Server running on http://localhost:${server.port}`);
