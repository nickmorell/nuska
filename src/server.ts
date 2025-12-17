import { IEngine } from './interfaces/IEngine';
import { IMiddleware } from './interfaces/IMiddleware';
import { IRequest, HttpMethod } from './interfaces/IRequest';
import type { IResponse } from './interfaces/IResponse';
import { IRoute } from './interfaces/IRoute';
import { IRouteGroup } from './interfaces/IRouteGroup';
import { IServer } from './interfaces/IServer';

export class Server implements IServer {
  private _engine: IEngine;
  private _globalMiddlewares: IMiddleware[] = [];
  private _routes: IRoute[] = [];
  private _isRunning: boolean = false;

  constructor(engine: IEngine) {
    this._engine = engine;
    this.setupEngineHandler();
  }

  // Public readonly properties
  public get isRunning(): boolean {
    return this._isRunning;
  }

  public get engine(): IEngine {
    return this._engine;
  }

  // Core server methods
  public use(middleware: IMiddleware): Server {
    this._globalMiddlewares.push(middleware);
    return this;
  }

  public route(routeInput: IRoute | IRoute[] | IRouteGroup): Server {
    if (this._isRunning) {
      throw new Error('Cannot add routes after server has started');
    }

    if (this.isRouteGroup(routeInput)) {
      this._routes.push(...routeInput.getPrefixedRoutes());
    } else if (Array.isArray(routeInput)) {
      routeInput.forEach(route => {
        if (route.path === '') {
          route.path = '/';
        }
      });
      this._routes.push(...routeInput);
    } else {
      if (routeInput.path === '') {
        routeInput.path = '/';
      }
      this._routes.push(routeInput);
    }

    return this;
  }

  public setEngine(engine: IEngine): Server {
    if (this._isRunning) {
      throw new Error('Cannot change engine while server is running');
    }

    this._engine = engine;
    this.setupEngineHandler();
    return this;
  }

  public async start(port: number, callback?: () => void): Promise<void> {
    if (this._isRunning) {
      throw new Error('Server is already running');
    }

    this._isRunning = true;

    try {
      await this._engine.listen(port, callback);
      console.log(`Server started on port ${port} using ${this._engine.protocol}`);
      for (const route of this._routes) {
        console.log(`Registered route: [${route.method}] ${route.path}`);
      }
    } catch (error) {
      this._isRunning = false;
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    try {
      await this._engine.close();
      this._isRunning = false;
      console.log('Server stopped');
    } catch (error) {
      console.error('Error stopping server:', error);
      throw error;
    }
  }

  // Private methods
  private setupEngineHandler(): void {
    this._engine.setRequestHandler(async (request: IRequest) => {
      return await this.processRequest(request);
    });
  }

  private async processRequest(request: IRequest): Promise<IResponse> {
    try {
      // Find matching route
      const route = this.findRoute(request.method, request.path);

      if (!route) {
        return this.createErrorResponse(404, 'Not Found');
      }

      // Execute middleware chain + route handler
      return await this.executeMiddlewareChain(route, request);
    } catch (error: unknown) {
      return await this.handleError(error, request);
    }
  }

  private findRoute(method: HttpMethod, path: string): IRoute | undefined {
    return this._routes.find(route => {
      // Simple path matching - you'd want more sophisticated routing here
      return route.method === method && this.pathMatches(route.path, path);
    });
  }

  private pathMatches(routePath: string, requestPath: string): boolean {
    // Basic exact match - enhance with parameter parsing
    return routePath === requestPath;
  }

  private async executeMiddlewareChain(route: IRoute, request: IRequest): Promise<IResponse> {
    const allMiddlewares = [...this._globalMiddlewares, ...(route.middlewares ?? [])];
    const response = this.createResponse();

    let index = 0;
    const next = async (): Promise<void> => {
      if (index >= allMiddlewares.length) {
        await route.handler(request, response);
        return;
      }

      const middleware = allMiddlewares[index++];

      try {
        if (middleware.before) {
          await middleware.before(request, response, next);
        } else {
          await next();
        }
      } catch (error: unknown) {
        if (middleware.onError) {
          await middleware.onError(error, request, response, next);
        } else {
          throw error;
        }
      }
    };

    await next();
    return response;
  }

  private async handleError(error: unknown, request: IRequest): Promise<IResponse> {
    console.error('Request processing error:', error);

    // Try to find error handling middleware
    for (const middleware of this._globalMiddlewares) {
      if (middleware.onError) {
        const response = this.createResponse();
        try {
          await middleware.onError(error, request, response, () => Promise.resolve());
          return response;
        } catch {
          // Error handler failed, continue to next
        }
      }
    }

    // No error handler handled it, return default error response
    return this.createErrorResponse(500, 'Internal Server Error');
  }

  private createResponse(): IResponse {
    let status: number | undefined; // Don't default to 200
    let headers: Record<string, string> = {};
    let body: unknown;
    let sent: boolean = false;
    let finished: boolean = false;

    return {
      get status(): number {
        // If no status was explicitly set, default to 200 for successful responses
        return status ?? 200;
      },
      get headers(): Record<string, string> {
        return { ...headers };
      },
      get body(): unknown {
        return body;
      },
      get sent(): boolean {
        return sent;
      },
      get finished(): boolean {
        return finished;
      },

      setStatus(code: number): IResponse {
        if (sent) {
          throw new Error('Cannot set status after response has been sent');
        }
        status = code;
        return this;
      },

      setHeader(name: string, value: string): IResponse {
        if (sent) {
          throw new Error('Cannot set headers after response has been sent');
        }
        headers[name] = value;
        return this;
      },

      json(data: unknown): void {
        this.setHeader('content-type', 'application/json');
        this.send(data);
      },

      send(data?: unknown): void {
        if (sent) {
          throw new Error('Response has already been sent');
        }

        // If no status was set and we're sending data, assume 200
        if (status === undefined) {
          status = 200;
        }

        body = data;
        sent = true;
        finished = true;
      },
    };
  }

  private createErrorResponse(status: number, message: string): IResponse {
    const response = this.createResponse();
    response.setStatus(status);
    response.json({ error: message });
    return response;
  }

  private isRouteGroup(input: any): input is IRouteGroup {
    return input && typeof input === 'object' && 'getPrefixedRoutes' in input;
  }
}
