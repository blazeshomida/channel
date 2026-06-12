export { createPeer } from "./create-peer";
export { createContract, event, request, stream } from "./contract";

export type {
  Contract,
  ContractOperations,
  EventOperation,
  Operation,
  RequestOperation,
  Schema,
  StreamOperation,
} from "./contract";
export type {
  CreatePeerOptions,
  EventName,
  HandleName,
  Peer,
  PeerEmitOptions,
  PeerHandleOptions,
  PeerOnOptions,
  PeerOnceOptions,
  PeerRequestOptions,
  PeerStreamOptions,
  RequestName,
  StreamName,
} from "./contract-types";
export type {
  PeerDispose,
  PeerErrorCode,
  PeerErrorContext,
  PeerErrorHandler,
  PeerErrorPayload,
  PeerHandleContext,
  PeerNotificationContext,
  PeerStream,
  PeerValidationDirection,
  PeerValidationErrorData,
  PeerValidationIssue,
} from "./types";
