// src/server.ts
var Server = class {
  constructor(engine) {
    this._globalMiddlewares = [];
    this._routes = [];
    this._isRunning = false;
    this._engine = engine;
    this.setupEngineHandler();
  }
  // Public readonly properties
  get isRunning() {
    return this._isRunning;
  }
  get engine() {
    return this._engine;
  }
  // Core server methods
  use(middleware) {
    this._globalMiddlewares.push(middleware);
    return this;
  }
  route(routeInput) {
    if (this._isRunning) {
      throw new Error("Cannot add routes after server has started");
    }
    if (this.isRouteGroup(routeInput)) {
      this._routes.push(...routeInput.getPrefixedRoutes());
    } else if (Array.isArray(routeInput)) {
      routeInput.forEach((route) => {
        if (route.path === "") {
          route.path = "/";
        }
      });
      this._routes.push(...routeInput);
    } else {
      if (routeInput.path === "") {
        routeInput.path = "/";
      }
      this._routes.push(routeInput);
    }
    return this;
  }
  setEngine(engine) {
    if (this._isRunning) {
      throw new Error("Cannot change engine while server is running");
    }
    this._engine = engine;
    this.setupEngineHandler();
    return this;
  }
  async start(port, callback) {
    if (this._isRunning) {
      throw new Error("Server is already running");
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
  async stop() {
    if (!this._isRunning) {
      return;
    }
    try {
      await this._engine.close();
      this._isRunning = false;
      console.log("Server stopped");
    } catch (error) {
      console.error("Error stopping server:", error);
      throw error;
    }
  }
  // Private methods
  setupEngineHandler() {
    this._engine.setRequestHandler(async (request) => {
      return await this.processRequest(request);
    });
  }
  async processRequest(request) {
    try {
      const route = this.findRoute(request.method, request.path);
      if (!route) {
        return this.createErrorResponse(404, "Not Found");
      }
      return await this.executeMiddlewareChain(route, request);
    } catch (error) {
      return await this.handleError(error, request);
    }
  }
  findRoute(method, path) {
    return this._routes.find((route) => {
      return route.method === method && this.pathMatches(route.path, path);
    });
  }
  pathMatches(routePath, requestPath) {
    return routePath === requestPath;
  }
  async executeMiddlewareChain(route, request) {
    const allMiddlewares = [...this._globalMiddlewares, ...route.middlewares ?? []];
    const response = this.createResponse();
    let index = 0;
    const next = async () => {
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
      } catch (error) {
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
  async handleError(error, request) {
    console.error("Request processing error:", error);
    for (const middleware of this._globalMiddlewares) {
      if (middleware.onError) {
        const response = this.createResponse();
        try {
          await middleware.onError(error, request, response, () => Promise.resolve());
          return response;
        } catch {
        }
      }
    }
    return this.createErrorResponse(500, "Internal Server Error");
  }
  createResponse() {
    let status;
    let headers = {};
    let body;
    let sent = false;
    let finished = false;
    return {
      get status() {
        return status ?? 200;
      },
      get headers() {
        return { ...headers };
      },
      get body() {
        return body;
      },
      get sent() {
        return sent;
      },
      get finished() {
        return finished;
      },
      setStatus(code) {
        if (sent) {
          throw new Error("Cannot set status after response has been sent");
        }
        status = code;
        return this;
      },
      setHeader(name, value) {
        if (sent) {
          throw new Error("Cannot set headers after response has been sent");
        }
        headers[name] = value;
        return this;
      },
      json(data) {
        this.setHeader("content-type", "application/json");
        this.send(data);
      },
      send(data) {
        if (sent) {
          throw new Error("Response has already been sent");
        }
        if (status === void 0) {
          status = 200;
        }
        body = data;
        sent = true;
        finished = true;
      }
    };
  }
  createErrorResponse(status, message) {
    const response = this.createResponse();
    response.setStatus(status);
    response.json({ error: message });
    return response;
  }
  isRouteGroup(input) {
    return input && typeof input === "object" && "getPrefixedRoutes" in input;
  }
};

// src/RouteGroup.ts
var RouteGroup = class _RouteGroup {
  constructor(prefix, routes, middlewares = [], description, tags) {
    this.prefix = this.normalizePrefix(prefix);
    this.routes = routes;
    this.middlewares = middlewares;
    this.description = description;
    this.tags = tags;
    this.validateRoutes();
  }
  normalizePrefix(prefix) {
    if (!prefix.startsWith("/")) {
      prefix = "/" + prefix;
    }
    if (prefix.length > 1 && prefix.endsWith("/")) {
      prefix = prefix.slice(0, -1);
    }
    return prefix;
  }
  validateRoutes() {
    const routeKeys = /* @__PURE__ */ new Set();
    for (const route of this.routes) {
      const routeKey = `${route.method}:${this.prefix}${route.path}`;
      if (routeKeys.has(routeKey)) {
        throw new Error(`Duplicate route detected: ${routeKey}`);
      }
      routeKeys.add(routeKey);
    }
  }
  // Method to add individual routes after creation
  addRoute(route) {
    const routeKey = `${route.method}:${this.prefix}${route.path}`;
    const existingRoute = this.routes.find((r) => `${r.method}:${this.prefix}${r.path}` === routeKey);
    if (existingRoute) {
      throw new Error(`Route already exists: ${routeKey}`);
    }
    return new _RouteGroup(
      this.prefix,
      [...this.routes, route],
      this.middlewares,
      this.description,
      this.tags
    );
  }
  // Method to add middleware after creation
  use(middleware) {
    return new _RouteGroup(
      this.prefix,
      this.routes,
      [...this.middlewares, middleware],
      this.description,
      this.tags
    );
  }
  // Method to get all routes with prefixed paths
  getPrefixedRoutes() {
    return this.routes.map((route) => ({
      ...route,
      path: this.prefix + route.path,
      middlewares: [...this.middlewares, ...route.middlewares || []]
    }));
  }
  // Method to find a specific route
  findRoute(method, path) {
    return this.routes.find((route) => route.method === method && route.path === path);
  }
  // Method to get route count
  get routeCount() {
    return this.routes.length;
  }
  // Method to check if group has specific tag
  hasTag(tag) {
    return this.tags?.includes(tag) ?? false;
  }
};

// src/engines/HttpEngine.ts
import * as http from "http";
import * as url from "url";
var HttpEngine = class {
  constructor(options = {}) {
    this.protocol = "HTTP/1.1";
    this.isSecure = false;
    const defaultOptions = {
      maxConnections: 1e3,
      timeout: 3e4,
      keepAlive: true,
      keepAliveTimeout: 5e3,
      ...options
    };
    this.server = http.createServer(defaultOptions);
    this.setupRequestHandler();
  }
  setupRequestHandler() {
    this.server.on("request", async (req, res) => {
      try {
        const request = await this.createRequestFromHttp(req);
        if (this.requestHandler) {
          const response = await this.requestHandler(request);
          await this.sendResponse(res, response);
        } else {
          res.writeHead(501, { "Content-Type": "text/plain" });
          res.end("Not Implemented");
        }
      } catch (error) {
        console.error("HTTP/1 Request Error:", error);
        const errorMessage = this.getErrorMessage(error);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(errorMessage);
      }
    });
    this.server.on("error", (error) => {
      console.error("HTTP/1 Server Error:", error);
    });
  }
  async createRequestFromHttp(req) {
    const parsedUrl = url.parse(req.url || "/", true);
    const method = this.normalizeHttpMethod(req.method || "GET");
    const requestUrl = new URL(
      `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host || "localhost"}${req.url || "/"}`
    );
    const query = {};
    Object.entries(parsedUrl.query).forEach(([key, value]) => {
      query[key] = Array.isArray(value) ? value[0] : value;
    });
    const params = {};
    const requestHeaders = {};
    Object.entries(req.headers).forEach(([key, value]) => {
      if (typeof value === "string") {
        requestHeaders[key] = value;
      } else if (Array.isArray(value)) {
        requestHeaders[key] = value[0];
      }
    });
    let body = void 0;
    const chunks = [];
    return new Promise((resolve) => {
      req.on("data", (chunk) => {
        chunks.push(chunk);
      });
      req.on("end", () => {
        if (chunks.length > 0) {
          const rawBody = Buffer.concat(chunks).toString();
          try {
            body = JSON.parse(rawBody);
          } catch {
            body = rawBody;
          }
        }
        resolve({
          method,
          url: requestUrl,
          // Now using proper URL object
          path: parsedUrl.pathname || "/",
          headers: requestHeaders,
          query,
          params,
          body,
          protocol: this.protocol,
          remoteAddress: req.socket.remoteAddress,
          userAgent: requestHeaders["user-agent"]
        });
      });
    });
  }
  async sendResponse(res, response) {
    res.statusCode = response.status || 200;
    Object.entries(response.headers || {}).forEach(([name, value]) => {
      res.setHeader(name, value);
    });
    if (response.body !== void 0) {
      if (typeof response.body === "string") {
        res.write(response.body);
      } else if (Buffer.isBuffer(response.body)) {
        res.write(response.body);
      } else {
        const jsonString = JSON.stringify(response.body);
        if (!response.headers?.["content-type"]) {
          res.setHeader("Content-Type", "application/json");
        }
        res.write(jsonString);
      }
    }
    res.end();
  }
  normalizeHttpMethod(method) {
    const upperMethod = method.toUpperCase();
    const validMethods = [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD",
      "OPTIONS",
      "TRACE",
      "CONNECT"
    ];
    if (!validMethods.includes(upperMethod)) {
      throw new Error(`Unsupported HTTP method: ${method}`);
    }
    return upperMethod;
  }
  getErrorMessage(error) {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error occurred";
    }
  }
  async listen(port, callback) {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(port, () => {
          console.log(`HTTP/1.1 server listening on port ${port}`);
          callback?.();
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  async close() {
    return new Promise((resolve, reject) => {
      try {
        this.server.close((error) => {
          if (error) {
            reject(error);
          } else {
            console.log("HTTP/1.1 server closed");
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  setRequestHandler(handler) {
    this.requestHandler = handler;
  }
};

// src/engines/Http2Engine.ts
import * as http2 from "http2";
var Http2Engine = class {
  constructor(options = {}) {
    this.protocol = "HTTP/2";
    this.isSecure = true;
    const defaultOptions = {
      allowHTTP1: true,
      // Fallback to HTTP/1.1
      maxConnections: 1e3,
      timeout: 3e4,
      ...options
    };
    if (!defaultOptions.key || !defaultOptions.cert) {
      this.server = http2.createServer();
    } else {
      this.server = http2.createSecureServer(defaultOptions);
    }
    this.setupStreamHandler();
  }
  setupStreamHandler() {
    this.server.on(
      "stream",
      async (stream, headers) => {
        try {
          const request = await this.createRequestFromHeaders(headers, stream);
          if (this.requestHandler) {
            const response = await this.requestHandler(request);
            await this.sendResponse(stream, response);
          } else {
            stream.respond({ ":status": 501 });
            stream.end("Not Implemented");
          }
        } catch (error) {
          console.error("HTTP2 Stream Error:", error);
          const errorMessage = this.getErrorMessage(error);
          stream.respond({ ":status": 500 });
          stream.end(errorMessage);
        }
      }
    );
    this.server.on("error", (error) => {
      console.error("HTTP2 Server Error:", error);
    });
  }
  getErrorMessage(error) {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error occurred";
    }
  }
  async createRequestFromHeaders(headers, stream) {
    const methodString = headers[":method"] || "GET";
    const path = headers[":path"] || "/";
    const scheme = headers[":scheme"] || "https";
    const authority = headers[":authority"] || "localhost";
    const method = this.normalizeHttpMethod(methodString);
    const url2 = new URL(`${scheme}://${authority}${path}`);
    const query = {};
    url2.searchParams.forEach((value, key) => {
      query[key] = value;
    });
    const params = {};
    const requestHeaders = {};
    Object.entries(headers).forEach(([key, value]) => {
      if (!key.startsWith(":") && typeof value === "string") {
        requestHeaders[key] = value;
      }
    });
    let body = void 0;
    const chunks = [];
    return new Promise((resolve) => {
      stream.on("data", (chunk) => {
        chunks.push(chunk);
      });
      stream.on("end", () => {
        if (chunks.length > 0) {
          const rawBody = Buffer.concat(chunks).toString();
          try {
            body = JSON.parse(rawBody);
          } catch {
            body = rawBody;
          }
        }
        resolve({
          method,
          url: url2,
          path: url2.pathname,
          headers: requestHeaders,
          query,
          params,
          body,
          protocol: this.protocol,
          remoteAddress: stream.session?.socket?.remoteAddress,
          userAgent: requestHeaders["user-agent"]
        });
      });
    });
  }
  normalizeHttpMethod(method) {
    const upperMethod = method.toUpperCase();
    const validMethods = [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD",
      "OPTIONS",
      "TRACE",
      "CONNECT"
    ];
    if (!validMethods.includes(upperMethod)) {
      throw new Error(`Unsupported HTTP method: ${method}`);
    }
    return upperMethod;
  }
  async sendResponse(stream, response) {
    const http2Headers = {
      ":status": response.status || 200,
      ...response.headers
    };
    stream.respond(http2Headers);
    if (response.body !== void 0) {
      if (typeof response.body === "string") {
        stream.write(response.body);
      } else if (Buffer.isBuffer(response.body)) {
        stream.write(response.body);
      } else {
        stream.write(JSON.stringify(response.body));
        if (!response.headers["content-type"]) {
          stream.respond({ ":status": response.status || 200, "content-type": "application/json" });
        }
      }
    }
    stream.end();
  }
  async listen(port, callback) {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(port, () => {
          console.log(`HTTP/2 server listening on port ${port}`);
          callback?.();
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  async close() {
    return new Promise((resolve, reject) => {
      try {
        this.server.close((error) => {
          if (error) {
            reject(error);
          } else {
            console.log("HTTP/2 server closed");
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  setRequestHandler(handler) {
    this.requestHandler = handler;
  }
};
export {
  Http2Engine,
  HttpEngine,
  RouteGroup,
  Server
};
//# sourceMappingURL=index.cjs.map