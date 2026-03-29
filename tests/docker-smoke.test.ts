import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');

function readProjectFile(relativePath: string): string {
  const fullPath = resolve(ROOT, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${relativePath}`);
  }
  return readFileSync(fullPath, 'utf-8');
}

// ---------------------------------------------------------------------------
// Expected services and their Dockerfile paths
// ---------------------------------------------------------------------------
const DOCKERFILES: Record<string, string> = {
  client: 'client/Dockerfile',
  'api-gateway': 'services/api-gateway/Dockerfile',
  'stt-cloud': 'services/stt-cloud/Dockerfile',
  'nlp-service': 'services/nlp-service/Dockerfile',
  'search-service': 'services/search-service/Dockerfile',
  'calendar-service': 'services/calendar-service/Dockerfile',
};

const EXPECTED_COMPOSE_SERVICES = [
  'client',
  'api-gateway',
  'stt-cloud',
  'nlp-service',
  'search-service',
  'calendar-service',
  'postgres',
  'minio',
];

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'TEAMS_CLIENT_ID',
  'TEAMS_CLIENT_SECRET',
  'ZOOM_API_KEY',
  'ZOOM_API_SECRET',
  'STT_MODEL_PATH',
  'NLP_MODEL_NAME',
];

// Patterns that indicate hardcoded secrets (not env-var references)
const HARDCODED_SECRET_PATTERNS = [
  /password\s*=\s*["'][^${}]+["']/i,
  /secret\s*=\s*["'][^${}]+["']/i,
  /api_key\s*=\s*["'][^${}]+["']/i,
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Docker Smoke Tests', () => {
  describe('docker-compose.yml validity', () => {
    it('should exist and be parseable YAML with all expected services', () => {
      const content = readProjectFile('docker-compose.yml');

      // Basic YAML structure checks — look for "services:" key
      expect(content).toContain('services:');

      // Every expected service should appear as a key under services
      for (const svc of EXPECTED_COMPOSE_SERVICES) {
        expect(content).toContain(`  ${svc}:`);
      }
    });

    it('should configure health checks for every application service', () => {
      const content = readProjectFile('docker-compose.yml');

      for (const svc of EXPECTED_COMPOSE_SERVICES) {
        // Extract the block for this service (rough but sufficient for smoke)
        const svcIdx = content.indexOf(`  ${svc}:`);
        expect(svcIdx).toBeGreaterThanOrEqual(0);

        // Find the next service block or end of file
        const rest = content.slice(svcIdx + 1);
        const nextSvcMatch = rest.match(/\n  [a-z][\w-]*:/);
        const block = nextSvcMatch
          ? rest.slice(0, nextSvcMatch.index!)
          : rest;

        expect(
          block,
          `Service "${svc}" should have a healthcheck configured`,
        ).toContain('healthcheck:');
      }
    });

    it('should include PostgreSQL and MinIO infrastructure services', () => {
      const content = readProjectFile('docker-compose.yml');
      expect(content).toContain('postgres:16-alpine');
      expect(content).toContain('minio/minio');
    });
  });

  describe('.env.example completeness', () => {
    it('should exist and contain all required environment variables', () => {
      const content = readProjectFile('.env.example');

      for (const v of REQUIRED_ENV_VARS) {
        expect(content, `Missing env var: ${v}`).toContain(v);
      }
    });
  });

  describe('Dockerfiles — multi-stage builds', () => {
    for (const [name, path] of Object.entries(DOCKERFILES)) {
      it(`${name} Dockerfile should exist and use multi-stage build`, () => {
        const content = readProjectFile(path);

        // Multi-stage build requires at least two FROM instructions
        const fromMatches = content.match(/^FROM\s+/gm);
        expect(
          fromMatches && fromMatches.length >= 2,
          `${name} Dockerfile should have at least 2 FROM stages (multi-stage build)`,
        ).toBe(true);
      });

      it(`${name} Dockerfile should use optimised base images`, () => {
        const content = readProjectFile(path);

        // Final stage should use alpine or slim variant
        const fromLines = content.match(/^FROM\s+.+$/gm) ?? [];
        const lastFrom = fromLines[fromLines.length - 1];
        expect(
          lastFrom,
          `${name} final stage should use alpine or slim base image`,
        ).toMatch(/alpine|slim/i);
      });

      it(`${name} Dockerfile should not contain hardcoded secrets`, () => {
        const content = readProjectFile(path);

        for (const pattern of HARDCODED_SECRET_PATTERNS) {
          expect(
            pattern.test(content),
            `${name} Dockerfile should not have hardcoded secrets matching ${pattern}`,
          ).toBe(false);
        }
      });
    }
  });

  describe('Dockerfiles — health check endpoints', () => {
    for (const [name, path] of Object.entries(DOCKERFILES)) {
      it(`${name} Dockerfile should configure a HEALTHCHECK`, () => {
        const content = readProjectFile(path);
        expect(
          content,
          `${name} Dockerfile should include a HEALTHCHECK instruction`,
        ).toContain('HEALTHCHECK');
      });

      it(`${name} Dockerfile health check should target /health`, () => {
        const content = readProjectFile(path);
        expect(
          content,
          `${name} Dockerfile HEALTHCHECK should reference /health endpoint`,
        ).toMatch(/\/health/);
      });
    }
  });

  describe('docker-compose.dev.yml', () => {
    it('should exist and contain volume mounts for hot-reload', () => {
      const content = readProjectFile('docker-compose.dev.yml');
      expect(content).toContain('volumes:');
      expect(content).toContain('NODE_ENV=development');
    });
  });
});
