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
  HandledOperationName,
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
  DisposePeerRegistration,
  PeerError,
  PeerErrorCallback,
  PeerErrorCode,
  PeerErrorContext,
  PeerEventContext,
  PeerHandleContext,
  PeerStream,
  PeerValidationBoundary,
  PeerValidationFailureData,
  PeerValidationIssue,
} from "./types";
