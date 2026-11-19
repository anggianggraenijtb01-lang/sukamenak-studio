# Sukamenak Studio — video renderer

Turns a finished poster generation into a 9:16 reel (1080×1920, 30 fps, h264). Rendering only:
there is no generative video model here, and nothing in this package ever sees a core prompt.

## What it draws

Everything comes from the poster and from data the backend already had:

| Element | Source |
|---|---|
| Poster | the generated image, whole (`contain`, never cropped) and slowly zooming |
| Fill | a blurred, dimmed copy of the same poster behind it, so the 9:16 canvas has no empty bands |
| Text | already baked into the poster by the pipeline; each zone is *revealed*, not redrawn |
| Colour | `brand_identities.palette` (progress line, outro) |
| Watermark | `app_settings.watermark_enabled` |

Two rules that must not be reversed:

- **Never draw the slot text again.** The poster is the output of the `composite` stage, so its text is
  already in the image. Drawing it on top produces a visible double image. Each `text_zones` rectangle
  instead starts covered by a dark blur scrim that clears, which reads as the text sharpening into focus.
  `zones[].text` is carried for diagnostics only.
- **Never crop the poster.** A 4:5 template cropped to 9:16 loses 21% of each side, exactly where its text
  sits. `objectFit: contain` plus the blurred fill keeps every pixel.

## Run it

```bash
npm ci
npx remotion browser ensure     # downloads Chrome Headless Shell (~131 MB, 303 MB on disk)

npm run studio                  # Remotion Studio, default props, for design work
node render.mjs --props p.json --out out.mp4
```

`render.mjs` prints `PROGRESS <0-100>` lines on stdout; the backend's worker parses them to update
`video_jobs.progress`. It renders in a child process from the backend, so a Chrome crash or an OOM
kill takes down the render, not the worker.

FFmpeg is not installed by anyone: Remotion ships its own binary in `node_modules/.remotion`.

## Version pinning

Remotion requires every `remotion` / `@remotion/*` package to be the **same** version, with no `^`.
The version here must match `package.json` exactly.

## Licence

Free for individuals and organisations of up to three people. Commercial use above that needs a
Company License from Remotion. This project is used by two people, which is inside the free tier —
re-check before adding contributors who work on the code.

## Known limitation

The composition asks for `Inter` and falls back to whatever is installed. The Docker image carries
`fonts-dejavu-core`, so only the optional watermark (the one piece of text this package draws itself) can
render in DejaVu when `app_settings.watermark_enabled` is on. Slot text is never drawn here — it comes from
the poster — so this does not affect the poster's own typography.

## Performance

`render.mjs` calls `bundle()` on every job. Measured on an 8-thread laptop: 41 s for an 8 s reel over HTTP,
but 147 s through the separate BullMQ worker on a cold bundle cache. That is why
`VIDEO_JOB_TIMEOUT_MS` defaults to 300 s rather than the spike's 120 s estimate. The one real speedup,
if it is ever needed, is reusing one bundle (and one browser) across jobs inside the worker — not raising
`VIDEO_WORKER_CONCURRENCY`, which just makes each render slower.

## Tests

`npm run typecheck` covers this package. The backend's video specs (`backend/test/integration/videos.spec.ts`)
run a stand-in script instead of a real render, so CI does not launch a browser per push.
