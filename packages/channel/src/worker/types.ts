/// <reference lib="dom" />

/**
 * Runtime-specific options for worker `postMessage` calls.
 */
export interface WorkerSendOptions {
  /**
   * Transferable objects to move to the receiving worker context.
   */
  transfer?: readonly Transferable[];
}

/**
 * Minimal event target shape required to receive typed worker messages.
 */
export interface WorkerMessageEventTarget<TMessage> {
  /**
   * Registers a message listener.
   */
  addEventListener(type: "message", listener: (event: MessageEvent<TMessage>) => void): void;

  /**
   * Removes a message listener.
   */
  removeEventListener(type: "message", listener: (event: MessageEvent<TMessage>) => void): void;
}

/**
 * Minimal target shape required to send typed worker messages.
 */
export interface WorkerPostMessageTarget<TMessage> {
  /**
   * Posts a message with an optional transfer list.
   */
  postMessage(message: TMessage, transfer: Transferable[]): void;
}

/**
 * Minimal main-thread worker shape required by the client worker transport.
 */
export interface WorkerClientTarget<TInbound, TOutbound>
  extends WorkerMessageEventTarget<TInbound>, WorkerPostMessageTarget<TOutbound> {
  /**
   * Terminates the worker.
   */
  terminate(): void;
}

/**
 * Minimal worker-scope shape required by the host worker transport.
 */
export interface WorkerHostTarget<TInbound, TOutbound>
  extends WorkerMessageEventTarget<TInbound>, WorkerPostMessageTarget<TOutbound> {
  /**
   * Closes the worker scope when the runtime supports it.
   */
  close?(): void;
}
