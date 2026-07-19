"use client";

import type { AiAnalysis, AnalysisLanguage } from "../lib/analyze-shared";

const headings = {
  en: {
    overview: "What happened", boundary: "One thing to hold onto first", uncertainFacts: "What could change this reading", pattern: "How this conversation pulls you away from the original issue", pushing: "What the conversation is pushing", reasonable: "What is reasonable",
    concerns: "What deserves attention", annotations: "Key annotations", grounding: "Steady yourself first", next: "What you could do next", risk: "Risk level",
    uncertainty: "What remains uncertain", groundingPoint: "Hold onto this", copy: "Copy",
  },
  zh: {
    overview: "发生了什么", boundary: "先说清楚一件事", uncertainFacts: "会影响判断的不确定点", pattern: "这段对话是怎么一步步把你带走的", pushing: "对方在推动什么", reasonable: "合理的部分", concerns: "值得警惕的部分",
    annotations: "重点批注", grounding: "先把自己站稳", next: "下一步可以怎么做", risk: "风险等级",
    uncertainty: "不确定之处", groundingPoint: "别被带走的点", copy: "复制",
  },
} as const;

function copyMessage(message: string) {
  if (message) navigator.clipboard?.writeText(message);
}

function leadSentence(text: string) {
  const match = text.match(/^.*?[。！？.!?](?:\s|$)/);
  const lead = match?.[0]?.trim() || text;
  return { lead, rest: text.slice(lead.length).trim() };
}

function shortQuote(quote: string) {
  return quote.length > 90 ? `${quote.slice(0, 90)}…` : quote;
}

export default function ConversationAnalysisResult({ analysis, language }: { analysis: AiAnalysis; language: AnalysisLanguage }) {
  const ui = headings[language];
  const annotationQuotes = new Set(analysis.keyAnnotations.flatMap((item) => item.quotes));
  const boundaryMain = analysis.evidenceBoundary.likely[0] || analysis.evidenceBoundary.observed[0] || "";
  const boundaryDetails = analysis.evidenceBoundary.likely.slice(boundaryMain ? 1 : 0, 3);
  const importantUncertainty = analysis.evidenceBoundary.uncertain[0] || "";
  const overview = leadSentence(analysis.overview);
  return <div className="english-result conversation-analysis-result">
    <span className="analysis-mode">{analysis.mode === "ai" ? (language === "zh" ? "AI 深度分析" : "AI analysis") : (language === "zh" ? "基础分析" : "Basic analysis")}</span>
    {analysis.mode === "local" && analysis.statusReason === "quota" && <p className="analysis-mode-note">{language === "zh" ? "深度分析当前不可用" : "Deep analysis is currently unavailable"}</p>}
    {analysis.mode === "local" && analysis.statusReason === "timeout" && <p className="analysis-mode-note">{language === "zh" ? "深度分析暂时超时，以下只整理原文中最明确的结构。" : "Deep analysis timed out. The notes below cover only the clearest structure in the text."}</p>}

    <section className="analysis-overview"><h3>{ui.overview}</h3><p><strong>{overview.lead}</strong>{overview.rest && <> {overview.rest}</>}</p></section>

    {(boundaryMain || boundaryDetails.length > 0 || importantUncertainty) && <section className="analysis-boundary semantic-ground"><h3>{ui.boundary}</h3>
      {boundaryMain && <p className="boundary-main">{boundaryMain}</p>}
      {boundaryDetails.map((item) => <p key={item}>{item}</p>)}
      {importantUncertainty && <p className="boundary-uncertainty"><b>{ui.uncertainFacts}</b>{importantUncertainty}</p>}
    </section>}

    {(analysis.interactionPattern.steps.length > 0 || analysis.interactionPattern.explanation) && <section className="analysis-pattern semantic-notice"><h3>{ui.pattern}</h3><h4>{analysis.interactionPattern.title}</h4>
      {analysis.interactionPattern.steps.length > 0 && <ol className="interaction-steps">{analysis.interactionPattern.steps.map((step) => {
        const quote = step.evidence.find((item) => !annotationQuotes.has(item));
        return <li key={`${step.action}-${step.evidence.join("|")}`}><b>{step.action}</b>{quote && <q>{shortQuote(quote)}</q>}</li>;
      })}</ol>}
      <p className="pattern-conclusion">{analysis.interactionPattern.explanation}</p>
    </section>}

    {analysis.whatTheyArePushing.length > 0 && <section><h3>{ui.pushing}</h3><div className="analysis-card-grid">
      {analysis.whatTheyArePushing.map((item) => <article className="semantic-notice" key={item.point}><h4>{item.point}</h4><small>{item.confidence}</small>{item.evidence[0] && <q className="analysis-short-quote">{shortQuote(item.evidence[0])}</q>}</article>)}
    </div></section>}

    {analysis.reasonableParts.length > 0 && <section className="semantic-ground"><h3>{ui.reasonable}</h3><ul>{analysis.reasonableParts.map((item) => <li key={item}>{item}</li>)}</ul></section>}

    {analysis.concerningParts.length > 0 && <section><h3>{ui.concerns}</h3><div className="analysis-card-grid">
      {analysis.concerningParts.map((item) => <article className={`semantic-${item.severity === "high" ? "high" : "notice"}`} key={`${item.label}-${item.explanation}`}><h4>{item.explanation}</h4><small>{item.label} · {item.confidence}</small>{item.evidence[0] && <q className="analysis-short-quote">{shortQuote(item.evidence[0])}</q>}</article>)}
    </div></section>}

    {analysis.keyAnnotations.length > 0 && <section><h3>{ui.annotations}</h3><div className="annotation-stack">
      {analysis.keyAnnotations.map((item, index) => <article className={item.tags.some((tag) => /威胁|羞辱|threat|humili/i.test(tag)) ? "semantic-high" : "semantic-notice"} key={`${item.keyPoint}-${index}`}>
        <div className="annotation-quotes">{item.quotes.slice(0, 2).map((quote) => <q key={quote}>{shortQuote(quote)}</q>)}</div>
        <h4>{item.keyPoint}</h4>
        <div className="analysis-tags">{item.tags.map((tag) => <small key={tag}>{tag}</small>)}</div>
        {item.grounding && <p className="annotation-grounding"><b>{ui.groundingPoint}</b>{item.grounding}</p>}
        {item.uncertainty && <p className="analysis-uncertainty"><b>{ui.uncertainty}</b> {item.uncertainty}</p>}
      </article>)}
    </div></section>}

    {analysis.selfGrounding.length > 0 && <section className="semantic-ground"><h3>{ui.grounding}</h3><ul>{analysis.selfGrounding.map((item) => <li key={item}>{item}</li>)}</ul></section>}

    {analysis.nextStepOptions.length > 0 && <section><h3>{ui.next}</h3><div className="next-step-list">
      {analysis.nextStepOptions.map((item) => <article className="semantic-ground" key={`${item.type}-${item.title}`}><small>{item.title}</small><p>{item.reason}</p>
        {item.message && <button type="button" className="copy-reply" onClick={() => copyMessage(item.message)}><span>{item.message}</span><b>{ui.copy}</b></button>}
      </article>)}
    </div></section>}

    <section className={analysis.risk.level === "紧急" || analysis.risk.level === "Urgent" ? "semantic-high" : "semantic-notice"}><h3>{ui.risk}</h3><strong className="risk-level">{analysis.risk.level}</strong>
      {analysis.risk.reasons.length > 0 && <ul>{analysis.risk.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
      {analysis.risk.urgentWarning && <p className="urgent-analysis-warning">{analysis.risk.urgentWarning}</p>}
    </section>
  </div>;
}
