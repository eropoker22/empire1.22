import type {
  RejectionCategory,
  RejectionExpectation
} from "./types";

export interface RejectionClassificationInput {
  reasonCode: string | null;
  expectation?: RejectionExpectation;
  unexpectedCategory?: Exclude<RejectionCategory, "EXPECTED_GAMEPLAY_REJECTION" | "EXPECTED_CONCURRENCY_REJECTION">;
  unexpectedRationale?: string;
}

export const classifyRejection = (
  input: RejectionClassificationInput
): { category: RejectionCategory; rationale: string } => {
  const reasonCode = input.reasonCode ?? "UNKNOWN_REJECTION";
  if (input.expectation?.codes.includes(reasonCode)) {
    return { category: input.expectation.category, rationale: input.expectation.rationale };
  }
  if (input.unexpectedCategory) {
    return {
      category: input.unexpectedCategory,
      rationale: input.unexpectedRationale ?? "Caller supplied an audited non-expected classification."
    };
  }
  return {
    category: "UNCLASSIFIED_UNEXPECTED_REJECTION",
    rationale: input.expectation
      ? `Canonical code ${reasonCode} was not one of the explicitly audited expected codes.`
      : "No audited expectation exists for this rejection."
  };
};
