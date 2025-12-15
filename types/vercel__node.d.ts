declare module '@vercel/node' {
  import type { IncomingMessage, ServerResponse } from 'http';

  export type VercelRequest = IncomingMessage & {
    query?: Record<string, string | string[]>;
    body?: unknown;
  };

  export type VercelResponse = ServerResponse;
}
