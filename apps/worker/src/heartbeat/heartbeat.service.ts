import * as os from 'os';
import { ApiClient } from '../api-client/api-client';
import { workerConfig } from '../config/worker.config';
import { logger } from '../logger';

export class HeartbeatService {
  private intervalHandle?: NodeJS.Timeout;
  private lastCpuUsage = process.cpuUsage();
  private lastSampleTime = Date.now();

  constructor(
    private readonly apiClient: ApiClient,
    private readonly workerId: string,
    private readonly getCurrentTaskCount: () => number,
  ) {}

  start(): void {
    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, workerConfig.heartbeatIntervalMs);
    // Fire one immediately rather than waiting a full interval after registration.
    void this.tick();
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
  }

  private async tick(): Promise<void> {
    try {
      const { cpuPercent, memoryMb } = this.sampleResourceUsage();
      await this.apiClient.sendHeartbeat(this.workerId, this.getCurrentTaskCount(), cpuPercent, memoryMb);
    } catch (err) {
      logger.warn(`Heartbeat failed: ${(err as Error).message}`);
    }
  }

  /** Approximate process CPU% since the last sample, plus current RSS in MB. */
  private sampleResourceUsage(): { cpuPercent: number; memoryMb: number } {
    const now = Date.now();
    const elapsedMs = now - this.lastSampleTime;
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);

    // user+system microseconds consumed, as a percentage of wall-clock time
    // elapsed, normalized by core count so a single busy core on an 8-core
    // box doesn't misleadingly read as 800%.
    const totalCpuMicros = currentCpuUsage.user + currentCpuUsage.system;
    const cpuPercent = elapsedMs > 0 ? ((totalCpuMicros / 1000 / elapsedMs) * 100) / os.cpus().length : 0;

    this.lastCpuUsage = process.cpuUsage();
    this.lastSampleTime = now;

    const memoryMb = process.memoryUsage().rss / 1024 / 1024;

    return { cpuPercent: Math.round(cpuPercent * 100) / 100, memoryMb: Math.round(memoryMb * 100) / 100 };
  }
}
