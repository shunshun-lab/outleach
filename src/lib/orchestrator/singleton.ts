import { PipelineOrchestrator } from "./orchestrator";
import { InMemoryPipelineStore } from "./store";

// Vercel/Next.js の API Route ではグローバル変数を使わないと都度リセットされるため、
// global にキャッシュする（dev/prod 共通で必要）
const globalForOrchestrator = global as unknown as {
  _pipelineStore: InMemoryPipelineStore;
  _pipelineOrchestrator: PipelineOrchestrator;
};

export const store = globalForOrchestrator._pipelineStore ?? new InMemoryPipelineStore();
export const orchestrator = globalForOrchestrator._pipelineOrchestrator ?? new PipelineOrchestrator(store);

globalForOrchestrator._pipelineStore = store;
globalForOrchestrator._pipelineOrchestrator = orchestrator;
