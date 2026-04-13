const { broadcastToRoom } = require("./wsBroadcast");

function handleMessage({ socket, payload, rooms }) {
  if (!payload || typeof payload.type !== "string") {
    return;
  }

  const roomMode = String(socket.user?.gameMode || "war").toLowerCase();

  switch (payload.type) {
    case "map:subscribe": {
      const key = `map:${roomMode}`;
      if (!rooms.has(key)) {
        rooms.set(key, new Set());
      }
      rooms.get(key).add(socket);
      socket.subscriptions.add(key);
      break;
    }
    case "map:unsubscribe": {
      const key = `map:${roomMode}`;
      if (rooms.has(key)) {
        rooms.get(key).delete(socket);
      }
      socket.subscriptions.delete(key);
      break;
    }
    case "market:subscribe": {
      const key = `market:${roomMode}`;
      if (!rooms.has(key)) {
        rooms.set(key, new Set());
      }
      rooms.get(key).add(socket);
      socket.subscriptions.add(key);
      break;
    }
    case "market:unsubscribe": {
      const key = `market:${roomMode}`;
      if (rooms.has(key)) {
        rooms.get(key).delete(socket);
      }
      socket.subscriptions.delete(key);
      break;
    }
    case "chat:ping": {
      socket.send(JSON.stringify({ type: "chat:pong", ts: Date.now() }));
      break;
    }
    case "district:update": {
      // Server authoritative. Ignore client-origin update requests.
      socket.send(JSON.stringify({ type: "error", error: "forbidden" }));
      break;
    }
    default:
      socket.send(JSON.stringify({ type: "error", error: "unknown_event" }));
  }
}

function broadcastMapUpdate({ rooms, update, gameMode = "war" }) {
  broadcastToRoom(rooms, `map:${String(gameMode || "war").toLowerCase()}`, { type: "map:update", data: update });
}

function broadcastMarketUpdate({ rooms, update, gameMode = "war" }) {
  broadcastToRoom(rooms, `market:${String(gameMode || "war").toLowerCase()}`, { type: "market:update", data: update });
}

module.exports = { handleMessage, broadcastMapUpdate, broadcastMarketUpdate };
