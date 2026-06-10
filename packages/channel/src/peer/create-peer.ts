import type { Channel } from "../channel";
import type { TransportSendArgs } from "../transport";
import {
  createMethodNotFoundError,
  createPeerClosedError,
  createPeerError,
  createRequestFailedError,
} from "./errors";
import {
  isNotificationMessage,
  isRequestMessage,
  isResponseMessage,
  type PeerMessage,
  type PeerNotificationMessage,
  type PeerRequestMessage,
  type PeerResponseMessage,
} from "./messages";
import type {
  CreatePeerOptions,
  Peer,
  PeerErrorContext,
  PeerErrorHandler,
  PeerErrorPayload,
  PeerHandleOptions,
  PeerHandler,
  PeerNotificationListener,
  PeerNotifyOptions,
  PeerOnOptions,
  PeerOnceOptions,
  PeerRequestOptions,
} from "./types";

interface PendingRequest<TResult> {
  name: string;
  onError: PeerErrorHandler | undefined;
  resolve(value: TResult): void;
  reject(reason: PeerErrorPayload): void;
}

interface RegisteredHandler {
  handler: PeerHandler<unknown, unknown>;
  onError: PeerErrorHandler | undefined;
}

interface RegisteredNotificationListener {
  listener: PeerNotificationListener<unknown>;
  onError: PeerErrorHandler | undefined;
  once: boolean;
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
  const { channel, onError } = options;
  const getRequestId = createRequestIdFactory();
  const pendingRequests = new Map<number, PendingRequest<unknown>>();
  const handlers = new Map<string, RegisteredHandler>();
  const notificationListeners = new Map<string, Set<RegisteredNotificationListener>>();

  let closed = false;

  function reportError(error: unknown, context: PeerErrorContext, localOnError?: PeerErrorHandler) {
    localOnError?.(error, context);
    onError?.(error, context);
  }

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
      reportError(
        createPeerError("REQUEST_FAILED", `No pending request for response "${message.id}".`),
        {
          type: "response",
          id: message.id,
        },
      );

      return;
    }

    pendingRequests.delete(message.id);

    if (message.ok) {
      pendingRequest.resolve(message.payload);
      return;
    }

    reportError(
      message.error,
      {
        type: "request",
        id: message.id,
        name: pendingRequest.name,
      },
      pendingRequest.onError,
    );

    pendingRequest.reject(message.error);
  }

  async function handleRequest(message: PeerRequestMessage) {
    const registeredHandler = handlers.get(message.name);

    if (!registeredHandler) {
      send({
        type: "response",
        id: message.id,
        ok: false,
        error: createMethodNotFoundError(message.name),
      });

      return;
    }

    try {
      const payload = await registeredHandler.handler(message.payload, {
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
      const responseError = createRequestFailedError(error);

      reportError(
        responseError,
        {
          type: "handler",
          id: message.id,
          name: message.name,
        },
        registeredHandler.onError,
      );

      send({
        type: "response",
        id: message.id,
        ok: false,
        error: responseError,
      });
    }
  }

  function handleNotification(message: PeerNotificationMessage) {
    const listeners = notificationListeners.get(message.name);

    if (!listeners) {
      return;
    }

    const activeListeners = Array.from(listeners);

    for (const entry of activeListeners) {
      if (!listeners.has(entry)) {
        continue;
      }

      if (entry.once) {
        listeners.delete(entry);
      }

      try {
        entry.listener(message.payload, {
          name: message.name,
        });
      } catch (error) {
        reportError(
          error,
          {
            type: "notification",
            name: message.name,
          },
          entry.onError,
        );
      }
    }

    if (listeners.size === 0) {
      notificationListeners.delete(message.name);
    }
  }

  const unsubscribe = channel.subscribe((message) => {
    if (isResponseMessage(message)) {
      handleResponse(message);
      return;
    }

    if (isRequestMessage(message)) {
      void handleRequest(message);
      return;
    }

    if (isNotificationMessage(message)) {
      handleNotification(message);
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
          name: requestOptions.name,
          onError: requestOptions.onError,
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

      handlers.set(handleOptions.name, {
        handler: (payload, context) => handleOptions.handler(payload as TPayload, context),
        onError: handleOptions.onError,
      });

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

    notify<TPayload = unknown>(notifyOptions: PeerNotifyOptions<TPayload, TSendOptions>) {
      assertOpen();

      send(
        {
          type: "notification",
          name: notifyOptions.name,
          payload: notifyOptions.payload,
        },
        notifyOptions.send,
      );
    },

    on<TPayload = unknown>(onOptions: PeerOnOptions<TPayload>) {
      assertOpen();

      let active = true;

      const listener: RegisteredNotificationListener = {
        listener: (payload, context) => onOptions.listener(payload as TPayload, context),
        onError: onOptions.onError,
        once: false,
      };

      let listeners = notificationListeners.get(onOptions.name);

      if (!listeners) {
        listeners = new Set();
        notificationListeners.set(onOptions.name, listeners);
      }

      listeners.add(listener);

      return () => {
        if (!active) {
          return;
        }

        active = false;
        listeners.delete(listener);

        if (listeners.size === 0) {
          notificationListeners.delete(onOptions.name);
        }
      };
    },

    once<TPayload = unknown>(onceOptions: PeerOnceOptions<TPayload>) {
      assertOpen();

      let active = true;

      const listener: RegisteredNotificationListener = {
        listener: (payload, context) => onceOptions.listener(payload as TPayload, context),
        onError: onceOptions.onError,
        once: true,
      };

      let listeners = notificationListeners.get(onceOptions.name);

      if (!listeners) {
        listeners = new Set();
        notificationListeners.set(onceOptions.name, listeners);
      }

      listeners.add(listener);

      return () => {
        if (!active) {
          return;
        }

        active = false;
        listeners.delete(listener);

        if (listeners.size === 0) {
          notificationListeners.delete(onceOptions.name);
        }
      };
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
      notificationListeners.clear();
      unsubscribe();
      channel.close();
    },
  };
}
