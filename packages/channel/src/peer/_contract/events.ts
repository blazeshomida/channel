import type { Contract } from "../contract";
import type {
  Peer as RawPeer,
  PeerDispose,
  PeerErrorHandler,
  PeerNotificationContext,
} from "../types";

import { validate } from "../_runtime/validation";

interface ContractEventListener {
  listener: (input: unknown, context: PeerNotificationContext) => void;
  onError: PeerErrorHandler | undefined;
  once: boolean;
}

interface ContractEventState {
  listeners: Set<ContractEventListener>;
  unsubscribe: PeerDispose;
}

interface CreateContractEventsArgs<TSendOptions> {
  contract: Contract;
  peer: RawPeer<TSendOptions>;
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
  close(): void;
}

export function createContractEvents<TSendOptions>({
  contract,
  peer,
  onError,
}: CreateContractEventsArgs<TSendOptions>): ContractEvents {
  const events = new Map<string, ContractEventState>();

  function deleteListener(name: string, listener: ContractEventListener): void {
    const state = events.get(name);

    if (!state) {
      return;
    }

    state.listeners.delete(listener);

    if (state.listeners.size === 0) {
      state.unsubscribe();
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

  function deliver(name: string, input: unknown): void {
    const state = events.get(name);

    if (!state) {
      return;
    }

    const context = { name };

    for (const listener of state.listeners) {
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

    if (operation?.kind !== "event" || operation.input === undefined) {
      deliver(name, input);
      return;
    }

    void validate({
      schema: operation.input,
      value: input,
      operation: name,
      direction: "input",
    })
      .then((validatedInput) => {
        deliver(name, validatedInput);
      })
      .catch((error: unknown) => {
        const state = events.get(name);

        if (!state) {
          return;
        }

        for (const listener of state.listeners) {
          listener.onError?.(error, {
            type: "notification",
            name,
          });
        }

        onError?.(error, {
          type: "notification",
          name,
        });
      });
  }

  return {
    add({ name, listener, onError: listenerOnError, once }) {
      let state = events.get(name);

      if (!state) {
        state = {
          listeners: new Set(),
          unsubscribe: peer.on({
            name,
            listener(input) {
              receive(name, input);
            },
          }),
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

    close() {
      for (const state of events.values()) {
        state.unsubscribe();
      }

      events.clear();
    },
  };
}
