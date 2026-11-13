#!/usr/bin/env bash
# Builds the site and publishes dist/ to the gh-pages branch (GitHub Pages).
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE="$(git remote get-url origin)"
npm run build
cd dist
touch .nojekyll
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "Deploy site"
git push -f -q "$REMOTE" gh-pages
rm -rf .git
echo "Deployed."
