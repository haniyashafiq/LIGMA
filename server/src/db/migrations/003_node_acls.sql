CREATE TABLE IF NOT EXISTS node_acls (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acl JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_node_acls_owner
  ON node_acls (owner_user_id);
