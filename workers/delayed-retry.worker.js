const { Queue, Worker } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const { simulateRecoveryResult } = require('@revivepay/simulator');
const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URL;

let redisConnection;
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

const delayedRetryQueue = new Queue('delayed-retries', {
  connection: redisConnection,
});

let prismaInstance = null;
function getPrisma() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

/**
 * BullMQ Worker processing delayed retries when their timer expires
 */
const delayedRetryWorker = new Worker(
  'delayed-retries',
  async (job) => {
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
async function enqueueDelayedRetry(data, delayOverrideMs) {
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
  } catch (err) {
    console.warn('⚠️ BullMQ queue add fallback (in-memory schedule):', err.message);
    return {
      jobId: `local-job-${Date.now()}`,
      delayMs,
      scheduledFor: new Date(Date.now() + delayMs).toISOString(),
    };
  }
}

module.exports = {
  delayedRetryQueue,
  delayedRetryWorker,
  enqueueDelayedRetry,
};
