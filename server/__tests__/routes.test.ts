import express from 'express';
import { registerRoutes } from '../routes';
import supertest from 'supertest';
import { Server } from 'http';
import { storage } from '../storage';

// Mock the fetch function
jest.mock('node-fetch', () => {
  return jest.fn().mockImplementation(() => {
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Website</title>
          <meta charset="UTF-8">
          <meta name="description" content="This is a test website for unit testing">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta property="og:title" content="Test OG Title">
        </head>
        <body>
          <h1>Test Content</h1>
        </body>
        </html>
      `)
    });
  });
});

describe('API Routes', () => {
  let app: express.Express;
  let server: Server;
  let request: any; // Use any to avoid type issues with supertest

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    request = supertest(app);
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('POST /api/analyze', () => {
    it('should return 400 for invalid URL', async () => {
      const response = await request
        .post('/api/analyze')
        .send({ url: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    it('should analyze a valid URL and return results', async () => {
      const response = await request
        .post('/api/analyze')
        .send({ url: 'https://example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('analysis');
      expect(response.body).toHaveProperty('tags');
      expect(response.body).toHaveProperty('recommendations');
      
      // Check analysis structure
      expect(response.body.analysis).toHaveProperty('id');
      expect(response.body.analysis).toHaveProperty('url');
      expect(response.body.analysis).toHaveProperty('totalCount');
      expect(response.body.analysis).toHaveProperty('seoCount');
      expect(response.body.analysis).toHaveProperty('socialCount');
      expect(response.body.analysis).toHaveProperty('technicalCount');
      expect(response.body.analysis).toHaveProperty('missingCount');
      expect(response.body.analysis).toHaveProperty('healthScore');
      
      // Verify some meta tags were found
      expect(response.body.tags.length).toBeGreaterThan(0);
      
      // A tag with the name "title" should exist
      const titleTag = response.body.tags.find((tag: any) => tag.name === 'title');
      expect(titleTag).toBeDefined();
      expect(titleTag.content).toBe('Test Website');
    });
  });
});