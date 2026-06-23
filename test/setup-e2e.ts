import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env before any test module is compiled
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });
