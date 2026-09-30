const Workspace = require('../models/Workspace');
const WorkspaceMember = require('../models/WorkspaceMember');

/**
 * Ensures that a user belongs to at least one workspace.
 * If not, creates a default workspace and adds the user as owner.
 */
const ensureUserWorkspace = async (user) => {
  const userId = user._id || user.id;

  // Check if user already has any workspace membership
  let membership = await WorkspaceMember.findOne({ userId }).populate('workspaceId');
  if (membership && membership.workspaceId) {
    return {
      workspace: membership.workspaceId,
      role: membership.role
    };
  }

  // Check if an owned workspace already exists for this user
  let workspace = await Workspace.findOne({ ownerId: userId });
  if (!workspace) {
    const workspaceName = 'TaskFlow Workspace';
    workspace = await Workspace.create({
      name: workspaceName,
      ownerId: userId
    });
  }

  // Create owner membership
  membership = await WorkspaceMember.findOneAndUpdate(
    { workspaceId: workspace._id, userId },
    { workspaceId: workspace._id, userId, role: 'owner', joinedAt: new Date() },
    { upsert: true, new: true }
  ).populate('workspaceId');

  return {
    workspace,
    role: 'owner'
  };
};

/**
 * Gets the active workspace for a user, verifying access.
 */
const getUserActiveWorkspace = async (user, requestedWorkspaceId = null) => {
  const userId = user._id || user.id;

  if (requestedWorkspaceId) {
    const member = await WorkspaceMember.findOne({
      workspaceId: requestedWorkspaceId,
      userId
    }).populate('workspaceId');

    if (member && member.workspaceId) {
      return {
        workspace: member.workspaceId,
        role: member.role
      };
    }
  }

  // Fallback to ensuring user has at least one workspace
  return ensureUserWorkspace(user);
};

/**
 * Checks if user is owner or admin in workspace.
 */
const isWorkspaceAdminOrOwner = async (workspaceId, userId) => {
  const member = await WorkspaceMember.findOne({ workspaceId, userId });
  return member && (member.role === 'owner' || member.role === 'admin');
};

/**
 * Get all user IDs belonging to a workspace.
 */
const getWorkspaceMemberUserIds = async (workspaceId) => {
  const members = await WorkspaceMember.find({ workspaceId }).select('userId').lean();
  return members.map((m) => m.userId);
};

module.exports = {
  ensureUserWorkspace,
  getUserActiveWorkspace,
  isWorkspaceAdminOrOwner,
  getWorkspaceMemberUserIds
};
