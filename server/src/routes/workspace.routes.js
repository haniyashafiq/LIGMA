const express = require('express');
const config = require('../config');
const workspaceService = require('../services/workspace.service');
const taskService = require('../services/task.service');
const eventService = require('../services/event.service');
const { authenticateRequest } = require('../middleware/auth');
const { requireRole, checkNodePermission } = require('../middleware/rbac');

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

router.get('/all/tasks', async (req, res) => {
  try {
    const tasks = await taskService.listUserTasks(req.user.id);
    return res.status(200).json({ tasks });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to list tasks.',
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
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${req.params.id}`).emit('workspace:role_updated', {
        workspaceId: req.params.id,
        userId: req.params.userId,
        role: updatedRole.role,
        reloadMembers: true,
      });
    }
    return res.status(200).json({ role: updatedRole });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to update user role.',
    });
  }
});

router.get('/:id/tasks', requireRole('lead', 'contributor', 'viewer'), async (req, res) => {
  try {
    const tasks = await taskService.listWorkspaceTasks(req.params.id);
    return res.status(200).json({ tasks });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to list tasks.',
    });
  }
});

router.post('/:id/tasks', requireRole('lead', 'contributor'), async (req, res) => {
  try {
    const task = await taskService.createTask(req.params.id, req.body);
    return res.status(201).json({ task });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to create task.',
    });
  }
});

router.put('/:id/tasks/node/:nodeId', requireRole('lead', 'contributor'), async (req, res) => {
  try {
    const canEditNode = await checkNodePermission(
      'edit',
      req.params.nodeId,
      req.user.id,
      req.params.id
    );
    if (!canEditNode) {
      return res.status(403).json({ message: 'You cannot modify tasks linked to this canvas node.' });
    }

    const task = await taskService.upsertTaskByNodeId(req.params.id, req.params.nodeId, req.body);
    
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${req.params.id}`).emit('task:sync', {
        id: task.id,
        title: task.title,
        status: task.status,
        sourceNodeId: task.source_node_id
      });
    }

    return res.status(200).json({ task });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to upsert task.',
    });
  }
});

router.delete('/:id/tasks/node/:nodeId', requireRole('lead', 'contributor'), async (req, res) => {
  try {
    const canEditNode = await checkNodePermission(
      'edit',
      req.params.nodeId,
      req.user.id,
      req.params.id
    );
    if (!canEditNode) {
      return res.status(403).json({ message: 'You cannot modify tasks linked to this canvas node.' });
    }

    const deletedRows = await taskService.deleteTaskByNodeId(req.params.id, req.params.nodeId);
    
    if (deletedRows && deletedRows.length > 0) {
      const io = req.app.get('io');
      if (io) {
        io.to(`room:${req.params.id}`).emit('task:sync', {
          deleted: true,
          sourceNodeId: req.params.nodeId
        });
      }
    }

    return res.status(200).json({ deleted: deletedRows });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to delete task.',
    });
  }
});

router.delete('/:id/tasks', requireRole('lead'), async (req, res) => {
  try {
    const deletedTasks = await taskService.deleteAllTasks(req.params.id);
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${req.params.id}`).emit('task:sync', { allDeleted: true });
    }
    return res.status(200).json({ deleted: deletedTasks });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to delete all tasks.' });
  }
});

router.patch('/:id/tasks/:taskId', requireRole('lead', 'contributor'), async (req, res) => {
  try {
    const existingTask = await taskService.getTask(req.params.id, req.params.taskId);
    if (!existingTask) {
      return res.status(404).json({
        message: 'Task not found in this workspace.',
      });
    }

    if (existingTask.source_node_id) {
      const canEditNode = await checkNodePermission(
        'edit',
        existingTask.source_node_id,
        req.user.id,
        req.params.id
      );
      if (!canEditNode) {
        return res.status(403).json({ message: 'You cannot modify tasks linked to this canvas node.' });
      }
    }

    const task = await taskService.updateTask(req.params.id, req.params.taskId, req.body);
    if (!task) {
      return res.status(404).json({
        message: 'Task not found in this workspace.',
      });
    }
    
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${req.params.id}`).emit('task:sync', {
        id: task.id,
        title: task.title,
        status: task.status,
        sourceNodeId: task.source_node_id
      });
    }

    return res.status(200).json({ task });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to update task.',
    });
  }
});

router.get('/:id/events', requireRole('lead', 'contributor', 'viewer'), async (req, res) => {
  try {
    const events = await eventService.getAllEvents(req.params.id);
    
    // We can enrich events with user details if needed, but for now just returning them
    return res.status(200).json({ events });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to list events.',
    });
  }
});

function serializeYjsUpdate(update) {
  if (!update) return null;
  return Array.from(new Uint8Array(update));
}

router.get('/:id/canvas-history', requireRole('lead', 'contributor', 'viewer'), async (req, res) => {
  try {
    const events = await eventService.getAllEvents(req.params.id);
    const history = events.map((event) => ({
      id: event.id,
      userId: event.userId,
      eventType: event.eventType,
      nodeId: event.nodeId,
      payload: event.payload || {},
      sequenceNum: event.sequenceNum,
      createdAt: event.createdAt,
      yjsUpdate: serializeYjsUpdate(event.yjsUpdate),
    }));

    return res.status(200).json({
      minSequence: history.length ? history[0].sequenceNum : 0,
      maxSequence: history.length ? history[history.length - 1].sequenceNum : 0,
      events: history,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to load canvas history.',
    });
  }
});

router.delete('/:id/tasks/:taskId', requireRole('lead', 'contributor'), async (req, res) => {
  try {
    const existingTask = await taskService.getTask(req.params.id, req.params.taskId);
    if (!existingTask) {
      return res.status(404).json({
        message: 'Task not found in this workspace.',
      });
    }

    if (existingTask.source_node_id) {
      const canEditNode = await checkNodePermission(
        'edit',
        existingTask.source_node_id,
        req.user.id,
        req.params.id
      );
      if (!canEditNode) {
        return res.status(403).json({ message: 'You cannot modify tasks linked to this canvas node.' });
      }
    }

    const deleted = await taskService.deleteTask(req.params.id, req.params.taskId);
    if (!deleted) {
      return res.status(404).json({
        message: 'Task not found in this workspace.',
      });
    }
    
    if (deleted) {
      const io = req.app.get('io');
      if (io) {
        io.to(`room:${req.params.id}`).emit('task:sync', {
          id: deleted.id,
          deleted: true,
          sourceNodeId: deleted.source_node_id
        });
      }
    }

    return res.status(200).json({ deleted });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Failed to delete task.',
    });
  }
});

module.exports = router;
