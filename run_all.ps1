<#
Helper script to open two PowerShell windows and run the backend and frontend.
Run from the repository root: `.
un_all.ps1`
#>

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

Write-Host "Starting backend in new PowerShell window..."
Start-Process -FilePath pwsh -ArgumentList "-NoExit","-Command","Set-Location -LiteralPath '$backend'; if(Test-Path .venv\Scripts\Activate.ps1){ . .venv\Scripts\Activate.ps1 }; python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

Write-Host "Starting frontend in new PowerShell window..."
Start-Process -FilePath pwsh -ArgumentList "-NoExit","-Command","Set-Location -LiteralPath '$frontend'; npm run preview"

Write-Host "Launched backend and frontend. Check the new terminal windows."
