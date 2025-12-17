import type { IRequest } from './IRequest';
import type { IResponse } from './IResponse';

export interface IMiddleware {
  before?(request: IRequest, response: IResponse, next: () => void): Promise<void>;
  after?(request: IRequest, response: IResponse, next: () => void): Promise<void>;
  onError?(error: unknown, request: IRequest, response: IResponse, next: () => void): Promise<void>;
}
