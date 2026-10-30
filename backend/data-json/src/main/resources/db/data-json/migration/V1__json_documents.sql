CREATE TABLE IF NOT EXISTS json_documents (
    tenant_id   TEXT    NOT NULL,
    app_id      TEXT    NOT NULL,
    collection  TEXT    NOT NULL,
    doc_id      TEXT    NOT NULL,
    data        TEXT    NOT NULL,
    _version    INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL,
    PRIMARY KEY (tenant_id, app_id, collection, doc_id)
);

CREATE INDEX IF NOT EXISTS idx_json_docs_collection
    ON json_documents(tenant_id, app_id, collection);
