# Install NSSM (Non-Sucking Service Manager) first
# Download from: https://nssm.cc/download

# After downloading nssm.exe, run:
C:\nssm\nssm.exe install PharmacyWebhook "C:\Program Files\nodejs\webhook.cmd"

# Set parameters
C:\nssm\nssm.exe set PharmacyWebhook AppParameters "-hooks C:\webhook-config\webhook-config.json -port 9000 -verbose"

# Set service to auto-start
C:\nssm\nssm.exe set PharmacyWebhook Start SERVICE_AUTO_START

# Start the service
net start PharmacyWebhook