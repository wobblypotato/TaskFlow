const mongoose = require('mongoose');
const crypto = require('crypto');

const workspaceInvitationSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true
    },
    email: {
      type: String,
      required: [true, 'Invited email is required'],
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address'
      ],
      index: true
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'member'],
        message: 'Role must be admin or member'
      },
      default: 'member'
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'declined', 'expired'],
        message: 'Status must be pending, accepted, declined, or expired'
      },
      default: 'pending',
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(32).toString('hex')
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days expiration
    }
  },
  {
    timestamps: true
  }
);

workspaceInvitationSchema.index({ workspaceId: 1, email: 1, status: 1 });
workspaceInvitationSchema.index({ email: 1, status: 1 });

const WorkspaceInvitation = mongoose.model('WorkspaceInvitation', workspaceInvitationSchema);

module.exports = WorkspaceInvitation;
