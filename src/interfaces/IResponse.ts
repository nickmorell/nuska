export interface IResponse<TBody = unknown> {
  // Core response data
  status: number;
  headers: Record<string, string>;
  body?: TBody;

  // Typed response methods
  setHeader(name: string, value: string): IResponse<TBody>;
  setStatus(code: number): IResponse<TBody>;
  send(data?: TBody): void;
  json(data: TBody): void;

  // State tracking
  sent: boolean;
  finished: boolean;
}