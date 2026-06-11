/// <reference lib="dom" />

import type { PeerContext } from "../_runtime/context";
import type {
  PeerStreamEndMessage,
  PeerStreamErrorMessage,
  PeerStreamItemMessage,
  PeerStreamPullMessage,
  PeerStreamRequestMessage,
} from "../messages";

import { reportError } from "../_runtime/context";
import {
  createMethodNotFoundError,
  createPeerError,
  createStreamFailedError,
} from "../_runtime/errors";
import { send } from "./send";

interface StreamMessageArgs<TSendOptions, TMessage> {
  context: PeerContext<TSendOptions>;
  message: TMessage;
}

function reportUnknownStreamMessage<TSendOptions>(
  context: PeerContext<TSendOptions>,
  id: number,
): void {
  reportError({
    context,
    error: createPeerError("STREAM_FAILED", `No pending stream for message "${id}".`),
    errorContext: {
      type: "stream-message",
      id,
    },
  });
}

export function receiveStreamRequest<TSendOptions>({
  context,
  message,
}: StreamMessageArgs<TSendOptions, PeerStreamRequestMessage>): void {
  const registeredHandler = context.streamHandlers.get(message.name);

  if (!registeredHandler) {
    send({
      context,
      message: {
        type: "stream-error",
        id: message.id,
        error: createMethodNotFoundError(message.name),
      },
    });

    return;
  }

  const controller = new AbortController();

  try {
    const iterable = registeredHandler.handler(message.payload, {
      id: message.id,
      name: message.name,
      signal: controller.signal,
    });

    context.activeStreams.set(message.id, {
      name: message.name,
      onError: registeredHandler.onError,
      controller,
      iterator: iterable[Symbol.asyncIterator](),
      pulling: false,
    });
  } catch (error) {
    const streamError = createStreamFailedError(error);

    reportError({
      context,
      error: streamError,
      errorContext: {
        type: "stream-handler",
        id: message.id,
        name: message.name,
      },
      onError: registeredHandler.onError,
    });

    send({
      context,
      message: {
        type: "stream-error",
        id: message.id,
        error: streamError,
      },
    });
  }
}

export async function receiveStreamPull<TSendOptions>({
  context,
  message,
}: StreamMessageArgs<TSendOptions, PeerStreamPullMessage>): Promise<void> {
  const activeStream = context.activeStreams.get(message.id);

  if (!activeStream || activeStream.pulling) {
    return;
  }

  activeStream.pulling = true;

  try {
    const result = await activeStream.iterator.next();

    activeStream.pulling = false;

    if (
      activeStream.controller.signal.aborted ||
      context.closed ||
      context.activeStreams.get(message.id) !== activeStream
    ) {
      return;
    }

    if (result.done) {
      context.activeStreams.delete(message.id);
      send({
        context,
        message: {
          type: "stream-end",
          id: message.id,
        },
      });
      return;
    }

    send({
      context,
      message: {
        type: "stream-item",
        id: message.id,
        payload: result.value,
      },
    });
  } catch (error) {
    activeStream.pulling = false;

    if (
      activeStream.controller.signal.aborted ||
      context.closed ||
      context.activeStreams.get(message.id) !== activeStream
    ) {
      return;
    }

    context.activeStreams.delete(message.id);

    const streamError = createStreamFailedError(error);

    reportError({
      context,
      error: streamError,
      errorContext: {
        type: "stream-handler",
        id: message.id,
        name: activeStream.name,
      },
      onError: activeStream.onError,
    });

    send({
      context,
      message: {
        type: "stream-error",
        id: message.id,
        error: streamError,
      },
    });
  }
}

function getPendingStream<TSendOptions>(
  context: PeerContext<TSendOptions>,
  id: number,
  terminal: boolean,
) {
  const pendingStream = context.pendingStreams.get(id);

  if (pendingStream) {
    return pendingStream;
  }

  if (context.cancelledRequests.has(id)) {
    if (terminal) {
      context.cancelledRequests.delete(id);
    }

    return undefined;
  }

  reportUnknownStreamMessage(context, id);
  return undefined;
}

export function receiveStreamItem<TSendOptions>({
  context,
  message,
}: StreamMessageArgs<TSendOptions, PeerStreamItemMessage>): void {
  getPendingStream(context, message.id, false)?.item(message.payload);
}

export function receiveStreamEnd<TSendOptions>({
  context,
  message,
}: StreamMessageArgs<TSendOptions, PeerStreamEndMessage>): void {
  const pendingStream = getPendingStream(context, message.id, true);

  if (!pendingStream) {
    return;
  }

  context.pendingStreams.delete(message.id);
  pendingStream.end();
}

export function receiveStreamError<TSendOptions>({
  context,
  message,
}: StreamMessageArgs<TSendOptions, PeerStreamErrorMessage>): void {
  const pendingStream = getPendingStream(context, message.id, true);

  if (!pendingStream) {
    return;
  }

  context.pendingStreams.delete(message.id);

  reportError({
    context,
    error: message.error,
    errorContext: {
      type: "stream",
      id: message.id,
      name: pendingStream.name,
    },
    onError: pendingStream.onError,
  });

  pendingStream.fail(message.error);
}
