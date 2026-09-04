# nebulosa

Owls see in the dark. So does SAR.

Ground-track visualizer for the Synspective StriX SAR constellation, built from public
orbital data (CelesTrak GP). Named for *Strix nebulosa*, the great grey owl — same genus
as the satellites, the iconic owl of Finland, and Latin for "cloudy": an owl named
*cloudy*, for satellites built to see through clouds.

Unofficial demo project; not affiliated with Synspective.

See [SCOPE.md](SCOPE.md) for the plan. Live at [nebulosa.misaki.fi](https://nebulosa.misaki.fi);
screenshots land with the MVP.

## Develop

```sh
npm install
npm run tles     # fetch public/data/tles.json from CelesTrak (not committed; do this first)
npm run dev      # Vite dev server
npm test         # Vitest
npm run lint     # oxlint
```

## Deploy

Static files behind nginx over HTTPS (Let's Encrypt / certbot). [`deploy.sh`](deploy.sh)
pulls, builds, and swaps the result into the web root; the root is asked on first run and
saved to `.deploy.local`.

```sh
./deploy.sh                          # pull, build, publish
./deploy.sh --no-pull                # build the working tree as-is
WEBROOT=/some/other/path ./deploy.sh # override the publish dir
```

[`nginx.conf.example`](nginx.conf.example) is the server block it's served from.

## License

MIT. Orbital data from [CelesTrak](https://celestrak.org/).
