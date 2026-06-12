const maxRememberedIds = 1024;

export interface CancelledIds {
  clear(): void;
  delete(id: number): boolean;
  has(id: number): boolean;
  remember(id: number): void;
}

export function createCancelledIds(): CancelledIds {
  const remembered = new Set<number>();
  const order: number[] = [];
  let ignoredThrough = 0;

  return {
    clear() {
      remembered.clear();
      order.length = 0;
      ignoredThrough = 0;
    },

    delete(id) {
      if (id <= ignoredThrough) {
        return true;
      }

      return remembered.delete(id);
    },

    has(id) {
      return id <= ignoredThrough || remembered.has(id);
    },

    remember(id) {
      if (id <= ignoredThrough || remembered.has(id)) {
        return;
      }

      remembered.add(id);
      order.push(id);

      while (order.length > maxRememberedIds) {
        const expiredId = order.shift();

        if (expiredId !== undefined) {
          remembered.delete(expiredId);
          ignoredThrough = Math.max(ignoredThrough, expiredId);
        }
      }
    },
  };
}
