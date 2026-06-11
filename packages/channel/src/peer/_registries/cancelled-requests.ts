const maxCancelledRequests = 1024;

export interface CancelledRequestRegistry {
  add(id: number): void;
  delete(id: number): boolean;
  clear(): void;
}

export function createCancelledRequestRegistry(): CancelledRequestRegistry {
  const requests = new Set<number>();
  const order: number[] = [];

  return {
    add(id) {
      if (requests.has(id)) {
        return;
      }

      requests.add(id);
      order.push(id);

      while (order.length > maxCancelledRequests) {
        const expiredId = order.shift();

        if (expiredId !== undefined) {
          requests.delete(expiredId);
        }
      }
    },

    delete(id) {
      return requests.delete(id);
    },

    clear() {
      requests.clear();
      order.length = 0;
    },
  };
}
