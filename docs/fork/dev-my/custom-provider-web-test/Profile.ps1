$ErrorActionPreference = 'Stop'
$TestPackageRoot = $PSScriptRoot
$TestExecutable = Join-Path $TestPackageRoot 'opencode.exe'
$TestManifestPath = Join-Path $TestPackageRoot 'build.json'
if (!(Test-Path -LiteralPath $TestExecutable) -or !(Test-Path -LiteralPath $TestManifestPath)) {
    throw 'Extract the complete portable test package before running this script.'
}
$TestManifest = Get-Content -LiteralPath $TestManifestPath -Raw | ConvertFrom-Json
if ($TestManifest.channel -ne 'models-web-test') { throw 'Unexpected test channel in build.json.' }
$TestProfile = Join-Path $TestPackageRoot '.web-test-profile'
$TestHome = Join-Path $TestProfile 'home'
$TestEnvironment = @{
    HOME = $TestHome
    USERPROFILE = $TestHome
    OPENCODE_TEST_HOME = $TestHome
    XDG_CONFIG_HOME = (Join-Path $TestProfile 'config')
    XDG_DATA_HOME = (Join-Path $TestProfile 'data')
    XDG_CACHE_HOME = (Join-Path $TestProfile 'cache')
    XDG_STATE_HOME = (Join-Path $TestProfile 'state')
    TEMP = (Join-Path $TestProfile 'tmp')
    TMP = (Join-Path $TestProfile 'tmp')
    OPENCODE_CONFIG_DIR = (Join-Path $TestProfile 'config/opencode')
    OPENCODE_CONFIG_PROJECT_DISABLE = '1'
    OPENCODE_DISABLE_CLAUDE_CODE = '1'
    OPENCODE_DISABLE_MODELS_FETCH = '1'
    OPENCODE_DISABLE_AUTOUPDATE = '1'
    OPENCODE_CLIENT = 'models-web-test'
    OPENCODE_DB = $null
    OPENCODE_CONFIG = $null
    OPENCODE_CONFIG_CONTENT = $null
    OPENCODE_CLI_CONFIG_CONTENT = $null
    OPENCODE_PASSWORD = $null
    OPENCODE_SERVER_PASSWORD = $null
    OPENCODE_MODELS_PATH = $null
    OPENCODE_MODELS_URL = $null
    OPENCODE_SIMULATE = $null
    OPENCODE_PTY_HANDOFF = $null
}
foreach ($directory in @($TestProfile, $TestHome, $TestEnvironment.XDG_CONFIG_HOME, $TestEnvironment.XDG_DATA_HOME,
        $TestEnvironment.XDG_CACHE_HOME, $TestEnvironment.XDG_STATE_HOME, $TestEnvironment.TEMP, $TestEnvironment.OPENCODE_CONFIG_DIR)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}
$TestLauncherLog = Join-Path $TestProfile 'launcher.log'

function Invoke-WebTestCli {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    $previous = @{}
    foreach ($name in $TestEnvironment.Keys) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        if ($null -eq $TestEnvironment[$name]) {
            Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
        }
        else { [Environment]::SetEnvironmentVariable($name, $TestEnvironment[$name], 'Process') }
    }
    Push-Location -LiteralPath $TestHome
    try {
        $output = & $TestExecutable @Arguments 2>> $TestLauncherLog
        if ($LASTEXITCODE -ne 0) { throw "Test CLI failed; inspect $TestLauncherLog" }
        return ($output -join "`n").Trim()
    }
    finally {
        Pop-Location
        foreach ($name in $previous.Keys) {
            if ($null -eq $previous[$name]) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
            else { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
        }
    }
}

function Get-WebTestHeaders {
    $password = Invoke-WebTestCli -Arguments @('service', 'get', 'password')
    return @{ Authorization = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("opencode:$password")) }
}
