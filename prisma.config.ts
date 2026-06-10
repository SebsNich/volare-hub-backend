import 'dotenv/config'; // Reemplaza dotenv.config() de forma nativa e integrada
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DIRECT_URL'), 
  },
  migrations: {
    path: 'prisma/migrations',
  }
});
