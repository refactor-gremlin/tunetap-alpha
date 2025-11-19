import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load environment variables from .env if present so Prisma commands get defaults.
loadEnv();

const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations'
	},
	engine: 'classic',
	datasource: {
		url: databaseUrl
	}
});
