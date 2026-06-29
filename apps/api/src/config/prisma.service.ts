import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL via Prisma');

    if (process.env.NODE_ENV === 'development') {
      // @ts-expect-error - Prisma's event typing for $on is loosely typed across versions
      this.$on('query', (e: { query: string; duration: number }) => {
        if (e.duration > 200) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }

    // @ts-expect-error - same as above
    this.$on('error', (e: { message: string }) => {
      this.logger.error(`Prisma error: ${e.message}`);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL');
  }

  /**
   * Wraps a set of operations in a Prisma interactive transaction with
   * sensible defaults for this workload (short, write-heavy task mutations).
   */
  async runInTransaction<T>(fn: (tx: Parameters<PrismaClient['$transaction']>[0]) => Promise<T>): Promise<T> {
    return this.$transaction(fn as any, {
      maxWait: 5000,
      timeout: 10000,
    }) as Promise<T>;
  }
}
