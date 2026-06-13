#!/bin/bash
# deploy.sh — run this to deploy neocampaign.ai
# Claude can execute this directly: bash deploy.sh "your commit message"

set -e

MSG="${1:-deploy: update application}"

echo "🚀 Deploying neocampaign.ai..."
echo "   Commit: $MSG"
echo ""

# Stage all changes
git add -A

# Check if there's anything to commit
if git diff --cached --quiet; then
  echo "✅ No changes to commit — triggering redeploy..."
  git commit --allow-empty -m "chore: trigger redeploy"
else
  git commit -m "$MSG"
fi

# Push to main → triggers GitHub Actions → auto-deploys Railway + Vercel
git push origin main

echo ""
echo "✅ Pushed to main."
echo "   Railway deploy:  https://railway.app/dashboard"
echo "   Vercel deploy:   https://vercel.com/dashboard"
echo "   Live site:       https://app.neocampaign.ai"
echo "   API:             https://api.neocampaign.ai"
echo ""
echo "   Deploys take ~3-5 minutes. Check GitHub Actions for status:"
echo "   https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/.git$//')/actions"
