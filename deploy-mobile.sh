#!/bin/bash

# Cloudflare Pages Deployment Script
echo "========================================================="
echo "    Deploying Mobile Client to Cloudflare Pages           "
echo "========================================================="
echo ""
echo "This script will deploy the static 'public' directory."
echo "If this is your first time, Wrangler will open a browser"
echo "window to authenticate your Cloudflare account."
echo ""

# Run Wrangler Pages deploy command
# It uses the 'public' folder and deploys to a project named 'remote-keyboard-dictation'
npx wrangler pages deploy public --project-name remote-keyboard-dictation

echo ""
echo "========================================================="
echo "Deployment command completed."
echo "1. Copy the secure HTTPS URL provided above by Cloudflare."
echo "2. Open the Remote Keyboard Electron App."
echo "3. Paste the URL into settings (append /mobile.html)."
echo "========================================================="
