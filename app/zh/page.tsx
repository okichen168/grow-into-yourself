import Link from "next/link";
import EnglishChecker from "../components/english-checker";
import ThemeControls from "../components/theme-controls";

export default function ChinesePage() {
  return <main><header className="topbar"><Link className="brand" href="/"><span className="brand-mark">G</span><span>Grow Into Yourself</span></Link><nav><Link href="/">English</Link><a href="#check">上传聊天截图</a></nav><ThemeControls /></header><section className="language-intro"><p className="eyebrow">中文入口</p><h1>看清一段让你不舒服的对话。</h1></section><EnglishChecker language="zh" /><footer><strong>Grow Into Yourself</strong><span>理解行为，把选择留给自己。</span><Link href="/">English</Link></footer></main>;
}
