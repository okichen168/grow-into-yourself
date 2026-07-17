"use client";

type BarragePost = {
  id: number;
  content: string;
  countryName: string | null;
  city: string | null;
  createdAt: string;
};

function timeLabel(value: string, language: "en" | "zh") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return language === "zh" ? "时间未显示" : "Time not shown";
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function CommunityBarrage({ posts, language, onSelect }: { posts: BarragePost[]; language: "en" | "zh"; onSelect: (id: number) => void }) {
  // Two tracks keep every approved note visible on narrow screens without overlap.
  const trackCount = 2;
  const tracks = Array.from({ length: trackCount }, (_, track) => posts.filter((_, index) => index % trackCount === track));

  return <div className="globe-barrage" aria-label={language === "zh" ? "审核通过的世界留言弹幕" : "Approved world-note stream"}>
    {tracks.map((track, trackIndex) => track.length ? <div className="barrage-lane" data-lane={trackIndex} key={trackIndex}>
      <div className="barrage-track">{[0, 1].map((copy) => <div className="barrage-set" aria-hidden={copy === 1} key={copy}>{track.map((post) => {
        const place = [post.city, post.countryName].filter(Boolean).join(" / ") || (language === "zh" ? "未公开地点" : "Location not shared");
        return <button type="button" tabIndex={copy === 1 ? -1 : 0} onClick={() => onSelect(post.id)} key={`${trackIndex}-${post.id}-${copy}`}>
          <span>{post.content}</span><small>· {place} · {timeLabel(post.createdAt, language)}</small>
        </button>;
      })}</div>)}</div>
    </div> : null)}
  </div>;
}
