build:
	pnpm --filter !"./sandbox/*" run -r build

dev:
	pnpm --filter "./packages/*" run -r --parallel dev

test:
	NODE_ENV=development pnpm --filter !"./sandbox/*" run -r --parallel test

