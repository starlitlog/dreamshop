# DreamShop Commands

# Show available commands
help:
	@echo "\033[1;35mDreamShop Commands:\033[0m"
	@echo ""
	@echo "\033[1;36mDevelopment:\033[0m"
	@echo "  \033[1;32mmake build\033[0m       - Build the website from src/ to dist/"
	@echo "  \033[1;32mmake dev\033[0m         - Build and preview locally"
	@echo "  \033[1;32mmake watch\033[0m       - Build, preview, and auto-rebuild on changes"
	@echo ""
	@echo "\033[1;36mDeployment:\033[0m"
	@echo "  \033[1;32mmake deploy\033[0m      - Build and upload to git"
	@echo "  \033[1;32mmake status\033[0m      - Check what files have changed"
	@echo "  \033[1;32mmake pages-status\033[0m    - Check Cloudflare Pages deployment"
	@echo ""
	@echo "\033[1;33mCloudflare Worker:\033[0m"
	@echo "  \033[1;32mmake worker-install\033[0m    - Install Wrangler CLI"
	@echo "  \033[1;32mmake worker-secrets\033[0m    - Update worker secrets (API keys)"
	@echo "  \033[1;32mmake worker-deploy\033[0m     - Deploy worker to your API domain"
	@echo "  \033[1;32mmake worker-logs\033[0m       - View worker logs"
	@echo ""
	@echo "\033[1;34mHelp:\033[0m"
	@echo "  \033[1;32mmake help\033[0m        - Show this help message"

# Build the website
build:
	@echo "\033[1;34mBuilding website...\033[0m"
	node build.js

# Preview your site locally (builds first)
dev: build
	@echo "\033[1;36mYour website is at: \033[1;32mhttp://localhost:8000\033[0m"
	@echo "\033[1;31mPress Ctrl+C to stop\033[0m"
	cd dist && python3 -m http.server 8000

# Watch for changes and rebuild (requires fswatch: brew install fswatch)
watch: build
	@echo "\033[1;36mYour website is at: \033[1;32mhttp://localhost:8000\033[0m"
	@echo "\033[1;33mWatching for changes in src/...\033[0m"
	@echo "\033[1;31mPress Ctrl+C to stop\033[0m"
	cd dist && python3 -m http.server 8000 &
	fswatch -o src/ config.js | xargs -n1 -I{} node build.js

# Deploy changes to the live site
deploy: build
	@echo "\033[1;34mDeploying to live website...\033[0m"
	git add .
	@read -p "What did you change? " msg; \
	git commit -m "$$msg"
	git push
	@echo "\033[1;32mChanges uploaded! Your website will update in 1-2 minutes.\033[0m"

# Check if everything is working
status:
	@echo "\033[1;34mChecking what files have changed...\033[0m"
	git status

# Install Wrangler CLI for Cloudflare Workers
worker-install:
	@echo "\033[1;33mInstalling Wrangler CLI...\033[0m"
	@if command -v npm >/dev/null 2>&1; then \
		npm install -g wrangler; \
		echo "\033[1;32mWrangler installed! Run 'wrangler login' to authenticate.\033[0m"; \
	else \
		echo "\033[1;31mnpm not found. Please install Node.js first: \033[1;36mhttps://nodejs.org\033[0m"; \
	fi

# Update worker secrets (API keys)
worker-secrets:
	@echo "\033[1;33mSetting up worker secrets...\033[0m"
	@echo "\033[0;37mYou'll be prompted to enter API keys. Leave empty to skip.\033[0m"
	@echo ""
	@echo "\033[1;36mOrders & Contacts (write access):\033[0m"
	@read -p "AIRTABLE_API_KEY (leave empty to skip): " key1; \
	if [ ! -z "$$key1" ]; then \
		cd _workers && echo "$$key1" | wrangler secret put AIRTABLE_API_KEY --env=""; \
		echo "\033[1;32mAIRTABLE_API_KEY updated\033[0m"; \
	else \
		echo "\033[1;90mAIRTABLE_API_KEY skipped\033[0m"; \
	fi
	@read -p "AIRTABLE_BASE_ID (leave empty to skip): " base1; \
	if [ ! -z "$$base1" ]; then \
		cd _workers && echo "$$base1" | wrangler secret put AIRTABLE_BASE_ID --env=""; \
		echo "\033[1;32mAIRTABLE_BASE_ID updated\033[0m"; \
	else \
		echo "\033[1;90mAIRTABLE_BASE_ID skipped\033[0m"; \
	fi
	@echo ""
	@echo "\033[1;36mProducts & Events (read-only):\033[0m"
	@read -p "AIRTABLE_API_KEY_WEB_RESOURCE (leave empty to skip): " key2; \
	if [ ! -z "$$key2" ]; then \
		cd _workers && echo "$$key2" | wrangler secret put AIRTABLE_API_KEY_WEB_RESOURCE --env=""; \
		echo "\033[1;32mAIRTABLE_API_KEY_WEB_RESOURCE updated\033[0m"; \
	else \
		echo "\033[1;90mAIRTABLE_API_KEY_WEB_RESOURCE skipped\033[0m"; \
	fi
	@read -p "AIRTABLE_BASE_ID_WEB_RESOURCE (leave empty to skip): " base2; \
	if [ ! -z "$$base2" ]; then \
		cd _workers && echo "$$base2" | wrangler secret put AIRTABLE_BASE_ID_WEB_RESOURCE --env=""; \
		echo "\033[1;32mAIRTABLE_BASE_ID_WEB_RESOURCE updated\033[0m"; \
	else \
		echo "\033[1;90mAIRTABLE_BASE_ID_WEB_RESOURCE skipped\033[0m"; \
	fi
	@echo ""
	@echo "\033[1;32mSecrets management completed!\033[0m"

# Deploy worker to Cloudflare
worker-deploy:
	@echo "\033[1;33mDeploying Cloudflare Worker...\033[0m"
	cd _workers && wrangler deploy --env=""
	@echo "\033[1;32mWorker deployed!\033[0m"
	@echo "\033[0;37m   Set up custom domain: Workers & Pages > Your Worker > Triggers > Custom Domains\033[0m"

# View worker logs
worker-logs:
	@echo "\033[1;33mViewing worker logs (press Ctrl+C to exit)...\033[0m"
	cd _workers && wrangler tail --env=""

# Check Cloudflare Pages deployment status
# Update 'your-project-name' with your actual project name
pages-status:
	@echo "\033[1;34mChecking Cloudflare Pages deployment status...\033[0m"
	wrangler pages deployment list --project-name=your-project-name

.PHONY: help build dev watch deploy status worker-install worker-secrets worker-deploy worker-logs pages-status
