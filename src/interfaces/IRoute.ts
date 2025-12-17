import type { IMiddleware } from './IMiddleware';
import type { HttpMethod, IRequest } from './IRequest';
import type { IResponse } from './IResponse';

export interface IRoute {
  method: HttpMethod;
  path: string;
  handler: (req: IRequest, res: IResponse) => void | Promise<{ status: number; body: any }>;
  middlewares?: IMiddleware[];
  description?: string;
  tags?: string[];
}
