import type { Transport, TransportListener } from "../../src";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export function createLinkedTransports<TMessage>(): [Transport<TMessage>, Transport<TMessage>] {
  let firstListener: TransportListener<TMessage> | undefined;
  let secondListener: TransportListener<TMessage> | undefined;

  return [
    {
      send(message) {
        secondListener?.(message);
      },
      subscribe(listener) {
        firstListener = listener;

        return () => {
          firstListener = undefined;
        };
      },
    },
    {
      send(message) {
        firstListener?.(message);
      },
      subscribe(listener) {
        secondListener = listener;

        return () => {
          secondListener = undefined;
        };
      },
    },
  ];
}

export function createSchema<TInput, TOutput>(
  validate: StandardSchemaV1.Props<TInput, TOutput>["validate"],
): StandardSchemaV1<TInput, TOutput> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate,
    },
  };
}
