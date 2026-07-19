"use client";

import type { AiAnalysis, AnalysisLanguage } from "../lib/analyze-shared";

const headings = {
  en: {
    overview: "What happened", boundary: "Evidence boundary", observed: "Observed", likely: "Likely", uncertainFacts: "Uncertain", pattern: "The interaction pattern", pushing: "What the conversation is pushing", reasonable: "What is reasonable",
    concerns: "What deserves attention", annotations: "Key annotations", grounding: "Steady yourself first", next: "What you could do next", risk: "Risk level",
    evidence: "Evidence", uncertainty: "What remains uncertain", copy: "Copy",
  },
  zh: {
    overview: "发生了什么", boundary: "证据边界", observed: "可观察事实", likely: "较合理推断", uncertainFacts: "目前无法确认", pattern: "整段互动结构", pushing: "对方在推动什么", reasonable: "合理的部分", concerns: "值得警惕的部分",
    annotations: "重点批注", grounding: "先把自己站稳", next: "下一步可以怎么做", risk: "风险等级",
    evidence: "对应原话", uncertainty: "不确定之处", copy: "复制",
  },
} as const;

function copyMessage(message: string) {
  if (message) navigator.clipboard?.writeText(message);
}

export default function ConversationAnalysisResult({ analysis, language }: { analysis: AiAnalysis; language: AnalysisLanguage }) {
  const ui = headings[language];
  return <div className="english-result conversation-analysis-result">
    <span className="analysis-mode">{analysis.mode === "ai" ? (language === "zh" ? "AI 深度分析" : "AI analysis") : (language === "zh" ? "本地结构化分析" : "Local structured analysis")}</span>
    {analysis.mode === "local" && analysis.statusReason === "quota" && <p className="analysis-mode-note">{language === "zh" ? "深度分析额度已用完，目前转为本地分析" : "The deep-analysis limit has been reached, so local analysis is being used."}</p>}

    <section className="analysis-overview"><h3>{ui.overview}</h3><p>{analysis.overview}</p></section>

    {(analysis.evidenceBoundary.observed.length > 0 || analysis.evidenceBoundary.likely.length > 0 || analysis.evidenceBoundary.uncertain.length > 0) && <section className="analysis-boundary semantic-ground"><h3>{ui.boundary}</h3>
      {analysis.evidenceBoundary.observed.length > 0 && <div><h4>{ui.observed}</h4><ul>{analysis.evidenceBoundary.observed.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {analysis.evidenceBoundary.likely.length > 0 && <div><h4>{ui.likely}</h4><ul>{analysis.evidenceBoundary.likely.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {analysis.evidenceBoundary.uncertain.length > 0 && <div><h4>{ui.uncertainFacts}</h4><ul>{analysis.evidenceBoundary.uncertain.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    </section>}

    <section className="analysis-pattern semantic-notice"><h3>{ui.pattern}</h3><h4>{analysis.interactionPattern.title}</h4>
      {analysis.interactionPattern.steps.length > 0 && <ol>{analysis.interactionPattern.steps.map((step) => <li key={`${step.action}-${step.evidence.join("|")}`}><b>{step.action}</b>{step.evidence.map((quote) => <q key={quote}>{quote}</q>)}</li>)}</ol>}
      <p>{analysis.interactionPattern.explanation}</p>
    </section>

    {analysis.whatTheyArePushing.length > 0 && <section><h3>{ui.pushing}</h3><div className="analysis-card-grid">
      {analysis.whatTheyArePushing.map((item) => <article className="semantic-notice" key={item.point}><small>{item.confidence}</small><h4>{item.point}</h4>
        {item.evidence.length > 0 && <div className="analysis-evidence"><b>{ui.evidence}</b>{item.evidence.map((quote) => <q key={quote}>{quote}</q>)}</div>}
      </article>)}
    </div></section>}

    {analysis.reasonableParts.length > 0 && <section className="semantic-ground"><h3>{ui.reasonable}</h3><ul>{analysis.reasonableParts.map((item) => <li key={item}>{item}</li>)}</ul></section>}

    {analysis.concerningParts.length > 0 && <section><h3>{ui.concerns}</h3><div className="analysis-card-grid">
      {analysis.concerningParts.map((item) => <article className={`semantic-${item.severity === "high" ? "high" : "notice"}`} key={`${item.label}-${item.explanation}`}><small>{item.label} · {item.confidence}</small><p>{item.explanation}</p>{item.evidence.length > 0 && <div className="analysis-evidence">{item.evidence.map((quote) => <q key={quote}>{quote}</q>)}</div>}</article>)}
    </div></section>}

    {analysis.keyAnnotations.length > 0 && <section><h3>{ui.annotations}</h3><div className="annotation-stack">
      {analysis.keyAnnotations.map((item, index) => <article className={item.tags.some((tag) => /威胁|羞辱|threat|humili/i.test(tag)) ? "semantic-high" : "semantic-notice"} key={`${item.keyPoint}-${index}`}>
        <div className="analysis-tags">{item.tags.map((tag) => <small key={tag}>{tag}</small>)}</div>
        <div className="annotation-quotes">{item.quotes.map((quote) => <q key={quote}>{quote}</q>)}</div>
        <h4>{item.keyPoint}</h4><p>{item.grounding}</p>
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
