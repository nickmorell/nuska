import * as http2 from 'http2';
import { HttpMethod, IRequest } from '../interfaces/IRequest';
import { IEngine } from '../interfaces/IEngine';
import type { IResponse } from '../interfaces/IResponse';

interface Http2Options {
  key?: string | Buffer;
  cert?: string | Buffer;
  allowHTTP1?: boolean;
  maxConnections?: number;
  timeout?: number;
}

export class Http2Engine implements IEngine {
  public readonly protocol = 'HTTP/2';
  public readonly isSecure = true;

  private server: http2.Http2SecureServer | http2.Http2Server;
  private requestHandler?: (request: IRequest) => Promise<IResponse>;

  constructor(options: Http2Options = {}) {
    // Default options for secure HTTP2
    const defaultOptions: Http2Options = {
      allowHTTP1: true, // Fallback to HTTP/1.1
      maxConnections: 1000,
      timeout: 30000,
      ...options,
    };

    // Validate required SSL options for secure HTTP2
    if (!defaultOptions.key || !defaultOptions.cert) {
      this.server = http2.createServer();
    } else {
      this.server = http2.createSecureServer(defaultOptions);
    }

    this.setupStreamHandler();
  }

  private setupStreamHandler(): void {
    this.server.on(
      'stream',
      async (stream: http2.ServerHttp2Stream, headers: http2.IncomingHttpHeaders) => {
        try {
          // Convert HTTP2 headers to framework IRequest
          const request = await this.createRequestFromHeaders(headers, stream);

          // Process request through framework handler
          if (this.requestHandler) {
            const response = await this.requestHandler(request);

            // Send response back through HTTP2 stream
            await this.sendResponse(stream, response);
          } else {
            // No handler configured, send 501
            stream.respond({ ':status': 501 });
            stream.end('Not Implemented');
          }
        } catch (error: unknown) {
          console.error('HTTP2 Stream Error:', error);

          // Type-safe error handling
          const errorMessage = this.getErrorMessage(error);

          stream.respond({ ':status': 500 });
          stream.end(errorMessage);
        }
      }
    );

    // Handle server errors
    this.server.on('error', (error: Error) => {
      console.error('HTTP2 Server Error:', error);
    });
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

  private async createRequestFromHeaders(
    headers: http2.IncomingHttpHeaders,
    stream: http2.ServerHttp2Stream
  ): Promise<IRequest> {
    // Extract HTTP2 pseudo-headers
    const methodString = (headers[':method'] as string) || 'GET';
    const path = (headers[':path'] as string) || '/';
    const scheme = (headers[':scheme'] as string) || 'https';
    const authority = (headers[':authority'] as string) || 'localhost';

    // Convert string to HttpMethod
    const method: HttpMethod = this.normalizeHttpMethod(methodString);

    // Parse URL components
    const url = new URL(`${scheme}://${authority}${path}`);

    // Extract query parameters
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    // Extract route parameters (simplified - you'd want more sophisticated path parsing)
    const params: Record<string, string> = {};

    // Convert HTTP2 headers to standard format (HTTP2 uses lowercase)
    const requestHeaders: Record<string, string> = {};
    Object.entries(headers).forEach(([key, value]) => {
      if (!key.startsWith(':') && typeof value === 'string') {
        requestHeaders[key] = value;
      }
    });

    // Parse body (HTTP2 streams are readable)
    let body: unknown = undefined;
    const chunks: Buffer[] = [];

    return new Promise<IRequest>(resolve => {
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      stream.on('end', () => {
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
          url,
          path: url.pathname,
          headers: requestHeaders,
          query,
          params,
          body,
          protocol: this.protocol,
          remoteAddress: stream.session?.socket?.remoteAddress,
          userAgent: requestHeaders['user-agent'],
        });
      });
    });
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

  private async sendResponse(stream: http2.ServerHttp2Stream, response: IResponse): Promise<void> {
    // Convert framework IResponse to HTTP2 headers
    const http2Headers: http2.OutgoingHttpHeaders = {
      ':status': response.status || 200,
      ...response.headers,
    };

    // Respond with headers
    stream.respond(http2Headers);

    // Send body if present
    if (response.body !== undefined) {
      if (typeof response.body === 'string') {
        stream.write(response.body);
      } else if (Buffer.isBuffer(response.body)) {
        stream.write(response.body);
      } else {
        // Convert objects to JSON
        stream.write(JSON.stringify(response.body));

        // Set content-type if not already set
        if (!response.headers['content-type']) {
          stream.respond({ ':status': response.status || 200, 'content-type': 'application/json' });
        }
      }
    }

    // End the stream
    stream.end();
  }

  async listen(port: number, callback?: () => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
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

  async close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.server.close((error?: Error) => {
          if (error) {
            reject(error);
          } else {
            console.log('HTTP/2 server closed');
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
