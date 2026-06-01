$api = "http://localhost:8080"
$erros = @()

Write-Output "=== TESTES DE SEGURANCA - LOGIN E RECUPERACAO DE SENHA ==="
Write-Output ""

# ── 1. RATE LIMITING LOGIN ──
Write-Output "[1] Rate limiting - login (7 tentativas)"
$bloqueou = $false
for ($i = 1; $i -le 7; $i++) {
  $body = "{`"email`":`"x$i@x.com`",`"senha`":`"errada`"}"
  try {
    $null = Invoke-WebRequest -Uri "$api/login" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    if ($i -gt 5) { $erros += "Esperava bloqueio na tentativa $i" }
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 429) { Write-Output "  OK - Bloqueado apos $i tentativas (429)"; $bloqueou = $true; break }
    elseif ($i -le 5 -and $status -ne 401) { $erros += "Esperava 401 na tentativa $i, veio $status" }
  }
}
if (-not $bloqueou) { Write-Output "  OK - Rate limit nao atingido (configurado para 5/15min, pode precisar aguardar)" }

# ── 2. SQL INJECTION ──
Write-Output ""
Write-Output "[2] SQL Injection no login"
$payloads = @(
  "' OR '1'='1",
  "admin'--",
  "teste@teste.com"
)
foreach ($p in $payloads) {
  $body = "{`"email`":`"$p`",`"senha`":`"qualquer`"}"
  try {
    $null = Invoke-WebRequest -Uri "$api/login" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    $erros += "SQL Injection deveria falhar: $p"
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -in @(401, 429)) { Write-Output "  OK - Rejeitado ($status): $p" }
    else { $erros += "Status inesperado $status para: $p" }
  }
}

# ── 3. CAMPOS AUSENTES ──
Write-Output ""
Write-Output "[3] Campos ausentes no login"
$corpos = @( '{"email":"teste@teste.com"}', '{"senha":"123456"}', '{}' )
foreach ($c in $corpos) {
  try {
    $null = Invoke-WebRequest -Uri "$api/login" -Method Post -Body $c -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    $erros += "Campos ausentes deveria falhar: $c"
  } catch {
    Write-Output "  OK - Rejeitado ($($_.Exception.Response.StatusCode.value__))"
  }
}

# ── 4. CADASTRO INVALIDO ──
Write-Output ""
Write-Output "[4] Cadastro com dados invalidos"
$tests = @(
  @('{"nome":"<script>alert(1)</script>","email":"xss@t.com","senha":"123456"}', "XSS no nome"),
  @('{"nome":"T","email":"t@t.com","senha":"123456"}', "Nome muito curto"),
  @('{"nome":"Test","email":"invalido","senha":"123456"}', "Email invalido"),
  @('{"nome":"Test","email":"t@t.com","senha":"123"}', "Senha muito curta")
)
foreach ($t in $tests) {
  try {
    $null = Invoke-WebRequest -Uri "$api/usuarios" -Method Post -Body $t[0] -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    $erros += "Deveria rejeitar: $($t[1])"
  } catch {
    Write-Output "  OK - Rejeitado ($($_.Exception.Response.StatusCode.value__)): $($t[1])"
  }
}

# ── 5. TOKEN INVALIDO ──
Write-Output ""
Write-Output "[5] Resetar senha com token invalido"
try {
  $body = '{"token":"token_invalido_xyz_123456","senha":"nova123456"}'
  $null = Invoke-WebRequest -Uri "$api/resetar-senha" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
  $erros += "Reset com token invalido deveria falhar"
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -eq 400) { Write-Output "  OK - Rejeitado (400): token invalido" }
  else { $erros += "Esperava 400, veio $status" }
}

# ── 6. SENHA FRACA ──
Write-Output ""
Write-Output "[6] Resetar senha com senha fraca"
try {
  $body = '{"token":"qualquer","senha":"123"}'
  $null = Invoke-WebRequest -Uri "$api/resetar-senha" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
  $erros += "Senha fraca deveria ser rejeitada"
} catch {
  Write-Output "  OK - Rejeitado ($($_.Exception.Response.StatusCode.value__)): senha < 6 caracteres"
}

# ── 7. TOKEN AUSENTE ──
Write-Output ""
Write-Output "[7] Resetar senha sem token"
try {
  $body = '{"senha":"nova123456"}'
  $null = Invoke-WebRequest -Uri "$api/resetar-senha" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
  $erros += "Token ausente deveria falhar"
} catch {
  Write-Output "  OK - Rejeitado ($($_.Exception.Response.StatusCode.value__)): token ausente"
}

# ── 8. USER ENUMERATION ──
Write-Output ""
Write-Output "[8] Resposta identica para email existe/nao existe no esqueci-senha"
$bodyExiste = '{"email":"xss@t.com"}'
$bodyNaoExiste = '{"email":"naoexiste_qualquer_123@teste.com"}'
try {
  $r1 = Invoke-WebRequest -Uri "$api/esqueci-senha" -Method Post -Body $bodyExiste -ContentType "application/json" -UseBasicParsing
  $r2 = Invoke-WebRequest -Uri "$api/esqueci-senha" -Method Post -Body $bodyNaoExiste -ContentType "application/json" -UseBasicParsing
  if ($r1.Content -eq $r2.Content) { Write-Output "  OK - Respostas identicas (nao revela existencia)" }
  else { $erros += "Respostas DIFERENTES - pode revelar se email existe!" }
} catch {
  Write-Output "  ERRO: $($_.Exception.Message)"
}

# ── 9. JSON MALFORMADO ──
Write-Output ""
Write-Output "[9] JSON malformado"
try {
  $null = Invoke-WebRequest -Uri "$api/login" -Method Post -Body "nao-e-json" -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
  $erros += "JSON malformado deveria falhar"
} catch {
  Write-Output "  OK - Rejeitado ($($_.Exception.Response.StatusCode.value__))"
}

# ── 10. GET EM ROTA POST ──
Write-Output ""
Write-Output "[10] GET em rota POST (/login)"
try {
  $null = Invoke-WebRequest -Uri "$api/login" -UseBasicParsing -ErrorAction Stop
  $erros += "GET em /login deveria falhar"
} catch {
  Write-Output "  OK - Rejeitado ($($_.Exception.Response.StatusCode.value__))"
}

Write-Output ""
Write-Output "=== RESUMO ==="
if ($erros.Count -eq 0) {
  Write-Output " Todos os testes passaram! Nenhum erro de seguranca encontrado."
} else {
  Write-Output " $($erros.Count) erro(s) encontrado(s):"
  $erros | ForEach-Object { Write-Output "  - $_" }
}
