import type { Schema } from "../contract";
import type { PeerStream } from "../types";

import { validate } from "../_runtime/validation";

interface CreateValidatedStreamArgs {
  stream: PeerStream<unknown>;
  schema: Schema | undefined;
  operation: string;
}

export function createValidatedStream<TResult>({
  stream,
  schema,
  operation,
}: CreateValidatedStreamArgs): PeerStream<TResult> {
  return {
    [Symbol.asyncIterator]() {
      return this;
    },

    async next() {
      const result = await stream.next();

      if (result.done) {
        return result;
      }

      try {
        const value = await validate({
          schema,
          value: result.value,
          operation,
          boundary: "item",
        });

        return {
          done: false,
          // Type boundary: the selected stream operation determines the validated item type.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          value: value as TResult,
        };
      } catch (error) {
        await stream.return();
        throw error;
      }
    },

    async return() {
      await stream.return();

      return {
        done: true,
        value: undefined,
      };
    },
  };
}
