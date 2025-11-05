build:
	pnpm --filter !"./sandbox/*" run -r build

dev:
	pnpm --filter "./packages/*" run -r --parallel dev

test:
	NODE_ENV=development pnpm --filter "kiru" run test && \
  NODE_ENV=development pnpm --filter "e2e-csr" run test && \
  NODE_ENV=development pnpm --filter "e2e-ssg" run test

