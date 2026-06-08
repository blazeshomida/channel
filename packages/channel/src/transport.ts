/**
 * Stops an active subscription.
 */
export type Unsubscribe = () => void;

/**
 * Extra arguments accepted by {@linkcode Transport.send}.
 *
 * Transports without options expose no second argument. Transports with options
 * expose one optional options argument.
 */
export type TransportSendArgs<TOptions> = [TOptions] extends [void] ? [] : [options?: TOptions];

/**
 * Handles messages emitted by a {@linkcode Transport}.
 */
export type TransportListener<TMessage> = (message: TMessage) => void;

/**
 * Adapts a runtime message source to the channel interface.
 */
export interface Transport<TInbound = unknown, TOutbound = TInbound, TOptions = void> {
  /**
   * Sends a message through the runtime transport.
   */
  send(message: TOutbound, ...args: TransportSendArgs<TOptions>): void;

  /**
   * Subscribes to messages emitted by the runtime transport.
   *
   * @returns A function that stops the subscription.
   */
  subscribe(listener: TransportListener<TInbound>): Unsubscribe;

  /**
   * Releases runtime transport resources.
   */
  close?(): void;
}
