import { generateStage } from './generator';

self.onmessage = (e: MessageEvent<{ rows: number; cols: number }>) => {
  const { rows, cols } = e.data;
  const stage = generateStage(rows, cols, (attempt) => {
    self.postMessage({ type: 'progress', attempt });
  });
  self.postMessage({ type: 'done', stage });
};
