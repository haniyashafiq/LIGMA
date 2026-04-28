const express = require('express');
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

router.put('/:id/tasks/node/:nodeId', async (req, res) => {
  try {
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

router.delete('/:id/tasks/node/:nodeId', async (req, res) => {
  try {
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

router.patch('/:id/tasks/:taskId', async (req, res) => {
  try {
    const task = await taskService.updateTask(req.params.taskId, req.body);
    
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

router.delete('/:id/tasks/:taskId', async (req, res) => {
  try {
    const deleted = await taskService.deleteTask(req.params.taskId);
    
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
