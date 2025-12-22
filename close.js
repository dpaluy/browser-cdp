#!/usr/bin/env node

import WebSocket from "ws";

const DEFAULT_PORT = process.env.DEBUG_PORT || 9222;

try {
  // Use CDP Browser.close to actually quit the browser
  const res = await fetch(`http://localhost:${DEFAULT_PORT}/json/version`);
  const { webSocketDebuggerUrl } = await res.json();

  const socket = new WebSocket(webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    socket.on("open", () => {
      socket.send(JSON.stringify({ id: 1, method: "Browser.close" }));
    });
    socket.on("message", () => {
      resolve();
    });
    socket.on("error", reject);
    setTimeout(() => resolve(), 2000); // Browser closes before responding
  });

  console.log("Browser closed");
} catch (err) {
  if (err.cause?.code === "ECONNREFUSED" || err.message?.includes("ECONNREFUSED")) {
    console.log("No browser running on port", DEFAULT_PORT);
  } else {
    throw err;
  }
}
