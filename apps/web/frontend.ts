import {
  BOARD_SIZE,
  type Coordinate,
  type GameStateDTO,
  MAX_CANDIDATES,
  type PlayerId,
  type ServerMessage,
  SUCCESS_PROBABILITY,
  WS_EVENTS,
} from "@pkg/shared";

// ===== State =====

let ws: WebSocket | null = null;
let myPlayerId: PlayerId | null = null;
let roomId: string | null = null;
let gameState: GameStateDTO | null = null;
let selectedCandidates: Coordinate[] = [];

// ===== DOM Elements =====

const statusEl = document.getElementById("status") as HTMLDivElement;
const roomControlsEl = document.getElementById(
  "room-controls",
) as HTMLDivElement;
const createBtn = document.getElementById("create-btn") as HTMLButtonElement;
const joinBtn = document.getElementById("join-btn") as HTMLButtonElement;
const roomInput = document.getElementById("room-input") as HTMLInputElement;
const boardContainerEl = document.getElementById(
  "board-container",
) as HTMLDivElement;
const boardEl = document.getElementById("board") as HTMLDivElement;
const turnInfoEl = document.getElementById("turn-info") as HTMLDivElement;
const candidatesInfoEl = document.getElementById(
  "candidates-info",
) as HTMLDivElement;
const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement;

// ===== Board Rendering =====

function renderBoard(): void {
  boardEl.innerHTML = "";

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);

      if (gameState) {
        const row = gameState.board[y];
        const cellState = row?.[x];
        if (cellState) {
          cell.classList.add(cellState);
        }
      }

      // Check if selected
      const isSelected = selectedCandidates.some((c) => c.x === x && c.y === y);
      if (isSelected) {
        cell.classList.add("selected");
      }

      cell.addEventListener("click", () => handleCellClick(x, y));
      boardEl.appendChild(cell);
    }
  }
}

function updateUI(): void {
  if (!gameState) return;

  const isMyTurn = gameState.currentPlayer === myPlayerId;

  if (gameState.phase === "finished") {
    if (gameState.winner) {
      const winnerName =
        gameState.winner === myPlayerId ? "あなたの勝ち!" : "相手の勝ち";
      turnInfoEl.textContent = winnerName;
    } else if (gameState.isDraw) {
      turnInfoEl.textContent = "引き分け";
    }
    candidatesInfoEl.textContent = "";
    submitBtn.classList.add("hidden");
  } else if (gameState.phase === "playing") {
    if (isMyTurn) {
      turnInfoEl.textContent = "あなたのターン";
      const probability = SUCCESS_PROBABILITY[selectedCandidates.length] ?? 0;
      candidatesInfoEl.textContent = `選択: ${selectedCandidates.length}/${MAX_CANDIDATES} (成功率: ${Math.round(probability * 100)}%)`;
      submitBtn.classList.toggle("hidden", selectedCandidates.length === 0);
    } else {
      turnInfoEl.textContent = "相手のターン";
      candidatesInfoEl.textContent = "待機中...";
      submitBtn.classList.add("hidden");
    }
  }

  renderBoard();
}

// ===== Event Handlers =====

function handleCellClick(x: number, y: number): void {
  if (!gameState || gameState.phase !== "playing") return;
  if (gameState.currentPlayer !== myPlayerId) return;

  // Can't click occupied cells
  const row = gameState.board[y];
  if (row?.[x] !== null) return;

  const existingIndex = selectedCandidates.findIndex(
    (c) => c.x === x && c.y === y,
  );

  if (existingIndex >= 0) {
    // Deselect
    selectedCandidates.splice(existingIndex, 1);
  } else if (selectedCandidates.length < MAX_CANDIDATES) {
    // Select
    selectedCandidates.push({ x, y });
  }

  updateUI();
}

function handleSubmit(): void {
  if (!ws || selectedCandidates.length === 0) return;

  ws.send(
    JSON.stringify({
      event: WS_EVENTS.GAME_SUBMIT_CANDIDATES,
      candidates: selectedCandidates,
    }),
  );

  selectedCandidates = [];
  updateUI();
}

// ===== WebSocket =====

function connect(): void {
  ws = new WebSocket("ws://localhost:3000/ws");

  ws.onopen = () => {
    statusEl.textContent = "接続完了";
  };

  ws.onclose = () => {
    statusEl.textContent = "切断されました";
    ws = null;
  };

  ws.onerror = () => {
    statusEl.textContent = "接続エラー";
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data) as ServerMessage;
    handleServerMessage(data);
  };
}

function handleServerMessage(data: ServerMessage): void {
  switch (data.event) {
    case WS_EVENTS.ROOM_CREATED:
      roomId = data.roomId;
      myPlayerId = data.playerId;
      statusEl.textContent = `ルーム作成: ${roomId} (相手を待っています...)`;
      roomControlsEl.classList.add("hidden");
      break;

    case WS_EVENTS.ROOM_JOINED:
      roomId = data.roomId;
      myPlayerId = data.playerId;
      statusEl.textContent = `ルーム参加: ${roomId}`;
      roomControlsEl.classList.add("hidden");
      break;

    case WS_EVENTS.ROOM_ERROR:
      statusEl.textContent = `エラー: ${data.message}`;
      break;

    case WS_EVENTS.GAME_START:
      gameState = data.state;
      statusEl.textContent = `ルーム: ${roomId}`;
      boardContainerEl.style.display = "flex";
      updateUI();
      break;

    case WS_EVENTS.GAME_STATE:
      gameState = data.state;
      updateUI();
      break;

    case WS_EVENTS.GAME_TURN_RESULT:
      gameState = data.state;
      selectedCandidates = [];

      if (!data.result.success) {
        const player = data.result.player === myPlayerId ? "あなた" : "相手";
        statusEl.textContent = `${player}の配置失敗 - ターン交代`;
      } else {
        statusEl.textContent = `ルーム: ${roomId}`;
      }

      updateUI();
      break;

    case WS_EVENTS.GAME_ERROR:
      statusEl.textContent = `エラー: ${data.message}`;
      break;
  }
}

// ===== Initialize =====

createBtn.addEventListener("click", () => {
  if (!ws) return;
  ws.send(JSON.stringify({ event: WS_EVENTS.ROOM_CREATE }));
});

joinBtn.addEventListener("click", () => {
  if (!ws) return;
  const id = roomInput.value.trim().toUpperCase();
  if (!id) return;
  ws.send(JSON.stringify({ event: WS_EVENTS.ROOM_JOIN, roomId: id }));
});

submitBtn.addEventListener("click", handleSubmit);

connect();
