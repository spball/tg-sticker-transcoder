# Telegram Sticker / Emoji Transcoder

中文文档：[README.zh.md](/README.zh.md)

A pure frontend tool for batch converting GIF, MP4, MOV, WEBM, and similar files into Telegram-ready WebM video stickers or video emoji. Files are read, decoded, compressed, and packaged entirely in the user's browser. Nothing is uploaded, and no backend API is required.

## Features

- Sticker mode: outputs VP9 WebM with one side exactly 512px and the other side 512px or less.
- Emoji mode: outputs VP9 WebM at exactly 100 x 100px.
- Automatically limits duration to 3 seconds or less.
- Removes audio automatically.
- Uses up to 30 FPS and dynamically adjusts bitrate based on source duration to get as close as possible to the 256 KB limit.
- Targets a maximum output size of 256 KB.
- Supports batch queues, per-file downloads, ZIP download for all outputs, and looping previews.
- GIF files are decoded frame by frame when supported, preserving animation.

## Requirements

- Node.js 20 or newer.
- Latest Chrome or Edge is recommended.

The browser must support:

- VP9 WebM encoding via `MediaRecorder`.
- `canvas.captureStream()`.
- `ImageDecoder` for frame-by-frame GIF processing.
- WebAssembly for FFmpeg-based WebM container finalization and fallback processing.

Safari has limited support for VP9 WebM and the required browser APIs, so it is not recommended as the primary browser.

## Local Usage

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL shown in the terminal, usually:

```text
http://localhost:5173/
```

Usage flow:

1. Choose `Sticker` or `Emoji` mode.
2. Drop files into the upload area, or click it to choose files.
3. Click `Start`.
4. Wait for the queue to finish.
5. Download individual WebM files from each row, or click `ZIP` to download all results.

## Build And Preview

Create a production build:

```bash
npm run build
```

The output is written to `dist/`.

Preview the production build locally:

```bash
npm run serve:dist
```

You can also use Vite preview:

```bash
npm run preview
```

## Static Hosting

This is a static frontend application. Deploy the generated `dist/` directory to any static hosting service.

Typical settings:

- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js version: 20 or newer

After deployment, the host only serves static files. All transcoding still happens locally in the visitor's browser.

## FFmpeg WASM Assets

The `@ffmpeg/core` WASM file is large, so the build script copies and splits it into same-origin static assets:

- `public/ffmpeg-core/ffmpeg-core.wasm.part-000`
- `public/ffmpeg-core/ffmpeg-core.wasm.part-001`
- `public/ffmpeg-core/ffmpeg-core.wasm.json`

At runtime, the browser downloads these chunks from the same static site and merges them locally into a WASM Blob.

`public/ffmpeg-core/` is generated during build and is ignored by Git. You do not need to commit it manually.

## Notes

- All file processing is local to the browser. Files are not uploaded to a server.
- The first file may pause at around 96% for a while. This is when FFmpeg WASM is first loaded, merged, and instantiated. Later files reuse the loaded runtime and should move faster.
- GIF animation relies on browser `ImageDecoder` support for frame-by-frame decoding. Latest Chrome or Edge is recommended.
- If old behavior appears after redeploying or rebuilding, hard refresh the page. On Windows/Linux this is usually `Ctrl + F5`.
- Larger input files increase browser memory and CPU usage. Trimming source media to 3 seconds or less before uploading improves the experience.
- WebM does not reliably store looping metadata. The page preview loops outputs, and Telegram clients usually loop stickers and emoji.
- If an output exceeds 256 KB, the tool keeps lowering bitrate and FPS. If it still cannot fit, the smallest result is kept and a warning is shown.
- Emoji mode keeps the full subject with padding by default instead of cropping.
- Sticker mode preserves aspect ratio and ensures one side is exactly 512px while the other side is 512px or less.

## Commands

```bash
npm run dev          # Start the development server
npm run build        # Create a production build
npm run serve:dist   # Preview dist with a simple static server
npm run preview      # Vite preview
npm test             # Run unit tests
npm run copy:ffmpeg  # Copy and split FFmpeg core static assets
```

## Project Structure

```text
src/
  App.tsx                  Page UI and batch queue
  lib/
    canvasRecorder.ts      Canvas + MediaRecorder transcoding path
    gifFrames.ts           Frame-by-frame GIF decoding
    ffmpegRuntime.ts       FFmpeg WASM loading and reuse
    webmFinalize.ts        WebM container finalization
    presets.ts             Telegram size, bitrate, and validation rules
scripts/
  copy-ffmpeg-core.mjs     Copies and splits FFmpeg core
  serve-dist.mjs           Local static preview server
public/
  ffmpeg-core/             Generated at build time and served as same-origin static assets
dist/                      Production build output
```
