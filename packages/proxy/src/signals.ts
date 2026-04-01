/**
 * Cross-module event signaling for conversation lifecycle events.
 *
 * Used to coordinate between REST route handlers and WebSocket connections.
 * When a user sends a message (REST), the WS polling loop must transition
 * to ACTIVE state immediately — this EventEmitter bridges that gap.
 */

import { EventEmitter } from "node:events";

export const conversationSignals = new EventEmitter();
conversationSignals.setMaxListeners(100); // One per open WS connection
