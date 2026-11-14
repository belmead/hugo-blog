# Production admin deployment and publishing

The password login is prepared for Vercel Functions with shared Upstash Redis state. The public blog remains static. The local editor and password continue to work as before.

Production saves commit Markdown and images directly to a configured GitHub branch. Reads and private previews use that branch, so cold starts and deployment snapshots cannot lose edits. Local mode continues to save to disk.

GitHub remains the source repository; Vercel hosts the static public site and protected admin function. A commit saves your content immediately. Public HTML changes after the resulting Vercel build succeeds. Drafts stay out of the public HTML, but a public GitHub repository exposes its Markdown, including drafts. All uploaded images are public assets.

## Credential setup completed November 13, 2026

The existing Vercel project `belmeads-projects/hugo-blog` (`prj_U2KB3ttuWpmts5GHCpXJu5aLVMQF`) now has all seven Shiro environment variables scoped to Production. GitHub token and Redis REST URL/token use Secret visibility. Preview and Development do not receive these credentials.

A permanent, owned Upstash resource named `shiro-production-auth` (`store_rrqpdBhVs7M81Gp2`) is connected to Production on the free plan, with `eviction=false`, `autoUpgrade=false`, and `prodPack=false` requested during provisioning. The selected primary region is `iad1`. This is separate from the disposable integration-test database.

The existing local admin password hash was provisioned without changing the password. Live checks confirmed Redis PING, an identical password record with no credential TTL, session creation/validation/revocation, and a read-only GitHub tree request using the new production token. The fine-grained token is named `Shiro production`, grants Contents read/write only on `belmead/hugo-blog` (plus required Metadata read), and expires November 13, 2027.

Private local credential material is in ignored `.shiro/production.env` and `.shiro/github-production-token`, both mode 600. Do not print, commit, or package these files. The local `.vercel/` project link and `.env.local` are also ignored. The production secret values are intentionally absent from this document.

Shiro source is now on the `shiro` branch; `main` retains the previous Hugo source. The Shiro branch omits the Hugo deployment workflow. Production publishing configuration uses `SHIRO_GITHUB_BRANCH=shiro`. Credential provisioning is complete and must not overwrite the existing credential. Staged Vercel checks have verified authenticated saves, a published post, pages, homepage saves, conflicts, previews, logout, and a 5 MB chunked image round-trip through GitHub. Traffic promotion is recorded in the release report after completion.

## Configure the deployment

1. Put the Shiro project in the deployment branch of `belmead/hugo-blog` when the local design is approved. Preserve a backup of the Hugo version. Replace the old Hugo GitHub Actions workflow, which currently runs `hugo`, with Vercel's Git integration for Shiro; configure its production branch to match `SHIRO_GITHUB_BRANCH`. Use this project's `vercel.json` (build `npm run build`, output `site/`), with no old Hugo build override or ignored-build rule for content-only commits. Do not run both the Hugo workflow and Shiro deployment. The first source migration and these production settings are deployment actions, not performed by local setup.
2. Create a permanent, account-owned Upstash Redis database dedicated to Shiro authentication, with durable storage and eviction disabled. The temporary database used by integration tests expires and is unsuitable for production.
3. Configure the Production environment in Vercel with `SHIRO_PUBLIC_ORIGIN`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`. Also set `SHIRO_GITHUB_REPOSITORY=belmead/hugo-blog`, `SHIRO_GITHUB_BRANCH=shiro` (or the explicitly selected deployment branch), and `SHIRO_GITHUB_TOKEN`. Create a fine-grained GitHub personal access token restricted to that repository with Contents read/write; no Workflows permission is needed. Permit direct content commits under branch rules, and ensure the token owner has access to deploy the connected Vercel project. Use the exact canonical HTTPS origin, for example `https://www.omya.games`. Do not put these credentials in GitHub, frontend variables, or public files.
4. Give preview deployments their own database credentials, HTTPS origin, and separate GitHub branch/token. Never point a preview admin at the production publishing branch. The default namespace is derived from the origin; `SHIRO_AUTH_NAMESPACE` can explicitly separate environments, but namespaces are not a substitute for separate credentials.
5. Provision the existing password hash once from this computer. Put the deployment variables in a private, ignored `.env.production` file, set its permissions to `600`, then run:

```sh
node --env-file=.env.production scripts/provision-admin.mjs
```

