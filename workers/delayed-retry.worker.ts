import { Queue, Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { simulateRecoveryResult } from '@revivepay/simulator';

const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
};

export interface DelayedRetryJobData {
  interventionId: string;
  failedPaymentId: string;
  delayHours: number;
}

export const delayedRetryQueue = new Queue<DelayedRetryJobData>('delayed-retries', {
  connection: REDIS_CONNECTION,
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
    connection: REDIS_CONNECTION,
  },
);

delayedRetryWorker.on('failed', (job, err) => {
  console.error(`❌ Delayed retry job #${job?.id} failed:`, err);
});

/**
 * Helper to enqueue a delayed retry job
 */
export async function enqueueDelayedRetry(data: DelayedRetryJobData, delayOverrideMs?: number) {
  // Use delayOverrideMs if supplied (useful for demo/testing), otherwise calculate hours to ms
  const delayMs = delayOverrideMs !== undefined ? delayOverrideMs : data.delayHours * 60 * 60 * 1000;

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
}
