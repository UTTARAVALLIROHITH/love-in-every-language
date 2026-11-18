# Love in Every Language

An interactive typographic heart made from expressions of love in languages around the world.

## Features

- Animated 2D typographic heart and interactive 3D heart
- Multilingual expressions and language-aware text rendering
- Heart color palette and custom colors
- Personal name and message overlay
- Shareable personalized links and QR code
- Live Design Studio with shape, font, particle density, and animation speed controls
- Secret Love Letter popup
- H4CK3R033 creator watermark

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm ci
npm run dev
```

## Production build

```bash
npm run build
```

The production output is generated in `dist/`.

## Deploy with GitHub Pages

A GitHub Actions workflow is included at `.github/workflows/deploy-pages.yml`. It builds the Vite app and publishes the `dist` folder whenever changes are pushed to `main`.

1. Open the repository **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Push to `main` or run the **Deploy to GitHub Pages** workflow manually from the Actions tab.

The project site URL will be:

`https://uttaravallirohith.github.io/love-in-every-language/`

GitHub Pages availability depends on repository visibility and the GitHub plan.

## Deploy with Netlify

Import this repository in Netlify. The included `netlify.toml` configures:

- Build command: `npm run build`
- Publish directory: `dist`

