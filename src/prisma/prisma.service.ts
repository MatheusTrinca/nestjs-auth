import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { DatabaseConfig } from '../config/database.config';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private client: PrismaClient;

  get user() {
    return this.client.user;
  }

  get post() {
    return this.client.post;
  }

  constructor(configService: ConfigService) {
    const dbConfig = configService.get<DatabaseConfig>('database')!;
    this.pool = new Pool({ connectionString: dbConfig.url });
    const adapter = new PrismaPg(this.pool);

    this.client = new PrismaClient({
      adapter,
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
    await this.pool.end();
  }
}
