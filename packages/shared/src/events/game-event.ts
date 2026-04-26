export interface GameEvent<TType extends string = string, TPayload = unknown> {
  type: TType;
  payload: TPayload;
  occurredAt: string;
}

