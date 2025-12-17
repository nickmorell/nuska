import { IMiddleware } from './interfaces/IMiddleware';
import { HttpMethod } from './interfaces/IRequest';
import { IRoute } from './interfaces/IRoute';
import { IRouteGroup } from './interfaces/IRouteGroup';

export class RouteGroup implements IRouteGroup {
  public readonly prefix: string;
  public readonly routes: IRoute[];
  public readonly middlewares: IMiddleware[];
  public readonly description?: string;
  public readonly tags?: string[];

  constructor(
    prefix: string,
    routes: IRoute[],
    middlewares: IMiddleware[] = [],
    description?: string,
    tags?: string[]
  ) {
    // Validate and normalize prefix
    this.prefix = this.normalizePrefix(prefix);

    // Store routes and middleware
    this.routes = routes;
    this.middlewares = middlewares;
    this.description = description;
    this.tags = tags;

    // Validate route paths don't conflict with prefix
    this.validateRoutes();
  }

  private normalizePrefix(prefix: string): string {
    // Ensure prefix starts with / and doesn't end with /
    if (!prefix.startsWith('/')) {
      prefix = '/' + prefix;
    }
    if (prefix.length > 1 && prefix.endsWith('/')) {
      prefix = prefix.slice(0, -1);
    }
    return prefix;
  }

  private validateRoutes(): void {
    // Check for duplicate routes within the group
    const routeKeys = new Set<string>();

    for (const route of this.routes) {
      const routeKey = `${route.method}:${this.prefix}${route.path}`;

      if (routeKeys.has(routeKey)) {
        throw new Error(`Duplicate route detected: ${routeKey}`);
      }

      routeKeys.add(routeKey);
    }
  }

  // Method to add individual routes after creation
  public addRoute(route: IRoute): RouteGroup {
    // Check for conflicts before adding
    const routeKey = `${route.method}:${this.prefix}${route.path}`;
    const existingRoute = this.routes.find(r => `${r.method}:${this.prefix}${r.path}` === routeKey);

    if (existingRoute) {
      throw new Error(`Route already exists: ${routeKey}`);
    }

    return new RouteGroup(
      this.prefix,
      [...this.routes, route],
      this.middlewares,
      this.description,
      this.tags
    );
  }

  // Method to add middleware after creation
  public use(middleware: IMiddleware): RouteGroup {
    return new RouteGroup(
      this.prefix,
      this.routes,
      [...this.middlewares, middleware],
      this.description,
      this.tags
    );
  }

  // Method to get all routes with prefixed paths
  public getPrefixedRoutes(): IRoute[] {
    return this.routes.map(route => ({
      ...route,
      path: this.prefix + route.path,
      middlewares: [...this.middlewares, ...(route.middlewares || [])],
    }));
  }

  // Method to find a specific route
  public findRoute(method: HttpMethod, path: string): IRoute | undefined {
    return this.routes.find(route => route.method === method && route.path === path);
  }

  // Method to get route count
  get routeCount(): number {
    return this.routes.length;
  }

  // Method to check if group has specific tag
  public hasTag(tag: string): boolean {
    return this.tags?.includes(tag) ?? false;
  }
}
