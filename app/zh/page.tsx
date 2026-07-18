"use client";

import CommunityBoard from "./components/community-board";
import SelfCheck from "./components/self-check";
import ThemeControls from "../components/theme-controls";
import LanguageSwitch from "../components/language-switch";
import EnglishChecker from "../components/english-checker";

const learningCards = [
  ["否认与改写", "反复否认说过的话，让你开始怀疑自己的记忆和判断。", "🪞", "/zh/learn#gaslighting"],
  ["羞辱与贬低", "不讨论事情，转而攻击你的能力、人格、外貌或价值。", "🥀", "/zh/learn#humiliation"],
  ["孤立与控制", "切断朋友、工作、钱和出行，让你越来越难独立选择。", "🕊️", "/zh/learn#control"],
  ["为什么外人容易看反", "对方可能很冷静，而被长期逼迫的人只在最后一幕崩溃。", "⛈️", "/zh/learn#darvo"],
];

const helpLines = [
  { number: "110 / 120", name: "正在发生危险或需要急救", note: "危险、暴力、限制自由、受伤时优先" },
  { number: "12356", name: "全国统一心理援助热线", note: "心理疏导与危机干预" },
  { number: "12338", name: "妇女儿童维权服务", note: "婚姻家庭、家暴与权益咨询" },
  { number: "12348", name: "公共法律服务热线", note: "法律咨询、法援与证据保存" },
  { number: "12355", name: "青少年服务台", note: "青少年心理与法律支持" },
];

export default function Home() {
  return (
    <main className="zh-page">
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark">长</span><span>长成自己</span></a>
        <nav><a href="#learn">认识情感操控</a><a href="#self-check">关系自查</a><a href="#tool">拆解聊天</a><a href="#community">匿名互助</a><a href="#safety">现实安全支持</a><LanguageSwitch language="zh" /></nav>
        <ThemeControls language="zh" />
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">长成自己 · 反情感暴力与关系安全工具</p>
          <h1>把自己领回来，<br />再按自己的方式长大一次。</h1>
          <p className="hero-subtitle">当一段对话让你反复内疚、怀疑自己、解释不清，我们陪你把真正的信息、情绪压力和危险信号一层层分开。</p>
          <div className="hero-actions"><a className="hero-primary" href="#tool">开始拆解聊天</a><a className="hero-secondary" href="#self-check">先做关系自查</a></div>
          <div className="trust-row"><span>匿名使用</span><span>AI 辅助解读</span><span>本站不保存文本</span><span>不做人格诊断</span></div>
        </div>
        <div className="comfort-card" aria-label="写给正在怀疑自己的你">
          <span className="soft-orb orb-one" /><span className="soft-orb orb-two" />
          <p>“为什么每次说到最后，<br />都变成了我的错？”</p>
          <strong>先别急着证明自己。<br />我们从原话开始看。</strong>
          <div className="chat-line left">你是不是又想多了？</div>
          <div className="chat-line right">我只是说，我不舒服。</div>
          <div className="chat-line left">都是为了你好。</div>
        </div>
      </section>

      <section className="learn" id="learn">
        <div className="section-heading"><p className="eyebrow">先认识它</p><h2>情感操控不一定大喊大叫</h2><p>它也可能披着“爱你、为你好、你太敏感”的外衣。我们不隔着屏幕诊断谁是NPD，只辨认具体行为。</p></div>
        <div className="learn-grid">{learningCards.map(([title, description, icon, href], index) => <a href={href} key={href}><article><i>{icon}</i><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{description}</p><b>点开看看 →</b></article></a>)}</div>
        <p className="learn-note">一个句子不能定义一段关系。真正需要警惕的是：这些行为是否反复发生、是否升级，以及你说“不”之后会发生什么。<a href="/zh/learn">查看全部通俗科普 →</a></p>
      </section>

      <EnglishChecker language="zh" />

      <section className="pain-section">
        <div className="section-heading"><p className="eyebrow">你可能正在经历</p><h2>有些难受，很难向别人解释</h2></div>
        <div className="pain-grid">
          <a href="#self-check"><article><p>“是不是我真的太敏感？”</p><span>点进来做一次非诊断式关系与身心状态自查。</span></article></a>
          <a href="#learn"><article><p>“我解释了很久，怎么又成了我的错？”</p><span>辨认否认、羞辱、冷处理、话题转移与强制控制。</span></article></a>
          <a href="#safety"><article><p>“我想离开，可钱、家人和威胁都卡着我。”</p><span>先看危险信号和中国地区现实求助，不把它只当沟通问题。</span></article></a>
        </div>
      </section>

      <SelfCheck />
      <CommunityBoard />

      <section className="credibility">
        <strong>公开证据，也公开边界</strong>
        <p>这是一个跨学科研究共建计划，正在邀请心理学、心理健康、社会工作与数理统计相关研究者参与方法审核与迭代。本轮检索核对60余条学术、机构与同类循证工具资料，首批公开26项可直接查看的核心来源。 <a href="/zh/learn#sources">查看来源与适用边界 →</a></p>
      </section>

      <section className="safety" id="safety">
        <details><summary>如果现实安全受到威胁：查看中国地区支持方式</summary><div className="compact-help">{helpLines.map((line) => <a href={`tel:${line.number.split(" ")[0]}`} key={line.number}><strong>{line.number}</strong><span>{line.name} · {line.note}</span></a>)}</div><p>热线接通与服务时间可能因地区而异。正在发生危险时优先拨110，受伤或需要急救拨120。</p></details>
      </section>

      <footer><strong>长成自己</strong><span>反对情感暴力 · 不给任何人贴诊断标签 · 把选择还给你</span><a href="/admin">内容管理</a></footer>
    </main>
  );
}
