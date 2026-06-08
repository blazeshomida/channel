import type { Transport, TransportListener, TransportSendArgs, Unsubscribe } from "./transport";

/**
 * Handles inbound messages received through a {@linkcode Channel}.
 */
export type ChannelListener<TMessage> = TransportListener<TMessage>;

/**
 * Sends, receives, and closes messages through a {@linkcode Transport}.
 */
export interface Channel<TInbound = unknown, TOutbound = TInbound, TOptions = void> {
  /**
   * Whether the channel has been closed.
   */
  readonly closed: boolean;

  /**
   * Sends a message through the underlying transport.
   *
   * @throws When the channel has been closed.
   */
  send(message: TOutbound, ...args: TransportSendArgs<TOptions>): void;

  /**
   * Subscribes to inbound messages from the underlying transport.
   *
   * The returned unsubscribe function is idempotent.
   *
   * @throws When the channel has been closed.
   */
  subscribe(listener: ChannelListener<TInbound>): Unsubscribe;

  /**
   * Closes the channel.
   *
   * Closing is idempotent. Active subscriptions are unsubscribed before the
   * underlying transport close hook runs.
   */
  close(): void;
}

/**
 * Creates a channel over a transport.
 *
 * A channel owns subscription cleanup and prevents sends or new subscriptions
 * after it is closed.
 *
 * @example Basic usage.
 * ```ts
 * const channel = createChannel(transport);
 *
 * const unsubscribe = channel.subscribe((message) => {
 *   console.log(message);
 * });
 *
 * channel.send(message);
 * unsubscribe();
 * channel.close();
 * ```
 */
export function createChannel<TInbound = unknown, TOutbound = TInbound, TOptions = void>(
  transport: Transport<TInbound, TOutbound, TOptions>,
): Channel<TInbound, TOutbound, TOptions> {
  const subscriptions = new Set<Unsubscribe>();

  let closed = false;

  function assertOpen() {
    if (closed) {
      throw new Error("Channel is closed.");
    }
  }

  return {
    get closed() {
      return closed;
    },

    send(message, ...args) {
      assertOpen();
      transport.send(message, ...args);
    },

    subscribe(listener) {
      assertOpen();

      let subscribed = true;

      const unsubscribeTransport = transport.subscribe(listener);

      const unsubscribe = () => {
        if (!subscribed) {
          return;
        }

        subscribed = false;
        subscriptions.delete(unsubscribe);
        unsubscribeTransport();
      };

      subscriptions.add(unsubscribe);

      return unsubscribe;
    },

    close() {
      if (closed) {
        return;
      }

      closed = true;

      const activeSubscriptions = [...subscriptions];

      subscriptions.clear();

      for (const unsubscribe of activeSubscriptions) {
        unsubscribe();
      }

      transport.close?.();
    },
  };
}
