import type { Contract } from "../contract";
import type { PeerDispose, PeerErrorHandler, PeerNotificationContext } from "../types";

import { validate } from "../_runtime/validation";

interface ContractEventListener {
  listener: (input: unknown, context: PeerNotificationContext) => void;
  onError: PeerErrorHandler | undefined;
  once: boolean;
}

interface ContractEventState {
  listeners: Set<ContractEventListener>;
  validationTail: Promise<void> | undefined;
}

interface CreateContractEventsArgs {
  contract: Contract;
  onError?: PeerErrorHandler;
}

interface AddContractEventListenerArgs {
  name: string;
  listener: ContractEventListener["listener"];
  onError?: PeerErrorHandler;
  once: boolean;
}

export interface ContractEvents {
  add(options: AddContractEventListenerArgs): PeerDispose;
  receive(input: unknown, context: PeerNotificationContext): void;
  close(): void;
}

export function createContractEvents({
  contract,
  onError,
}: CreateContractEventsArgs): ContractEvents {
  const events = new Map<string, ContractEventState>();
  let closed = false;

  function deleteListener(name: string, listener: ContractEventListener): void {
    const state = events.get(name);

    if (!state) {
      return;
    }

    state.listeners.delete(listener);

    if (state.listeners.size === 0) {
      events.delete(name);
    }
  }

  function reportError(error: unknown, name: string, localOnError?: PeerErrorHandler): void {
    const context = {
      type: "notification",
      name,
    } satisfies PeerNotificationContext & { type: "notification" };

    localOnError?.(error, context);
    onError?.(error, context);
  }

  function deliver(
    name: string,
    state: ContractEventState,
    listeners: ContractEventListener[],
    input: unknown,
  ): void {
    if (events.get(name) !== state) {
      return;
    }

    const context = { name };

    for (const listener of listeners) {
      if (!state.listeners.has(listener)) {
        continue;
      }

      if (listener.once) {
        deleteListener(name, listener);
      }

      try {
        listener.listener(input, context);
      } catch (error) {
        reportError(error, name, listener.onError);
      }
    }
  }

  function receive(name: string, input: unknown): void {
    const operation = contract.operations[name];
    const state = events.get(name);

    if (!state) {
      return;
    }

    const listeners = Array.from(state.listeners);

    if (operation?.kind !== "event" || operation.input === undefined) {
      deliver(name, state, listeners, input);
      return;
    }

    const validateAndDeliver = async (): Promise<void> => {
      try {
        const validatedInput = await validate({
          schema: operation.input,
          value: input,
          operation: name,
          direction: "input",
        });

        if (events.get(name) === state) {
          deliver(name, state, listeners, validatedInput);
        }
      } catch (error) {
        if (events.get(name) !== state) {
          return;
        }

        for (const listener of listeners) {
          if (!state.listeners.has(listener)) {
            continue;
          }

          listener.onError?.(error, {
            type: "notification",
            name,
          });
        }

        onError?.(error, {
          type: "notification",
          name,
        });
      }
    };
    const validation =
      state.validationTail === undefined
        ? validateAndDeliver()
        : state.validationTail.then(validateAndDeliver);

    state.validationTail = validation;
    void validation.finally(() => {
      if (state.validationTail === validation) {
        state.validationTail = undefined;
      }
    });
  }

  return {
    add({ name, listener, onError: listenerOnError, once }) {
      if (closed) {
        throw new Error("Peer is closed.");
      }

      let state = events.get(name);

      if (!state) {
        state = {
          listeners: new Set(),
          validationTail: undefined,
        };
        events.set(name, state);
      }

      const registeredListener: ContractEventListener = {
        listener,
        onError: listenerOnError,
        once,
      };

      state.listeners.add(registeredListener);

      let active = true;

      return () => {
        if (!active) {
          return;
        }

        active = false;
        deleteListener(name, registeredListener);
      };
    },

    receive(input, context) {
      receive(context.name, input);
    },

    close() {
      closed = true;
      events.clear();
    },
  };
}
