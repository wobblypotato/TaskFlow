const crypto = require('crypto');
const Workspace = require('../models/Workspace');
const WorkspaceMember = require('../models/WorkspaceMember');
const WorkspaceInvitation = require('../models/WorkspaceInvitation');
const User = require('../models/User');
const { AppError } = require('../middleware/error.middleware');
const {
  ensureUserWorkspace,
  getUserActiveWorkspace,
  isWorkspaceAdminOrOwner
} = require('../services/workspace.service');
const { sendWorkspaceInvitationEmail } = require('../services/email.service');

// @desc    Get current active workspace details and user workspaces
// @route   GET /api/workspaces/current
const getCurrentWorkspace = async (req, res, next) => {
  try {
    const requestedWorkspaceId = req.headers['x-workspace-id'] || req.query.workspaceId;
    const { workspace, role } = await getUserActiveWorkspace(req.user, requestedWorkspaceId);

    // Also get all workspaces this user belongs to
    const memberships = await WorkspaceMember.find({ userId: req.user._id })
      .populate('workspaceId')
      .lean();

    const userWorkspaces = memberships
      .filter((m) => m.workspaceId)
      .map((m) => ({
        _id: m.workspaceId._id,
        name: m.workspaceId.name,
        role: m.role,
        isOwner: String(m.workspaceId.ownerId) === String(req.user._id)
      }));

    res.status(200).json({
      success: true,
      data: {
        workspace,
        role,
        userWorkspaces
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get members of current workspace
// @route   GET /api/workspaces/current/members
const getWorkspaceMembers = async (req, res, next) => {
  try {
    const requestedWorkspaceId = req.headers['x-workspace-id'] || req.query.workspaceId;
    const { workspace, role } = await getUserActiveWorkspace(req.user, requestedWorkspaceId);

    const members = await WorkspaceMember.find({ workspaceId: workspace._id })
      .populate('userId', 'name email createdAt')
      .lean();

    // Map into clean member objects
    const formattedMembers = members
      .filter((m) => m.userId)
      .map((m) => ({
        _id: m._id,
        userId: m.userId._id,
        name: m.userId.name,
        email: m.userId.email,
        role: m.role,
        joinedAt: m.joinedAt || m.createdAt,
        userCreatedAt: m.userId.createdAt
      }));

    // Sort: owner first, then admin, then member, then by name
    const roleWeight = { owner: 1, admin: 2, member: 3 };
    formattedMembers.sort((a, b) => {
      const weightDiff = (roleWeight[a.role] || 99) - (roleWeight[b.role] || 99);
      if (weightDiff !== 0) return weightDiff;
      return (a.name || '').localeCompare(b.name || '');
    });

    res.status(200).json({
      success: true,
      data: {
        workspace: {
          _id: workspace._id,
          name: workspace.name,
          role
        },
        members: formattedMembers
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new workspace invitation
// @route   POST /api/workspaces/current/invitations
const createInvitation = async (req, res, next) => {
  try {
    const { email, role = 'member' } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const validRole = role === 'admin' ? 'admin' : 'member';

    const requestedWorkspaceId = req.headers['x-workspace-id'] || req.body?.workspaceId;
    const { workspace, role: userRole } = await getUserActiveWorkspace(req.user, requestedWorkspaceId);

    if (userRole !== 'owner' && userRole !== 'admin') {
      return next(new AppError('Only workspace owners and administrators can invite people', 403, 'FORBIDDEN'));
    }

    // Requester cannot invite themselves
    if (normalizedEmail === req.user.email.toLowerCase()) {
      return next(new AppError('You cannot invite yourself to the workspace', 400, 'CANNOT_INVITE_SELF'));
    }

    // Check if user with this email is already a member
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      const alreadyMember = await WorkspaceMember.findOne({
        workspaceId: workspace._id,
        userId: existingUser._id
      });
      if (alreadyMember) {
        return next(new AppError('This user is already a member of this workspace', 400, 'ALREADY_MEMBER'));
      }
    }

    // Check for existing pending invitation
    let invitation = await WorkspaceInvitation.findOne({
      workspaceId: workspace._id,
      email: normalizedEmail,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });

    if (invitation) {
      // Refresh the existing pending invitation
      invitation.role = validRole;
      invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      invitation.token = crypto.randomBytes(32).toString('hex');
      await invitation.save();
    } else {
      invitation = await WorkspaceInvitation.create({
        workspaceId: workspace._id,
        email: normalizedEmail,
        invitedBy: req.user._id,
        role: validRole
      });
    }

    // Send email asynchronously using existing email infrastructure
    sendWorkspaceInvitationEmail({
      to: normalizedEmail,
      inviterName: req.user.name,
      workspaceName: workspace.name,
      role: validRole,
      inviteToken: invitation.token
    }).catch((err) => {
      console.warn(`[Workspace Invite Email Warning]: ${err.message}`);
    });

    // Real-time notification if recipient is an existing registered user
    if (existingUser && req.app.locals.io) {
      const notifPayload = {
        id: `invite-${invitation._id}-${Date.now()}`,
        type: 'workspace:invitation',
        title: 'Workspace Invitation',
        message: `You've been invited to ${workspace.name} by ${req.user.name}`,
        invitationId: String(invitation._id),
        workspaceName: workspace.name,
        role: validRole,
        originatorId: String(req.user._id),
        createdAt: new Date().toISOString()
      };

      req.app.locals.io.to(`user:${existingUser._id}`).emit('notification:new', notifPayload);
      req.app.locals.io.to(`user:${existingUser._id}`).emit('invitation:received', {
        _id: invitation._id,
        workspaceId: { _id: workspace._id, name: workspace.name },
        invitedBy: { _id: req.user._id, name: req.user.name, email: req.user.email },
        role: validRole,
        createdAt: invitation.createdAt
      });
    }

    res.status(201).json({
      success: true,
      message: `Invitation sent to ${normalizedEmail}`,
      data: invitation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending invitations for the logged-in user
// @route   GET /api/workspaces/invitations/my
const getMyInvitations = async (req, res, next) => {
  try {
    const invitations = await WorkspaceInvitation.find({
      email: req.user.email.toLowerCase(),
      status: 'pending',
      expiresAt: { $gt: new Date() }
    })
      .populate('workspaceId', 'name')
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: invitations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending invitations sent for current workspace (for admin/owner)
// @route   GET /api/workspaces/current/invitations
const getWorkspaceInvitations = async (req, res, next) => {
  try {
    const requestedWorkspaceId = req.headers['x-workspace-id'] || req.query.workspaceId;
    const { workspace, role } = await getUserActiveWorkspace(req.user, requestedWorkspaceId);

    if (role !== 'owner' && role !== 'admin') {
      return res.status(200).json({ success: true, data: [] });
    }

    const invitations = await WorkspaceInvitation.find({
      workspaceId: workspace._id,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    })
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: invitations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept a workspace invitation
// @route   POST /api/workspaces/invitations/:id/accept
const acceptInvitation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const invitation = await WorkspaceInvitation.findById(id).populate('workspaceId');
    if (!invitation) {
      return next(new AppError('Invitation not found', 404, 'NOT_FOUND'));
    }

    if (invitation.status !== 'pending') {
      return next(new AppError(`Invitation has already been ${invitation.status}`, 400, 'INVITATION_INACTIVE'));
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      invitation.status = 'expired';
      await invitation.save();
      return next(new AppError('This invitation has expired', 400, 'INVITATION_EXPIRED'));
    }

    if (invitation.email.toLowerCase() !== req.user.email.toLowerCase()) {
      return next(new AppError('You are not authorized to accept this invitation', 403, 'FORBIDDEN'));
    }

    const workspaceId = invitation.workspaceId._id || invitation.workspaceId;

    // Prevent duplicate membership
    let membership = await WorkspaceMember.findOne({
      workspaceId,
      userId: req.user._id
    });

    if (!membership) {
      membership = await WorkspaceMember.create({
        workspaceId,
        userId: req.user._id,
        role: invitation.role || 'member',
        joinedAt: new Date()
      });
    }

    // Mark invitation as accepted
    invitation.status = 'accepted';
    await invitation.save();

    // Real-time broadcast: member joined
    const io = req.app.locals.io;
    if (io) {
      const joinMessage = `${req.user.name} joined the workspace`;

      // Workspace rooms
      io.to(`workspace:${workspaceId}`).emit('workspace:member-joined', {
        workspaceId,
        member: {
          _id: membership._id,
          userId: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: membership.role,
          joinedAt: membership.joinedAt
        }
      });

      // Notification broadcast
      io.to(`workspace:${workspaceId}`).emit('notification:new', {
        id: `joined-${Date.now()}`,
        type: 'workspace:member-joined',
        title: 'New Member',
        message: joinMessage,
        originatorId: String(req.user._id),
        createdAt: new Date().toISOString()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Workspace invitation accepted successfully',
      data: {
        workspaceId,
        workspaceName: invitation.workspaceId?.name || 'TaskFlow Workspace',
        role: membership.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Decline a workspace invitation
// @route   POST /api/workspaces/invitations/:id/decline
const declineInvitation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const invitation = await WorkspaceInvitation.findById(id);
    if (!invitation) {
      return next(new AppError('Invitation not found', 404, 'NOT_FOUND'));
    }

    if (invitation.status !== 'pending') {
      return next(new AppError(`Invitation has already been ${invitation.status}`, 400, 'INVITATION_INACTIVE'));
    }

    if (invitation.email.toLowerCase() !== req.user.email.toLowerCase()) {
      return next(new AppError('You are not authorized to decline this invitation', 403, 'FORBIDDEN'));
    }

    invitation.status = 'declined';
    await invitation.save();

    res.status(200).json({
      success: true,
      message: 'Workspace invitation declined'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel / revoke a pending workspace invitation
// @route   DELETE /api/workspaces/invitations/:id
const cancelInvitation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const invitation = await WorkspaceInvitation.findById(id);
    if (!invitation) {
      return next(new AppError('Invitation not found', 404, 'NOT_FOUND'));
    }

    // Check authorization: only admin or owner of that workspace can cancel
    const canManage = await isWorkspaceAdminOrOwner(invitation.workspaceId, req.user._id);
    if (!canManage) {
      return next(new AppError('Not authorized to cancel this invitation', 403, 'FORBIDDEN'));
    }

    await WorkspaceInvitation.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Invitation cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCurrentWorkspace,
  getWorkspaceMembers,
  createInvitation,
  getMyInvitations,
  getWorkspaceInvitations,
  acceptInvitation,
  declineInvitation,
  cancelInvitation
};
