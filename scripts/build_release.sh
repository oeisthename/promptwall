#!/bin/bash
set -e

echo "Building PromptWall Release Package..."

# 1. Build Next.js Dashboard
echo "[1/3] Building Next.js Dashboard..."
cd dashboard
npm install
npm run build

# Next.js standalone mode requires public and static folders to be copied manually
echo "Copying static assets for standalone deployment..."
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# 2. Package Dashboard into Python Source
echo "Moving standalone bundle into python package..."
cd ..
rm -rf src/promptwall/dashboard
mkdir -p src/promptwall/dashboard
cp -r dashboard/.next/standalone/* src/promptwall/dashboard/
cp -r dashboard/.next/standalone/.next src/promptwall/dashboard/
# Note: standalone/.next already contains static and server, so we are good.

# 3. Build Python Package
echo "[2/3] Building Python Wheel..."
uv build

echo "[3/3] Build complete!"
echo "Your release packages are in the 'dist' directory."
ls -lh dist/
