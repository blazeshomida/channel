import type {
  PeerMessage,
  PeerNotificationMessage,
  PeerRequestMessage,
  PeerResponseMessage,
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
