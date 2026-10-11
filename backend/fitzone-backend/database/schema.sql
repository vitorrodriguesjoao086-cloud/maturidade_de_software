CREATE DATABASE IF NOT EXISTS fitzone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fitzone;

CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'teacher') NOT NULL,
    phone VARCHAR(30) NULL,
    birth_date DATE NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_role (role),
    INDEX idx_users_name (name)
);

CREATE TABLE auth_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tokens_user (user_id),
    INDEX idx_tokens_expiration (expires_at)
);

CREATE TABLE exercises (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    muscle_group VARCHAR(80) NOT NULL,
    description TEXT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_exercises_group (muscle_group),
    INDEX idx_exercises_name (name)
);

CREATE TABLE workout_plans (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    created_by INT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    goal VARCHAR(150) NULL,
    status ENUM('draft', 'active', 'archived') NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_plans_student FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_plans_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_plans_student (user_id),
    INDEX idx_plans_status (status)
);

CREATE TABLE plan_exercises (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plan_id INT UNSIGNED NOT NULL,
    exercise_id INT UNSIGNED NOT NULL,
    day TINYINT UNSIGNED NOT NULL DEFAULT 1,
    sets SMALLINT UNSIGNED NULL,
    repetitions VARCHAR(50) NULL,
    duration_seconds INT UNSIGNED NULL,
    rest_seconds INT UNSIGNED NULL DEFAULT 60,
    load_value DECIMAL(8,2) NULL,
    notes VARCHAR(500) NULL,
    position INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_plan_exercises_plan FOREIGN KEY (plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE,
    CONSTRAINT fk_plan_exercises_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT,
    INDEX idx_plan_exercises_plan_day (plan_id, day, position)
);

INSERT INTO exercises (name, muscle_group, description) VALUES
('Supino reto com barra', 'Peito', 'Exercício para peitoral com barra.'),
('Supino inclinado com halteres', 'Peito', 'Exercício para peitoral superior.'),
('Puxada frontal', 'Costas', 'Puxada na polia alta para dorsais.'),
('Remada baixa', 'Costas', 'Remada sentada na polia.'),
('Agachamento livre', 'Pernas', 'Agachamento com barra.'),
('Leg press 45°', 'Pernas', 'Exercício para quadríceps e glúteos.'),
('Cadeira extensora', 'Pernas', 'Extensão de joelhos na máquina.'),
('Mesa flexora', 'Pernas', 'Flexão de joelhos na máquina.'),
('Desenvolvimento com halteres', 'Ombros', 'Desenvolvimento para deltoides.'),
('Elevação lateral', 'Ombros', 'Abdução de ombros com halteres.'),
('Rosca direta', 'Bíceps', 'Flexão de cotovelos com barra.'),
('Tríceps na polia', 'Tríceps', 'Extensão de cotovelos na polia.'),
('Prancha', 'Abdômen', 'Exercício isométrico para core.'),
('Abdominal supra', 'Abdômen', 'Flexão de tronco no solo.'),
('Esteira', 'Cardio', 'Caminhada ou corrida na esteira.');

-- Usuários de desenvolvimento.
-- Senha de ambos: password
INSERT INTO users (name, email, password_hash, role, phone) VALUES
('Professor Demo', 'professor@fitzone.local', '$2y$12$U7sq1k.KI6syvLagWnMkDu1ZeI.AQIsB511kdK4SuiMteu73Agqje', 'teacher', '(81) 99999-0000'),
('Aluno Demo', 'aluno@fitzone.local', '$2y$12$U7sq1k.KI6syvLagWnMkDu1ZeI.AQIsB511kdK4SuiMteu73Agqje', 'student', '(81) 99999-1111');
