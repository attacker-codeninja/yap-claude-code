# Website

The public site: one indexed product page for humans and the same instructions
as plain text at `/llms.txt` for agents.

## Principles

- **One copy source.** [content.mjs](content.mjs) holds every word. The page,
  its agent view and `llms.txt` all render from it, so humans and agents
  can't be told different things.
- **Link, don't restate.** Install procedure belongs to the repository README's
  agent setup and the consumer skill's references. The site points agents there
  and keeps only the facts that change what an agent does first.
- **The README owns the install prompt.** The build fails if `agentPrompt`
  differs from the prompt in the README's "Get started" section. Change both
  together.
- **Artwork has one home.** Illustrations are copied from `.github/readme` at
  build time; the site keeps no copies.
- **No dependencies, no framework.** [build.mjs](build.mjs) writes static files
  to `dist/`. There is no download button: agents are the only install route, and
  the page's Open in Claude Code / Open in Codex links only pre-fill the prompt.

## Build and check

```sh
node apps/site/build.mjs     # writes apps/site/dist
node --test apps/site/build.test.mjs
```

Preview `apps/site/dist` with any static server. Canonical URLs, the sitemap and
robots use `SITE_URL`, else Vercel's production domain, else a local origin.

## Deploying on Vercel

Import the repository and set **Root Directory** to `apps/site`; [vercel.json](vercel.json)
supplies the build. Keep "Include files outside the root directory" enabled
(the default), because the build reads the README and artwork. Set `SITE_URL`
once a custom domain is attached.
