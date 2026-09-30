const nodemailer = require('nodemailer');
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;

  const hasSmtpConfig = process.env.SMTP_USER && process.env.SMTP_PASS;

  if (hasSmtpConfig) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    // In development without credentials, create an ephemeral Ethereal test account
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`[TaskFlow Email] Configured dev Ethereal test email account: ${testAccount.user}`);
    } catch {
      // Fallback to null transporter that logs to console
      transporter = null;
    }
  }

  return transporter;
};

/**
 * Send task reminder notification email
 */
const sendTaskReminderEmail = async ({ to, taskTitle, dueDate, priority, taskDescription }) => {
  const from = process.env.SMTP_FROM || 'TaskFlow Alerts <notifications@taskflow.local>';
  const formattedDue = dueDate ? new Date(dueDate).toLocaleString() : 'No deadline set';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #334155;">
      <h2 style="color: #6366f1; margin-top: 0;">⏰ TaskFlow Reminder</h2>
      <p style="font-size: 16px; color: #cbd5e1;">This is a friendly reminder for your upcoming task:</p>
      
      <div style="background-color: #1e293b; padding: 16px; border-radius: 8px; border-left: 4px solid #6366f1; margin: 20px 0;">
        <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 18px;">${escapeHtml(taskTitle)}</h3>
        ${taskDescription ? `<p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 14px;">${escapeHtml(taskDescription)}</p>` : ''}
        <div style="font-size: 13px; color: #cbd5e1;">
          <p style="margin: 4px 0;"><strong>Priority:</strong> <span style="text-transform: uppercase; color: ${priority === 'high' ? '#ef4444' : priority === 'medium' ? '#f59e0b' : '#10b981'}; font-weight: bold;">${priority || 'MEDIUM'}</span></p>
          <p style="margin: 4px 0;"><strong>Due Date:</strong> ${escapeHtml(formattedDue)}</p>
        </div>
      </div>

      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
        Sent automatically by TaskFlow. You received this because a reminder was scheduled for this task.
      </p>
    </div>
  `;

  try {
    const mailer = await getTransporter();
    if (!mailer) {
      console.log(`[TaskFlow Email Sim] 📧 Simulated reminder email to: ${to} for task: "${taskTitle}"`);
      return { messageId: 'simulated_' + Date.now() };
    }

    const info = await mailer.sendMail({
      from,
      to,
      subject: `⏰ Reminder: ${String(taskTitle).replace(/[\r\n]/g, ' ').slice(0, 200)}`,
      html
    });

    console.log(`[TaskFlow Email] Sent reminder email to ${to} (MessageId: ${info.messageId})`);
    if (nodemailer.getTestMessageUrl(info)) {
      console.log(`[TaskFlow Email] 🔗 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return info;
  } catch (err) {
    console.error(`[TaskFlow Email Error] Failed to send reminder: ${err.message}`);
    throw err;
  }
};

/**
 * Send workspace invitation email
 */
const sendWorkspaceInvitationEmail = async ({ to, inviterName, workspaceName, role, inviteToken }) => {
  const from = process.env.SMTP_FROM || 'TaskFlow Workspace <invitations@taskflow.local>';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #131418; color: #f5f5f7; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
        <div style="background-color: #595cd9; width: 24px; height: 24px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">✓</div>
        <span style="font-size: 18px; font-weight: 600; letter-spacing: -0.02em; color: #ffffff;">TaskFlow</span>
      </div>

      <h2 style="color: #ffffff; margin-top: 0; font-size: 20px; font-weight: 500;">You've been invited to join a workspace</h2>
      <p style="font-size: 15px; color: #a7abb9; line-height: 1.5;">
        <strong style="color: #f5f5f7;">${escapeHtml(inviterName)}</strong> has invited you to collaborate in <strong style="color: #f5f5f7;">${escapeHtml(workspaceName)}</strong> as a <strong style="color: #c7d2fe; text-transform: capitalize;">${escapeHtml(role || 'member')}</strong>.
      </p>

      <div style="background-color: #1a1d26; padding: 20px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08); margin: 24px 0;">
        <p style="margin: 0 0 10px 0; font-size: 13px; color: #747888; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace;">Workspace</p>
        <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 16px; font-weight: 500;">${escapeHtml(workspaceName)}</p>

        <p style="margin: 0 0 4px 0; font-size: 13px; color: #747888;">Role: <span style="color: #f5f5f7; text-transform: capitalize;">${escapeHtml(role || 'member')}</span></p>
        <p style="margin: 0; font-size: 13px; color: #747888;">Invited by: <span style="color: #f5f5f7;">${escapeHtml(inviterName)}</span></p>
      </div>

      <p style="font-size: 14px; color: #a7abb9; line-height: 1.5;">
        Sign in or create an account with <strong>${escapeHtml(to)}</strong> to view and accept your invitation directly in the TaskFlow Team dashboard.
      </p>

      <p style="font-size: 12px; color: #525666; margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
        Sent automatically by TaskFlow Workspace. If you were not expecting this invitation, you can ignore this email.
      </p>
    </div>
  `;

  try {
    const mailer = await getTransporter();
    if (!mailer) {
      console.log(`[TaskFlow Email Sim] 📧 Simulated workspace invitation to: ${to} for workspace: "${workspaceName}" by ${inviterName}`);
      return { messageId: 'simulated_invite_' + Date.now() };
    }

    const info = await mailer.sendMail({
      from,
      to,
      subject: `Invite: Join ${escapeHtml(workspaceName)} on TaskFlow`,
      html
    });

    console.log(`[TaskFlow Email] Sent workspace invite email to ${to} (MessageId: ${info.messageId})`);
    if (nodemailer.getTestMessageUrl(info)) {
      console.log(`[TaskFlow Email] 🔗 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return info;
  } catch (err) {
    console.error(`[TaskFlow Email Error] Failed to send workspace invite: ${err.message}`);
    // Non-fatal: do not block invitation creation if mail transport fails
    return null;
  }
};

module.exports = {
  sendTaskReminderEmail,
  sendWorkspaceInvitationEmail
};
