export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  | 'TRACE'
  | 'CONNECT';

export interface IRequest<
  TBody = unknown,
  TQuery = Record<string, string>,
  TParams = Record<string, string>,
> {
  // Core request metadata
  method: HttpMethod;
  url: URL;
  path: string;

  // Typed request data
  headers: Record<string, string>;
  query: TQuery;
  params: TParams;
  body: TBody;

  // Protocol metadata
  protocol: string;
  remoteAddress?: string;
  userAgent?: string;
}
