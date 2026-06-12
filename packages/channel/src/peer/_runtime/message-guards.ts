import type {
  PeerCancelMessage,
  PeerMessage,
  PeerNotificationMessage,
  PeerRequestMessage,
  PeerResponseMessage,
  PeerStreamEndMessage,
  PeerStreamErrorMessage,
  PeerStreamItemMessage,
  PeerStreamPullMessage,
  PeerStreamRequestMessage,
} from "../messages";
import type { PeerErrorPayload } from "../types";

const peerErrorCodes = new Set<string>([
  "INVALID_MESSAGE",
  "METHOD_NOT_FOUND",
  "PEER_CLOSED",
  "REQUEST_CANCELLED",
  "REQUEST_FAILED",
  "STREAM_FAILED",
  "VALIDATION_FAILED",
]);

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasId(message: Record<PropertyKey, unknown>): boolean {
  const id = message["id"];

  return Number.isSafeInteger(id) && typeof id === "number" && id > 0;
}

function hasName(message: Record<PropertyKey, unknown>): boolean {
  return typeof message["name"] === "string";
}

function isPeerErrorPayload(value: unknown): value is PeerErrorPayload {
  return (
    isRecord(value) &&
    typeof value["code"] === "string" &&
    peerErrorCodes.has(value["code"]) &&
    typeof value["message"] === "string"
  );
}

function isCompletePeerMessage(message: unknown): message is PeerMessage {
  if (!isRecord(message) || typeof message["type"] !== "string") {
    return false;
  }

  switch (message["type"]) {
    case "request":
    case "stream-request":
      return hasId(message) && hasName(message) && hasOwn(message, "payload");
    case "response":
      if (!hasId(message) || typeof message["ok"] !== "boolean") {
        return false;
      }

      return message["ok"]
        ? hasOwn(message, "payload")
        : hasOwn(message, "error") && isPeerErrorPayload(message["error"]);
    case "notification":
      return hasName(message) && hasOwn(message, "payload");
    case "cancel":
    case "stream-pull":
    case "stream-end":
      return hasId(message);
    case "stream-item":
      return hasId(message) && hasOwn(message, "payload");
    case "stream-error":
      return hasId(message) && isPeerErrorPayload(message["error"]);
    default:
      return false;
  }
}

export function isPeerMessage(message: unknown): message is PeerMessage {
  try {
    return isCompletePeerMessage(message);
  } catch {
    return false;
  }
}

export function isResponseMessage(message: PeerMessage): message is PeerResponseMessage {
  return message.type === "response";
}

export function isRequestMessage(message: PeerMessage): message is PeerRequestMessage {
  return message.type === "request";
}

export function isNotificationMessage(message: PeerMessage): message is PeerNotificationMessage {
  return message.type === "notification";
}

export function isCancelMessage(message: PeerMessage): message is PeerCancelMessage {
  return message.type === "cancel";
}

export function isStreamRequestMessage(message: PeerMessage): message is PeerStreamRequestMessage {
  return message.type === "stream-request";
}

export function isStreamPullMessage(message: PeerMessage): message is PeerStreamPullMessage {
  return message.type === "stream-pull";
}

export function isStreamItemMessage(message: PeerMessage): message is PeerStreamItemMessage {
  return message.type === "stream-item";
}

export function isStreamEndMessage(message: PeerMessage): message is PeerStreamEndMessage {
  return message.type === "stream-end";
}

export function isStreamErrorMessage(message: PeerMessage): message is PeerStreamErrorMessage {
  return message.type === "stream-error";
}
