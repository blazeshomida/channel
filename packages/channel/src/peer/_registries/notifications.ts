import type {
  PeerDispose,
  PeerErrorHandler,
  PeerNotificationContext,
  PeerNotificationListener,
} from "../types";

export interface RegisteredNotificationListener {
  listener: PeerNotificationListener<unknown>;
  onError: PeerErrorHandler | undefined;
  once: boolean;
}

export interface NotificationListenerOptions {
  name: string;
  listener: PeerNotificationListener<unknown>;
  onError: PeerErrorHandler | undefined;
  once: boolean;
}

export type NotifyNotificationListener = (
  listener: RegisteredNotificationListener,
  payload: unknown,
  context: PeerNotificationContext,
) => void;

export interface NotificationRegistry {
  add(options: NotificationListenerOptions): PeerDispose;
  emit(name: string, payload: unknown, notify: NotifyNotificationListener): void;
  clear(): void;
}

export function createNotificationRegistry(): NotificationRegistry {
  const listenersByName = new Map<string, Set<RegisteredNotificationListener>>();

  function deleteListener(name: string, listener: RegisteredNotificationListener): void {
    const listeners = listenersByName.get(name);

    if (!listeners) {
      return;
    }

    listeners.delete(listener);

    if (listeners.size === 0) {
      listenersByName.delete(name);
    }
  }

  return {
    add(options) {
      let active = true;

      const listener: RegisteredNotificationListener = {
        listener: options.listener,
        onError: options.onError,
        once: options.once,
      };

      let listeners = listenersByName.get(options.name);

      if (!listeners) {
        listeners = new Set();
        listenersByName.set(options.name, listeners);
      }

      listeners.add(listener);

      return () => {
        if (!active) {
          return;
        }

        active = false;
        deleteListener(options.name, listener);
      };
    },

    emit(name, payload, notify) {
      const listeners = listenersByName.get(name);

      if (!listeners) {
        return;
      }

      const activeListeners = Array.from(listeners);

      for (const listener of activeListeners) {
        if (!listeners.has(listener)) {
          continue;
        }

        if (listener.once) {
          listeners.delete(listener);
        }

        notify(listener, payload, { name });
      }

      if (listeners.size === 0) {
        listenersByName.delete(name);
      }
    },

    clear() {
      listenersByName.clear();
    },
  };
}
