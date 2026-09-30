require('dotenv').config();
const { Worker } = require('bullmq');
const { redisConfig } = require('../config/redis');
const { sendTaskReminderEmail } = require('../services/email.service');
const connectDB = require('../config/db');
const Task = require('../models/Task');

console.log(`========================================`);
console.log(`🛠️  TaskFlow Background Worker Starting...`);
console.log(`📡 Redis Target: ${redisConfig.host}:${redisConfig.port}`);
console.log(`========================================`);

connectDB();

const worker = new Worker(
  'task-reminders',
  async (job) => {
    console.log(`\n[Worker] 📥 Processing Job ${job.id} (${job.name})`);
    const { taskId, taskTitle, taskDescription, userEmail, dueDate, priority } = job.data;

    const task = await Task.findById(taskId);
    if (!task || task.status === 'completed' || !task.reminderAt || task.reminderAt.getTime() > Date.now() + 1000) {
      return { status: 'skipped', reason: 'reminder-no-longer-current' };
    }

    if (!userEmail) {
      console.warn(`[Worker] ⚠️ Skipped job ${job.id}: No user email provided.`);
      return { status: 'skipped', reason: 'no_email' };
    }

    console.log(`[Worker] 🚀 Sending reminder email for task: "${taskTitle}" to: ${userEmail}`);
    const result = await sendTaskReminderEmail({
      to: userEmail,
      taskTitle,
      taskDescription,
      dueDate,
      priority
    });

    return { status: 'completed', taskId, recipient: userEmail, result };
  },
  {
    connection: redisConfig,
    concurrency: 5
  }
);

worker.on('completed', (job, returnvalue) => {
  console.log(`[Worker] ✅ Job ${job.id} completed successfully.`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] ❌ Job ${job ? job.id : 'unknown'} failed: ${err.message}`);
});

worker.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    // Suppress spammy connection errors when Redis is not running
  } else {
    console.warn(`[Worker] Warning: ${err.message}`);
  }
});

const shutdown = async () => {
  console.log('\n[Worker] Shutting down worker gracefully...');
  await worker.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
