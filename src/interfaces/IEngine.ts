import type { IRequest } from './IRequest';
import type { IResponse } from './IResponse';

export interface IEngine {
  // Protocol lifecycle
  listen(port: number, callback?: () => void): Promise<void>;
  close(): Promise<void>;

  // Engine only knows about protocol, not routing
  setRequestHandler(handler: (request: IRequest) => Promise<IResponse>): void;

  // Protocol metadata
  readonly protocol: string;
  readonly isSecure: boolean;
}
