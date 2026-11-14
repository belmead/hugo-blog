# Shiro

A Markdown writing app and static blog generator with a local editor, production admin login, and GitHub publishing. Markdown files are the source of truth. The generated public site needs no Node server, database, or editor bundle.

## Run locally

Production uses Node 22.x.

```sh
npm install
npm run dev
```

Open [admin sign-in](http://127.0.0.1:4317/admin/) or [the blog](http://127.0.0.1:4317/). The editor binds to this computer only. Set your admin password on the first visit, then sign in with it. Password hashes live in ignored `.shiro/admin.json`; credentials are never included in the public build. Sessions expire after 30 minutes idle or eight hours absolute. Local sessions also expire on a server restart; production sessions use shared Redis state. Existing passwords remain valid; older hashes upgrade at the next successful login. See `docs/security.md` for the controls and deployment boundary. The public blog remains readable without signing in.

- **Writing:** create posts, switch between rich text and Markdown, add a snippet and cover image, set the date/time, and save as a draft or published post. `Cmd/Ctrl+S` saves. The preview button saves first and can open drafts.
- **Pages:** create Markdown pages and optionally add them to the site's navigation.
- **Homepage:** edit the site name, hero headline, subtext, wide image, link, list heading, time zone, and optional content. The side preview updates after saving.
- **Images:** upload or reuse local PNG, JPEG, WebP, and GIF images. Insert them from the image picker, or paste/drop them into the editor. Images are limited to 10 MB each. Add an image description for accessibility.
- **Build static site:** generates the public site into `site/`. Locally this builds files only. In production, saves commit to GitHub and Build requests another static deployment.

## Files

```text
content/home.md             Homepage settings and optional Markdown
content/posts/*.md          Posts with YAML front matter
content/pages/*.md          Custom pages with YAML front matter
content/.history/           Previous versions saved before an overwrite
public/uploads/             Uploaded images
public/img/                 Copied original blog images
public/images/              Initial cover images
public/site.css             Public theme
site/                       Generated public site; rebuilt from scratch
src/                        Local editor UI
lib/                        Markdown storage and public HTML rendering
```

Edit these files in any text editor. Reload Shiro to pick up external changes. If a file changes after opening it, saving rejects the conflict instead of replacing the newer file. Browser recovery keeps unsaved work locally; disk saves keep previous versions in `content/.history/`. Back up or version `content/` and `public/` together.

Post URLs use `/posts/<filename>/`, page URLs use `/<filename>/`. Existing URL names stay fixed when titles change. A future-dated published post is omitted until a build runs after its date. Shiro does not run a scheduled publishing service.

Rich text uses CommonMark/GFM through TOAST UI Editor. HTML and Markdown in public output are sanitized. Custom HTML, scripts, and Hugo templates are not a portable rich text format; use Markdown for new content. There is no arbitrary HTML layout builder: the homepage fields and Markdown pages are the deliberately small editing surface.

The editor is pinned to TOAST UI 3.2.2. `scripts/patch-editor.mjs` applies a checked install-time fix for its queued resize callback after teardown. Review that patch when updating the editor. DOMPurify is overridden to a patched release. The current sanitize-html release is retained, with htmlparser2 constrained to its compatible CommonJS 10.x build because Vercel’s function loader rejects its newer ESM-only build. Sanitizer tests and npm audit pass with this override.

## Original blog

Verified November 13, 2026:

- [belmead/hugo-blog](https://github.com/belmead/hugo-blog) is the Hugo source repository. Its `hugo.toml` selects Archie and the `omya.games` base URL.
- The live site redirects to `www.omya.games` and is served by Vercel, confirmed by HTTP headers and DNS. Its footer identifies Hugo.
- The repository's `.github/workflows/main.yml` builds Hugo on a push to `main`, then invokes the Vercel CLI for production deployment. Vercel dashboard settings were not inspected because its connector requires reauthentication.
- A local source checkout is retained in ignored `source-reference/` at commit `324f09399a0f28820f1d1b9dcbedca9a63e35609`. No remote files were changed.
- `node import-hugo.mjs` copied 44 Markdown posts and original static files. Original body text is checked unchanged. Seven undated files remain drafts, and two draft filenames were normalized. Details are in `docs/import-report.json`. Two image files referenced by the manga post are absent from the original repository; see `docs/missing-source-images.json`.
- Date-only source posts retain their original calendar date and display no invented time. New posts include a date and time.
- Added preview photographs were replaced with plain beige placeholders at the user’s request. Original post images remain, including the accessibility screenshot and server photos. The original favicon set is retained. The peptides post was removed from the active blog and retained in ignored `content/.trash/`. A scratchpad draft exercises the editor.

## Build and checks

```sh
npm test
npm run build
```

`build` compiles the local studio into `dist/studio/` and generates the public site into `site/`. Only `site/` belongs on a public host. Neither the editor, admin credentials, nor Markdown drafts are included in that output. `npm run build:site` builds only the public files.

Later, GitHub can remain the source repository and Vercel can serve `site/`, or a GitHub Pages workflow can upload it as an artifact. Hosting changes, repository pushes, and domain changes are deferred until the local design is approved. Production admin login is prepared for Vercel Functions and shared Redis authentication state. See `docs/deploy-admin.md` for environment settings and one-time owner provisioning. Production post/page/homepage saves and image uploads commit to the configured GitHub branch; its Vercel Git integration rebuilds the public site. Private previews read GitHub immediately. Tokens remain server-only and file revisions prevent stale edits from overwriting newer work. Deployment requires installing Shiro in that branch and replacing the old Hugo deployment workflow, plus the documented server credentials. Nothing has been deployed by this setup.

Production uses the `shiro` Git branch. The unchanged Hugo source remains on `main` for rollback.
