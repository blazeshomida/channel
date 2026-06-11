import type { Channel } from "../channel";
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
import type { PeerStreamHandler } from "./types";

import { createContractEvents } from "./_contract/events";
import { createValidatedStream } from "./_contract/validated-stream";
import { validate } from "./_runtime/validation";
import { createRawPeer } from "./create-raw-peer";

export function createPeer<const TContract extends Contract, TSendOptions = void>({
  contract,
  channel,
  onError,
}: CreatePeerOptions<TContract, TSendOptions>): Peer<TContract, TSendOptions> {
  const rawPeerOptions = {
    // The raw protocol is private; the contract peer owns this transport seam.
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- createPeer is the sole adapter from the public unknown channel to the private peer protocol.
    channel: channel as Channel<PeerMessage, PeerMessage, TSendOptions>,
  };

  if (onError !== undefined) {
    Object.assign(rawPeerOptions, { onError });
  }

  const rawPeer = createRawPeer(rawPeerOptions);
  const events = createContractEvents({
    contract,
    peer: rawPeer,
    ...(onError === undefined ? {} : { onError }),
  });

  return {
    request<const TName extends RequestName<TContract>>(
      options: PeerRequestOptions<TContract, TName, TSendOptions>,
    ): ReturnType<Peer<TContract, TSendOptions>["request"]> {
      const operation = contract.operations[options.name];
      const response = rawPeer.request({
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
      const rawStream = rawPeer.stream({
        name: options.name,
        payload: options.input,
        ...("send" in options ? { send: options.send } : {}),
        ...("signal" in options ? { signal: options.signal } : {}),
        ...("onError" in options ? { onError: options.onError } : {}),
      });

      return createValidatedStream({
        stream: rawStream,
        schema: operation?.kind === "stream" ? operation.item : undefined,
        operation: options.name,
      });
    },

    emit<const TName extends EventName<TContract>>(
      options: PeerEmitOptions<TContract, TName, TSendOptions>,
    ) {
      rawPeer.notify({
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

        return rawPeer.handle({
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
        const handler = options.handler as PeerStreamHandler<unknown, unknown>;

        return rawPeer.handleStream({
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
      rawPeer.close();
    },
  };
}
