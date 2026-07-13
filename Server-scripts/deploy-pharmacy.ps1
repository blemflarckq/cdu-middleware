param(
    [string]$LogFile = "C:\logs\pharmacy-deploy.log"
)

# Create log directory if it doesn't exist
$LogDir = Split-Path $LogFile -Parent
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force
}

function Write-Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$Timestamp - $Message" | Out-File -FilePath $LogFile -Append
    Write-Host "$Timestamp - $Message"
}

Write-Log "Starting deployment..."

# Set your project path
$ProjectPath = "C:\pharmacy-logistics"

try {
    # Navigate to project directory
    Set-Location $ProjectPath
    
    # Pull latest changes
    Write-Log "Pulling latest code from Git..."
    git pull origin main 2>&1 | Out-File -FilePath $LogFile -Append
    
    # Stop existing containers
    Write-Log "Stopping existing containers..."
    docker compose down 2>&1 | Out-File -FilePath $LogFile -Append
    
    # Rebuild containers
    Write-Log "Rebuilding containers..."
    docker compose build --no-cache 2>&1 | Out-File -FilePath $LogFile -Append
    
    # Start containers
    Write-Log "Starting containers..."
    docker compose up -d 2>&1 | Out-File -FilePath $LogFile -Append
    
    # Clean up old images
    Write-Log "Cleaning up old Docker images..."
    docker image prune -f 2>&1 | Out-File -FilePath $LogFile -Append
    
    Write-Log "Deployment completed successfully!"
}
catch {
    Write-Log "ERROR: $_"
    exit 1
}