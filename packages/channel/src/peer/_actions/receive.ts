import type { PeerContext } from "../_runtime/context";
import type { RequestLifecycle } from "../_runtime/request-lifecycle";
import type { StreamLifecycle } from "../_runtime/stream-lifecycle";
import type { PeerCancelMessage, PeerMessage, PeerNotificationMessage } from "../messages";

import {
  isCancelMessage,
  isNotificationMessage,
  isRequestMessage,
  isResponseMessage,
  isStreamEndMessage,
  isStreamErrorMessage,
  isStreamItemMessage,
  isStreamPullMessage,
  isStreamRequestMessage,
} from "../_runtime/message-guards";

interface ReceiveArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  message: PeerMessage;
  requests: RequestLifecycle<TSendOptions>;
  streams: StreamLifecycle<TSendOptions>;
}

interface HandleNotificationArgs<TSendOptions> {
  context: PeerContext<TSendOptions>;
  message: PeerNotificationMessage;
}

interface HandleCancelArgs<TSendOptions> {
  message: PeerCancelMessage;
  requests: RequestLifecycle<TSendOptions>;
  streams: StreamLifecycle<TSendOptions>;
}

function handleNotification<TSendOptions>({
  context,
  message,
}: HandleNotificationArgs<TSendOptions>): void {
  context.onNotification?.(message.payload, {
    name: message.name,
  });
}

function handleCancel<TSendOptions>({
  message,
  requests,
  streams,
}: HandleCancelArgs<TSendOptions>): void {
  requests.cancelHandler(message.id, message.reason);
  streams.cancelProducer(message.id, message.reason);
}

export function receive<TSendOptions>({
  context,
  message,
  requests,
  streams,
}: ReceiveArgs<TSendOptions>): void {
  if (isResponseMessage(message)) {
    requests.receiveResponse(message);
    return;
  }

  if (isRequestMessage(message)) {
    void requests.receiveRequest(message);
    return;
  }

  if (isNotificationMessage(message)) {
    handleNotification({ context, message });
    return;
  }

  if (isCancelMessage(message)) {
    handleCancel({ message, requests, streams });
    return;
  }

  if (isStreamRequestMessage(message)) {
    streams.receiveRequest(message);
    return;
  }

  if (isStreamPullMessage(message)) {
    void streams.receivePull(message);
    return;
  }

  if (isStreamItemMessage(message)) {
    streams.receiveItem(message);
    return;
  }

  if (isStreamEndMessage(message)) {
    streams.receiveEnd(message);
    return;
  }

  if (isStreamErrorMessage(message)) {
    streams.receiveError(message);
  }
}
