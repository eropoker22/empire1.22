export const SUPPORTED_NODE_MAJOR: 24;
export const SUPPORTED_NODE_RANGE: ">=24 <25";

export interface SupportedNodeVersionResult {
  detectedVersion: string | null;
  detectedMajor: number | null;
  expectedMajor: 24;
  supported: boolean;
}

export const parseNodeVersion: (value: unknown) => {
  version: string;
  major: number;
} | null;
export const evaluateSupportedNodeVersion: (value: unknown) => SupportedNodeVersionResult;
export const formatUnsupportedNodeMessage: (value: unknown) => string;
export const assertSupportedNodeVersion: (value: unknown) => SupportedNodeVersionResult;
