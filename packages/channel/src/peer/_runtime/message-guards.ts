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
