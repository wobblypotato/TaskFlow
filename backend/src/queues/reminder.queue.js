const { Queue } = require('bullmq');
const { redisConfig } = require('../config/redis');

let reminderQueue = null;

const getReminderQueue = () => {
  if (!reminderQueue) {
    try {
      reminderQueue = new Queue('task-reminders', {
        connection: redisConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          },
          removeOnComplete: true,
          removeOnFail: false
        }
      });

      reminderQueue.on('error', (err) => {
        // Suppress unhandled queue connection errors if Redis is down
      });
    } catch (err) {
      console.warn(`[BullMQ] Could not initialize reminder queue: ${err.message}`);
    }
  }
  return reminderQueue;
};

/**
 * Schedule a background reminder job
 * @param {Object} task - Task document or object
 * @param {Date|string} reminderTime - Target time for notification
 * @param {string} userEmail - Recipient email
 */
const scheduleReminderJob = async (task, reminderTime, userEmail) => {
  try {
    const queue = getReminderQueue();
    if (!queue) return null;

    const delay = Math.max(0, new Date(reminderTime).getTime() - Date.now());
    const jobId = `reminder_${task._id}`;

    // Remove any existing job for this task to avoid duplicates
    try {
      const existingJob = await queue.getJob(jobId);
      if (existingJob) {
        await existingJob.remove();
      }
    } catch {
      // Ignored if job doesn't exist
    }

    const job = await queue.add(
      'send-reminder',
      {
        taskId: task._id.toString(),
        taskTitle: task.title,
        taskDescription: task.description,
        userEmail,
        dueDate: task.dueDate,
        priority: task.priority
      },
      {
        delay,
        jobId
      }
    );

    console.log(`[BullMQ] Scheduled reminder for task "${task.title}" (Job ID: ${job.id}, Delay: ${Math.round(delay / 1000)}s)`);
    return job;
  } catch (err) {
    console.warn(`[BullMQ] Notice: Reminder background job skipped (${err.message})`);
    return null;
  }
};

/**
 * Cancel a scheduled reminder job for a task
 * @param {string|ObjectId} taskId
 */
const cancelReminderJob = async (taskId) => {
  try {
    const queue = getReminderQueue();
    if (!queue) return;
    const jobId = `reminder_${taskId}`;
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`[BullMQ] Removed reminder job for task ${taskId}`);
    }
  } catch (err) {
    // Non-critical, ignore
  }
};

module.exports = { scheduleReminderJob, cancelReminderJob };
