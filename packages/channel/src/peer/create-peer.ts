import type { Channel } from "../channel";
import type { TransportSendArgs } from "../transport";
import { assertOpen, createContext, reportError } from "./_context";
import {
  createMethodNotFoundError,
  createPeerClosedError,
  createPeerError,
  createRequestFailedError,
} from "./_errors";
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
): void {
  const args = (options === undefined ? [] : [options]) as TransportSendArgs<TSendOptions>;

  channel.send(message, ...args);
}

export function createPeer<TSendOptions = void>(
  options: CreatePeerOptions<TSendOptions>,
): Peer<TSendOptions> {
  const context = createContext({ options });
  const { channel, pendingRequests, handlers, notifications } = context;

  function rejectIfClosed<TResult>(): Promise<TResult> | undefined {
    if (!context.closed) {
      return undefined;
    }

    return Promise.reject(createPeerClosedError());
  }

  function send(message: PeerMessage, sendOptions?: TSendOptions): void {
    sendPeerMessage(channel, message, sendOptions);
  }

  function handleResponse(message: PeerResponseMessage): void {
    const pendingRequest = pendingRequests.get(message.id);

    if (!pendingRequest) {
      reportError({
        context,
        error: createPeerError(
          "REQUEST_FAILED",
          `No pending request for response "${message.id}".`,
        ),
        errorContext: {
          type: "response",
          id: message.id,
        },
      });

      return;
    }

    pendingRequests.delete(message.id);

    if (message.ok) {
      pendingRequest.resolve(message.payload);
      return;
    }

    reportError({
      context,
      error: message.error,
      errorContext: {
        type: "request",
        id: message.id,
        name: pendingRequest.name,
      },
      onError: pendingRequest.onError,
    });

    pendingRequest.reject(message.error);
  }

  async function handleRequest(message: PeerRequestMessage): Promise<void> {
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

      reportError({
        context,
        error: responseError,
        errorContext: {
          type: "handler",
          id: message.id,
          name: message.name,
        },
        onError: registeredHandler.onError,
      });

      send({
        type: "response",
        id: message.id,
        ok: false,
        error: responseError,
      });
    }
  }

  function handleNotification(message: PeerNotificationMessage): void {
    notifications.emit(message.name, message.payload, (listener, payload, notificationContext) => {
      try {
        listener.listener(payload, notificationContext);
      } catch (error) {
        reportError({
          context,
          error,
          errorContext: {
            type: "notification",
            name: message.name,
          },
          onError: listener.onError,
        });
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

      const id = context.getRequestId();

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
      assertOpen({ context });

      if (handlers.has(handleOptions.name)) {
        throw new Error(`Handler already registered for "${handleOptions.name}".`);
      }

      let active = true;

      handlers.set(handleOptions.name, {
        handler: (payload, handlerContext) =>
          handleOptions.handler(payload as TPayload, handlerContext),
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
      assertOpen({ context });

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
      assertOpen({ context });

      return notifications.add({
        name: onOptions.name,
        listener: (payload, notificationContext) =>
          onOptions.listener(payload as TPayload, notificationContext),
        onError: onOptions.onError,
        once: false,
      });
    },

    once<TPayload = unknown>(onceOptions: PeerOnceOptions<TPayload>) {
      assertOpen({ context });

      return notifications.add({
        name: onceOptions.name,
        listener: (payload, notificationContext) =>
          onceOptions.listener(payload as TPayload, notificationContext),
        onError: onceOptions.onError,
        once: true,
      });
    },

    close() {
      if (context.closed) {
        return;
      }

      context.closed = true;

      pendingRequests.rejectAll(createPeerClosedError());
      handlers.clear();
      notifications.clear();
      unsubscribe();
      channel.close();
    },
  };
}
