import CommunityBoard from "./components/community-board";
import EnglishChecker from "./components/english-checker";
import SelfCheck from "./components/self-check";
import ThemeControls from "./components/theme-controls";
import LanguageSwitch from "./components/language-switch";
import Link from "next/link";

const learningCards = [
  ["Denial and rewriting", "When a concern is repeatedly turned into a question about your memory or sanity.", "🪞", "gaslighting"],
  ["Humiliation and devaluation", "When the conversation shifts from the issue to your worth, ability or character.", "🥀", "humiliation"],
  ["Isolation and control", "When privacy, people, money or movement become conditions for keeping the peace.", "🕊️", "control"],
  ["Threats and emotional coercion", "When fear, guilt, silence or a crisis is used to shrink your choices.", "⛈️", "coercion"],
];

export default function Home() {
  return <main><header className="topbar"><a className="brand" href="#top"><span className="brand-mark">G</span><span>Grow Into Yourself</span></a><nav><a href="#check">Check a chat</a><a href="#self-check">Relationship check</a><a href="#learn">Learn the patterns</a><a href="#community">World notes</a><a href="#help">Safety support</a><LanguageSwitch language="en" /></nav><ThemeControls /></header>
    <section className="hero english-hero" id="top"><div className="hero-copy"><p className="eyebrow">A privacy-first relationship clarity tool</p><h1>Find your way back to yourself.</h1><p className="hero-subtitle">When a conversation leaves you guilty, confused or small, this space helps separate facts, emotional pressure and safety signals — without labelling anyone.</p><div className="hero-actions"><a className="hero-primary" href="#check">Check a chat</a><a className="hero-secondary" href="#self-check">Relationship check</a></div><div className="feature-links" aria-label="Main features"><a href="#check">Check a chat</a><a href="#self-check">Relationship check</a><a href="#learn">Learn the patterns</a><a href="#community">World notes</a><a href="#help">Safety support</a></div><div className="trust-row"><span>No sign-up</span><span>Local screenshot reading</span><span>Private chats are not published</span><span>Not used to train AI</span></div></div><div className="comfort-card" aria-label="A gentle reminder"><span className="soft-orb orb-one" /><span className="soft-orb orb-two" /><p>“Why does every chat<br />end up being my fault?”</p><strong>Pause. You do not need to prove yourself first.</strong><div className="chat-line left">You are too sensitive.</div><div className="chat-line right">I am saying that hurt.</div><div className="chat-line left">I am only doing this for you.</div></div></section>
    <section className="learn" id="learn"><div className="section-heading"><p className="eyebrow">Recognise the pattern</p><h2>Pressure does not always sound loud.</h2><p>It can arrive as love, concern, a joke or a calm voice. One sentence does not define a relationship. Repetition, power, boundaries and what happens after “no” matter more.</p></div><div className="learn-grid">{learningCards.map(([title, description, icon, id], index) => <Link href={`/learn#${id}`} key={id}><article><i>{icon}</i><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{description}</p><b>Explore this topic →</b></article></Link>)}</div><p className="learn-note">This tool does not diagnose NPD or any personality disorder. It focuses on observable behaviour, impact and options. <Link href="/learn">Read the guide →</Link></p></section>
    <section className="pain-section english-pain-section"><div className="section-heading"><p className="eyebrow">You may be carrying this quietly</p><h2>Some things are hard to explain.</h2></div><div className="pain-grid">
      <a href="#self-check"><article><p>“Am I really being too sensitive?”</p><span>Run a private relationship and wellbeing check.</span></article></a>
      <Link href="/learn"><article><p>“I’ve explained it again and again. Why does it still become my fault?”</p><span>Spot denial, humiliation, silent treatment, blame-shifting and control.</span></article></Link>
      <a href="#help"><article><p>“I want to leave, but money, family or threats are holding me back.”</p><span>Look at immediate safety and practical support.</span></article></a>
    </div></section>
    <EnglishChecker />
    <SelfCheck />
    <CommunityBoard initialLanguage="en" />
    <section className="safety" id="help"><details><summary>Get help</summary><p>If someone is threatening, tracking, restricting your movement, forcing you to return, threatening self-harm or threatening a child, use local emergency services or a trusted local support organisation. This page cannot replace emergency, medical, legal or mental-health care.</p></details></section>
    <footer><strong>Grow Into Yourself</strong><span>Understand behaviour. Keep your choices.</span><Link href="/admin">Content admin</Link></footer></main>;
}
