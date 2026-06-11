import type {
  PeerCancelMessage,
  PeerMessage,
  PeerNotificationMessage,
  PeerRequestMessage,
  PeerResponseMessage,
} from "../messages";

import { reportError, type PeerContext } from "../_runtime/context";
import {
  createMethodNotFoundError,
  createPeerError,
  createRequestFailedError,
} from "../_runtime/errors";
import {
  isCancelMessage,
  isNotificationMessage,
  isRequestMessage,
  isResponseMessage,
} from "../_runtime/message-guards";
import { send } from "./send";

interface ReceiveArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  message: PeerMessage;
}

interface HandleResponseArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  message: PeerResponseMessage;
}

interface HandleRequestArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  message: PeerRequestMessage;
}

interface HandleNotificationArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  message: PeerNotificationMessage;
}

interface HandleCancelArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  message: PeerCancelMessage;
}

function handleResponse<TSendOptions>({
  context,
  message,
}: HandleResponseArgs<TSendOptions>): void {
  const pendingRequest = context.pendingRequests.get(message.id);

  if (!pendingRequest) {
    if (context.cancelledRequests.delete(message.id)) {
      return;
    }

    reportError({
      context,
      error: createPeerError("REQUEST_FAILED", `No pending request for response "${message.id}".`),
      errorContext: {
        type: "response",
        id: message.id,
      },
    });

    return;
  }

  context.pendingRequests.delete(message.id);

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

async function handleRequest<TSendOptions>({
  context,
  message,
}: HandleRequestArgs<TSendOptions>): Promise<void> {
  const registeredHandler = context.handlers.get(message.name);

  if (!registeredHandler) {
    send({
      context,
      message: {
        type: "response",
        id: message.id,
        ok: false,
        error: createMethodNotFoundError(message.name),
      },
    });

    return;
  }

  const activeRequest = context.activeRequests.create(message.id);

  try {
    const payload = await registeredHandler.handler(message.payload, {
      id: message.id,
      name: message.name,
      signal: activeRequest.signal,
    });

    context.activeRequests.delete(message.id);

    if (activeRequest.signal.aborted || context.closed) {
      return;
    }

    send({
      context,
      message: {
        type: "response",
        id: message.id,
        ok: true,
        payload,
      },
    });
  } catch (error) {
    context.activeRequests.delete(message.id);

    if (activeRequest.signal.aborted || context.closed) {
      return;
    }

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
      context,
      message: {
        type: "response",
        id: message.id,
        ok: false,
        error: responseError,
      },
    });
  }
}

function handleNotification<TSendOptions>({
  context,
  message,
}: HandleNotificationArgs<TSendOptions>): void {
  context.notifications.emit(
    message.name,
    message.payload,
    (listener, payload, notificationContext) => {
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
    },
  );
}

function handleCancel<TSendOptions>({ context, message }: HandleCancelArgs<TSendOptions>): void {
  context.activeRequests.abort(message.id, message.reason);
}

export function receive<TSendOptions>({ context, message }: ReceiveArgs<TSendOptions>): void {
  if (isResponseMessage(message)) {
    handleResponse({ context, message });
    return;
  }

  if (isRequestMessage(message)) {
    void handleRequest({ context, message });
    return;
  }

  if (isNotificationMessage(message)) {
    handleNotification({ context, message });
    return;
  }

  if (isCancelMessage(message)) {
    handleCancel({ context, message });
  }
}
