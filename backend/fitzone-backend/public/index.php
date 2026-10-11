<?php

declare(strict_types=1);

$config = require __DIR__ . '/../config/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . $config['app']['cors_origin']);
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function db(): PDO
{
    static $pdo = null;
    global $config;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $d = $config['db'];
    $dsn = "mysql:host={$d['host']};port={$d['port']};dbname={$d['name']};charset={$d['charset']}";
    $pdo = new PDO($dsn, $d['user'], $d['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

function jsonInput(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        errorResponse('JSON inválido.', 400);
    }

    return $data;
}

function respond(mixed $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function errorResponse(string $message, int $status = 400, array $details = []): never
{
    http_response_code($status);
    echo json_encode([
        'success' => false,
        'error' => ['message' => $message, 'details' => $details],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function pathSegments(): array
{
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
    $path = preg_replace('#^/api#', '', $path);
    return array_values(array_filter(explode('/', trim($path, '/')), 'strlen'));
}

function bearerToken(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(\S+)/i', $header, $m)) {
        return $m[1];
    }
    return null;
}

function authUser(): array
{
    $token = bearerToken();
    if (!$token) {
        errorResponse('Token de autenticação não informado.', 401);
    }

    $stmt = db()->prepare(
        'SELECT u.id, u.name, u.email, u.role, u.phone, u.birth_date, u.active
         FROM auth_tokens t
         INNER JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = SHA2(?, 256)
           AND t.expires_at > NOW()
           AND u.active = 1'
    );
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        errorResponse('Token inválido ou expirado.', 401);
    }

    return $user;
}

function requireRole(string ...$roles): array
{
    $user = authUser();
    if (!in_array($user['role'], $roles, true)) {
        errorResponse('Você não tem permissão para esta operação.', 403);
    }
    return $user;
}

function userPublic(array $user): array
{
    unset($user['active']);
    return $user;
}

function validateRequired(array $data, array $fields): void
{
    foreach ($fields as $field) {
        if (!isset($data[$field]) || trim((string)$data[$field]) === '') {
            errorResponse("O campo '{$field}' é obrigatório.", 422);
        }
    }
}

function findUser(int $id): ?array
{
    $stmt = db()->prepare('SELECT id, name, email, role, phone, birth_date, active, created_at FROM users WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

function findPlan(int $id): ?array
{
    $stmt = db()->prepare(
        'SELECT p.id, p.user_id, p.created_by, p.name, p.description, p.goal, p.status,
                p.created_at, p.updated_at,
                u.name AS student_name,
                c.name AS created_by_name
         FROM workout_plans p
         INNER JOIN users u ON u.id = p.user_id
         INNER JOIN users c ON c.id = p.created_by
         WHERE p.id = ?'
    );
    $stmt->execute([$id]);
    $plan = $stmt->fetch();
    if (!$plan) return null;

    $stmt = db()->prepare(
        'SELECT pe.id, pe.exercise_id, e.name, e.muscle_group, e.description,
                pe.day, pe.sets, pe.repetitions, pe.duration_seconds, pe.rest_seconds,
                pe.load_value, pe.notes, pe.position
         FROM plan_exercises pe
         INNER JOIN exercises e ON e.id = pe.exercise_id
         WHERE pe.plan_id = ?
         ORDER BY pe.day, pe.position, pe.id'
    );
    $stmt->execute([$id]);
    $plan['exercises'] = $stmt->fetchAll();
    return $plan;
}

$method = $_SERVER['REQUEST_METHOD'];
$segments = pathSegments();
$resource = $segments[0] ?? '';
$id = isset($segments[1]) && ctype_digit($segments[1]) ? (int)$segments[1] : null;
$subresource = $segments[2] ?? null;

try {
    // API root / welcome
    if ($method === 'GET' && $resource === '') {
        respond([
            'service' => 'FITZONE API',
            'status' => 'ok',
            'message' => 'Backend em execução.',
            'endpoints' => [
                'GET /health',
                'POST /auth/register',
                'POST /auth/login',
                'GET /me',
                'GET /students',
                'GET /plans',
                'GET /exercises',
            ],
        ]);
    }

    // Health check
    if ($method === 'GET' && $resource === 'health') {
        respond(['status' => 'ok', 'service' => 'FITZONE API']);
    }

    // Authentication
    if ($resource === 'auth' && ($segments[1] ?? '') === 'register' && $method === 'POST') {
        $data = jsonInput();
        validateRequired($data, ['name', 'email', 'password', 'role']);

        $role = $data['role'];
        if (!in_array($role, ['student', 'teacher'], true)) {
            errorResponse('Role deve ser student ou teacher.', 422);
        }
        if (strlen((string)$data['password']) < 6) {
            errorResponse('A senha deve ter pelo menos 6 caracteres.', 422);
        }

        $stmt = db()->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([strtolower(trim($data['email']))]);
        if ($stmt->fetch()) {
            errorResponse('Este e-mail já está cadastrado.', 409);
        }

        $stmt = db()->prepare(
            'INSERT INTO users (name, email, password_hash, role, phone, birth_date) VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            trim($data['name']),
            strtolower(trim($data['email'])),
            password_hash($data['password'], PASSWORD_DEFAULT),
            $role,
            $data['phone'] ?? null,
            $data['birth_date'] ?? null,
        ]);

        respond(userPublic(findUser((int)db()->lastInsertId())), 201);
    }

    if ($resource === 'auth' && ($segments[1] ?? '') === 'login' && $method === 'POST') {
        $data = jsonInput();
        validateRequired($data, ['email', 'password']);

        $stmt = db()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([strtolower(trim($data['email']))]);
        $user = $stmt->fetch();

        if (!$user || !$user['active'] || !password_verify($data['password'], $user['password_hash'])) {
            errorResponse('E-mail ou senha inválidos.', 401);
        }

        $token = bin2hex(random_bytes(32));
        $hours = max(1, $config['app']['token_ttl_hours']);
        $expiresAt = (new DateTimeImmutable("+{$hours} hours"))->format('Y-m-d H:i:s');

        $stmt = db()->prepare('INSERT INTO auth_tokens (user_id, token_hash, expires_at) VALUES (?, SHA2(?, 256), ?)');
        $stmt->execute([$user['id'], $token, $expiresAt]);

        unset($user['password_hash'], $user['active']);
        respond([
            'token' => $token,
            'expires_at' => $expiresAt,
            'user' => $user,
        ]);
    }

    if ($resource === 'auth' && ($segments[1] ?? '') === 'logout' && $method === 'POST') {
        $token = bearerToken();
        if ($token) {
            $stmt = db()->prepare('DELETE FROM auth_tokens WHERE token_hash = SHA2(?, 256)');
            $stmt->execute([$token]);
        }
        respond(['message' => 'Logout realizado.']);
    }

    // Current user
    if ($resource === 'me' && $method === 'GET') {
        respond(userPublic(authUser()));
    }

    // Students - professor only
    if ($resource === 'students') {
        $teacher = requireRole('teacher');

        if ($method === 'GET' && $id === null) {
            $q = trim($_GET['q'] ?? '');
            $sql = 'SELECT id, name, email, phone, birth_date, created_at FROM users WHERE role = "student" AND active = 1';
            $params = [];
            if ($q !== '') {
                $sql .= ' AND (name LIKE ? OR email LIKE ?)';
                $params = ["%{$q}%", "%{$q}%"];
            }
            $sql .= ' ORDER BY name';
            $stmt = db()->prepare($sql);
            $stmt->execute($params);
            respond($stmt->fetchAll());
        }

        if ($method === 'GET' && $id !== null) {
            $student = findUser($id);
            if (!$student || $student['role'] !== 'student') {
                errorResponse('Aluno não encontrado.', 404);
            }

            $stmt = db()->prepare('SELECT id, name, description, goal, status, created_at, updated_at FROM workout_plans WHERE user_id = ? ORDER BY created_at DESC');
            $stmt->execute([$id]);
            $student['plans'] = $stmt->fetchAll();
            respond(userPublic($student));
        }
    }

    // Exercise catalog
    if ($resource === 'exercises') {
        authUser();
        if ($method === 'GET') {
            $group = trim($_GET['muscle_group'] ?? '');
            if ($group !== '') {
                $stmt = db()->prepare('SELECT id, name, muscle_group, description FROM exercises WHERE active = 1 AND muscle_group = ? ORDER BY name');
                $stmt->execute([$group]);
            } else {
                $stmt = db()->query('SELECT id, name, muscle_group, description FROM exercises WHERE active = 1 ORDER BY muscle_group, name');
            }
            respond($stmt->fetchAll());
        }
    }

    // Workout plans
    if ($resource === 'plans') {
        $user = authUser();

        if ($method === 'GET' && $id === null) {
            if ($user['role'] === 'student') {
                $stmt = db()->prepare('SELECT id, name, description, goal, status, created_at, updated_at FROM workout_plans WHERE user_id = ? ORDER BY created_at DESC');
                $stmt->execute([$user['id']]);
            } else {
                $stmt = db()->prepare(
                    'SELECT p.id, p.name, p.description, p.goal, p.status, p.created_at, p.updated_at,
                            u.id AS user_id, u.name AS student_name
                     FROM workout_plans p INNER JOIN users u ON u.id = p.user_id
                     ORDER BY p.updated_at DESC'
                );
                $stmt->execute();
            }
            respond($stmt->fetchAll());
        }

        if ($method === 'GET' && $id !== null) {
            $plan = findPlan($id);
            if (!$plan) errorResponse('Plano não encontrado.', 404);
            if ($user['role'] === 'student' && (int)$plan['user_id'] !== (int)$user['id']) {
                errorResponse('Você não pode acessar este plano.', 403);
            }
            respond($plan);
        }

        if ($method === 'POST' && $id === null) {
            $data = jsonInput();
            validateRequired($data, ['name']);

            $studentId = $user['role'] === 'student' ? (int)$user['id'] : (int)($data['user_id'] ?? 0);
            if ($studentId <= 0) errorResponse('Informe user_id do aluno.', 422);
            $student = findUser($studentId);
            if (!$student || $student['role'] !== 'student') errorResponse('Aluno inválido.', 422);

            $stmt = db()->prepare(
                'INSERT INTO workout_plans (user_id, created_by, name, description, goal, status) VALUES (?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $studentId,
                $user['id'],
                trim($data['name']),
                $data['description'] ?? null,
                $data['goal'] ?? null,
                $data['status'] ?? 'draft',
            ]);

            respond(findPlan((int)db()->lastInsertId()), 201);
        }

        if ($method === 'PUT' && $id !== null) {
            $plan = findPlan($id);
            if (!$plan) errorResponse('Plano não encontrado.', 404);
            if ($user['role'] === 'student' && (int)$plan['user_id'] !== (int)$user['id']) {
                errorResponse('Você não pode editar este plano.', 403);
            }

            $data = jsonInput();
            $allowedStatus = ['draft', 'active', 'archived'];
            $status = $data['status'] ?? $plan['status'];
            if (!in_array($status, $allowedStatus, true)) errorResponse('Status inválido.', 422);

            $stmt = db()->prepare('UPDATE workout_plans SET name = ?, description = ?, goal = ?, status = ? WHERE id = ?');
            $stmt->execute([
                $data['name'] ?? $plan['name'],
                $data['description'] ?? $plan['description'],
                $data['goal'] ?? $plan['goal'],
                $status,
                $id,
            ]);
            respond(findPlan($id));
        }

        // Add exercise to plan: POST /plans/{id}/exercises
        if ($method === 'POST' && $id !== null && $subresource === 'exercises') {
            $plan = findPlan($id);
            if (!$plan) errorResponse('Plano não encontrado.', 404);
            if ($user['role'] === 'student' && (int)$plan['user_id'] !== (int)$user['id']) {
                errorResponse('Você não pode editar este plano.', 403);
            }

            $data = jsonInput();
            validateRequired($data, ['exercise_id']);
            $exerciseId = (int)$data['exercise_id'];

            $stmt = db()->prepare('SELECT id FROM exercises WHERE id = ? AND active = 1');
            $stmt->execute([$exerciseId]);
            if (!$stmt->fetch()) errorResponse('Exercício não encontrado.', 404);

            $stmt = db()->prepare(
                'INSERT INTO plan_exercises
                (plan_id, exercise_id, day, sets, repetitions, duration_seconds, rest_seconds, load_value, notes, position)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $id,
                $exerciseId,
                $data['day'] ?? 1,
                $data['sets'] ?? null,
                $data['repetitions'] ?? null,
                $data['duration_seconds'] ?? null,
                $data['rest_seconds'] ?? 60,
                $data['load_value'] ?? null,
                $data['notes'] ?? null,
                $data['position'] ?? 0,
            ]);

            respond(findPlan($id), 201);
        }

        // Remove exercise from plan: DELETE /plans/{planId}/exercises/{planExerciseId}
        if ($method === 'DELETE' && $id !== null && $subresource === 'exercises' && isset($segments[3]) && ctype_digit($segments[3])) {
            $plan = findPlan($id);
            if (!$plan) errorResponse('Plano não encontrado.', 404);
            if ($user['role'] === 'student' && (int)$plan['user_id'] !== (int)$user['id']) {
                errorResponse('Você não pode editar este plano.', 403);
            }

            $planExerciseId = (int)$segments[3];
            $stmt = db()->prepare('DELETE FROM plan_exercises WHERE id = ? AND plan_id = ?');
            $stmt->execute([$planExerciseId, $id]);
            if ($stmt->rowCount() === 0) errorResponse('Exercício não encontrado neste plano.', 404);
            respond(findPlan($id));
        }
    }

    errorResponse('Rota não encontrada.', 404);
} catch (PDOException $e) {
    errorResponse('Erro de banco de dados.', 500, ['message' => $e->getMessage()]);
} catch (Throwable $e) {
    errorResponse('Erro interno do servidor.', 500, ['message' => $e->getMessage()]);
}
