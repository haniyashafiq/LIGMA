const { pool } = require('../db/pool');

function normalizePayload(payload) {
  if (payload && typeof payload === 'object') {
    return payload;
  }

  return {};
}

function mapEvent(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    eventType: row.event_type,
    nodeId: row.node_id,
    payload: row.payload,
    yjsUpdate: row.yjs_update,
    sequenceNum: row.sequence_num,
    createdAt: row.created_at,
  };
}

function mapSnapshot(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    snapshot: row.snapshot,
    lastSequenceNum: row.last_sequence_num,
    createdAt: row.created_at,
  };
}

async function appendEvent(workspaceId, userId, eventType, nodeId, payload, yjsUpdate = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('SELECT id FROM workspaces WHERE id = $1 FOR UPDATE', [workspaceId]);

    const sequenceResult = await client.query(
      `
        SELECT COALESCE(MAX(sequence_num), 0) + 1 AS next_sequence_num
        FROM canvas_events
        WHERE workspace_id = $1
      `,
      [workspaceId]
    );

    const nextSequenceNum = Number(sequenceResult.rows[0].next_sequence_num);

    const insertResult = await client.query(
      `
        INSERT INTO canvas_events (
          workspace_id,
          user_id,
          event_type,
          node_id,
          payload,
          yjs_update,
          sequence_num
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
        RETURNING id, sequence_num
      `,
      [
        workspaceId,
        userId || null,
        eventType,
        nodeId || null,
        JSON.stringify(normalizePayload(payload)),
        yjsUpdate || null,
        nextSequenceNum,
      ]
    );

    await client.query('COMMIT');
    return {
      id: insertResult.rows[0].id,
      sequence_num: insertResult.rows[0].sequence_num,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getEventsSince(workspaceId, sinceSequence = 0) {
  const result = await pool.query(
    `
      SELECT
        id,
        workspace_id,
        user_id,
        event_type,
        node_id,
        payload,
        yjs_update,
        sequence_num,
        created_at
      FROM canvas_events
      WHERE workspace_id = $1 AND sequence_num > $2
      ORDER BY sequence_num ASC
    `,
    [workspaceId, Number(sinceSequence) || 0]
  );

  return result.rows.map(mapEvent);
}

async function getAllEvents(workspaceId) {
  const result = await pool.query(
    `
      SELECT
        id,
        workspace_id,
        user_id,
        event_type,
        node_id,
        payload,
        yjs_update,
        sequence_num,
        created_at
      FROM canvas_events
      WHERE workspace_id = $1
      ORDER BY sequence_num ASC
    `,
    [workspaceId]
  );

  return result.rows.map(mapEvent);
}

async function createSnapshot(workspaceId, yjsStateVector, lastSequenceNum = 0) {
  const result = await pool.query(
    `
      INSERT INTO yjs_snapshots (workspace_id, snapshot, last_sequence_num)
      VALUES ($1, $2, $3)
      RETURNING id, workspace_id, snapshot, last_sequence_num, created_at
    `,
    [workspaceId, yjsStateVector, Number(lastSequenceNum) || 0]
  );

  return mapSnapshot(result.rows[0]);
}

async function getLatestSnapshot(workspaceId) {
  const result = await pool.query(
    `
      SELECT id, workspace_id, snapshot, last_sequence_num, created_at
      FROM yjs_snapshots
      WHERE workspace_id = $1
      ORDER BY last_sequence_num DESC, created_at DESC
      LIMIT 1
    `,
    [workspaceId]
  );

  return mapSnapshot(result.rows[0] || null);
}

module.exports = {
  appendEvent,
  getEventsSince,
  getAllEvents,
  createSnapshot,
  getLatestSnapshot,
};
