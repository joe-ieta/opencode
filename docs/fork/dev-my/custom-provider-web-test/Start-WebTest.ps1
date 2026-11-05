param(
    [ValidateRange(1024, 32767)][int]$Port = 4381,
    [switch]$NoBrowser
)
. (Join-Path $PSScriptRoot 'Profile.ps1')
$version = Invoke-WebTestCli -Arguments @('--version')
if ($version -ne "opencode v$($TestManifest.version)") { throw 'Binary and build.json versions differ.' }
$url = Invoke-WebTestCli -Arguments @('service', 'status')
if ($url -eq 'stopped') {
    Invoke-WebTestCli -Arguments @('service', 'set', 'hostname', '127.0.0.1') | Out-Null
    Invoke-WebTestCli -Arguments @('service', 'set', 'port', "$Port") | Out-Null
    $url = Invoke-WebTestCli -Arguments @('service', 'start')
}
$expected = "http://127.0.0.1:$Port"
if ($url.TrimEnd('/') -ne $expected) { throw "The test profile already uses $url. Stop it before choosing another port." }
$headers = Get-WebTestHeaders
$info = Invoke-RestMethod -Uri "$expected/api/info" -Headers $headers -TimeoutSec 30
if ($info.version -ne $TestManifest.version) { throw 'Running test service version differs; it was left untouched.' }
Write-Host "Web test ready: $expected"
Write-Host "Isolated profile: $TestProfile"
Write-Host "Use Stop-WebTest.cmd to stop only this test service."
if (!$NoBrowser) {
    $pair = Invoke-RestMethod -Method Post -Uri "$expected/api/pair" -Headers $headers -TimeoutSec 15
    Start-Process -FilePath "$expected/auth/connect/$($pair.code)"
}
