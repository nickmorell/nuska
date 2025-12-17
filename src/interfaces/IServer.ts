import type { IEngine } from './IEngine';
import type { IMiddleware } from './IMiddleware';
import type { IRoute } from './IRoute';
import type { IRouteGroup } from './IRouteGroup';

export interface IServer {
  // Core lifecycle management
  start(port: number, callback?: () => void): Promise<void>;
  stop(): Promise<void>;

  // Route registration with flexible input types
  route(routeInput: IRoute | IRoute[] | IRouteGroup): IServer;

  // Global middleware registration
  use(middleware: IMiddleware): IServer;

  // Engine management
  setEngine(engine: IEngine): IServer;

  // Server state
  readonly isRunning: boolean;
  readonly engine: IEngine;
}
