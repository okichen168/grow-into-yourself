"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Group = "pressure" | "control" | "withdrawal" | "wellbeing";
type Kind = "partner" | "family" | "workplace" | "friendship";
type Question = { text: string; group: Group; safety?: boolean };

const scale = ["Never", "Sometimes", "Often", "Almost always"];
const groupLabels: Record<Group, string> = {
  pressure: "Denial and devaluation",
  control: "Control and power",
  withdrawal: "Isolation and withdrawal",
  wellbeing: "Emotional wellbeing impact",
};

const questionnaires: Record<Kind, { label: string; intro: string; questions: Question[] }> = {
  partner: {
    label: "Partner / Dating",
    intro: "These questions look at repeated pressure, boundaries and safety in a close relationship.",
    questions: [
      { text: "They humiliate, mock or put me down, then say it was only a joke.", group: "pressure" },
      { text: "Jealousy, checking in or suspicion is framed as proof of love.", group: "pressure" },
      { text: "They deny what happened or rewrite it when I say I was hurt.", group: "pressure" },
      { text: "They monitor my phone, location, clothes, time or who I see.", group: "control" },
      { text: "They pressure me around money, work, housing, documents or sex.", group: "control" },
      { text: "They use breakup, self-harm or reputational threats to make me comply.", group: "control", safety: true },
      { text: "They punish me with silence or withdrawal until I apologise or give in.", group: "withdrawal" },
      { text: "I have become more distant from people who could support me.", group: "withdrawal" },
      { text: "I plan what I say around their reaction instead of saying what I mean.", group: "wellbeing" },
      { text: "This relationship is affecting my sleep, appetite, confidence or daily life.", group: "wellbeing" },
    ],
  },
  family: {
    label: "Family",
    intro: "These questions focus on guilt, dependence, privacy and independence within family relationships.",
    questions: [
      { text: "Family members use guilt, sacrifice or duty to override my choices.", group: "pressure" },
      { text: "They compare me, shame me or make me feel smaller in front of others.", group: "pressure" },
      { text: "They deny past harm or say I am ungrateful for remembering it.", group: "pressure" },
      { text: "They expect access to my phone, location, relationships or private decisions.", group: "control" },
      { text: "Money, housing, documents or care are used as conditions for obedience.", group: "control" },
      { text: "They pressure me to return home or control my study, work, marriage or living arrangements.", group: "control", safety: true },
      { text: "Relatives are brought in to pressure me or make me feel isolated.", group: "withdrawal" },
      { text: "I hide normal parts of my life because I expect punishment or escalation.", group: "withdrawal" },
      { text: "Family contact regularly leaves me tense, panicked, sick or unable to sleep.", group: "wellbeing" },
      { text: "I struggle to tell what I want from what others demand of me.", group: "wellbeing" },
    ],
  },
  workplace: {
    label: "Workplace",
    intro: "These questions focus on repeated conduct, power imbalance and the ability to do your work safely.",
    questions: [
      { text: "I am publicly humiliated, mocked or blamed for problems I did not create.", group: "pressure" },
      { text: "My work is criticised through personal attacks rather than clear standards.", group: "pressure" },
      { text: "Information, meetings or resources I need are withheld, then used against me.", group: "control" },
      { text: "Deadlines or workloads are repeatedly impossible without the support needed to meet them.", group: "control" },
      { text: "My credit is taken, my contribution is erased or expectations change after I deliver.", group: "control" },
      { text: "I am threatened with dismissal, references, shifts, promotion or retaliation if I speak up.", group: "control", safety: true },
      { text: "I am repeatedly excluded from normal meetings, group chats or working relationships.", group: "withdrawal" },
      { text: "People are encouraged to avoid me, take sides or treat me as the problem.", group: "withdrawal" },
      { text: "I am anxious before work or spend a lot of time trying to predict who will turn on me.", group: "wellbeing" },
      { text: "This is affecting my health, concentration, confidence or ability to work.", group: "wellbeing" },
    ],
  },
  friendship: {
    label: "Friendship",
    intro: "These questions look at trust, privacy, exclusion and pressure in friendships or social groups.",
    questions: [
      { text: "They share private information, screenshots or stories about me without consent.", group: "pressure" },
      { text: "They humiliate me as a joke and dismiss my response as oversensitivity.", group: "pressure" },
      { text: "They show others only the part where I reacted, not the lead-up.", group: "pressure" },
      { text: "They use my time, money, work or connections while ignoring my limits.", group: "control" },
      { text: "They test loyalty by making me choose sides or join in excluding someone.", group: "control" },
      { text: "They threaten gossip, exposure or damage to my reputation.", group: "control", safety: true },
      { text: "I am left out of plans, groups or information in a way that feels deliberate.", group: "withdrawal" },
      { text: "Warmth or access is withdrawn whenever I set a boundary.", group: "withdrawal" },
      { text: "I agree to things I do not want to do because I am afraid of being dropped.", group: "wellbeing" },
      { text: "This friendship is affecting my confidence, sleep or other relationships.", group: "wellbeing" },
    ],
  },
};

