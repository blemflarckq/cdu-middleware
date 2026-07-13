# C:\pharmacy-poll.ps1
$ProjectPath = "C:\pharmacy-logistics"
$LastCommitFile = "C:\logs\last-commit.txt"
$LogFile = "C:\logs\pharmacy-deploy.log"
$PollIntervalSeconds = 60  # Check every minute (adjust as needed)

# Create directories if they don't exist
$LogDir = "C:\logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force
}

if (-not (Test-Path $ProjectPath)) {
    Write-Host "Project path not found! First time setup..."
    Set-Location "C:\"
    git clone https://github.com/yourusername/pharmacy-logistics.git $ProjectPath
}

function Write-Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$Timestamp - $Message" | Out-File -FilePath $LogFile -Append
    Write-Host "$Timestamp - $Message"
}

function Deploy-Application {
    Write-Log "New commit detected! Starting deployment..."
    
    Set-Location $ProjectPath
    
    # Stop containers
    docker compose down 2>&1 | Out-File -FilePath $LogFile -Append
    
    # Pull latest changes
    git pull origin main 2>&1 | Out-File -FilePath $LogFile -Append
    
    # Rebuild and start
    docker compose build --no-cache 2>&1 | Out-File -FilePath $LogFile -Append
    docker compose up -d 2>&1 | Out-File -FilePath $LogFile -Append
    
    # Cleanup
    docker image prune -f 2>&1 | Out-File -FilePath $LogFile -Append
    
    Write-Log "Deployment completed!"
}

# Main polling loop
Write-Log "Starting pharmacy polling service..."
Set-Location $ProjectPath

while ($true) {
    try {
        # Fetch latest changes without merging
        git fetch origin main 2>&1 | Out-File -FilePath $LogFile -Append
        
        # Get local and remote commit hashes
        $LocalCommit = git rev-parse HEAD
        $RemoteCommit = git rev-parse origin/main
        
        if ($LocalCommit -ne $RemoteCommit) {
            Write-Log "Change detected! Local: $LocalCommit, Remote: $RemoteCommit"
            Deploy-Application
        } else {
            Write-Log "No changes detected. Current commit: $LocalCommit"
        }
    }
    catch {
        Write-Log "ERROR: $_"
    }
    
    # Wait before next check
    Start-Sleep -Seconds $PollIntervalSeconds
}