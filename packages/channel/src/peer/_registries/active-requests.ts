/// <reference lib="dom" />

export interface ActiveRequestRegistry {
  create(id: number): AbortController;
  get(id: number): AbortController | undefined;
  delete(id: number): void;
  abort(id: number, reason?: unknown): void;
  abortAll(reason?: unknown): void;
}

export function createActiveRequestRegistry(): ActiveRequestRegistry {
  const requests = new Map<number, AbortController>();

  return {
    create(id) {
      const controller = new AbortController();

      requests.set(id, controller);

      return controller;
    },

    get(id) {
      return requests.get(id);
    },

    delete(id) {
      requests.delete(id);
    },

    abort(id, reason) {
      const controller = requests.get(id);

      if (!controller) {
        return;
      }

      controller.abort(reason);
      requests.delete(id);
    },

    abortAll(reason) {
      const controllers = [...requests.values()];

      requests.clear();

      for (const controller of controllers) {
        controller.abort(reason);
      }
    },
  };
}
