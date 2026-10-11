<?php

declare(strict_types=1);

return [
    'db' => [
        'host' => getenv('DB_HOST') ?: '127.0.0.1',
        'port' => getenv('DB_PORT') ?: '3306',
        'name' => getenv('DB_NAME') ?: 'fitzone',
        'user' => getenv('DB_USER') ?: 'root',
        'pass' => getenv('DB_PASS') ?: '',
        'charset' => 'utf8mb4',
    ],
    'app' => [
        'cors_origin' => getenv('CORS_ORIGIN') ?: '*',
        'token_ttl_hours' => (int) (getenv('TOKEN_TTL_HOURS') ?: 24),
    ],
];
