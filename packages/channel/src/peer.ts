import type { Channel } from "./channel";
import type { TransportSendArgs } from "./transport";

export type PeerErrorCode = "METHOD_NOT_FOUND" | "REQUEST_FAILED" | "PEER_CLOSED";

export interface PeerErrorPayload {
  code: PeerErrorCode;
  message: string;
  data?: unknown;
}

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

export type PeerMessage = PeerRequestMessage | PeerResponseMessage;

export interface PeerRequestOptions<TPayload, TSendOptions> {
  name: string;
  payload: TPayload;
  send?: TSendOptions;
}

export interface PeerHandleContext {
  id: number;
  name: string;
}

export type PeerHandler<TPayload, TResult> = (
  payload: TPayload,
  context: PeerHandleContext,
) => TResult | Promise<TResult>;

export interface PeerHandleOptions<TPayload, TResult> {
  name: string;
  handler: PeerHandler<TPayload, TResult>;
}

export interface CreatePeerOptions<TSendOptions = void> {
  channel: Channel<PeerMessage, PeerMessage, TSendOptions>;
}

export type PeerDispose = () => void;

export interface Peer<TSendOptions = void> {
  request<TPayload = unknown, TResult = unknown>(
    options: PeerRequestOptions<TPayload, TSendOptions>,
  ): Promise<TResult>;

  handle<TPayload = unknown, TResult = unknown>(
    options: PeerHandleOptions<TPayload, TResult>,
  ): PeerDispose;

  hasHandler(name: string): boolean;

  close(): void;
}

interface PendingRequest<TResult> {
  resolve(value: TResult): void;
  reject(reason: PeerErrorPayload): void;
}

function createPeerError(code: PeerErrorCode, message: string, data?: unknown): PeerErrorPayload {
  return data === undefined ? { code, message } : { code, message, data };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createRequestFailedError(error: unknown): PeerErrorPayload {
  return createPeerError("REQUEST_FAILED", getErrorMessage(error));
}

function createPeerClosedError(): PeerErrorPayload {
  return createPeerError("PEER_CLOSED", "Peer is closed.");
}

function createMethodNotFoundError(name: string): PeerErrorPayload {
  return createPeerError("METHOD_NOT_FOUND", `No handler registered for "${name}".`);
}

function isResponseMessage(message: PeerMessage): message is PeerResponseMessage {
  return message.type === "response";
}

function isRequestMessage(message: PeerMessage): message is PeerRequestMessage {
  return message.type === "request";
}

function createRequestIdFactory() {
  let previousId = 0;

  return () => {
    previousId += 1;
    return previousId;
  };
}

function sendPeerMessage<TSendOptions>(
  channel: Channel<PeerMessage, PeerMessage, TSendOptions>,
  message: PeerMessage,
  options?: TSendOptions,
) {
  const args = (options === undefined ? [] : [options]) as TransportSendArgs<TSendOptions>;

  channel.send(message, ...args);
}

export function createPeer<TSendOptions = void>(
  options: CreatePeerOptions<TSendOptions>,
): Peer<TSendOptions> {
  const { channel } = options;
  const getRequestId = createRequestIdFactory();
  const pendingRequests = new Map<number, PendingRequest<unknown>>();
  const handlers = new Map<string, PeerHandler<unknown, unknown>>();

  let closed = false;

  function assertOpen() {
    if (closed) {
      throw new Error("Peer is closed.");
    }
  }

  function rejectIfClosed<TResult>(): Promise<TResult> | undefined {
    if (!closed) {
      return undefined;
    }

    return Promise.reject(createPeerClosedError());
  }

  function send(message: PeerMessage, sendOptions?: TSendOptions) {
    sendPeerMessage(channel, message, sendOptions);
  }

  function handleResponse(message: PeerResponseMessage) {
    const pendingRequest = pendingRequests.get(message.id);

    if (!pendingRequest) {
      return;
    }

    pendingRequests.delete(message.id);

    if (message.ok) {
      pendingRequest.resolve(message.payload);
      return;
    }

    pendingRequest.reject(message.error);
  }

  async function handleRequest(message: PeerRequestMessage) {
    const handler = handlers.get(message.name);

    if (!handler) {
      send({
        type: "response",
        id: message.id,
        ok: false,
        error: createMethodNotFoundError(message.name),
      });

      return;
    }

    try {
      const payload = await handler(message.payload, {
        id: message.id,
        name: message.name,
      });

      send({
        type: "response",
        id: message.id,
        ok: true,
        payload,
      });
    } catch (error) {
      send({
        type: "response",
        id: message.id,
        ok: false,
        error: createRequestFailedError(error),
      });
    }
  }

  const unsubscribe = channel.subscribe((message) => {
    if (isResponseMessage(message)) {
      handleResponse(message);
      return;
    }

    if (isRequestMessage(message)) {
      void handleRequest(message);
    }
  });

  return {
    request<TPayload = unknown, TResult = unknown>(
      requestOptions: PeerRequestOptions<TPayload, TSendOptions>,
    ): Promise<TResult> {
      const closedPromise = rejectIfClosed<TResult>();

      if (closedPromise) {
        return closedPromise;
      }

      const id = getRequestId();

      return new Promise<TResult>((resolve, reject) => {
        pendingRequests.set(id, {
          resolve: (value) => {
            resolve(value as TResult);
          },
          reject,
        });

        send(
          {
            type: "request",
            id,
            name: requestOptions.name,
            payload: requestOptions.payload,
          },
          requestOptions.send,
        );
      });
    },

    handle<TPayload = unknown, TResult = unknown>(
      handleOptions: PeerHandleOptions<TPayload, TResult>,
    ) {
      assertOpen();

      if (handlers.has(handleOptions.name)) {
        throw new Error(`Handler already registered for "${handleOptions.name}".`);
      }

      let active = true;

      const handler: PeerHandler<unknown, unknown> = (payload, context) =>
        handleOptions.handler(payload as TPayload, context);

      handlers.set(handleOptions.name, handler);

      return () => {
        if (!active) {
          return;
        }

        active = false;
        handlers.delete(handleOptions.name);
      };
    },

    hasHandler(name) {
      return handlers.has(name);
    },

    close() {
      if (closed) {
        return;
      }

      closed = true;

      const pendingRequestValues = [...pendingRequests.values()];

      pendingRequests.clear();

      for (const pendingRequest of pendingRequestValues) {
        pendingRequest.reject(createPeerClosedError());
      }

      handlers.clear();
      unsubscribe();
      channel.close();
    },
  };
}
