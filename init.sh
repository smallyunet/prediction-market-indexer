#!/bin/bash

# Project Initialization Script
echo "Rocket Launching Prediction Market Indexer... 🚀"

# 1. Install Dependencies
echo "📦 Installing dependencies with pnpm..."
pnpm install

# 2. Generate Ponder Types (requires Ponder to run locally, skipping for now or handled by dev)
# echo "🔮 Generating Ponder types..."
# pnpm --filter indexer run codegen

# 3. Print instructions
echo "✅ Setup Complete!"
echo ""
echo "To start the database:"
echo "  docker-compose up -d"
echo ""
echo "To start the Indexer (Ponder):"
echo "  pnpm --filter indexer dev"
echo ""
echo "To start the API (Hono):"
echo "  pnpm --filter api dev"
echo ""
