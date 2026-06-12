import type { Channel } from "../channel";
import type { CreateProtocolRuntimeOptions } from "./_runtime/types";
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
import { createContractOperations } from "./_contract/operations";
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
    // Type boundary: createPeer adapts the public unknown channel to the private peer protocol.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    channel: channel as Channel<PeerMessage, PeerMessage, TSendOptions>,
    onNotification(input, context) {
      events.receive(input, context);
    },
  } satisfies CreateProtocolRuntimeOptions<TSendOptions>;

  if (onError !== undefined) {
    Object.assign(runtimeOptions, { onError });
  }

  const runtime = createProtocolRuntime(runtimeOptions);
  const operations = createContractOperations({
    contract,
    runtime,
  });

  function addEventListener<TName extends EventName<TContract>>(
    options: PeerOnOptions<TContract, TName>,
    once: boolean,
  ) {
    // Type boundary: the selected event operation determines the validated listener input type.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const listener = options.listener as Parameters<typeof events.add>[0]["listener"];

    return events.add({
      name: options.name,
      listener,
      ...("onError" in options ? { onError: options.onError } : {}),
      once,
    });
  }

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

      // Type boundary: the selected contract operation determines the validated response type.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
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
      return operations.handle(options);
    },

    on<const TName extends EventName<TContract>>(options: PeerOnOptions<TContract, TName>) {
      return addEventListener(options, false);
    },

    once<const TName extends EventName<TContract>>(options: PeerOnceOptions<TContract, TName>) {
      return addEventListener(options, true);
    },

    close() {
      events.close();
      operations.close();
      runtime.close();
    },
  };
}
