# C:\check-updates.ps1
$ProjectPath = "C:\pharmacy-logistics"
$LastCommitFile = "C:\logs\last-commit.txt"

Set-Location $ProjectPath

# Get current commit hash
git fetch origin main
$CurrentCommit = git rev-parse origin/main
$LastCommit = if (Test-Path $LastCommitFile) { Get-Content $LastCommitFile } else { "" }

if ($CurrentCommit -ne $LastCommit) {
    Write-Host "New commit detected. Deploying..."
    $CurrentCommit | Out-File $LastCommitFile
    C:\deploy-pharmacy.bat
} else {
    Write-Host "No changes detected."
}