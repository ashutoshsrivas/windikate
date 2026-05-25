-- =====================================================================
-- Windikate · Investment Analysis Workflow
-- MySQL 8 schema
-- =====================================================================

CREATE DATABASE IF NOT EXISTS windikate_analysis
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE windikate_analysis;

-- ---------- Analysts -------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(190) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(120) NULL,             -- "What would Windikate call you"
    role            ENUM('vc_analyst','investment_associate','incubator_manager','angel_investor') NULL,
    focus_areas     JSON NULL,                     -- ["b2b_saas","fintech",...]
    onboarded_at    DATETIME NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Optional firm benchmarks (Phase 1, step 2) ----------------
CREATE TABLE IF NOT EXISTS user_benchmarks (
    user_id              BIGINT UNSIGNED PRIMARY KEY,
    preseed_arr_min_inr  BIGINT NULL,
    preseed_arr_max_inr  BIGINT NULL,
    cac_ltv_ratio        DECIMAL(4,2) NULL,        -- e.g. 1:3 stored as 3.00
    extras               JSON NULL,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_bench_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Analyses (one per upload) ---------------------------------
CREATE TABLE IF NOT EXISTS analyses (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id           BIGINT UNSIGNED NOT NULL,
    company_name      VARCHAR(190) NULL,
    stage             VARCHAR(60)  NULL,
    deck_path         VARCHAR(500) NULL,
    financials_path   VARCHAR(500) NULL,
    apercept_enabled  TINYINT(1) NOT NULL DEFAULT 0,
    status            ENUM('queued','processing','complete','failed') NOT NULL DEFAULT 'queued',
    progress          JSON NULL,                    -- step-by-step progress for UI
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at      DATETIME NULL,
    CONSTRAINT fk_an_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_an_user_created (user_id, created_at)
) ENGINE=InnoDB;

-- ---------- Schema-mapped financial metrics ---------------------------
CREATE TABLE IF NOT EXISTS analysis_metrics (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    analysis_id   BIGINT UNSIGNED NOT NULL,
    metric_key    VARCHAR(60) NOT NULL,         -- 'TAM','CAC','LTV','runway','burn'
    value_text    VARCHAR(190) NULL,
    value_number  DECIMAL(20,4) NULL,
    unit          VARCHAR(30) NULL,
    source_slide  VARCHAR(60) NULL,
    confidence    ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
    is_missing    TINYINT(1) NOT NULL DEFAULT 0,
    CONSTRAINT fk_metric_an FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE,
    INDEX idx_metric_an (analysis_id)
) ENGINE=InnoDB;

-- ---------- Deviations from benchmark ---------------------------------
CREATE TABLE IF NOT EXISTS deviations (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    analysis_id         BIGINT UNSIGNED NOT NULL,
    metric_key          VARCHAR(60) NOT NULL,
    title               VARCHAR(190) NOT NULL,
    description         TEXT NULL,
    severity            ENUM('red','yellow','green') NOT NULL,    -- system-computed
    edited_severity     ENUM('red','yellow','green') NULL,        -- analyst-overridden OK standard
    benchmark_label     VARCHAR(120) NULL,         -- e.g. "Gartner 2025"
    benchmark_value     VARCHAR(120) NULL,
    benchmark_url       VARCHAR(500) NULL,
    analyst_citation    TEXT NULL,                 -- analyst-added justification
    source_slide        VARCHAR(60) NULL,
    edited_by           BIGINT UNSIGNED NULL,
    edited_at           DATETIME NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_an FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE,
    CONSTRAINT fk_dev_edit FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_dev_an (analysis_id)
) ENGINE=InnoDB;

-- ---------- Competitor intelligence -----------------------------------
CREATE TABLE IF NOT EXISTS competitors (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    analysis_id     BIGINT UNSIGNED NOT NULL,
    name            VARCHAR(190) NOT NULL,
    relation        ENUM('direct','indirect') NOT NULL DEFAULT 'direct',
    funding_usd     BIGINT NULL,
    monthly_traffic BIGINT NULL,
    features        JSON NULL,
    website         VARCHAR(500) NULL,
    notes           TEXT NULL,
    CONSTRAINT fk_comp_an FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE,
    INDEX idx_comp_an (analysis_id)
) ENGINE=InnoDB;

-- ---------- Meeting-prep questions ------------------------------------
CREATE TABLE IF NOT EXISTS questions (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    analysis_id     BIGINT UNSIGNED NOT NULL,
    deviation_id    BIGINT UNSIGNED NULL,
    text            TEXT NOT NULL,
    category        VARCHAR(60) NULL,            -- 'unit_economics','gtm','defensibility'...
    priority        ENUM('critical','important','nice_to_know') NOT NULL DEFAULT 'important',
    custom_edit     TINYINT(1) NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_q_an FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE,
    CONSTRAINT fk_q_dev FOREIGN KEY (deviation_id) REFERENCES deviations(id) ON DELETE SET NULL,
    INDEX idx_q_an (analysis_id)
) ENGINE=InnoDB;

-- ---------- Apercept AI simulation results ----------------------------
CREATE TABLE IF NOT EXISTS apercept_simulations (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    analysis_id     BIGINT UNSIGNED NOT NULL,
    adoption_rate   DECIMAL(5,2) NULL,             -- 0.00–100.00
    criticism       JSON NULL,
    feedback_loops  JSON NULL,
    personas        JSON NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_apc_an FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Generated memos -------------------------------------------
CREATE TABLE IF NOT EXISTS memos (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    analysis_id     BIGINT UNSIGNED NOT NULL,
    format          ENUM('mckinsey','bcg','yc','custom') NOT NULL,
    include_options JSON NULL,
    recommendation  ENUM('pass','deep_dive','partner_meeting') NULL,
    content         LONGTEXT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_memo_an FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
) ENGINE=InnoDB;
