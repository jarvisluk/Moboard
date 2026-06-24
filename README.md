# Moboard

Moboard is a cross-device voice dictation keyboard. The macOS desktop app receives text from the hosted mobile client and pastes it into the active cursor location.

## Local development

```bash
npm install
npm start
```

Use `npm run server` to run only the local Express server.

## Cloudflare Pages deployment

The mobile client is a static site in `public/`. Deploy it with:

```bash
npm run deploy:cloudflare:create
npm run deploy:cloudflare
```

The project is configured as `moboard` in `wrangler.toml`, so the default mobile client URL is:

```text
https://moboard.pages.dev/mobile.html
```

For GitHub Actions deployment, add these repository secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

`cloudflare-pages.yml` deploys `public/` to Cloudflare Pages on pushes to `main` and records the deployment in GitHub Deployments.

## Desktop release

Build locally:

```bash
npm run dist:mac
```

Create a release tag after the repository has a GitHub `origin` remote:

```bash
npm run release:tag -- patch
```

You can also pass `minor`, `major`, or an explicit version such as `1.1.0`. The tag push triggers `release.yml`, which builds the macOS DMG and creates a GitHub Release with the generated assets.
