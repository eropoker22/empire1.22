import { execFile } from "node:child_process";
import { buildMatrixReport } from "./matrix";
import type { FreeBrMatrixReport, FreeBrScenarioName, FreeBrSimulationOptions, FreeBrSimulationReport } from "./types";

declare const process: {
  cwd: () => string;
  execPath: string;
};

export interface FreeBrMatrixParallelOptions extends FreeBrSimulationOptions {
  scenarios?: FreeBrScenarioName[];
  workers?: number;
}

export const defaultFreeBrMatrixWorkerCount = (totalRuns: number): number => {
  if (totalRuns < 8) return 1;
  return Math.max(1, Math.min(4, totalRuns));
};

export const runFreeBrMatrixParallel = async (options: FreeBrMatrixParallelOptions = {}): Promise<FreeBrMatrixReport> => {
  const runs = Math.max(1, Math.floor(options.runs ?? 50));
  const scenarioNames = options.scenarios ?? [options.scenario ?? "canonical-20p"];
  const totalRuns = runs * scenarioNames.length;
  const workers = Math.max(1, Math.min(Math.floor(options.workers ?? defaultFreeBrMatrixWorkerCount(totalRuns)), totalRuns));

  if (workers <= 1) {
    const { runFreeBrMatrix } = await import("./simulation");
    return runFreeBrMatrix(options);
  }

  const jobs = createMatrixJobs(scenarioNames, runs, workers);
  const reports = (await runJobsWithConcurrency(jobs, workers, (job) => runWorkerJob({
    ...options,
    scenario: job.scenario,
    runs: job.runs,
    startRun: job.startRun
  }))).flat();

  return buildMatrixReport(reports, scenarioNames, runs);
};

const createMatrixJobs = (
  scenarioNames: FreeBrScenarioName[],
  runs: number,
  workers: number
): Array<{ scenario: FreeBrScenarioName; startRun: number; runs: number }> => {
  const jobs: Array<{ scenario: FreeBrScenarioName; startRun: number; runs: number }> = [];
  const chunksPerScenario = Math.max(1, Math.min(workers, runs));
  for (const scenario of scenarioNames) {
    const baseChunkSize = Math.floor(runs / chunksPerScenario);
    const remainder = runs % chunksPerScenario;
    let startRun = 1;
    for (let chunk = 0; chunk < chunksPerScenario; chunk += 1) {
      const chunkRuns = baseChunkSize + (chunk < remainder ? 1 : 0);
      if (chunkRuns <= 0) continue;
      jobs.push({ scenario, startRun, runs: chunkRuns });
      startRun += chunkRuns;
    }
  }
  return jobs;
};

const runJobsWithConcurrency = async <TJob, TResult>(
  jobs: TJob[],
  concurrency: number,
  worker: (job: TJob) => Promise<TResult>
): Promise<TResult[]> => {
  const results: TResult[] = [];
  let nextIndex = 0;

  const runNext = async (): Promise<void> => {
    const currentIndex = nextIndex;
    nextIndex += 1;
    if (currentIndex >= jobs.length) return;
    results[currentIndex] = await worker(jobs[currentIndex]);
    await runNext();
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => runNext()));
  return results;
};

const runWorkerJob = async (
  options: FreeBrSimulationOptions & {
    scenario: FreeBrScenarioName;
    startRun: number;
  }
): Promise<FreeBrSimulationReport[]> => {
  const workerScript = decodeURIComponent(new URL("./matrix-worker.ts", import.meta.url).pathname)
    .replace(/^\/([A-Za-z]:)/, "$1");
  const stdout = await execFileText(process.execPath, [
    "scripts/run-local-bin.mjs",
    "vite-node/vite-node.mjs",
    workerScript,
    `--seed=${String(options.seed ?? "matrix")}`,
    `--hours=${String(options.hours ?? 168)}`,
    `--scenario=${options.scenario}`,
    `--runs=${String(options.runs ?? 1)}`,
    `--startRun=${String(options.startRun)}`
  ]);

  return JSON.parse(stdout) as FreeBrSimulationReport[];
};

const execFileText = (file: string, args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile(file, args, { cwd: process.cwd(), maxBuffer: 256 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${error.message}\n${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
