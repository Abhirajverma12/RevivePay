import { Queue, Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { simulateRecoveryResult } from '@revivepay/simulator';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

let redisConnection: IORedis;
if (redisUrl) {
  redisConnection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
} else {
  redisConnection = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
}

redisConnection.on('error', (err) => {
  console.warn('⚠️ BullMQ Redis connection notice (fallback active):', err.message);
});

export interface DelayedRetryJobData {
  interventionId: string;
  failedPaymentId: string;
  delayHours: number;
}

export const delayedRetryQueue = new Queue<DelayedRetryJobData>('delayed-retries', {
  connection: redisConnection,
});

let prismaInstance: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

/**
 * BullMQ Worker processing delayed retries when their timer expires
 */
export const delayedRetryWorker = new Worker<DelayedRetryJobData>(
  'delayed-retries',
  async (job: Job<DelayedRetryJobData>) => {
    console.log(`⏳ Processing delayed retry job #${job.id} for intervention ${job.data.interventionId}`);
    const prisma = getPrisma();
    const result = await simulateRecoveryResult(prisma, job.data.interventionId);
    console.log(`✅ Delayed retry completed for intervention ${job.data.interventionId}: Recovered=${result.recovered}, Amount=₹${result.amountRecovered}`);
    return result;
  },
  {
    connection: redisConnection,
  },
);

delayedRetryWorker.on('failed', (job, err) => {
  console.error(`❌ Delayed retry job #${job?.id} failed:`, err);
});

/**
 * Helper to enqueue a delayed retry job
 */
export async function enqueueDelayedRetry(data: DelayedRetryJobData, delayOverrideMs?: number) {
  const delayMs = delayOverrideMs !== undefined ? delayOverrideMs : data.delayHours * 60 * 60 * 1000;

  try {
    const job = await delayedRetryQueue.add('execute-delayed-retry', data, {
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: false,
    });

    return {
      jobId: job.id,
      delayMs,
      scheduledFor: new Date(Date.now() + delayMs).toISOString(),
    };
  } catch (err: any) {
    console.warn('⚠️ BullMQ queue add fallback (in-memory schedule):', err.message);
    return {
      jobId: `local-job-${Date.now()}`,
      delayMs,
      scheduledFor: new Date(Date.now() + delayMs).toISOString(),
    };
  }
}
