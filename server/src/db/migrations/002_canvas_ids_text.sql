ALTER TABLE canvas_events
  ALTER COLUMN node_id TYPE TEXT USING node_id::text;

ALTER TABLE tasks
  ALTER COLUMN source_node_id TYPE TEXT USING source_node_id::text;