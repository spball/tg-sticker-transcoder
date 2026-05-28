import {
  Archive,
  CheckCircle2,
  CircleAlert,
  Download,
  Film,
  LoaderCircle,
  Pause,
  Play,
  Smile,
  Sparkles,
  Trash2,
  UploadCloud,
  XCircle
} from "lucide-react";
import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BatchJob, ConversionMode, TranscodeResult } from "./types";
import { downloadBlob, downloadZip } from "./lib/downloads";
import {
  formatBytes,
  PRESETS,
  summarizeAttempts,
  TELEGRAM_MAX_BYTES
} from "./lib/presets";
import {
  detectLocale,
  getModeDescription,
  getTranslations,
  type Translations
} from "./lib/i18n";
import { terminateFFmpegRuntime } from "./lib/ffmpegRuntime";
import { transcodeFile } from "./lib/transcode";

const ACCEPTED_TYPES = [
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/x-msvideo"
];

function App() {
  const locale = useMemo(() => detectLocale(), []);
  const text = useMemo(() => getTranslations(locale), [locale]);
  const [mode, setMode] = useState<ConversionMode>("sticker");
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const jobsRef = useRef(jobs);
  const pausedRef = useRef(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    return () => {
      for (const job of jobsRef.current) {
        URL.revokeObjectURL(job.sourceUrl);
        if (job.outputUrl) {
          URL.revokeObjectURL(job.outputUrl);
        }
      }
      terminateFFmpegRuntime();
    };
  }, []);

  const downloadableJobs = useMemo(
    () => jobs.filter((job) => job.outputBlob && job.outputName),
    [jobs]
  );
  const queuedJobs = useMemo(() => jobs.filter((job) => job.status === "queued"), [jobs]);

  const markDone = useCallback((jobId: string, result: TranscodeResult) => {
    setJobs((current) =>
      current.map((job) => {
        if (job.id !== jobId) {
          return job;
        }

        if (job.outputUrl) {
          URL.revokeObjectURL(job.outputUrl);
        }

        const outputUrl = URL.createObjectURL(result.blob);
        return {
          ...job,
          status: "done",
          progress: 1,
          outputBlob: result.blob,
          outputUrl,
          outputName: result.outputName,
          attempts: result.attempts,
          inspection: result.inspection,
          warning: result.warnings.join(text.output.separator) || undefined,
          error: undefined
        };
      })
    );
  }, [text.output.separator]);

  const markFailed = useCallback((jobId: string, error: unknown) => {
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: "failed",
              progress: 0,
              error: error instanceof Error ? error.message : text.errors.transcodeFailed
            }
          : job
      )
    );
  }, [text.errors.transcodeFailed]);

  const markCancelled = useCallback((jobId: string) => {
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: "cancelled",
              progress: 0,
              error: text.status.cancelled
            }
          : job
      )
    );
  }, [text.status.cancelled]);

  const changeMode = (nextMode: ConversionMode) => {
    setMode(nextMode);
    setJobs((current) =>
      current.map((job) => (job.status === "queued" ? { ...job, mode: nextMode } : job))
    );
  };

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const nextJobs = Array.from(fileList)
        .filter((file) => ACCEPTED_TYPES.includes(file.type) || /\.(gif|mp4|webm|mov|m4v|avi)$/i.test(file.name))
        .map<BatchJob>((file) => ({
          id: crypto.randomUUID(),
          file,
          mode,
          status: "queued",
          progress: 0,
          sourceUrl: URL.createObjectURL(file),
          attempts: []
        }));

      if (nextJobs.length > 0) {
        setJobs((current) => [...current, ...nextJobs]);
      }
    },
    [mode]
  );

  const runQueue = useCallback(async () => {
    if (isProcessing) {
      return;
    }

    cancelRef.current = false;
    pausedRef.current = false;
    setIsPaused(false);
    setIsProcessing(true);

    const queueSnapshot = jobsRef.current.filter((job) => job.status === "queued");
    for (const nextJob of queueSnapshot) {
      if (cancelRef.current || pausedRef.current) {
        break;
      }
      setJobs((current) =>
        current.map((job) =>
          job.id === nextJob.id
            ? { ...job, status: "processing", progress: 0.02, error: undefined, warning: undefined }
            : job
        )
      );

      try {
        const result = await transcodeFile(nextJob.file, nextJob.mode, {
          locale,
          onProgress: (progress) => {
            setJobs((current) =>
              current.map((job) =>
                job.id === nextJob.id ? { ...job, progress: Math.max(job.progress, progress) } : job
              )
            );
          }
        });

        if (cancelRef.current) {
          markCancelled(nextJob.id);
          break;
        }

        markDone(nextJob.id, result);
      } catch (error) {
        if (cancelRef.current) {
          markCancelled(nextJob.id);
        } else {
          markFailed(nextJob.id, error);
        }
      }
    }

    setIsProcessing(false);
  }, [isProcessing, locale, markCancelled, markDone, markFailed]);

  const pauseQueue = () => {
    pausedRef.current = true;
    setIsPaused(true);
  };

  const cancelQueue = () => {
    cancelRef.current = true;
    pausedRef.current = false;
    setIsPaused(false);
    terminateFFmpegRuntime();
    setJobs((current) =>
      current.map((job) =>
        job.status === "queued" || job.status === "processing"
          ? { ...job, status: "cancelled", progress: 0, error: text.status.cancelled }
          : job
      )
    );
    setIsProcessing(false);
  };

  const clearFinished = () => {
    setJobs((current) => {
      const keep = current.filter((job) => job.status === "queued" || job.status === "processing");
      for (const job of current) {
        if (!keep.includes(job)) {
          URL.revokeObjectURL(job.sourceUrl);
          if (job.outputUrl) {
            URL.revokeObjectURL(job.outputUrl);
          }
        }
      }
      return keep;
    });
  };

  const removeJob = (jobId: string) => {
    setJobs((current) => {
      const target = current.find((job) => job.id === jobId);
      if (target) {
        URL.revokeObjectURL(target.sourceUrl);
        if (target.outputUrl) {
          URL.revokeObjectURL(target.outputUrl);
        }
      }
      return current.filter((job) => job.id !== jobId);
    });
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  };

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span>{text.app.brand}</span>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">{text.app.eyebrow}</span>
          <h1>{text.app.heroTitle}</h1>
          <p>{text.app.heroBody}</p>
        </div>
        <div className="hero-stats" aria-label={text.app.constraintsLabel}>
          <div>
            <strong>512px</strong>
            <span>{text.stats.stickerSide}</span>
          </div>
          <div>
            <strong>100px</strong>
            <span>{text.stats.emojiCanvas}</span>
          </div>
          <div>
            <strong>3s</strong>
            <span>{text.stats.duration}</span>
          </div>
          <div>
            <strong>256KB</strong>
            <span>{text.stats.size}</span>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="mode-panel">
          <div className="section-heading">
            <span>{text.modes.heading}</span>
            <small>{getModeDescription(mode, locale)}</small>
          </div>
          <div className="mode-grid">
            <ModeCard
              active={mode === "sticker"}
              color="coral"
              icon={<Film size={20} />}
              title="Sticker"
              subtitle={text.modes.stickerSubtitle}
              onClick={() => changeMode("sticker")}
            />
            <ModeCard
              active={mode === "emoji"}
              color="blue"
              icon={<Smile size={20} />}
              title="Emoji"
              subtitle={text.modes.emojiSubtitle}
              onClick={() => changeMode("emoji")}
            />
          </div>

          <div className="rules-list">
            <Rule icon={<Sparkles size={18} />} label={text.rules.vp9Label} value={text.rules.vp9Value} />
            <Rule icon={<CheckCircle2 size={18} />} label={text.rules.fpsLabel} value={text.rules.fpsValue} />
            <Rule icon={<Archive size={18} />} label={text.rules.sizeLabel} value={`≤ ${formatBytes(TELEGRAM_MAX_BYTES)}`} />
          </div>
        </div>

        <label
          className={`dropzone ${isDragging ? "is-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            multiple
            accept=".gif,.mp4,.webm,.mov,.m4v,.avi,image/gif,video/*"
            onChange={(event) => {
              if (event.currentTarget.files) {
                addFiles(event.currentTarget.files);
                event.currentTarget.value = "";
              }
            }}
          />
          <UploadCloud size={34} />
          <strong>{text.upload.title}</strong>
          <span>{text.upload.currentMode(PRESETS[mode].label)}</span>
        </label>
      </section>

      <section id="queue" className="queue-section">
        <div className="queue-header">
          <div>
            <span className="eyebrow">{text.queue.eyebrow}</span>
            <h2>{text.queue.title}</h2>
          </div>
          <div className="queue-actions">
            <button className="button-primary" onClick={runQueue} disabled={isProcessing || queuedJobs.length === 0}>
              <Play size={16} />
              {text.actions.start}
            </button>
            <button className="button-secondary" onClick={pauseQueue} disabled={!isProcessing || isPaused}>
              <Pause size={16} />
              {text.actions.pause}
            </button>
            <button className="button-secondary" onClick={cancelQueue} disabled={!isProcessing && queuedJobs.length === 0}>
              <XCircle size={16} />
              {text.actions.cancel}
            </button>
            <button className="button-secondary" onClick={() => downloadZip(downloadableJobs)} disabled={downloadableJobs.length === 0}>
              <Archive size={16} />
              {text.actions.zip}
            </button>
            <button className="button-icon" onClick={clearFinished} disabled={jobs.length === queuedJobs.length}>
              <Trash2 size={17} />
              <span className="sr-only">{text.actions.clearFinished}</span>
            </button>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="empty-state">
            <CircleAlert size={20} />
            <span>{text.queue.empty}</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{text.table.file}</th>
                  <th>{text.table.mode}</th>
                  <th>{text.table.status}</th>
                  <th>{text.table.output}</th>
                  <th>{text.table.preview}</th>
                  <th>{text.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <JobRow key={job.id} job={job} onRemove={removeJob} text={text} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function ModeCard({
  active,
  color,
  icon,
  title,
  subtitle,
  onClick
}: {
  active: boolean;
  color: "coral" | "blue";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button className={`mode-card ${color} ${active ? "active" : ""}`} onClick={onClick}>
      <span className="mode-icon">{icon}</span>
      <strong>{title}</strong>
      <span>{subtitle}</span>
    </button>
  );
}

function Rule({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rule">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function JobRow({
  job,
  onRemove,
  text
}: {
  job: BatchJob;
  onRemove: (jobId: string) => void;
  text: Translations;
}) {
  const attemptSummary = job.attempts.length > 0 ? summarizeAttempts(job.attempts) : text.output.pending;
  const status = getStatusContent(job, text);

  return (
    <tr>
      <td>
        <div className="file-cell">
          <strong title={job.file.name}>{job.file.name}</strong>
          <span>{formatBytes(job.file.size)}</span>
        </div>
      </td>
      <td>
        <span className="mode-chip">{PRESETS[job.mode].label}</span>
      </td>
      <td>
        <div className="status-cell">
          <span className={`job-status ${job.status}`}>{status}</span>
          {job.status === "processing" ? (
            <div className="progress-track">
              <span style={{ width: `${Math.round(job.progress * 100)}%` }} />
            </div>
          ) : null}
        </div>
      </td>
      <td>
        <div className="output-cell">
          <strong>{job.outputBlob ? formatBytes(job.outputBlob.size) : "-"}</strong>
          <span title={attemptSummary}>{attemptSummary}</span>
          {job.warning ? <em className="warning-text" title={job.warning}>{job.warning}</em> : null}
          {job.error ? <em className="error-text" title={job.error}>{job.error}</em> : null}
          {job.inspection ? (
            <small>
              {job.inspection.width} x {job.inspection.height} · {job.inspection.durationSeconds.toFixed(2)}s
            </small>
          ) : null}
        </div>
      </td>
      <td>
        {job.outputUrl ? (
          <video className="preview" src={job.outputUrl} muted loop playsInline controls />
        ) : (
          <video className="preview" src={job.sourceUrl} muted loop playsInline />
        )}
      </td>
      <td>
        <div className="row-actions">
          <button
            className="button-icon"
            disabled={!job.outputBlob || !job.outputName}
            onClick={() => job.outputBlob && job.outputName && downloadBlob(job.outputBlob, job.outputName)}
            title={text.actions.download}
          >
            <Download size={16} />
          </button>
          <button
            className="button-icon"
            disabled={job.status === "processing"}
            onClick={() => onRemove(job.id)}
            title={text.actions.remove}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function getStatusContent(job: BatchJob, text: Translations) {
  if (job.status === "done") {
    return (
      <>
        <CheckCircle2 size={14} />
        {text.status.done}
      </>
    );
  }
  if (job.status === "failed") {
    return (
      <>
        <CircleAlert size={14} />
        {text.status.failed}
      </>
    );
  }
  if (job.status === "cancelled") {
    return (
      <>
        <XCircle size={14} />
        {text.status.cancelled}
      </>
    );
  }
  if (job.status === "processing") {
    return (
      <>
        <LoaderCircle className="spin" size={14} />
        {text.status.processing(Math.round(job.progress * 100))}
      </>
    );
  }
  return text.status.queued;
}

export default App;
