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

# Push to main → triggers GitHub Actions → auto-deploys EC2 (backend) + Vercel (frontend)
git push origin main

echo ""
echo "✅ Pushed to main."
echo "   Live site:       https://aicaller.store"
echo "   API:             https://api.aicaller.store"
echo ""
echo "   Deploys take ~1-2 minutes. Check GitHub Actions for status:"
echo "   https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/.git$//')/actions"
