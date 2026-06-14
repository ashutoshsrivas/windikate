-- 001 · Admin panel groundwork
-- Renames legacy users.role (profession) -> users.profession,
-- adds a new role column for admin/analyst, plus settings + usage_events.

ALTER TABLE users CHANGE COLUMN role profession
    ENUM('vc_analyst','investment_associate','incubator_manager','angel_investor') NULL;

ALTER TABLE users
    ADD COLUMN role                ENUM('analyst','admin') NOT NULL DEFAULT 'analyst' AFTER display_name,
    ADD COLUMN allowed_models      JSON   NULL                                         AFTER role,
    ADD COLUMN monthly_spend_cents BIGINT UNSIGNED NOT NULL DEFAULT 0                  AFTER allowed_models,
    ADD COLUMN monthly_cap_cents   BIGINT UNSIGNED NULL                                AFTER monthly_spend_cents;

CREATE TABLE settings (
    key_name   VARCHAR(64) PRIMARY KEY,
    value      JSON NOT NULL,
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO settings (key_name, value) VALUES ('default_model', JSON_QUOTE('us.anthropic.claude-3-5-haiku-20241022-v1:0'));
INSERT INTO settings (key_name, value) VALUES ('bedrock_enabled', CAST('true' AS JSON));
INSERT INTO settings (key_name, value) VALUES ('monthly_cap_cents', CAST('5000' AS JSON));

CREATE TABLE usage_events (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id           BIGINT UNSIGNED NULL,
    analysis_id       BIGINT UNSIGNED NULL,
    service           VARCHAR(40) NOT NULL,
    model_id          VARCHAR(120) NOT NULL,
    input_tokens      INT UNSIGNED NULL,
    output_tokens     INT UNSIGNED NULL,
    input_cost_cents  INT UNSIGNED NULL,
    output_cost_cents INT UNSIGNED NULL,
    total_cost_cents  INT UNSIGNED NULL,
    success           TINYINT(1) NOT NULL DEFAULT 1,
    error_code        VARCHAR(60) NULL,
    duration_ms       INT UNSIGNED NULL,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usage_user     FOREIGN KEY (user_id)     REFERENCES users(id)    ON DELETE SET NULL,
    CONSTRAINT fk_usage_analysis FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE SET NULL,
    INDEX idx_usage_user_time (user_id, created_at),
    INDEX idx_usage_time      (created_at),
    INDEX idx_usage_analysis  (analysis_id)
) ENGINE=InnoDB;

UPDATE users SET role = 'admin' WHERE email = 'demo@windikate.com';
