import type { PeerError } from "./types";

export interface PeerRequestMessage {
  type: "request";
  id: number;
  name: string;
  payload: unknown;
}

export type PeerResponseMessage = PeerSuccessResponseMessage | PeerErrorResponseMessage;

export interface PeerSuccessResponseMessage {
  type: "response";
  id: number;
  ok: true;
  payload: unknown;
}

export interface PeerErrorResponseMessage {
  type: "response";
  id: number;
  ok: false;
  error: PeerError;
}

export interface PeerNotificationMessage {
  type: "notification";
  name: string;
  payload: unknown;
}

export interface PeerCancelMessage {
  type: "cancel";
  id: number;
  reason?: unknown;
}

export interface PeerStreamRequestMessage {
  type: "stream-request";
  id: number;
  name: string;
  payload: unknown;
}

export interface PeerStreamPullMessage {
  type: "stream-pull";
  id: number;
}

export interface PeerStreamItemMessage {
  type: "stream-item";
  id: number;
  payload: unknown;
}

export interface PeerStreamEndMessage {
  type: "stream-end";
  id: number;
}

export interface PeerStreamErrorMessage {
  type: "stream-error";
  id: number;
  error: PeerError;
}

export type PeerMessage =
  | PeerRequestMessage
  | PeerResponseMessage
  | PeerNotificationMessage
  | PeerCancelMessage
  | PeerStreamRequestMessage
  | PeerStreamPullMessage
  | PeerStreamItemMessage
  | PeerStreamEndMessage
  | PeerStreamErrorMessage;
