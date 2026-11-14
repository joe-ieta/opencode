. (Join-Path $PSScriptRoot 'Profile.ps1')
$version = Invoke-WebTestCli -Arguments @('--version')
if ($version -ne "opencode v$($TestManifest.version)") { throw 'Binary and build.json versions differ.' }
Invoke-WebTestCli -Arguments @('service', 'stop') | Out-Null
Write-Host 'The isolated web test service is stopped. Its configuration and test data were preserved.'
