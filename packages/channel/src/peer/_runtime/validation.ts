import type { PeerErrorPayload } from "../types";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export type PeerValidationDirection = "input" | "output" | "item";

export interface PeerValidationIssue {
  message: string;
  path?: readonly (string | number)[];
}

export interface PeerValidationErrorData {
  operation: string;
  direction: PeerValidationDirection;
  issues: readonly PeerValidationIssue[];
}

interface ValidateArgs {
  schema: StandardSchemaV1 | undefined;
  value: unknown;
  operation: string;
  direction: PeerValidationDirection;
}

function serializeIssue(issue: StandardSchemaV1.Issue): PeerValidationIssue {
  if (issue.path === undefined) {
    return {
      message: issue.message,
    };
  }

  return {
    message: issue.message,
    path: issue.path.map((segment) => {
      const key = typeof segment === "object" ? segment.key : segment;

      return typeof key === "symbol" ? String(key) : key;
    }),
  };
}

export async function validate({
  schema,
  value,
  operation,
  direction,
}: ValidateArgs): Promise<unknown> {
  if (schema === undefined) {
    return value;
  }

  const result = await schema["~standard"].validate(value);

  if (result.issues === undefined) {
    return result.value;
  }

  throw {
    code: "VALIDATION_FAILED",
    message: `Validation failed for "${operation}" ${direction}.`,
    data: {
      operation,
      direction,
      issues: result.issues.map(serializeIssue),
    },
  } satisfies PeerErrorPayload;
}
