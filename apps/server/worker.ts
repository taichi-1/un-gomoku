import { createWorkerApp } from "./worker/app";

export { GameRoomDurableObject } from "./worker/game-room-do";

const app = createWorkerApp();

export default app;
