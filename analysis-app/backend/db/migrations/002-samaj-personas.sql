-- 002 · SAMAJ groundwork — personas, invites, simulation sessions, apercept runs.
-- Backed by the digital_twin_conference_paper protocol:
--   Stage 1 (battery), Stage 2 (life-story), Stage 3 (situational), Stage 4 (build/evaluate)
-- The full intake payload is stored as JSON in personas.payload, and the
-- compiled "persona system prompt" lives in personas.system_prompt_md.

CREATE TABLE persona_invites (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    token           VARCHAR(64) NOT NULL UNIQUE,
    invited_by      BIGINT UNSIGNED NOT NULL,
    invitee_email   VARCHAR(190) NULL,
    invitee_name    VARCHAR(190) NULL,
    note            TEXT NULL,
    status          ENUM('pending','submitted','approved','rejected','revoked') NOT NULL DEFAULT 'pending',
    persona_id      BIGINT UNSIGNED NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at    DATETIME NULL,
    decided_at      DATETIME NULL,
    expires_at      DATETIME NULL,
    INDEX idx_invite_status (status, created_at),
    INDEX idx_invite_invited_by (invited_by),
    CONSTRAINT fk_invite_admin FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE personas (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    invite_id           BIGINT UNSIGNED NULL,
    display_name        VARCHAR(190) NOT NULL,
    headline            VARCHAR(255) NULL,
    archetype           VARCHAR(60) NULL,
    avatar_seed         VARCHAR(32) NULL,
    payload             JSON NOT NULL,
    traits              JSON NULL,
    system_prompt_md    MEDIUMTEXT NULL,
    map_x               DECIMAL(8,5) NULL,
    map_y               DECIMAL(8,5) NULL,
    status              ENUM('pending','approved','rejected','archived') NOT NULL DEFAULT 'pending',
    approved_by         BIGINT UNSIGNED NULL,
    approved_at         DATETIME NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_persona_status (status),
    INDEX idx_persona_archetype (archetype),
    CONSTRAINT fk_persona_invite   FOREIGN KEY (invite_id)   REFERENCES persona_invites(id) ON DELETE SET NULL,
    CONSTRAINT fk_persona_approver FOREIGN KEY (approved_by) REFERENCES users(id)           ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE persona_invites
    ADD CONSTRAINT fk_invite_persona FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE SET NULL;

CREATE TABLE simulation_sessions (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    owner_id        BIGINT UNSIGNED NOT NULL,
    title           VARCHAR(255) NULL,
    mode            ENUM('chat','discussion','apercept') NOT NULL DEFAULT 'chat',
    status          ENUM('active','paused','complete','archived') NOT NULL DEFAULT 'active',
    prompt          TEXT NULL,
    summary_md      MEDIUMTEXT NULL,
    metrics         JSON NULL,
    analysis_id     BIGINT UNSIGNED NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sess_owner (owner_id, created_at),
    INDEX idx_sess_mode (mode, status),
    CONSTRAINT fk_sess_owner    FOREIGN KEY (owner_id)    REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_sess_analysis FOREIGN KEY (analysis_id) REFERENCES analyses(id)  ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE simulation_participants (
    session_id      BIGINT UNSIGNED NOT NULL,
    persona_id      BIGINT UNSIGNED NOT NULL,
    role_in_session ENUM('participant','moderator','observer') NOT NULL DEFAULT 'participant',
    PRIMARY KEY (session_id, persona_id),
    CONSTRAINT fk_sp_session FOREIGN KEY (session_id) REFERENCES simulation_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_sp_persona FOREIGN KEY (persona_id) REFERENCES personas(id)           ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE simulation_messages (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id      BIGINT UNSIGNED NOT NULL,
    persona_id      BIGINT UNSIGNED NULL,
    speaker         VARCHAR(40) NOT NULL,
    phase           VARCHAR(30) NULL,
    content         MEDIUMTEXT NOT NULL,
    meta            JSON NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_msg_session (session_id, created_at),
    CONSTRAINT fk_msg_session FOREIGN KEY (session_id) REFERENCES simulation_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_persona FOREIGN KEY (persona_id) REFERENCES personas(id)           ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE apercept_runs (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    analysis_id         BIGINT UNSIGNED NULL,
    session_id          BIGINT UNSIGNED NULL,
    requested_by        BIGINT UNSIGNED NOT NULL,
    product_brief       TEXT NOT NULL,
    persona_count       INT UNSIGNED NOT NULL DEFAULT 0,
    adoption_pct        DECIMAL(5,2) NULL,
    avg_wtp_inr         DECIMAL(12,2) NULL,
    wtp_distribution    JSON NULL,
    sentiment_summary   JSON NULL,
    consensus_md        MEDIUMTEXT NULL,
    status              ENUM('queued','running','complete','failed') NOT NULL DEFAULT 'queued',
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at        DATETIME NULL,
    INDEX idx_apc_analysis (analysis_id),
    CONSTRAINT fk_apc_analysis FOREIGN KEY (analysis_id) REFERENCES analyses(id)            ON DELETE SET NULL,
    CONSTRAINT fk_apc_session  FOREIGN KEY (session_id)  REFERENCES simulation_sessions(id) ON DELETE SET NULL,
    CONSTRAINT fk_apc_user     FOREIGN KEY (requested_by) REFERENCES users(id)              ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE apercept_responses (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    run_id          BIGINT UNSIGNED NOT NULL,
    persona_id      BIGINT UNSIGNED NOT NULL,
    will_adopt      TINYINT(1) NULL,
    sentiment       ENUM('strong_pos','pos','neutral','neg','strong_neg') NULL,
    wtp_inr         DECIMAL(12,2) NULL,
    personal_view   MEDIUMTEXT NULL,
    discussion_pts  MEDIUMTEXT NULL,
    INDEX idx_apr_run (run_id),
    CONSTRAINT fk_apr_run     FOREIGN KEY (run_id)     REFERENCES apercept_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_apr_persona FOREIGN KEY (persona_id) REFERENCES personas(id)      ON DELETE CASCADE
) ENGINE=InnoDB;

-- Default settings for SAMAJ
INSERT INTO settings (key_name, value) VALUES ('samaj_simulation_paused', 'false');
INSERT INTO settings (key_name, value) VALUES ('samaj_persona_model',     '"us.amazon.nova-micro-v1:0"');
INSERT INTO settings (key_name, value) VALUES ('samaj_apercept_size',     '12');

-- Default model swap — Nova Micro is the new cheapest baseline.
UPDATE settings SET value = '"us.amazon.nova-micro-v1:0"' WHERE key_name = 'default_model';
