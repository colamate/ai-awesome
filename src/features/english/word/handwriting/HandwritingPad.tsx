import { useCallback, useEffect, useRef, useState } from 'react';

interface HandwritingPadProps {
  questionIndex: number;
  onSubmit: (text: string) => void;
  onUnavailable: () => void;
}

interface OcrWorker {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
}

let workerPromise: Promise<OcrWorker> | null = null;

async function getWorker(): Promise<OcrWorker> {
  if (workerPromise === null) {
    workerPromise = (async () => {
      const mod = await import('tesseract.js');
      const worker = await mod.createWorker('eng', undefined, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/',
        langPath: '/ocr/',
        gzip: true,
      });
      return worker as unknown as OcrWorker;
    })();
  }
  return workerPromise;
}

function resetWorkerCache(): void {
  const pending = workerPromise;
  workerPromise = null;
  if (pending) {
    void pending.then((w) => w.terminate()).catch(() => undefined);
  }
}

export default function HandwritingPad({ questionIndex, onSubmit, onUnavailable }: HandwritingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const unavailableFiredRef = useRef(false);
  const [text, setText] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const fireUnavailable = useCallback(() => {
    if (unavailableFiredRef.current) return;
    unavailableFiredRef.current = true;
    onUnavailable();
  }, [onUnavailable]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        fireUnavailable();
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#1d1d1f';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } catch {
      fireUnavailable();
    }
  }, [fireUnavailable, questionIndex]);

  useEffect(() => () => resetWorkerCache(), []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const p = pos(e);
    if (!canvas || !ctx || !p) return;
    drawingRef.current = true;
    canvas.setPointerCapture(e.pointerId);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const p = pos(e);
    if (!ctx || !p) return;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const endDraw = () => {
    drawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setText(null);
    setDraft('');
    setHint(null);
  };

  const recognize = async () => {
    const canvas = canvasRef.current;
    if (!canvas || busy) return;
    setBusy(true);
    setHint(null);
    try {
      const worker = await getWorker();
      const result = await worker.recognize(canvas);
      const recognized = result.data.text.replace(/\s+/g, '').trim();
      if (recognized === '') {
        setHint('没识别到文字，请重写或写大一点');
      } else {
        setText(recognized);
        setDraft(recognized);
      }
    } catch {
      fireUnavailable();
    } finally {
      setBusy(false);
    }
  };

  if (text !== null) {
    return (
      <div className="mt-8" data-testid="handwriting-confirm">
        <label className="mb-2 block text-sm text-[var(--x-color-text-secondary)]" htmlFor="ocr-text-input">
          识别结果（可修改）
        </label>
        <input
          id="ocr-text-input"
          data-testid="ocr-text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full rounded-[var(--x-radius-md)] border border-black/10 bg-white px-4 py-3 text-center text-xl font-semibold outline-none transition-colors focus:border-[var(--x-color-accent)]"
        />
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            data-testid="ocr-confirm"
            onClick={() => {
              if (draft.trim() !== '') onSubmit(draft);
            }}
            className="flex-1 rounded-full bg-[var(--x-color-accent)] py-3 text-sm font-medium text-white transition-transform active:scale-95"
          >
            确认提交
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            className="flex-1 rounded-full bg-black/5 py-3 text-sm font-medium transition-colors hover:bg-black/10"
          >
            重写
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8" data-testid="handwriting-pad">
      <canvas
        ref={canvasRef}
        width={640}
        height={240}
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
        className="w-full touch-none rounded-[var(--x-radius-md)] border border-black/10 bg-white"
      />
      {hint && <p className="mt-2 text-center text-sm text-[var(--x-color-warning)]">{hint}</p>}
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={clearCanvas}
          className="flex-1 rounded-full bg-black/5 py-3 text-sm font-medium transition-colors hover:bg-black/10"
        >
          清空
        </button>
        <button
          type="button"
          data-testid="ocr-recognize"
          onClick={() => void recognize()}
          disabled={busy}
          className="flex-1 rounded-full bg-[var(--x-color-accent)] py-3 text-sm font-medium text-white transition-transform active:scale-95 disabled:opacity-40"
        >
          {busy ? '识别中…' : '识别'}
        </button>
      </div>
    </div>
  );
}
