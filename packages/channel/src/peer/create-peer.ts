import type { Channel } from "../channel";
import type { TransportSendArgs } from "../transport";
import {
  createMethodNotFoundError,
  createPeerClosedError,
  createPeerError,
  createRequestFailedError,
} from "./_errors";
import { createHandlerRegistry } from "./_handlers";
import { createNotificationRegistry } from "./_notifications";
import { createPendingRequestRegistry, createRequestIdFactory } from "./_requests";
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
  PeerHandleOptions,
  PeerNotifyOptions,
  PeerOnOptions,
  PeerOnceOptions,
  PeerRequestOptions,
} from "./types";

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
  const pendingRequests = createPendingRequestRegistry();
  const handlers = createHandlerRegistry();
  const notifications = createNotificationRegistry();

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
    notifications.emit(message.name, message.payload, (listener, payload, context) => {
      try {
        listener.listener(payload, context);
      } catch (error) {
        reportError(
          error,
          {
            type: "notification",
            name: message.name,
          },
          listener.onError,
        );
      }
    });
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

      return notifications.add({
        name: onOptions.name,
        listener: (payload, context) => onOptions.listener(payload as TPayload, context),
        onError: onOptions.onError,
        once: false,
      });
    },

    once<TPayload = unknown>(onceOptions: PeerOnceOptions<TPayload>) {
      assertOpen();

      return notifications.add({
        name: onceOptions.name,
        listener: (payload, context) => onceOptions.listener(payload as TPayload, context),
        onError: onceOptions.onError,
        once: true,
      });
    },

    close() {
      if (closed) {
        return;
      }

      closed = true;

      pendingRequests.rejectAll(createPeerClosedError());
      handlers.clear();
      notifications.clear();
      unsubscribe();
      channel.close();
    },
  };
}
