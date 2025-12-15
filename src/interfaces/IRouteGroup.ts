import type { IMiddleware } from "./IMiddleware";
import type { IRoute } from "./IRoute";

export interface IRouteGroup {
  // Core properties
  readonly prefix: string;
  readonly routes: IRoute[];
  readonly middlewares: IMiddleware[];

  // Optional metadata
  readonly description?: string;
  readonly tags?: string[];

  // Core method for getting routes with applied prefix and middleware
  getPrefixedRoutes(): IRoute[];
}