The command reads `.shiro/admin.json`, sends only the salted password hash to the configured Upstash database, and refuses to overwrite an existing admin credential. It never prints the password, hash, or database token. Legacy hashes upgrade on successful sign-in. There is no public signup or setup endpoint.

6. Run checks and build:

```sh
npm test
npm run build
```

`vercel.json` routes `/admin/`, `/studio/`, private previews, newly uploaded images, and editor APIs through `api/shiro.mjs`. Public pages and assets come from `site/`. The function includes the compiled studio and content snapshots; `.shiro/`, private environment files, histories, discarded posts, source snapshots, and test artifacts are excluded from deployment. The production server never runs Vite.

The Vercel platform provides HTTPS termination and forwarded-protocol information. Shiro trusts one platform hop only when running in Vercel, requires the configured host and HTTPS on backend requests, and always issues `__Host-` cookies with Secure, HttpOnly, SameSite=Strict, Path=/, and no Domain attribute. A different self-hosted proxy requires its exact trusted IP/CIDR through `SHIRO_TRUST_PROXY`; never trust arbitrary incoming proxy headers.

## Saving and uploading

Each document save writes `content/posts/<id>.md` or `content/pages/<id>.md`; homepage settings go to `content/home.md`. GitHub's file SHA guards competing edits. Stale saves return HTTP 409 and preserve your work in the browser. Concurrent branch changes are retried up to three times without forcing history. A lost save response is reconciled against the intended blob before reporting success. GitHub commit history replaces local `.history/` backups in production.

PNG, JPEG, GIF, and WebP uploads accept up to 10 MB, including rich-text paste/drop and cover images. The browser sends 512 KB chunks through authenticated, origin-checked APIs, avoiding Vercel's request size limit. Redis holds temporary chunks for ten minutes; one upload stages at a time. Only a complete, type-checked image is committed to `public/uploads/`. Finished/cancelled uploads release their slot; abandoned staging expires automatically. The final filename is stable for retries, preventing duplicate image commits after a lost response. Provision Redis with room for at least 15 MB of temporary staging in addition to authentication state; keep eviction disabled.

Unique uploaded image URLs are served immediately by a streaming GitHub proxy while static deployment catches up. Public image responses contain no GitHub credentials. The Images page lists GitHub images and copies public Markdown links. Private homepage/document previews read saved GitHub content immediately; the public blog shows the last successful deployment. Build static site creates a non-force rebuild commit in production and builds files on disk locally.

The GitHub token stays on the server. Shiro confines writes to its content Markdown and uploaded image paths; it cannot edit workflows or arbitrary repository paths. Missing credentials or failed GitHub permissions report errors rather than falling back to transient filesystem writes. Rotate an expiring token in the server environment before its expiry.

## Check the actual deployment before promotion

Confirm HTTPS certificate validity and canonical-domain routing, sign in with the existing password, verify authentication on editor APIs, then verify logout and session revocation. Verify the Vercel rewrites and packaged studio against the actual preview deployment. Create a draft, edit it, upload an image over 4.5 MB, set it as the cover, copy its Markdown, and preview it. Publish a test post and verify the GitHub commit triggers a successful static build and the public URL/image work; then unpublish it and check that the public URL disappears after rebuilding. Confirm a stale second editor tab cannot overwrite the first. These platform checks require a real deployment and have not been claimed as completed locally.

Missing settings stop production startup. Missing owner provisioning produces HTTP 503 rather than exposing password setup. Redis outages fail closed for login, protected routes, and logout.

## Integration tests

The production integration suite uses real HTTPS with a pinned test certificate and real Redis REST/Lua commands. Supply a private JSON file containing `url` and `token` for a disposable Upstash database:

```sh
npm run build
SHIRO_REDIS_TEST_CONFIG=/private/path/redis-test.json npm test
```

Tests use synthetic passwords and isolated namespaces, remove their own keys afterward, and never read or migrate the real admin password. They cover multiple server instances, restarts, shared throttling, leases for expensive hashing, cookie flags, origin checks, blocked public setup, legacy migration, revocation, expiration, and storage failures. Without the test connection, local tests run and the remote integration cases are explicitly skipped.

References: [GitHub Contents API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents), [Vercel Git integration](https://vercel.com/docs/git), and [Vercel payload limits](https://vercel.com/docs/functions/limitations#request-body-size).