function scoreLabel(value: number) {
  if (value >= 67) return "High";
  if (value >= 34) return "Present";
  if (value >= 12) return "Some signs";
  return "Low";
}

function actionFor(kind: Kind, safety: boolean) {
  if (safety) return "Tell one trusted person exactly what happened today, and keep one dated record somewhere the other person cannot access.";
  if (kind === "workplace") return "Send one short written follow-up today: the task, deadline, resources and success criteria you understood.";
  if (kind === "family") return "Move one important document, spare key or small amount of money to a place only you can access.";
  if (kind === "friendship") return "Save one full conversation or post, then tell one person outside the group the complete sequence once.";
  return "Write one boundary, wait 20 minutes before replying, and notice what happens after you say no.";
}

function boundaryFor(kind: Kind) {
  if (kind === "workplace") return "Please keep feedback specific to the work, the standard and the next step.";
  if (kind === "family") return "I hear that you disagree. I will make this decision for myself.";
  if (kind === "friendship") return "Please do not share my private information or speak for me.";
  return "I will talk about the issue, but not while I am being insulted, monitored or pressured.";
}

export default function SelfCheck() {
  const [kind, setKind] = useState<Kind | null>(null);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<number[]>(Array(10).fill(-1));
  const [showResults, setShowResults] = useState(false);
  const questionsRef = useRef<HTMLDivElement>(null);
  const config = kind ? questionnaires[kind] : null;
  const questions = useMemo(() => config?.questions ?? [], [config]);
  const complete = answers.every((answer) => answer >= 0);
  const scores = useMemo(() => {
    const totals: Record<Group, number> = { pressure: 0, control: 0, withdrawal: 0, wellbeing: 0 };
    const counts: Record<Group, number> = { pressure: 0, control: 0, withdrawal: 0, wellbeing: 0 };
    questions.forEach((question, index) => { totals[question.group] += Math.max(0, answers[index]); counts[question.group] += 1; });
    return (Object.keys(totals) as Group[]).map((group) => ({ group, label: groupLabels[group], value: counts[group] ? Math.round((totals[group] / (counts[group] * 3)) * 100) : 0 }));
  }, [answers, questions]);
  const get = (group: Group) => scores.find((item) => item.group === group)?.value ?? 0;
  const pressure = Math.round((get("pressure") + get("control") + get("withdrawal")) / 3);
  const wellbeing = get("wellbeing");
  const safety = questions.some((question, index) => question.safety && answers[index] >= 2);
  const strongest = scores.filter((item) => item.group !== "wellbeing").sort((a, b) => b.value - a.value)[0];

  useEffect(() => {
    if (started) questionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [started]);

  function chooseKind(next: Kind) { setKind(next); setStarted(false); setAnswers(Array(10).fill(-1)); setShowResults(false); }
  const level = safety ? "Elevated" : pressure >= 65 || wellbeing >= 65 ? "High" : pressure >= 35 || wellbeing >= 35 ? "Moderate" : "Low";

  return <section className="self-check" id="self-check">
    <div className="section-heading"><p className="eyebrow">Relationship check-in</p><h2>Look at the pattern, not one reaction.</h2><p>The person applying pressure may look calm. The person under pressure may panic or shout. This check asks about repetition, power, boundaries and impact — not who looked composed.</p></div>
    <div className="check-start english-check-start"><div><div className="check-tabs" role="tablist" aria-label="Relationship type">{(Object.keys(questionnaires) as Kind[]).map((item) => <button type="button" role="tab" data-context={item} aria-selected={kind === item} className={kind === item ? "active" : ""} onClick={() => chooseKind(item)} key={item}>{kind === item && <span aria-hidden="true">✓ </span>}{questionnaires[item].label}</button>)}</div>{config ? <p className="check-intro">{config.intro}</p> : <p className="check-intro">Choose the relationship you want to check.</p>}</div><button type="button" disabled={!kind} onClick={() => setStarted(true)}>Start relationship check</button></div>
    {started && config && <><div className="question-list" id="relationship-questions" ref={questionsRef}>{questions.map((question, index) => <article className="question-card" key={question.text}><div className="question-heading"><span>{String(index + 1).padStart(2, "0")}</span><p>{question.text}</p></div><div className="frequency-row" role="radiogroup" aria-label={`Question ${index + 1}`}>{scale.map((label, value) => <label key={label}><input type="radio" name={`question-${index}`} checked={answers[index] === value} onChange={() => { const next = [...answers]; next[index] = value; setAnswers(next); setShowResults(false); }} /><span>{label}</span></label>)}</div></article>)}</div>
    <button type="button" className="primary check-submit" disabled={!complete} onClick={() => setShowResults(true)}>See my check-in</button>
    {!complete && <p className="check-hint">Choose one answer for each question. Your answers stay on this device unless you actively submit something elsewhere.</p>}</>}
    {showResults && kind && <section className="check-results" aria-live="polite"><p className="eyebrow">Your check-in</p><h3>{level} relationship pressure</h3><div className="score-grid">{scores.map((item) => <article key={item.group}><span>{item.label}</span><strong>{item.value}<small>/100</small></strong><em>{scoreLabel(item.value)}</em></article>)}</div>
      <div className="result-reading"><article><h4>What your answers suggest</h4><p>{pressure >= 35 ? `Your answers suggest repeated relationship pressure, especially around ${strongest?.label.toLowerCase()}. This is a pattern check, not a diagnosis of the other person.` : "Your answers do not show a concentrated pattern in this check. A single harmful event can still deserve care and a clear boundary."}</p></article><article><h4>Behaviour patterns noticed</h4><p>{pressure >= 35 ? "The concern is not how calm either person looked. It is the repeated pattern of pressure, control, isolation or what happens after you say no." : "There is not enough here to make a strong pattern claim. Notice whether a specific behaviour repeats, escalates or leaves you less free to choose."}</p></article><article><h4>How this may be affecting you</h4><p>{wellbeing >= 34 ? "Your answers suggest this may be taking up real emotional and physical space. Panic, anger, numbness or self-doubt after prolonged pressure do not prove that you caused it." : "Your wellbeing score is lower today. Keep noticing sleep, fear, self-doubt and whether you feel able to speak freely over time."}</p></article><article><h4>Safety concern level</h4><p>{safety ? "Elevated: one or more answers involve threats, retaliation, forced return or exposure. If there is immediate danger, use local emergency help rather than relying on this page." : "No immediate safety signal was selected here. That is not a guarantee of safety; your offline situation and instincts still matter."}</p></article><article><h4>What remains uncertain</h4><p>This check cannot verify events, read another person’s intentions or diagnose NPD, trauma or any personality disorder. It is most useful alongside dates, original messages and real-world support.</p></article><article><h4>One specific action for today</h4><p>{actionFor(kind, safety)}</p></article><article><h4>A boundary you may copy</h4><p className="copyable-boundary">{boundaryFor(kind)}</p></article></div><p className="supportive-closing">You do not have to prove that a pattern is “bad enough” before taking one careful step to protect your time, privacy or peace.</p></section>}
  </section>;
}
