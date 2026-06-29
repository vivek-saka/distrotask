import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Prefer a dedicated .env.test (isolated test DB/broker) if the repo has
// one configured; otherwise fall back to the same .env used for local dev.
// CI should always provide .env.test pointing at ephemeral service
// containers (see .github/workflows/ci.yml).
const testEnvPath = path.resolve(__dirname, '../../.env.test');
const defaultEnvPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath });
} else {
  dotenv.config({ path: defaultEnvPath });
}

// E2E tests are noisy by default (Nest logs every request) — keep test
// output focused on assertions/failures unless explicitly debugging.
if (!process.env.DEBUG_E2E) {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
}
