declare module '@vercel/node' {
  import type { IncomingMessage, ServerResponse } from 'http';

  export type VercelRequest = IncomingMessage & {
    query?: Record<string, any>;
    body?: any;
  };

  export type VercelResponse = ServerResponse;
}
