-- 003 · web search result cache + settings rows
-- Lets the deviation engine ask "what's the current OpenView SaaS Series A
-- gross margin benchmark page?" every time a deck is uploaded, without
-- burning the Serper.dev free quota on identical repeat queries.

CREATE TABLE web_search_cache (
    cache_key       VARCHAR(190) PRIMARY KEY,
    query           TEXT         NOT NULL,
    provider        VARCHAR(40)  NOT NULL DEFAULT 'serper',
    results         JSON         NOT NULL,
    top_url         VARCHAR(2048) NULL,
    top_title       VARCHAR(512)  NULL,
    top_snippet     TEXT          NULL,
    hits            INT UNSIGNED NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    refreshed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      DATETIME NULL,
    INDEX idx_wsc_expires (expires_at)
) ENGINE=InnoDB;

-- Knobs admins can tweak from /admin/settings
INSERT INTO settings (key_name, value) VALUES ('web_search_enabled',  'false');
INSERT INTO settings (key_name, value) VALUES ('web_search_provider', '"serper"');
INSERT INTO settings (key_name, value) VALUES ('web_search_ttl_days', '30');
