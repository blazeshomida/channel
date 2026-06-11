import type { PeerContext } from "../_runtime/context";
import type { PeerRequestOptions } from "../types";

import { createPeerClosedError } from "../_runtime/errors";
import { send } from "./send";

interface RequestArgs<TPayload, TSendOptions> {
  context: PeerContext<TSendOptions>;
  options: PeerRequestOptions<TPayload, TSendOptions>;
}

function rejectIfClosed<TResult, TSendOptions>(
  context: PeerContext<TSendOptions>,
): Promise<TResult> | undefined {
  if (!context.closed) {
    return undefined;
  }

  return Promise.reject(createPeerClosedError());
}

export function request<TPayload = unknown, TResult = unknown, TSendOptions = void>({
  context,
  options,
}: RequestArgs<TPayload, TSendOptions>): Promise<TResult> {
  const closedPromise = rejectIfClosed<TResult, TSendOptions>(context);

  if (closedPromise) {
    return closedPromise;
  }

  const id = context.getRequestId();

  return new Promise<TResult>((resolve, reject) => {
    context.pendingRequests.set(id, {
      name: options.name,
      onError: options.onError,
      resolve: (value) => {
        // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Request result types are compile-time contracts; runtime schemas belong in a future contract layer.
        resolve(value as TResult);
      },
      reject,
    });

    send({
      context,
      message: {
        type: "request",
        id,
        name: options.name,
        payload: options.payload,
      },
      options: options.send,
    });
  });
}
