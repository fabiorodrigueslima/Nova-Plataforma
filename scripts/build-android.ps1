$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $projectDir "android"
$sdkDir = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$userDir = Split-Path -Parent (Split-Path -Parent $env:LOCALAPPDATA)
$microsoftJdks = Get-ChildItem -LiteralPath "C:\Program Files\Microsoft" -Directory -ErrorAction SilentlyContinue |
  Where-Object Name -Like "jdk-21*" |
  Sort-Object Name -Descending

if (-not $microsoftJdks) {
  throw "Java 21 nao encontrado. Instale Microsoft.OpenJDK.21 antes de compilar."
}

$env:JAVA_HOME = $microsoftJdks[0].FullName
$env:ANDROID_HOME = $sdkDir
$env:GRADLE_USER_HOME = Join-Path $userDir ".gradle"

Push-Location $projectDir
try {
  npm run android:sync
  Push-Location $androidDir
  try {
    .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) {
      throw "A compilacao Android falhou com o codigo $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}

$apk = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
Write-Host "APK criado em: $apk"
