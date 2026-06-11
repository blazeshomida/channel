/// <reference lib="dom" />

import type { Channel } from "../channel";
import type {
  Contract,
  ContractOperations,
  EventOperation,
  RequestOperation,
  StreamOperation,
} from "./contract";
import type {
  PeerDispose,
  PeerErrorHandler,
  PeerHandleContext,
  PeerNotificationContext,
  PeerStream,
} from "./types";

type OperationsOf<TContract extends Contract> = TContract["operations"];

type NamesByOperation<TContract extends Contract, TOperation> = {
  [TName in keyof OperationsOf<TContract>]: OperationsOf<TContract>[TName] extends TOperation
    ? TName
    : never;
}[keyof OperationsOf<TContract>] &
  string;

export type RequestName<TContract extends Contract> = NamesByOperation<TContract, RequestOperation>;
export type StreamName<TContract extends Contract> = NamesByOperation<TContract, StreamOperation>;
export type EventName<TContract extends Contract> = NamesByOperation<TContract, EventOperation>;
export type HandleName<TContract extends Contract> = RequestName<TContract> | StreamName<TContract>;

type OperationAt<
  TContract extends Contract,
  TName extends keyof ContractOperations,
> = OperationsOf<TContract>[TName & keyof OperationsOf<TContract>];

type RequestInput<TOperation> =
  TOperation extends RequestOperation<infer TInput, unknown, unknown, unknown> ? TInput : never;
type RequestHandlerInput<TOperation> =
  TOperation extends RequestOperation<unknown, infer TInput, unknown, unknown> ? TInput : never;
type RequestHandlerOutput<TOperation> =
  TOperation extends RequestOperation<unknown, unknown, infer TOutput, unknown> ? TOutput : never;
type RequestOutput<TOperation> =
  TOperation extends RequestOperation<unknown, unknown, unknown, infer TOutput> ? TOutput : never;

type StreamInput<TOperation> =
  TOperation extends StreamOperation<infer TInput, unknown, unknown, unknown> ? TInput : never;
type StreamHandlerInput<TOperation> =
  TOperation extends StreamOperation<unknown, infer TInput, unknown, unknown> ? TInput : never;
type StreamHandlerItem<TOperation> =
  TOperation extends StreamOperation<unknown, unknown, infer TItem, unknown> ? TItem : never;
type StreamItem<TOperation> =
  TOperation extends StreamOperation<unknown, unknown, unknown, infer TItem> ? TItem : never;

type EventInput<TOperation> =
  TOperation extends EventOperation<infer TInput, unknown> ? TInput : never;
type EventListenerInput<TOperation> =
  TOperation extends EventOperation<unknown, infer TInput> ? TInput : never;

export interface PeerRequestOptions<
  TContract extends Contract,
  TName extends RequestName<TContract>,
  TSendOptions,
> {
  name: TName;
  input: RequestInput<OperationAt<TContract, TName>>;
  send?: TSendOptions;
  signal?: AbortSignal;
  onError?: PeerErrorHandler;
}

export interface PeerStreamOptions<
  TContract extends Contract,
  TName extends StreamName<TContract>,
  TSendOptions,
> {
  name: TName;
  input: StreamInput<OperationAt<TContract, TName>>;
  send?: TSendOptions;
  signal?: AbortSignal;
  onError?: PeerErrorHandler;
}

export interface PeerEmitOptions<
  TContract extends Contract,
  TName extends EventName<TContract>,
  TSendOptions,
> {
  name: TName;
  input: EventInput<OperationAt<TContract, TName>>;
  send?: TSendOptions;
}

type PeerRequestHandleOptions<TContract extends Contract, TName extends RequestName<TContract>> = {
  name: TName;
  handler: (
    input: RequestHandlerInput<OperationAt<TContract, TName>>,
    context: PeerHandleContext,
  ) =>
    | RequestHandlerOutput<OperationAt<TContract, TName>>
    | Promise<RequestHandlerOutput<OperationAt<TContract, TName>>>;
  onError?: PeerErrorHandler;
};

type PeerStreamHandleOptions<TContract extends Contract, TName extends StreamName<TContract>> = {
  name: TName;
  handler: (
    input: StreamHandlerInput<OperationAt<TContract, TName>>,
    context: PeerHandleContext,
  ) => AsyncIterable<StreamHandlerItem<OperationAt<TContract, TName>>>;
  onError?: PeerErrorHandler;
};

export type PeerHandleOptions<TContract extends Contract, TName extends HandleName<TContract>> =
  TName extends RequestName<TContract>
    ? PeerRequestHandleOptions<TContract, TName>
    : TName extends StreamName<TContract>
      ? PeerStreamHandleOptions<TContract, TName>
      : never;

export interface PeerOnOptions<TContract extends Contract, TName extends EventName<TContract>> {
  name: TName;
  listener: (
    input: EventListenerInput<OperationAt<TContract, TName>>,
    context: PeerNotificationContext,
  ) => void;
  onError?: PeerErrorHandler;
}

export type PeerOnceOptions<
  TContract extends Contract,
  TName extends EventName<TContract>,
> = PeerOnOptions<TContract, TName>;

export interface CreatePeerOptions<TContract extends Contract, TSendOptions = void> {
  contract: TContract;
  channel: Channel<unknown, unknown, TSendOptions>;
  onError?: PeerErrorHandler;
}

export interface Peer<TContract extends Contract, TSendOptions = void> {
  request<const TName extends RequestName<TContract>>(
    options: PeerRequestOptions<TContract, TName, TSendOptions>,
  ): Promise<RequestOutput<OperationAt<TContract, TName>>>;

  stream<const TName extends StreamName<TContract>>(
    options: PeerStreamOptions<TContract, TName, TSendOptions>,
  ): PeerStream<StreamItem<OperationAt<TContract, TName>>>;

  emit<const TName extends EventName<TContract>>(
    options: PeerEmitOptions<TContract, TName, TSendOptions>,
  ): void;

  handle<const TName extends HandleName<TContract>>(
    options: PeerHandleOptions<TContract, TName>,
  ): PeerDispose;

  on<const TName extends EventName<TContract>>(
    options: PeerOnOptions<TContract, TName>,
  ): PeerDispose;

  once<const TName extends EventName<TContract>>(
    options: PeerOnceOptions<TContract, TName>,
  ): PeerDispose;

  close(): void;
}
