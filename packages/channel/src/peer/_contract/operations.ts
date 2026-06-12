import type { ProtocolRuntime, ProtocolStreamHandler } from "../_runtime/types";
import type { Contract } from "../contract";
import type { HandleName, PeerHandleOptions } from "../contract-types";
import type { PeerDispose } from "../types";

import { validate } from "../_runtime/validation";

interface CreateContractOperationsArgs<TContract extends Contract, TSendOptions> {
  contract: TContract;
  runtime: ProtocolRuntime<TSendOptions>;
}

export interface ContractOperations<TContract extends Contract> {
  handle<TName extends HandleName<TContract>>(
    options: PeerHandleOptions<TContract, TName>,
  ): PeerDispose;
  close(): void;
}

export function createContractOperations<const TContract extends Contract, TSendOptions = void>({
  contract,
  runtime,
}: CreateContractOperationsArgs<TContract, TSendOptions>): ContractOperations<TContract> {
  const registrations = new Map<
    string,
    {
      registration: symbol;
      dispose: PeerDispose;
    }
  >();

  return {
    handle<TName extends HandleName<TContract>>(
      options: PeerHandleOptions<TContract, TName>,
    ): PeerDispose {
      const operation = contract.operations[options.name];

      if (operation?.kind !== "request" && operation?.kind !== "stream") {
        throw new Error(`Operation "${options.name}" cannot be handled.`);
      }

      if (registrations.has(options.name)) {
        const label = operation.kind === "request" ? "Handler" : "Stream handler";
        throw new Error(`${label} already registered for "${options.name}".`);
      }

      const registration = Symbol(options.name);
      let disposeProtocolHandler: PeerDispose;

      if (operation.kind === "request") {
        // Type boundary: contract dispatch narrows the unified handler to a request handler.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const handler = options.handler as (
          input: unknown,
          context: Parameters<typeof options.handler>[1],
        ) => unknown;

        disposeProtocolHandler = runtime.handle({
          name: options.name,
          async handler(input, context) {
            const validatedInput = await validate({
              schema: operation.input,
              value: input,
              operation: options.name,
              direction: "input",
            });

            if (context.signal.aborted) {
              throw context.signal.reason;
            }

            return handler(validatedInput, context);
          },
          ...("onError" in options ? { onError: options.onError } : {}),
        });
      } else {
        // Type boundary: contract dispatch narrows the unified handler to a stream handler.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const handler = options.handler as ProtocolStreamHandler<unknown, unknown>;

        disposeProtocolHandler = runtime.handleStream({
          name: options.name,
          async *handler(input, context) {
            const validatedInput = await validate({
              schema: operation.input,
              value: input,
              operation: options.name,
              direction: "input",
            });

            if (context.signal.aborted) {
              return;
            }

            yield* handler(validatedInput, context);
          },
          ...("onError" in options ? { onError: options.onError } : {}),
        });
      }

      registrations.set(options.name, {
        registration,
        dispose: disposeProtocolHandler,
      });

      return () => {
        if (registrations.get(options.name)?.registration !== registration) {
          return;
        }

        registrations.delete(options.name);
        disposeProtocolHandler();
      };
    },

    close(): void {
      const activeRegistrations = [...registrations.values()];

      registrations.clear();

      for (const registration of activeRegistrations) {
        registration.dispose();
      }
    },
  };
}
