<?php
require_once __DIR__ . '/BaseModel.php';

class SistemasDominioCom extends BaseModel {
    protected $table = 'sistemas_dominio_com';

    public function __construct($db) {
        parent::__construct($db);
        $this->ensureStatusEnum();
    }

    public function normalizeDomainName(string $input): string {
        $domain = strtolower(trim($input));
        $domain = preg_replace('/\.com$/', '', $domain);
        $domain = preg_replace('/[^a-z0-9-]/', '', $domain);

        if (strlen($domain) < 2 || strlen($domain) > 63) {
            throw new Exception('Nome de domínio deve ter entre 2 e 63 caracteres');
        }

        if (!preg_match('/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/', $domain)) {
            throw new Exception('Nome de domínio inválido. Use letras, números e hífen (sem iniciar/finalizar com hífen)');
        }

        return $domain;
    }

    public function buildFullDomain(string $domainName): string {
        return $domainName . '.com';
    }

    public function findByDomain(string $fullDomain): ?array {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE dominio_completo = ? LIMIT 1");
        $stmt->execute([$fullDomain]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findByIdForUser(int $id, int $userId): ?array {
        $stmt = $this->db->prepare(
            "SELECT id, module_id, user_id, nome_solicitante, dominio_nome, dominio_completo, status, valor_cobrado, desconto_aplicado, saldo_usado, created_at, updated_at
             FROM {$this->table}
             WHERE id = ? AND user_id = ?
             LIMIT 1"
        );
        $stmt->execute([$id, $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function checkAvailability(string $domainInput): array {
        $domainName = $this->normalizeDomainName($domainInput);
        $fullDomain = $this->buildFullDomain($domainName);
        $existing = $this->findByDomain($fullDomain);

        return [
            'dominio_nome' => $domainName,
            'dominio_completo' => $fullDomain,
            'disponivel' => !$existing,
            'registro' => $existing,
        ];
    }

    public function listByUser(int $userId, int $limit = 50, int $offset = 0): array {
        $stmt = $this->db->prepare(
            "SELECT id, module_id, user_id, nome_solicitante, dominio_nome, dominio_completo, status, valor_cobrado, desconto_aplicado, saldo_usado, created_at, updated_at
             FROM {$this->table}
             WHERE user_id = ?
             ORDER BY id DESC
             LIMIT ? OFFSET ?"
        );
        $stmt->execute([$userId, $limit, $offset]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function countByUser(int $userId): int {
        $stmt = $this->db->prepare("SELECT COUNT(*) as count FROM {$this->table} WHERE user_id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)($row['count'] ?? 0);
    }

    public function listForAdmin(?string $status, ?string $search, int $limit = 50, int $offset = 0): array {
        $where = [];
        $params = [];

        if ($status && in_array($status, ['registrado', 'em_propagacao', 'finalizado', 'cancelado'], true)) {
            $where[] = 'status = ?';
            $params[] = $status;
        }

        if ($search) {
            $where[] = '(nome_solicitante LIKE ? OR dominio_nome LIKE ? OR dominio_completo LIKE ?)';
            $like = '%' . trim($search) . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $whereSql = !empty($where) ? ('WHERE ' . implode(' AND ', $where)) : '';

        $stmt = $this->db->prepare(
            "SELECT id, module_id, user_id, nome_solicitante, dominio_nome, dominio_completo, status, valor_cobrado, desconto_aplicado, saldo_usado, created_at, updated_at
             FROM {$this->table}
             {$whereSql}
             ORDER BY id DESC
             LIMIT ? OFFSET ?"
        );

        $params[] = $limit;
        $params[] = $offset;
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function countForAdmin(?string $status, ?string $search): int {
        $where = [];
        $params = [];

        if ($status && in_array($status, ['registrado', 'cancelado'], true)) {
            $where[] = 'status = ?';
            $params[] = $status;
        }

        if ($search) {
            $where[] = '(nome_solicitante LIKE ? OR dominio_nome LIKE ? OR dominio_completo LIKE ?)';
            $like = '%' . trim($search) . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $whereSql = !empty($where) ? ('WHERE ' . implode(' AND ', $where)) : '';
        $stmt = $this->db->prepare("SELECT COUNT(*) as count FROM {$this->table} {$whereSql}");
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return (int)($row['count'] ?? 0);
    }

    public function cancelById(int $id): bool {
        $stmt = $this->db->prepare("UPDATE {$this->table} SET status = 'cancelado', updated_at = NOW() WHERE id = ? AND status <> 'cancelado'");
        return $stmt->execute([$id]);
    }

    public function registerDomain(array $data, int $userId): array {
        $nomeSolicitante = trim((string)($data['nome_solicitante'] ?? ''));
        if ($nomeSolicitante === '' || strlen($nomeSolicitante) > 150) {
            throw new Exception('Nome do solicitante é obrigatório e deve ter até 150 caracteres');
        }

        $moduleId = (int)($data['module_id'] ?? 176);
        $availability = $this->checkAvailability((string)($data['dominio_nome'] ?? ''));

        if (!$availability['disponivel']) {
            throw new Exception('Este domínio já está registrado');
        }

        $this->db->beginTransaction();

        try {
            $lockStmt = $this->db->prepare("SELECT id FROM {$this->table} WHERE dominio_completo = ? FOR UPDATE");
            $lockStmt->execute([$availability['dominio_completo']]);
            if ($lockStmt->fetch(PDO::FETCH_ASSOC)) {
                throw new Exception('Este domínio acabou de ser registrado por outro usuário');
            }

            $moduleStmt = $this->db->prepare("SELECT price FROM modules WHERE id = ? LIMIT 1");
            $moduleStmt->execute([$moduleId]);
            $moduleData = $moduleStmt->fetch(PDO::FETCH_ASSOC);
            $precoOriginal = (float)($moduleData['price'] ?? 0);
            if ($precoOriginal <= 0) {
                throw new Exception('Preço do módulo não configurado');
            }

            $userStmt = $this->db->prepare("SELECT saldo, saldo_plano, tipoplano FROM users WHERE id = ? LIMIT 1 FOR UPDATE");
            $userStmt->execute([$userId]);
            $userData = $userStmt->fetch(PDO::FETCH_ASSOC);
            if (!$userData) {
                throw new Exception('Usuário não encontrado');
            }

            $planName = trim((string)($userData['tipoplano'] ?? 'Pré-Pago'));
            $discountPercent = $this->resolveDiscountPercent($userId, $planName);
            $descontoValor = round(($precoOriginal * $discountPercent) / 100, 2);
            $valorFinal = round(max($precoOriginal - $descontoValor, 0.01), 2);

            $saldoPlano = (float)($userData['saldo_plano'] ?? 0);
            $saldoCarteira = (float)($userData['saldo'] ?? 0);
            $saldoTotal = $saldoPlano + $saldoCarteira;

            if ($saldoTotal < $valorFinal) {
                throw new Exception('Saldo insuficiente. Necessário: R$ ' . number_format($valorFinal, 2, ',', '.'));
            }

            $debitoPlano = min($saldoPlano, $valorFinal);
            $debitoCarteira = round($valorFinal - $debitoPlano, 2);

            $novoSaldoPlano = round($saldoPlano - $debitoPlano, 2);
            $novoSaldoCarteira = round($saldoCarteira - $debitoCarteira, 2);

            $saldoUsado = 'carteira';
            if ($debitoPlano > 0 && $debitoCarteira > 0) {
                $saldoUsado = 'misto';
            } elseif ($debitoPlano > 0) {
                $saldoUsado = 'plano';
            }

            $insertStmt = $this->db->prepare(
                "INSERT INTO {$this->table}
                (module_id, user_id, nome_solicitante, dominio_nome, dominio_completo, status, valor_cobrado, desconto_aplicado, saldo_usado, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'registrado', ?, ?, ?, NOW(), NOW())"
            );
            $insertStmt->execute([
                $moduleId,
                $userId,
                $nomeSolicitante,
                $availability['dominio_nome'],
                $availability['dominio_completo'],
                $valorFinal,
                $descontoValor,
                $saldoUsado,
            ]);

            $registroId = (int)$this->db->lastInsertId();

            $updateUserStmt = $this->db->prepare("UPDATE users SET saldo = ?, saldo_plano = ?, saldo_atualizado = 1, updated_at = NOW() WHERE id = ?");
            $updateUserStmt->execute([$novoSaldoCarteira, $novoSaldoPlano, $userId]);

            $this->syncUserWalletBalance($userId, 'main', $novoSaldoCarteira);
            $this->syncUserWalletBalance($userId, 'plan', $novoSaldoPlano);

            $description = "Registro domínio .COM: {$availability['dominio_completo']}";

            if ($debitoPlano > 0) {
                $this->insertWalletTransaction(
                    $userId,
                    'plan',
                    -$debitoPlano,
                    $saldoPlano,
                    $novoSaldoPlano,
                    $description,
                    $registroId
                );
            }

            if ($debitoCarteira > 0) {
                $this->insertWalletTransaction(
                    $userId,
                    'main',
                    -$debitoCarteira,
                    $saldoCarteira,
                    $novoSaldoCarteira,
                    $description,
                    $registroId
                );
            }

            $consultationStmt = $this->db->prepare(
                "INSERT INTO consultations
                (user_id, module_type, document, cost, result_data, status, ip_address, user_agent, metadata, created_at, updated_at)
                VALUES (?, 'sistemas_dominio_com', ?, ?, NULL, 'completed', ?, ?, ?, NOW(), NOW())"
            );

            $metadata = json_encode([
                'source' => 'sistemas-dominio-com',
                'module_id' => $moduleId,
                'registro_id' => $registroId,
                'dominio' => $availability['dominio_completo'],
                'saldo_usado' => $saldoUsado,
                'desconto_aplicado' => $descontoValor,
                'preco_original' => $precoOriginal,
                'valor_final' => $valorFinal,
                'timestamp' => date('c'),
            ], JSON_UNESCAPED_UNICODE);

            $consultationStmt->execute([
                $userId,
                $availability['dominio_completo'],
                $valorFinal,
                $_SERVER['REMOTE_ADDR'] ?? null,
                $_SERVER['HTTP_USER_AGENT'] ?? null,
                $metadata,
            ]);

            $this->db->commit();

            return [
                'id' => $registroId,
                'dominio_nome' => $availability['dominio_nome'],
                'dominio_completo' => $availability['dominio_completo'],
                'valor_cobrado' => $valorFinal,
                'desconto_aplicado' => $descontoValor,
                'saldo_usado' => $saldoUsado,
                'saldo_restante' => [
                    'saldo' => $novoSaldoCarteira,
                    'saldo_plano' => $novoSaldoPlano,
                    'total' => round($novoSaldoCarteira + $novoSaldoPlano, 2),
                ],
            ];
        } catch (Exception $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    private function resolveDiscountPercent(int $userId, string $planName): float {
        // 1) Plano ativo do usuário (fonte prioritária)
        $activePlanStmt = $this->db->prepare(
            "SELECT p.discount_percentage
             FROM user_subscriptions us
             INNER JOIN plans p ON p.id = us.plan_id
             WHERE us.user_id = ? AND us.status = 'active'
             ORDER BY us.id DESC
             LIMIT 1"
        );
        $activePlanStmt->execute([$userId]);
        $activePlanDiscount = $activePlanStmt->fetchColumn();
        if ($activePlanDiscount !== false && $activePlanDiscount !== null) {
            return max(0, (float)$activePlanDiscount);
        }

        // 2) Fallback por nome do plano na tabela plans
        if ($planName !== '') {
            $planByNameStmt = $this->db->prepare("SELECT discount_percentage FROM plans WHERE name = ? LIMIT 1");
            $planByNameStmt->execute([$planName]);
            $planByNameDiscount = $planByNameStmt->fetchColumn();
            if ($planByNameDiscount !== false && $planByNameDiscount !== null) {
                return max(0, (float)$planByNameDiscount);
            }
        }

        // 3) Legado: planos antigos
        $legacyDiscountMap = [
            'Pré-Pago' => 0,
            'Rainha de Ouros' => 5,
            'Rainha de Paus' => 10,
            'Rainha de Copas' => 15,
            'Rainha de Espadas' => 20,
            'Rei de Ouros' => 20,
            'Rei de Paus' => 30,
            'Rei de Copas' => 40,
            'Rei de Espadas' => 50,
            'CONSULTA VIP' => 5,
            'CONSULTA PRO' => 10,
            'CONSULTA PLUS' => 15,
            'CONSULTA PRIME' => 25,
        ];

        return max(0, (float)($legacyDiscountMap[$planName] ?? 0));
    }

    private function syncUserWalletBalance(int $userId, string $walletType, float $newBalance): void {
        $stmt = $this->db->prepare(
            "INSERT INTO user_wallets (user_id, wallet_type, current_balance, available_balance, status, total_deposited, total_spent, last_transaction_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'active', 0, 0, NOW(), NOW(), NOW())
             ON DUPLICATE KEY UPDATE
                current_balance = VALUES(current_balance),
                available_balance = VALUES(available_balance),
                last_transaction_at = NOW(),
                updated_at = NOW()"
        );

        $stmt->execute([$userId, $walletType, $newBalance, $newBalance]);
    }

    private function insertWalletTransaction(
        int $userId,
        string $walletType,
        float $amount,
        float $balanceBefore,
        float $balanceAfter,
        string $description,
        int $referenceId
    ): void {
        $stmt = $this->db->prepare(
            "INSERT INTO wallet_transactions
            (user_id, wallet_type, type, amount, balance_before, balance_after, description, payment_method, reference_type, reference_id, status, created_at, updated_at)
            VALUES (?, ?, 'consulta', ?, ?, ?, ?, 'saldo', 'sistemas_dominio_com', ?, 'completed', NOW(), NOW())"
        );

        $stmt->execute([
            $userId,
            $walletType,
            $amount,
            $balanceBefore,
            $balanceAfter,
            $description,
            $referenceId,
        ]);
    }
}
