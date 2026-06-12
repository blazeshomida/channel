import type { Channel } from "../channel";
import type { CreateProtocolRuntimeOptions, ProtocolStreamHandler } from "./_runtime/types";
import type { Contract } from "./contract";
import type {
  CreatePeerOptions,
  EventName,
  HandleName,
  Peer,
  PeerEmitOptions,
  PeerHandleOptions,
  PeerOnOptions,
  PeerOnceOptions,
  PeerRequestOptions,
  PeerStreamOptions,
  RequestName,
  StreamName,
} from "./contract-types";
import type { PeerMessage } from "./messages";

import { createContractEvents } from "./_contract/events";
import { createValidatedStream } from "./_contract/validated-stream";
import { createProtocolRuntime } from "./_runtime/create-protocol-runtime";
import { validate } from "./_runtime/validation";

export function createPeer<const TContract extends Contract, TSendOptions = void>({
  contract,
  channel,
  onError,
}: CreatePeerOptions<TContract, TSendOptions>): Peer<TContract, TSendOptions> {
  const events = createContractEvents({
    contract,
    ...(onError === undefined ? {} : { onError }),
  });
  const runtimeOptions = {
    // The protocol is private; the contract peer owns this transport seam.
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- createPeer is the sole adapter from the public unknown channel to the private peer protocol.
    channel: channel as Channel<PeerMessage, PeerMessage, TSendOptions>,
    onNotification(input, context) {
      events.receive(input, context);
    },
  } satisfies CreateProtocolRuntimeOptions<TSendOptions>;

  if (onError !== undefined) {
    Object.assign(runtimeOptions, { onError });
  }

  const runtime = createProtocolRuntime(runtimeOptions);

  return {
    request<const TName extends RequestName<TContract>>(
      options: PeerRequestOptions<TContract, TName, TSendOptions>,
    ): ReturnType<Peer<TContract, TSendOptions>["request"]> {
      const operation = contract.operations[options.name];
      const response = runtime.request({
        name: options.name,
        payload: options.input,
        ...("send" in options ? { send: options.send } : {}),
        ...("signal" in options ? { signal: options.signal } : {}),
        ...("onError" in options ? { onError: options.onError } : {}),
      });

      // eslint-disable-next-line typescript/no-unsafe-type-assertion -- The selected contract operation determines the validated response type.
      return response.then((value) =>
        validate({
          schema: operation?.kind === "request" ? operation.output : undefined,
          value,
          operation: options.name,
          direction: "output",
        }),
      ) as ReturnType<Peer<TContract, TSendOptions>["request"]>;
    },

    stream<const TName extends StreamName<TContract>>(
      options: PeerStreamOptions<TContract, TName, TSendOptions>,
    ) {
      const operation = contract.operations[options.name];
      const protocolStream = runtime.stream({
        name: options.name,
        payload: options.input,
        ...("send" in options ? { send: options.send } : {}),
        ...("signal" in options ? { signal: options.signal } : {}),
        ...("onError" in options ? { onError: options.onError } : {}),
      });

      return createValidatedStream({
        stream: protocolStream,
        schema: operation?.kind === "stream" ? operation.item : undefined,
        operation: options.name,
      });
    },

    emit<const TName extends EventName<TContract>>(
      options: PeerEmitOptions<TContract, TName, TSendOptions>,
    ) {
      runtime.notify({
        name: options.name,
        payload: options.input,
        ...("send" in options ? { send: options.send } : {}),
      });
    },

    handle<const TName extends HandleName<TContract>>(
      options: PeerHandleOptions<TContract, TName>,
    ) {
      const operation = contract.operations[options.name];

      if (operation?.kind === "request") {
        // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Runtime contract dispatch narrows the unified handler to a request handler.
        const handler = options.handler as (
          input: unknown,
          context: Parameters<typeof options.handler>[1],
        ) => unknown;

        return runtime.handle({
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
      }

      if (operation?.kind === "stream") {
        // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Runtime contract dispatch narrows the unified handler to a stream handler.
        const handler = options.handler as ProtocolStreamHandler<unknown, unknown>;

        return runtime.handleStream({
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

      throw new Error(`Operation "${options.name}" cannot be handled.`);
    },

    on<const TName extends EventName<TContract>>(options: PeerOnOptions<TContract, TName>) {
      // eslint-disable-next-line typescript/no-unsafe-type-assertion -- The selected event operation determines the validated listener input type.
      const listener = options.listener as Parameters<typeof events.add>[0]["listener"];

      return events.add({
        name: options.name,
        listener,
        ...("onError" in options ? { onError: options.onError } : {}),
        once: false,
      });
    },

    once<const TName extends EventName<TContract>>(options: PeerOnceOptions<TContract, TName>) {
      // eslint-disable-next-line typescript/no-unsafe-type-assertion -- The selected event operation determines the validated listener input type.
      const listener = options.listener as Parameters<typeof events.add>[0]["listener"];

      return events.add({
        name: options.name,
        listener,
        ...("onError" in options ? { onError: options.onError } : {}),
        once: true,
      });
    },

    close() {
      events.close();
      runtime.close();
    },
  };
}
