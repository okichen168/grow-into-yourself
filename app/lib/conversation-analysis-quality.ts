import type { AiAnalysis, AnalysisLanguage } from "./analyze-shared";

const zhLabels: Record<string, string> = {
  power: "权力与自主",
  concern: "值得核对",
  contradiction: "前后矛盾",
  reasonable: "合理部分",
  risk: "风险线索",
  control: "控制与限制",
};

export function localizeAnalysisLabel(value: string, language: AnalysisLanguage) {
  return language === "zh" ? (zhLabels[value.trim().toLowerCase()] || value) : value;
}

export function selectEvidenceForDisplay(analysis: AiAnalysis) {
  const counts = new Map<string, number>();
  const selected = new Map<string, string[]>();
  const take = (key: string, values: string[], limit: number) => {
    const result: string[] = [];
    for (const value of [...new Set(values.map((item) => item.trim()).filter(Boolean))]) {
      if ((counts.get(value) || 0) >= 2) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
      result.push(value);
      if (result.length >= limit) break;
    }
    selected.set(key, result);
  };

  analysis.keyAnnotations.forEach((item, index) => take(`annotation:${index}`, item.quotes, 2));
  analysis.concerningParts.forEach((item, index) => take(`concern:${index}`, item.evidence, 1));
  analysis.whatTheyArePushing.forEach((item, index) => take(`push:${index}`, item.evidence, 1));
  analysis.interactionPattern.steps.forEach((item, index) => take(`step:${index}`, item.evidence, 1));
  return selected;
}
