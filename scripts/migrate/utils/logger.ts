// Tiny structured logger — stdout for human reading, captured into the run
// report separately via report.ts.

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (c: string, s: string) => (useColor ? `${c}${s}${RESET}` : s);

function ts() {
  return new Date().toISOString().slice(11, 19);
}

export const log = {
  info(msg: string) {
    console.log(`${paint(DIM, ts())} ${msg}`);
  },
  step(msg: string) {
    console.log(`${paint(DIM, ts())} ${paint(CYAN, "▶")} ${msg}`);
  },
  ok(msg: string) {
    console.log(`${paint(DIM, ts())} ${paint(GREEN, "✓")} ${msg}`);
  },
  warn(msg: string) {
    console.log(`${paint(DIM, ts())} ${paint(YELLOW, "⚠")} ${msg}`);
  },
  error(msg: string) {
    console.error(`${paint(DIM, ts())} ${paint(RED, "✗")} ${msg}`);
  },
};
