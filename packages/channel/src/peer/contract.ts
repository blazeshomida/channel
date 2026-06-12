import type { StandardSchemaV1 } from "@standard-schema/spec";

export type Schema = StandardSchemaV1;

declare const operationTypes: unique symbol;

interface OperationTypes<TInput, TConsumedInput, TProducedOutput, TOutput> {
  input: TInput;
  consumedInput: TConsumedInput;
  producedOutput: TProducedOutput;
  output: TOutput;
}

export interface RequestOperation<
  TInput = unknown,
  THandlerInput = TInput,
  THandlerOutput = unknown,
  TOutput = THandlerOutput,
> {
  readonly kind: "request";
  readonly input?: Schema;
  readonly output?: Schema;
  readonly [operationTypes]?: OperationTypes<TInput, THandlerInput, THandlerOutput, TOutput>;
}

export interface StreamOperation<
  TInput = unknown,
  THandlerInput = TInput,
  THandlerItem = unknown,
  TItem = THandlerItem,
> {
  readonly kind: "stream";
  readonly input?: Schema;
  readonly item?: Schema;
  readonly [operationTypes]?: OperationTypes<TInput, THandlerInput, THandlerItem, TItem>;
}

export interface EventOperation<TInput = unknown, TListenerInput = TInput> {
  readonly kind: "event";
  readonly input?: Schema;
  readonly [operationTypes]?: OperationTypes<TInput, TListenerInput, never, never>;
}

export type Operation = RequestOperation | StreamOperation | EventOperation;
export type ContractOperations = Record<string, Operation>;

export interface Contract<TOperations extends ContractOperations = ContractOperations> {
  readonly operations: TOperations;
}

interface RequestSchemaOptions<TInput extends Schema, TOutput extends Schema> {
  input: TInput;
  output: TOutput;
}

export function request<TInput = unknown, TOutput = unknown>(): RequestOperation<
  TInput,
  TInput,
  TOutput,
  TOutput
>;
export function request<const TInputSchema extends Schema, const TOutputSchema extends Schema>(
  options: RequestSchemaOptions<TInputSchema, TOutputSchema>,
): RequestOperation<
  StandardSchemaV1.InferInput<TInputSchema>,
  StandardSchemaV1.InferOutput<TInputSchema>,
  StandardSchemaV1.InferInput<TOutputSchema>,
  StandardSchemaV1.InferOutput<TOutputSchema>
>;
export function request(options?: RequestSchemaOptions<Schema, Schema>): RequestOperation {
  if (options === undefined) {
    return {
      kind: "request",
    };
  }

  return {
    kind: "request",
    input: options.input,
    output: options.output,
  };
}

interface StreamSchemaOptions<TInput extends Schema, TItem extends Schema> {
  input: TInput;
  item: TItem;
}

export function stream<TInput = unknown, TItem = unknown>(): StreamOperation<
  TInput,
  TInput,
  TItem,
  TItem
>;
export function stream<const TInputSchema extends Schema, const TItemSchema extends Schema>(
  options: StreamSchemaOptions<TInputSchema, TItemSchema>,
): StreamOperation<
  StandardSchemaV1.InferInput<TInputSchema>,
  StandardSchemaV1.InferOutput<TInputSchema>,
  StandardSchemaV1.InferInput<TItemSchema>,
  StandardSchemaV1.InferOutput<TItemSchema>
>;
export function stream(options?: StreamSchemaOptions<Schema, Schema>): StreamOperation {
  if (options === undefined) {
    return {
      kind: "stream",
    };
  }

  return {
    kind: "stream",
    input: options.input,
    item: options.item,
  };
}

interface EventSchemaOptions<TInput extends Schema> {
  input: TInput;
}

export function event<TInput = unknown>(): EventOperation<TInput, TInput>;
export function event<const TInputSchema extends Schema>(
  options: EventSchemaOptions<TInputSchema>,
): EventOperation<
  StandardSchemaV1.InferInput<TInputSchema>,
  StandardSchemaV1.InferOutput<TInputSchema>
>;
export function event(options?: EventSchemaOptions<Schema>): EventOperation {
  if (options === undefined) {
    return {
      kind: "event",
    };
  }

  return {
    kind: "event",
    input: options.input,
  };
}

export function createContract<const TOperations extends ContractOperations>(
  operations: TOperations,
): Contract<TOperations> {
  return {
    operations,
  };
}
