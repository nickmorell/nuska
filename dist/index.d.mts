type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'TRACE' | 'CONNECT';
interface IRequest<TBody = unknown, TQuery = Record<string, string>, TParams = Record<string, string>> {
    method: HttpMethod;
    url: URL;
    path: string;
    headers: Record<string, string>;
    query: TQuery;
    params: TParams;
    body: TBody;
    protocol: string;
    remoteAddress?: string;
    userAgent?: string;
}

interface IResponse<TBody = unknown> {
    status: number;
    headers: Record<string, string>;
    body?: TBody;
    setHeader(name: string, value: string): IResponse<TBody>;
    setStatus(code: number): IResponse<TBody>;
    send(data?: TBody): void;
    json(data: TBody): void;
    sent: boolean;
    finished: boolean;
}

interface IEngine {
    listen(port: number, callback?: () => void): Promise<void>;
    close(): Promise<void>;
    setRequestHandler(handler: (request: IRequest) => Promise<IResponse>): void;
    readonly protocol: string;
    readonly isSecure: boolean;
}

interface IMiddleware {
    before?(request: IRequest, response: IResponse, next: (() => void)): Promise<void>;
    after?(request: IRequest, response: IResponse, next: (() => void)): Promise<void>;
    onError?(error: unknown, request: IRequest, response: IResponse, next: (() => void)): Promise<void>;
}

interface IRoute {
    method: HttpMethod;
    path: string;
    handler: (req: IRequest, res: IResponse) => void | Promise<void>;
    middlewares: IMiddleware[];
    description?: string;
    tags?: string[];
}

interface IRouteGroup {
    readonly prefix: string;
    readonly routes: IRoute[];
    readonly middlewares: IMiddleware[];
    readonly description?: string;
    readonly tags?: string[];
    getPrefixedRoutes(): IRoute[];
}

interface IServer {
    start(port: number, callback?: () => void): Promise<void>;
    stop(): Promise<void>;
    route(routeInput: IRoute | IRoute[] | IRouteGroup): IServer;
    use(middleware: IMiddleware): IServer;
    setEngine(engine: IEngine): IServer;
    readonly isRunning: boolean;
    readonly engine: IEngine;
}

declare class Server implements IServer {
    private _engine;
    private _globalMiddlewares;
    private _routes;
    private _isRunning;
    constructor(engine: IEngine);
    get isRunning(): boolean;
    get engine(): IEngine;
    use(middleware: IMiddleware): Server;
    route(routeInput: IRoute | IRoute[] | IRouteGroup): Server;
    setEngine(engine: IEngine): Server;
    start(port: number, callback?: () => void): Promise<void>;
    stop(): Promise<void>;
    private setupEngineHandler;
    private processRequest;
    private findRoute;
    private pathMatches;
    private executeMiddlewareChain;
    private handleError;
    private createResponse;
    private createErrorResponse;
    private isRouteGroup;
}

declare class RouteGroup implements IRouteGroup {
    readonly prefix: string;
    readonly routes: IRoute[];
    readonly middlewares: IMiddleware[];
    readonly description?: string;
    readonly tags?: string[];
    constructor(prefix: string, routes: IRoute[], middlewares?: IMiddleware[], description?: string, tags?: string[]);
    private normalizePrefix;
    private validateRoutes;
    addRoute(route: IRoute): RouteGroup;
    use(middleware: IMiddleware): RouteGroup;
    getPrefixedRoutes(): IRoute[];
    findRoute(method: HttpMethod, path: string): IRoute | undefined;
    get routeCount(): number;
    hasTag(tag: string): boolean;
}

interface Http2Options {
    key?: string | Buffer;
    cert?: string | Buffer;
    allowHTTP1?: boolean;
    maxConnections?: number;
    timeout?: number;
}
declare class Http2Engine implements IEngine {
    readonly protocol = "HTTP/2";
    readonly isSecure = true;
    private server;
    private requestHandler?;
    constructor(options?: Http2Options);
    private setupStreamHandler;
    private getErrorMessage;
    private createRequestFromHeaders;
    private normalizeHttpMethod;
    private sendResponse;
    listen(port: number, callback?: () => void): Promise<void>;
    close(): Promise<void>;
    setRequestHandler(handler: (request: IRequest) => Promise<IResponse>): void;
}

export { Http2Engine, type HttpMethod, type IEngine, type IMiddleware, type IRequest, type IResponse, type IRoute, type IRouteGroup, type IServer, RouteGroup, Server };
