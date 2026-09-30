const request = require('supertest');
const app = require('../src/app');

describe('health and API documentation', () => {
  test('reports API liveness with database state', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('healthy');
    expect(response.body.data).toHaveProperty('database');
  });

  test('reports database readiness separately', async () => {
    const response = await request(app).get('/health/db');
    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty('database');
  });

  test('serves interactive OpenAPI documentation', async () => {
    const response = await request(app).get('/api/docs/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
  });
});
