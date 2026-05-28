# Telegram 贴纸 / Emoji 本地转码工具

一个用于批量把 GIF、MP4、MOV、WEBM 等文件转成 Telegram 视频贴纸或视频 Emoji WebM 的纯前端工具。文件读取、解码、压缩、封装都在用户浏览器本地完成，不上传文件，也不依赖后端接口。

## 功能

- Sticker 模式：输出 VP9 WebM，一边精确 512px，另一边不超过 512px。
- Emoji 模式：输出 VP9 WebM，尺寸精确 100 x 100px。
- 自动限制时长不超过 3 秒。
- 自动移除音频。
- 帧率最高 30 FPS，并按素材时长动态调整码率，尽量贴近 256 KB 上限。
- 目标文件大小不超过 256 KB。
- 支持批量队列、单文件下载、全部打包 ZIP 下载和循环预览。
- GIF 会优先逐帧解码，保留动画效果。

## 环境要求

- Node.js 20 或更新版本。
- 推荐使用最新版 Chrome 或 Edge。

浏览器需要支持：

- `MediaRecorder` 的 VP9 WebM 编码。
- `canvas.captureStream()`。
- `ImageDecoder`，用于逐帧处理 GIF 动图。
- WebAssembly，用于 FFmpeg WebM 容器整理和兜底处理。

Safari 对 VP9 WebM 和相关浏览器 API 支持有限，不建议作为主要使用环境。

## 本地使用

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

打开终端显示的本地地址，通常是：

```text
http://localhost:5173/
```

使用流程：

1. 选择 `Sticker` 或 `Emoji` 模式。
2. 拖入文件，或点击上传区域选择文件。
3. 点击 `开始`。
4. 等待队列完成。
5. 在每一行下载单个 WebM，或点击 `ZIP` 下载全部结果。

## 构建和预览

生产构建：

```bash
npm run build
```

构建产物会输出到 `dist/`。

本地预览生产构建：

```bash
npm run serve:dist
```

也可以使用 Vite 预览：

```bash
npm run preview
```

## 部署到 Pages

推荐配置：

- Framework preset：Vite / React
- Install command：`npm ci`
- Build command：`npm run build`
- Output directory：`dist`
- Node.js version：20 或更新版本

### FFmpeg WASM 文件说明

`@ffmpeg/core` 的 WASM 文件大约 30MiB，超过 EdgeOne Pages 单文件 25MiB 限制。项目的构建脚本会自动把它拆成多个小分片：

- `public/ffmpeg-core/ffmpeg-core.wasm.part-000`
- `public/ffmpeg-core/ffmpeg-core.wasm.part-001`
- `public/ffmpeg-core/ffmpeg-core.wasm.json`

运行时浏览器会从同源静态目录下载这些分片并在本地合并成 WASM Blob。构建后最大单文件约 20MiB，满足 EdgeOne Pages 单文件大小限制。

`public/ffmpeg-core/` 是构建生成目录，已加入 `.gitignore`，不需要手动提交。

## 注意事项

- 所有文件处理都在浏览器本地完成。文件不会上传到服务器。
- 第一个文件转码到 96% 时可能停留较久，这是首次加载、合并并实例化 FFmpeg WASM。后续文件会复用已加载的运行时，速度会明显正常。
- GIF 动画依赖浏览器 `ImageDecoder` 逐帧解码。推荐使用最新版 Chrome 或 Edge。
- 如果重新部署后仍然遇到旧行为，请在浏览器里硬刷新页面，Windows/Linux 通常是 `Ctrl + F5`。
- 输入文件越大，浏览器内存和 CPU 压力越高。建议先裁剪到 3 秒以内再上传，体验会更好。
- WebM 本身不可靠写入循环播放元数据。本工具页面预览会循环播放，Telegram 客户端通常也会循环播放贴纸和 Emoji。
- 如果输出超过 256 KB，工具会继续降低码率和 FPS。若仍无法达标，会保留最小的一版并显示提示。
- Emoji 模式默认完整留边，不裁切主体。
- Sticker 模式按比例缩放，保证一边精确 512px，另一边不超过 512px。

## 常用命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run serve:dist   # 用简单静态服务器预览 dist
npm run preview      # Vite 预览
npm test             # 运行单元测试
npm run copy:ffmpeg  # 复制并拆分 FFmpeg core 静态资源
```

## 项目结构

```text
src/
  App.tsx                  页面和批量队列 UI
  lib/
    canvasRecorder.ts      Canvas + MediaRecorder 转码路径
    gifFrames.ts           GIF 逐帧解码
    ffmpegRuntime.ts       FFmpeg WASM 加载与复用
    webmFinalize.ts        WebM 容器整理
    presets.ts             Telegram 尺寸、码率和校验规则
scripts/
  copy-ffmpeg-core.mjs     复制并拆分 FFmpeg core
  serve-dist.mjs           本地静态预览服务器
public/
  ffmpeg-core/             构建时生成，部署到同源静态目录
dist/                      生产构建输出
```
