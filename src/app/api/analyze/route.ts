import { createAnalysisRoute } from "@/app/api/analyze/analysis-route";
import { createOpenAIExtractionProvider } from "@/providers/openai-extraction";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const POST = createAnalysisRoute({
  provider: createOpenAIExtractionProvider(),
});
