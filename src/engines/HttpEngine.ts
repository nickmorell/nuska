import * as http from 'http';
import * as url from 'url';
import { IEngine, IRequest, IResponse, HttpMethod } from '../interfaces';

interface HttpOptions {
  maxConnections?: number;
  timeout?: number;
  keepAlive?: boolean;
  keepAliveTimeout?: number;
}

export class HttpEngine implements IEngine {
  public readonly protocol = 'HTTP/1.1';
  public readonly isSecure = false;

  private server: http.Server;
  private requestHandler?: (request: IRequest) => Promise<IResponse>;

  constructor(options: HttpOptions = {}) {
    // Default options for HTTP/1.1
    const defaultOptions: HttpOptions = {
      maxConnections: 1000,
      timeout: 30000,
      keepAlive: true,
      keepAliveTimeout: 5000,
      ...options,
    };

    this.server = http.createServer(defaultOptions);
    this.setupRequestHandler();
  }

  private setupRequestHandler(): void {
    this.server.on('request', async (req: http.IncomingMessage, res: http.ServerResponse) => {
      try {
        // Convert HTTP/1 request to framework IRequest
        const request = await this.createRequestFromHttp(req);

        // Process request through framework handler
        if (this.requestHandler) {
          const response = await this.requestHandler(request);

          // Send response back through HTTP/1
          await this.sendResponse(res, response);
        } else {
          // No handler configured, send 501
          res.writeHead(501, { 'Content-Type': 'text/plain' });
          res.end('Not Implemented');
        }
      } catch (error: unknown) {
        console.error('HTTP/1 Request Error:', error);

        // Type-safe error handling
        const errorMessage = this.getErrorMessage(error);

        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(errorMessage);
      }
    });

    // Handle server errors
    this.server.on('error', (error: Error) => {
      console.error('HTTP/1 Server Error:', error);
    });
  }

  private async createRequestFromHttp(req: http.IncomingMessage): Promise<IRequest> {
    // Parse URL to extract components
    const parsedUrl = url.parse(req.url || '/', true);

    // Convert string to HttpMethod
    const method: HttpMethod = this.normalizeHttpMethod(req.method || 'GET');

    // Create a proper URL object from the parsed URL
    const requestUrl = new URL(
      `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host || 'localhost'}${req.url || '/'}`
    );

    // Extract query parameters
    const query: Record<string, string> = {};
    Object.entries(parsedUrl.query).forEach(([key, value]) => {
      query[key] = Array.isArray(value) ? value[0] : (value as string);
    });

    // Extract route parameters (simplified - you'd want more sophisticated path parsing)
    const params: Record<string, string> = {};

    // Convert HTTP/1 headers to standard format
    const requestHeaders: Record<string, string> = {};
    Object.entries(req.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        requestHeaders[key] = value;
      } else if (Array.isArray(value)) {
        requestHeaders[key] = value[0];
      }
    });

    // Parse body (HTTP/1 requests are readable streams)
    let body: unknown = undefined;
    const chunks: Buffer[] = [];

    return new Promise<IRequest>(resolve => {
      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        if (chunks.length > 0) {
          const rawBody = Buffer.concat(chunks).toString();

          // Try to parse as JSON, fall back to raw string
          try {
            body = JSON.parse(rawBody);
          } catch {
            body = rawBody;
          }
        }

        resolve({
          method,
          url: requestUrl, // Now using proper URL object
          path: parsedUrl.pathname || '/',
          headers: requestHeaders,
          query,
          params,
          body,
          protocol: this.protocol,
          remoteAddress: req.socket.remoteAddress,
          userAgent: requestHeaders['user-agent'],
        });
      });
    });
  }

  private async sendResponse(res: http.ServerResponse, response: IResponse): Promise<void> {
    // Set status code
    res.statusCode = response.status || 200;

    // Set headers
    Object.entries(response.headers || {}).forEach(([name, value]) => {
      res.setHeader(name, value);
    });

    // Send body if present
    if (response.body !== undefined) {
      if (typeof response.body === 'string') {
        res.write(response.body);
      } else if (Buffer.isBuffer(response.body)) {
        res.write(response.body);
      } else {
        // Convert objects to JSON
        const jsonString = JSON.stringify(response.body);

        // Set content-type if not already set
        if (!response.headers?.['content-type']) {
          res.setHeader('Content-Type', 'application/json');
        }

        res.write(jsonString);
      }
    }

    // End the response
    res.end();
  }

  private normalizeHttpMethod(method: string): HttpMethod {
    const upperMethod = method.toUpperCase();

    // Validate that it's a valid HttpMethod
    const validMethods: HttpMethod[] = [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'HEAD',
      'OPTIONS',
      'TRACE',
      'CONNECT',
    ];

    if (!validMethods.includes(upperMethod as HttpMethod)) {
      throw new Error(`Unsupported HTTP method: ${method}`);
    }

    return upperMethod as HttpMethod;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    // Handle other unknown error types
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error occurred';
    }
  }

  async listen(port: number, callback?: () => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
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

  async close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.server.close((error?: Error) => {
          if (error) {
            reject(error);
          } else {
            console.log('HTTP/1.1 server closed');
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  setRequestHandler(handler: (request: IRequest) => Promise<IResponse>): void {
    this.requestHandler = handler;
  }
}
