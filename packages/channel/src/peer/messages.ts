import type { PeerErrorPayload } from "./types";

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
  error: PeerErrorPayload;
}

export interface PeerNotificationMessage {
  type: "notification";
  name: string;
  payload: unknown;
}

export type PeerMessage = PeerRequestMessage | PeerResponseMessage | PeerNotificationMessage;
