const express = require('express');
const config = require('../config');
const workspaceService = require('../services/workspace.service');
const { authenticateRequest } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateRequest);

router.post('/', async (req, res) => {
  const { name } = req.body || {};

  try {
    const workspace = await workspaceService.createWorkspace(name, req.user.id);
    return res.status(201).json({ workspace });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to create workspace.',
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const workspaces = await workspaceService.listUserWorkspaces(req.user.id);
    return res.status(200).json({ workspaces });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to list workspaces.',
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const payload = await workspaceService.getWorkspaceWithMembers(req.params.id, req.user.id);
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to load workspace.',
    });
  }
});

router.post('/:id/invite', requireRole('lead'), async (req, res) => {
  const { username, role } = req.body || {};

  try {
    const member = await workspaceService.inviteUser(req.params.id, username, role);
    return res.status(200).json({ member });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to invite user.',
    });
  }
});

router.post('/:id/invite-link', requireRole('lead'), async (req, res) => {
  const { role } = req.body || {};

  try {
    const invite = workspaceService.createInviteToken(req.params.id, role);
    const inviteUrl = `${config.CLIENT_URL}/workspace/${req.params.id}?invite=${encodeURIComponent(invite.token)}`;
    return res.status(200).json({ ...invite, inviteUrl });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to create invite link.',
    });
  }
});

router.post('/invite-links/accept', async (req, res) => {
  const { token } = req.body || {};

  try {
    const accepted = await workspaceService.acceptInviteToken(token, req.user.id);
    return res.status(200).json({ accepted });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to accept invite link.',
    });
  }
});

router.patch('/:id/roles/:userId', requireRole('lead'), async (req, res) => {
  const { role } = req.body || {};

  try {
    const updatedRole = await workspaceService.updateUserRole(
      req.params.id,
      req.params.userId,
      role
    );
    return res.status(200).json({ role: updatedRole });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to update user role.',
    });
  }
});

// ── Tasks ───────────────────────────────────────────
const taskService = require('../services/task.service');

router.get('/:id/tasks', async (req, res) => {
  try {
    const tasks = await taskService.listWorkspaceTasks(req.params.id);
    return res.status(200).json({ tasks });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to list tasks.',
    });
  }
});

router.post('/:id/tasks', async (req, res) => {
  try {
    const task = await taskService.createTask(req.params.id, req.body);
    return res.status(201).json({ task });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to create task.',
    });
  }
});

module.exports = router;
