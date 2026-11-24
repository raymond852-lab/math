import { useEffect, useMemo, useRef, useState } from "react";

// ---------- Records API ----------
async function callApi(action: string, args: Record<string, unknown>) {
  const res = await fetch("actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(typeof json?.error === "string" ? json.error : "連唔到紀錄，請稍後再試。");
  }
  return json.data;
}

type Attempt = {
  id: string;
  created_at: string;
  value: { score: number; total: number; answers: number[] };
};

// ---------- Content ----------
type FactorInfo = { num: number; pairs: number[][]; all: number[]; tip: string };
const FACTORS: FactorInfo[] = [
  { num: 30, pairs: [[1, 30], [2, 15], [3, 10], [5, 6]], all: [1, 2, 3, 5, 6, 10, 15, 30], tip: "貼士：2 同 15 係最容易漏咗嘅一對，記得唔好漏咗佢哋呀！" },
  { num: 12, pairs: [[1, 12], [2, 6], [3, 4]], all: [1, 2, 3, 4, 6, 12], tip: "貼士：由 1 開始，逐個試，試到 3 乘 4 就已經齊晒喇。" },
  { num: 18, pairs: [[1, 18], [2, 9], [3, 6]], all: [1, 2, 3, 6, 9, 18], tip: "貼士：3 乘 6 係 18，成對記低就唔會漏。" },
];

type QuizQ = { q: string; options: string[]; correct: number; explain: string };
const QUIZ: QuizQ[] = [
  { q: "30 嘅所有因數係？", options: ["1，3，5，6，10，30", "1，2，3，5，6，10，15，30"], correct: 1, explain: "記得成對搵，2 同 15 好容易漏咗，唔好漏咗佢。" },
  { q: "12 同 18 有幾多個公因數？", options: ["3 個", "4 個"], correct: 1, explain: "12 同 18 嘅公因數係 1、2、3、6，一共有 4 個。" },
  { q: "27 同 54 嘅最大公因數係？", options: ["3", "27"], correct: 1, explain: "54 係 27 嘅倍數，大數係細數嘅倍數，最大公因數就係細數 27。" },
  { q: "3 係唔係 56 同 84 嘅公因數？", options: ["係", "唔係"], correct: 1, explain: "56 ÷ 3 除唔盡，兩個都要得，先叫公因數。" },
  { q: "21 同 35 用短除法，第一步應用咩數除？", options: ["1", "7"], correct: 1, explain: "1 除咩都唔變，幫唔到手，要用大過 1 嘅公因數 7。" },
  { q: "24 同 20 嘅最大公因數係？", options: ["2", "4"], correct: 1, explain: "24 同 20 要除到盡：2 × 2 = 4，唔好除一次就停。" },
];

type ShortRow = { divisor: number; resultA: number; resultB: number };
type ShortExample = { id: string; title: string; sub: string; start: [number, number]; rows: ShortRow[]; hcf: string; notes: string[] };
const SHORT_EXAMPLES: ShortExample[] = [
  {
    id: "A", title: "例子 A：21 同 35", sub: "一步就搞掂，記得唔好用 1。",
    start: [21, 35], rows: [{ divisor: 7, resultA: 3, resultB: 5 }], hcf: "7",
    notes: [
      "準備好未？諗吓邊個數可以同時除盡 21 同 35？",
      "第一步：用 7 除。記住唔好用 1，因為 1 除咩都唔變。",
      "21 ÷ 7 = 3，35 ÷ 7 = 5。3 同 5 已經冇公因數喇，可以停。",
      "完成！最大公因數就係左邊嘅 7。",
    ],
  },
  {
    id: "B", title: "例子 B：24 同 20", sub: "要除兩次，唔好除一次就停。",
    start: [24, 20], rows: [{ divisor: 2, resultA: 12, resultB: 10 }, { divisor: 2, resultA: 6, resultB: 5 }], hcf: "2 × 2 = 4",
    notes: [
      "準備好未？先諗吓邊個數可以同時除盡 24 同 20？",
      "第一步：用 2 除，得到 12 同 10。",
      "第二步：12 同 10 仲有公因數 2，唔可以停！",
      "再用 2 除，得到 6 同 5。",
      "6 同 5 已經冇公因數喇，可以停。",
      "完成！左邊乘埋：2 × 2 = 4。如果除一次就停，就會錯咗做 2。",
    ],
  },
  {
    id: "C", title: "例子 C：30 同 42", sub: "先用 3，再用 2，一步一步嚟。",
    start: [30, 42], rows: [{ divisor: 3, resultA: 10, resultB: 14 }, { divisor: 2, resultA: 5, resultB: 7 }], hcf: "3 × 2 = 6",
    notes: [
      "準備好未？先諗吓邊個數可以同時除盡 30 同 42？",
      "第一步：用 3 除，得到 10 同 14。",
      "第二步：10 同 14 仲有公因數 2，繼續除！",
      "再用 2 除，得到 5 同 7。",
      "5 同 7 已經冇公因數喇，可以停。",
      "完成！左邊乘埋：3 × 2 = 6。",
    ],
  },
];

function formatAttemptDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("zh-HK", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function App() {
  // Section 1
  const [factorIndex, setFactorIndex] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const factor = FACTORS[factorIndex];
  const revealedPairs = factor.pairs.slice(0, revealed);
  const revealedFactors = useMemo(() => {
    const set = new Set<number>();
    revealedPairs.forEach(([a, b]) => { set.add(a); set.add(b); });
    return Array.from(set).sort((a, b) => a - b);
  }, [revealedPairs]);

  // Section 2
  const [check3, setCheck3] = useState<null | boolean>(null);
  const [check7, setCheck7] = useState<null | boolean>(null);

  // Section 3
  const [shortSteps, setShortSteps] = useState<number[]>([0, 0, 0]);

  // Section 5 quiz + records
  const [answers, setAnswers] = useState<(number | null)[]>(Array(6).fill(null));
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(true);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const savedRoundRef = useRef(false);
  const saveKeyRef = useRef<string | null>(null);

  const correctCount = answers.reduce((sum, ans, i) => sum + (ans === QUIZ[i].correct ? 1 : 0), 0);
  const answeredCount = answers.filter((a) => a !== null).length;
  const completed = answeredCount === 6;

  async function reloadRecords() {
    const data = await callApi("records.list", { collection: "quiz_attempts" });
    const list = (data?.records ?? []) as Attempt[];
    setAttempts(list.slice(0, 3));
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await reloadRecords();
        if (alive) setAttemptsError(null);
      } catch {
        if (alive) setAttemptsError("而家連唔到紀錄，唔緊要，照樣可以練習。");
      } finally {
        if (alive) setAttemptsLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!completed || savedRoundRef.current) return;
    savedRoundRef.current = true;
    if (!saveKeyRef.current) {
      saveKeyRef.current = `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    const key = saveKeyRef.current;
    setSaveStatus("儲存中…");
    (async () => {
      try {
        await callApi("records.create", {
          collection: "quiz_attempts",
          value: { score: correctCount, total: 6, answers: answers as number[] },
          idempotency_key: key,
        });
        await reloadRecords();
        setSaveStatus("已經儲存咗今次嘅成績。");
      } catch {
        setSaveStatus("今次成績暫時儲存唔到，唔緊要，你嘅答案已經喺上面。");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  function chooseAnswer(qi: number, oi: number) {
    setAnswers((prev) => prev.map((v, i) => (i === qi ? oi : v)));
  }
  function restartQuiz() {
    setAnswers(Array(6).fill(null));
    savedRoundRef.current = false;
    saveKeyRef.current = null;
    setSaveStatus(null);
    document.getElementById("quiz")?.scrollIntoView({ behavior: "smooth" });
  }

  function shortRowsToShow(ex: ShortExample, step: number) {
    if (step === 0) return [] as (ShortRow & { showResult: boolean })[];
    if (step >= ex.rows.length * 2 + 1) return ex.rows.map((r) => ({ ...r, showResult: true }));
    const count = Math.ceil(step / 2);
    return ex.rows.slice(0, count).map((r, i) => ({ ...r, showResult: i < count - 1 || step % 2 === 0 }));
  }

  const resultMessage = correctCount === 6
    ? "嘩！全部啱曬！你真係搞清楚曬喇，叻到不得了！"
    : correctCount >= 4
    ? "做得好好！差少少就滿分，再睇吓上面嗰啲小貼士就得喇。"
    : correctCount >= 2
    ? "唔緊要，慢慢嚟，你已經識咗好多喇，再返上去睇吓短除法三步。"
    : "唔使急，呢啲題目係有啲難度，我哋一齊再睇一次，慢慢嚟。";

  return (
    <div data-safe-area-inset-root style={{ boxSizing: "border-box", paddingTop: "var(--safe-area-inset-top)" }} className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--ink)]">
      {/* Sticky nav */}
      <header data-safe-area-sticky-top style={{ top: "var(--safe-area-inset-top)" }} className="sticky z-30 border-b border-[var(--line)] bg-[var(--bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-2 px-3 py-3 sm:px-5">
          <a href="#hero" className="flex items-center gap-2 rounded-full bg-[var(--ink)] px-3 py-2 text-[15px] font-black text-[var(--bg)]">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--yellow)] text-[15px] text-[#2D2A26]">✦</span>
            公因數小教室
          </a>
          <nav className="flex flex-wrap gap-1.5" aria-label="課堂目錄">
            <a href="#s1" className="rounded-full bg-[var(--surface)] px-3 py-2 text-[14px] font-bold shadow-sm">成對搵</a>
            <a href="#s2" className="rounded-full bg-[var(--surface)] px-3 py-2 text-[14px] font-bold shadow-sm">公因數</a>
            <a href="#s3" className="rounded-full bg-[var(--surface)] px-3 py-2 text-[14px] font-bold shadow-sm">短除法</a>
            <a href="#s4" className="rounded-full bg-[var(--surface)] px-3 py-2 text-[14px] font-bold shadow-sm">特別題型</a>
            <a href="#quiz" className="rounded-full bg-[var(--orange)] px-3 py-2 text-[14px] font-black text-white shadow-sm">即刻練習 →</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-3 pb-10 sm:px-5">
        {/* HERO */}
        <section id="hero" className="relative overflow-hidden rounded-[32px] bg-[var(--surface-2)] px-5 pb-7 pt-8 mt-5 soft-shadow sm:px-9 sm:pt-10">
          <div className="wavy absolute right-0 top-0 h-28 w-40 opacity-60" aria-hidden="true" />
          <p className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-[15px] font-bold text-[#8A4A12]">✨ 專為你而設 · 慢慢嚟，唔使急 <span className="rounded-full bg-[var(--yellow)] px-2 py-0.5">你做得到㗎！</span></p>
          <h1 className="mt-5 text-[clamp(2.4rem,7vw,4.4rem)] font-black leading-[1.05] tracking-tight">公因數同<br />最大公因數<br /><span className="text-[var(--orange-deep)]">小教室</span></h1>
          <p className="mt-4 max-w-[640px] text-[clamp(1.15rem,3vw,1.5rem)] font-bold leading-relaxed">由因數開始，一步步搞清楚短除法。</p>
          <p className="mt-3 max-w-[640px] rounded-2xl bg-[var(--mint)] px-4 py-3 text-[17px] font-bold leading-relaxed sm:text-lg">你之前喺呢度差少少，宜家一齊搞清楚。我哋一步一步嚟，錯咗都唔緊要。</p>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] bg-[var(--surface)] p-5 card-shadow"><div className="text-3xl" aria-hidden="true">🔍</div><h2 className="mt-3 text-[22px] font-black">因數</h2><p className="mt-1 text-[17px] font-bold leading-relaxed">除得盡佢嘅數</p></div>
            <div className="rounded-[24px] bg-[var(--surface)] p-5 card-shadow"><div className="text-3xl" aria-hidden="true">🤝</div><h2 className="mt-3 text-[22px] font-black">公因數</h2><p className="mt-1 text-[17px] font-bold leading-relaxed">兩個都有</p></div>
            <div className="rounded-[24px] bg-[var(--orange)] p-5 text-white card-shadow"><div className="text-3xl" aria-hidden="true">👑</div><h2 className="mt-3 text-[22px] font-black">最大公因數</h2><p className="mt-1 text-[17px] font-bold leading-relaxed">最大嗰個</p></div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[24px] bg-[var(--surface)] p-5">
            <span className="rounded-full bg-[var(--yellow)] px-3 py-1 text-[15px] font-black">例如</span>
            <p className="text-[18px] font-bold leading-relaxed sm:text-xl">12 同 18 嘅公因數係 <strong className="num">1、2、3、6</strong>，最大公因數係 <strong className="num text-[var(--orange-deep)]">6</strong>。</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="#s1" className="rounded-full bg-[var(--ink)] px-5 py-3 text-[17px] font-black text-[var(--bg)]">由第一課開始 →</a>
            <a href="#quiz" className="rounded-full bg-white px-5 py-3 text-[17px] font-black shadow">直接去練習</a>
          </div>
        </section>

        {/* SECTION 1 */}
        <section id="s1" className="mt-8 rounded-[32px] bg-[var(--surface)] p-5 soft-shadow sm:p-8">
          <p className="text-[15px] font-black tracking-widest text-[var(--orange-deep)]">第 1 課</p>
          <h2 className="mt-1 text-[clamp(1.7rem,5vw,2.5rem)] font-black leading-tight">點樣唔漏因數 — 成對搵</h2>
          <p className="mt-3 max-w-[760px] text-[18px] font-medium leading-relaxed sm:text-xl">試吓由細到大諗：1 乘幾等於 30？搵到一對，就記低一對，咁就唔會漏。</p>
          <div className="mt-4 rounded-2xl bg-[var(--yellow)]/50 px-4 py-3 text-[18px] font-black">口訣：因數要成對，由細到大試。</div>

          <div className="mt-5 flex flex-wrap gap-2">
            {FACTORS.map((f, i) => (
              <button key={f.num} onClick={() => { setFactorIndex(i); setRevealed(0); }} className={`rounded-full px-5 py-3 text-[17px] font-black shadow-sm ${i === factorIndex ? "bg-[var(--orange)] text-white" : "bg-[var(--surface-2)]"}`}>睇 {f.num} 嘅因數</button>
            ))}
          </div>

          <div className="mt-5 rounded-[24px] border-2 border-dashed border-[var(--line)] bg-[var(--bg)] p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xl font-black sm:text-2xl">宜家睇緊：<span className="num text-[var(--orange-deep)]">{factor.num}</span> 嘅因數</h3><span className="rounded-full bg-[var(--mint)] px-3 py-1 text-[15px] font-black">已經揭開 {revealed} 對 / 一共 {factor.pairs.length} 對</span></div>
            <div className="mt-4 grid gap-2">
              {factor.pairs.map(([a, b], i) => (
                <div key={`${a}-${b}`} className={`flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-[18px] font-bold sm:text-xl ${i < revealed ? "bg-[var(--surface)] shadow-sm" : "bg-black/[0.03] opacity-50"}`}>
                  <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[15px]">第 {i + 1} 對</span>
                  {i < revealed ? <><span className="num text-2xl">{a} × {b} = {factor.num}</span>{factor.num === 30 && a === 2 && <span className="rounded-full bg-[var(--pink)] px-3 py-1 text-[14px]">好容易漏咗！</span>}</> : <span>？ × ？ = {factor.num}</span>}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setRevealed((v) => Math.min(factor.pairs.length, v + 1))} disabled={revealed >= factor.pairs.length} className="rounded-full bg-[var(--ink)] px-5 py-3 text-[17px] font-black text-[var(--bg)] disabled:opacity-40">{revealed >= factor.pairs.length ? "已經揭晒喇！" : "揭開下一對 →"}</button>
              <button onClick={() => setRevealed(factor.pairs.length)} className="rounded-full bg-white px-5 py-3 text-[17px] font-black shadow">一次過睇曬</button>
              <button onClick={() => setRevealed(0)} className="rounded-full bg-[var(--surface-2)] px-5 py-3 text-[17px] font-black">由頭嚟過</button>
            </div>
            <div className="mt-5 rounded-2xl bg-[var(--surface)] p-4">
              <p className="font-black">{factor.num} 嘅因數（由細到大）：</p>
              <p className="num mt-2 min-h-[44px] text-[clamp(1.4rem,5vw,2rem)] font-bold leading-snug [overflow-wrap:anywhere]">{revealed === 0 ? "撳上面個掣，逐對揭開嚟睇。" : revealedFactors.join("、")}</p>
              {revealed === factor.pairs.length && <p className="mt-2 rounded-xl bg-[var(--mint)] px-3 py-2 text-[16px] font-bold">{factor.tip}</p>}
            </div>
          </div>
        </section>

        {/* SECTION 2 */}
        <section id="s2" className="mt-8 rounded-[32px] bg-[var(--mint)] p-5 soft-shadow sm:p-8">
          <p className="text-[15px] font-black tracking-widest text-[var(--mint-deep)]">第 2 課</p>
          <h2 className="mt-1 text-[clamp(1.7rem,5vw,2.5rem)] font-black leading-tight">公因數一定要兩個都除得盡</h2>
          <p className="mt-3 max-w-[760px] text-[18px] font-bold leading-relaxed sm:text-xl">一個數要同時除得盡兩個數，先可以叫佢哋嘅公因數。只要有一個除唔盡，就唔係喇。</p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* Checker 3 */}
            <article className="rounded-[24px] bg-[var(--surface)] p-5 card-shadow">
              <p className="rounded-full bg-[var(--orange-soft)] px-3 py-1 text-[15px] font-black inline-block">試吓答</p>
              <h3 className="mt-3 text-[22px] font-black leading-snug">3 係唔係 56 同 84 嘅公因數？</h3>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => setCheck3(true)} className={`rounded-2xl py-4 text-xl font-black ${check3 === true ? "bg-[var(--orange)] text-white" : "bg-[var(--surface-2)]"}`}>係</button>
                <button onClick={() => setCheck3(false)} className={`rounded-2xl py-4 text-xl font-black ${check3 === false ? "bg-[var(--mint-deep)] text-white" : "bg-[var(--surface-2)]"}`}>唔係</button>
              </div>
              {check3 !== null && (
                <div className="mt-4">
                  <p className={`rounded-2xl px-4 py-3 text-[17px] font-black ${check3 === false ? "bg-[var(--mint)]" : "bg-[var(--pink)]"}`}>{check3 === false ? "啱曬！你諗得好清楚。" : "差少少啫，唔緊要，一齊睇吓點解。"}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-2xl bg-[var(--bg)] p-3"><p className="num text-xl font-black">56 ÷ 3</p><p className="mt-1 font-black text-[var(--orange-deep)]">除唔盡 ✕</p></div>
                    <div className="rounded-2xl bg-[var(--bg)] p-3"><p className="num text-xl font-black">84 ÷ 3 = 28</p><p className="mt-1 font-black text-[var(--mint-deep)]">除得盡 ✓</p></div>
                  </div>
                  <p className="mt-3 text-[17px] font-bold leading-relaxed">所以答案係：唔係。因為要兩個都得，先叫公因數。</p>
                </div>
              )}
              {check3 === null && <p className="mt-4 text-[16px] font-bold text-[var(--muted)]">撳「係」或者「唔係」，我哋即刻一齊睇。</p>}
            </article>

            {/* Checker 7 */}
            <article className="rounded-[24px] bg-[var(--surface)] p-5 card-shadow">
              <p className="rounded-full bg-[var(--blue-soft)] px-3 py-1 text-[15px] font-black inline-block">再試一個</p>
              <h3 className="mt-3 text-[22px] font-black leading-snug">7 係唔係 56 同 84 嘅公因數？</h3>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => setCheck7(true)} className={`rounded-2xl py-4 text-xl font-black ${check7 === true ? "bg-[var(--mint-deep)] text-white" : "bg-[var(--surface-2)]"}`}>係</button>
                <button onClick={() => setCheck7(false)} className={`rounded-2xl py-4 text-xl font-black ${check7 === false ? "bg-[var(--orange)] text-white" : "bg-[var(--surface-2)]"}`}>唔係</button>
              </div>
              {check7 !== null && (
                <div className="mt-4">
                  <p className={`rounded-2xl px-4 py-3 text-[17px] font-black ${check7 === true ? "bg-[var(--mint)]" : "bg-[var(--pink)]"}`}>{check7 === true ? "啱曬！兩個都除得盡，所以 7 係公因數。" : "差少少啫，睇吓下面兩個除數，兩個都除得盡㗎。"}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-2xl bg-[var(--bg)] p-3"><p className="num text-xl font-black">56 ÷ 7 = 8</p><p className="mt-1 font-black text-[var(--mint-deep)]">除得盡 ✓</p></div>
                    <div className="rounded-2xl bg-[var(--bg)] p-3"><p className="num text-xl font-black">84 ÷ 7 = 12</p><p className="mt-1 font-black text-[var(--mint-deep)]">除得盡 ✓</p></div>
                  </div>
                  <p className="mt-3 text-[17px] font-bold leading-relaxed">兩個都除得盡，所以 7 係 56 同 84 嘅公因數。</p>
                </div>
              )}
              {check7 === null && <p className="mt-4 text-[16px] font-bold text-[var(--muted)]">撳「係」或者「唔係」，即刻知啱唔啱。</p>}
            </article>
          </div>
        </section>

        {/* SECTION 3 */}
        <section id="s3" className="mt-8 rounded-[32px] bg-[var(--surface)] p-5 soft-shadow sm:p-8">
          <p className="text-[15px] font-black tracking-widest text-[var(--orange-deep)]">第 3 課 · 最重要</p>
          <h2 className="mt-1 text-[clamp(1.7rem,5vw,2.5rem)] font-black leading-tight">短除法三步</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[24px] bg-[var(--surface-2)] p-5"><span className="num grid h-11 w-11 place-items-center rounded-full bg-[var(--orange)] text-xl font-black text-white">1</span><h3 className="mt-3 text-xl font-black">第一步：揀啱除數</h3><p className="mt-2 text-[16px] font-bold leading-relaxed">除數一定要係大過 1 嘅公因數，唔可以用 1，因為 1 除咩都唔變，幫唔到手。</p></div>
            <div className="rounded-[24px] bg-[var(--mint)] p-5"><span className="num grid h-11 w-11 place-items-center rounded-full bg-[var(--mint-deep)] text-xl font-black text-white">2</span><h3 className="mt-3 text-xl font-black">第二步：除到盡為止</h3><p className="mt-2 text-[16px] font-bold leading-relaxed">要一直除到下面兩個數冇公因數為止，即係佢哋互質，先可以停。</p></div>
            <div className="rounded-[24px] bg-[var(--orange)] p-5 text-white"><span className="num grid h-11 w-11 place-items-center rounded-full bg-white text-xl font-black text-[#E86A1A]">3</span><h3 className="mt-3 text-xl font-black">第三步：左邊乘埋</h3><p className="mt-2 text-[16px] font-bold leading-relaxed">最大公因數 = 左邊所有除數乘埋，唔係下面嗰兩個數。</p></div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {SHORT_EXAMPLES.map((ex, ei) => {
              const step = shortSteps[ei];
              const maxStep = ex.rows.length * 2 + 1;
              const rowsToShow = shortRowsToShow(ex, step);
              return (
                <article key={ex.id} className="flex flex-col rounded-[24px] border-2 border-[var(--line)] bg-[var(--bg)] p-5">
                  <h3 className="text-[21px] font-black">{ex.title}</h3>
                  <p className="mt-1 text-[15px] font-bold text-[var(--muted)]">{ex.sub}</p>
                  <div className="mt-4 flex-1 rounded-2xl bg-[var(--surface)] p-4">
                    <div className="overflow-x-auto">
                      <div className="min-w-[170px]">
                        <div className="flex items-center gap-3 border-b-2 border-[var(--line)] pb-2"><span className="w-8 text-center text-[var(--muted)]">　</span><span className="num flex-1 text-center text-2xl font-black">{ex.start[0]}</span><span className="num flex-1 text-center text-2xl font-black">{ex.start[1]}</span></div>
                        {rowsToShow.map((r, ri) => (
                          <div key={ri} className="flex items-center gap-3 border-b-2 border-[var(--line)] py-2"><span className="num grid h-8 w-8 place-items-center rounded-full bg-[var(--yellow)] text-lg font-black">{r.divisor}</span><span className="num flex-1 text-center text-2xl font-black">{r.showResult ? r.resultA : "？"}</span><span className="num flex-1 text-center text-2xl font-black">{r.showResult ? r.resultB : "？"}</span></div>
                        ))}
                        {rowsToShow.length === 0 && <p className="py-3 text-center text-[15px] font-bold text-[var(--muted)]">撳「下一步」，逐格揭開。</p>}
                      </div>
                    </div>
                    {step >= maxStep && <div className="mt-3 rounded-2xl bg-[var(--mint)] px-4 py-3 text-center"><p className="text-[15px] font-black">最大公因數</p><p className="num text-2xl font-black text-[var(--mint-deep)]">{ex.hcf}</p></div>}
                  </div>
                  <p className="mt-3 min-h-[72px] rounded-2xl bg-white/70 px-3 py-2 text-[16px] font-bold leading-relaxed">{ex.notes[step]}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setShortSteps((prev) => prev.map((v, i) => (i === ei ? Math.min(maxStep, v + 1) : v)))} disabled={step >= maxStep} className="flex-1 rounded-full bg-[var(--ink)] px-4 py-3 text-[16px] font-black text-[var(--bg)] disabled:opacity-40">{step >= maxStep ? "已經做完喇！" : "下一步 →"}</button>
                    <button onClick={() => setShortSteps((prev) => prev.map((v, i) => (i === ei ? 0 : v)))} className="rounded-full bg-[var(--surface-2)] px-4 py-3 text-[16px] font-black">由頭嚟過</button>
                  </div>
                  <p className="mt-2 text-center text-[14px] font-bold text-[var(--muted)]">第 {step} 步 / 一共 {maxStep} 步</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* SECTION 4 */}
        <section id="s4" className="mt-8 rounded-[32px] bg-[var(--surface)] p-5 soft-shadow sm:p-8">
          <p className="text-[15px] font-black tracking-widest text-[var(--orange-deep)]">第 4 課</p>
          <h2 className="mt-1 text-[clamp(1.7rem,5vw,2.5rem)] font-black leading-tight">特別題型 — 睇清楚先好做</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <article className="rounded-[24px] bg-[var(--blue-soft)] p-6">
              <span className="rounded-full bg-white px-3 py-1 text-[15px] font-black">P 同 Q 題</span>
              <h3 className="mt-3 text-[22px] font-black leading-snug">先搵返 P 同 Q 係幾多</h3>
              <p className="mt-3 text-[18px] font-bold leading-relaxed">P 嘅第一個倍數就係 P 自己，所以 P = 24。<br />Q 嘅最大因數就係 Q 自己，所以 Q = 20。<br />然後搵 24 同 20 嘅最大公因數 = <strong className="num text-[var(--orange-deep)]">4</strong>。</p>
              <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-[16px] font-black">記住：第一個倍數同最大因數，都係自己本身。</p>
            </article>
            <article className="rounded-[24px] bg-[var(--surface-2)] p-6">
              <span className="rounded-full bg-[var(--yellow)] px-3 py-1 text-[15px] font-black">★ 題</span>
              <h3 className="mt-3 text-[22px] font-black leading-snug">搵 ★ 同最大公因數</h3>
              <div className="mt-3 rounded-2xl bg-[var(--surface)] p-4">
                <div className="flex items-center gap-3 border-b-2 border-[var(--line)] pb-2"><span className="num grid h-9 w-9 place-items-center rounded-full bg-[var(--yellow)] text-lg font-black">6</span><span className="num flex-1 text-center text-2xl font-black">★</span><span className="num flex-1 text-center text-2xl font-black">60</span></div>
                <div className="flex items-center gap-3 py-2"><span className="num grid h-9 w-9 place-items-center rounded-full bg-[var(--yellow)] text-lg font-black">2</span><span className="num flex-1 text-center text-2xl font-black">6</span><span className="num flex-1 text-center text-2xl font-black">10</span></div>
                <div className="flex items-center gap-3 border-t-2 border-[var(--line)] pt-2"><span className="w-9 text-center">　</span><span className="num flex-1 text-center text-2xl font-black">3</span><span className="num flex-1 text-center text-2xl font-black">5</span></div>
              </div>
              <p className="mt-3 text-[18px] font-bold leading-relaxed">★ = 6 × 6 = <strong className="num">36</strong>，但最大公因數 = 6 × 2 = <strong className="num">12</strong>。唔好將 ★ 同最大公因數撈亂。</p>
              <p className="mt-4 rounded-2xl bg-[var(--mint)] px-4 py-3 text-[16px] font-black leading-relaxed">貼士：大數係細數嘅倍數，最大公因數就係細數。例如 27 同 54，最大公因數就係 27。</p>
            </article>
          </div>
        </section>

        {/* SECTION 5 QUIZ */}
        <section id="quiz" className="mt-8 rounded-[32px] bg-[var(--orange)] p-5 text-white soft-shadow sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-black tracking-widest">第 5 課 · 即刻練習</p>
              <h2 className="mt-1 text-[clamp(1.7rem,5vw,2.5rem)] font-black leading-tight">試吓自己做</h2>
              <p className="mt-2 max-w-[620px] text-[17px] font-bold leading-relaxed">唔怕錯，錯咗先學到嘢。每完成一次練習，成績會儲存一次，方便你睇返自己嘅進步。</p>
            </div>
            <div className="rounded-[20px] bg-white px-5 py-3 text-center text-[#2D2A26] shadow"><p className="text-[14px] font-black">答啱咗</p><p className="num text-3xl font-black"><span className="text-[var(--orange-deep)]">{correctCount}</span> / 6</p><p className="text-[13px] font-bold">已經答咗 {answeredCount} / 6 題</p></div>
          </div>

          <div className="mt-6 grid gap-4">
            {QUIZ.map((item, qi) => {
              const selected = answers[qi];
              const isCorrect = selected === item.correct;
              return (
                <article key={qi} className="rounded-[24px] bg-[var(--surface)] p-5 text-[var(--ink)] card-shadow">
                  <div className="flex flex-wrap items-center gap-2"><span className="num rounded-full bg-[var(--ink)] px-3 py-1 text-[14px] font-black text-[var(--bg)]">第 {qi + 1} 題</span>{selected !== null && <span className={`rounded-full px-3 py-1 text-[14px] font-black ${isCorrect ? "bg-[var(--mint)]" : "bg-[var(--pink)]"}`}>{isCorrect ? "啱曬！" : "差少少，睇吓解釋"}</span>}</div>
                  <h3 className="mt-3 text-[21px] font-black leading-snug sm:text-[23px]">{item.q}</h3>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {item.options.map((opt, oi) => {
                      const isSelected = selected === oi;
                      const isRight = oi === item.correct;
                      return (
                        <button key={oi} onClick={() => chooseAnswer(qi, oi)} className={`rounded-2xl border-2 px-4 py-4 text-left text-[18px] font-black leading-snug [overflow-wrap:anywhere] ${isSelected ? (isCorrect ? "border-[var(--mint-deep)] bg-[var(--mint)]" : "border-[#E86A1A] bg-[var(--orange-soft)]") : selected !== null && isRight ? "border-[var(--mint-deep)] bg-[var(--mint)]/60" : "border-[var(--line)] bg-[var(--bg)]"}`}>
                          <span className="num mr-2 inline-grid h-8 w-8 place-items-center rounded-full bg-white shadow-sm">{oi === 0 ? "A" : "B"}</span>
                          {opt}
                          {isSelected && <span className="ml-2">{isCorrect ? "✓" : "✕"}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {selected !== null && <p className="mt-3 rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-[16px] font-bold leading-relaxed">💡 {item.explain}</p>}
                  {selected === null && <p className="mt-3 text-[15px] font-bold text-[var(--muted)]">撳一個答案，唔啱都唔緊要。</p>}
                </article>
              );
            })}
          </div>

          {completed && (
            <div className="mt-5 rounded-[24px] bg-white p-6 text-center text-[#2D2A26] card-shadow">
              <p className="text-4xl" aria-hidden="true">🎉</p>
              <h3 className="mt-2 text-[26px] font-black leading-snug">你做完喇！答啱咗 {correctCount} / 6</h3>
              <p className="mx-auto mt-2 max-w-[560px] text-[18px] font-bold leading-relaxed">{resultMessage}</p>
              {saveStatus && <p className="mt-2 text-[15px] font-bold text-[var(--muted)]">{saveStatus}</p>}
              <button onClick={restartQuiz} className="mt-4 rounded-full bg-[var(--ink)] px-6 py-3.5 text-[18px] font-black text-white">再做一次</button>
            </div>
          )}

          <div className="mt-5 rounded-[24px] bg-white/20 p-5">
            <h3 className="text-lg font-black">你之前嘅練習紀錄</h3>
            {attemptsLoading && <p className="mt-2 font-bold">載入中…</p>}
            {attemptsError && <p className="mt-2 font-bold">{attemptsError}</p>}
            {!attemptsLoading && !attemptsError && attempts.length === 0 && <p className="mt-2 font-bold">暫時未有紀錄，做完上面 6 題就會喺度出現。</p>}
            {!attemptsLoading && attempts.length > 0 && (
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {attempts.map((a) => (
                  <li key={a.id} className="rounded-2xl bg-white px-4 py-3 text-[#2D2A26]"><p className="num text-2xl font-black">{a.value.score} / {a.value.total}</p><p className="text-[14px] font-bold text-[var(--muted)]">{formatAttemptDate(a.created_at)}</p></li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <footer className="mt-8 rounded-[32px] bg-[var(--ink)] p-6 text-center text-[var(--bg)] sm:p-8">
          <p className="text-[15px] font-black tracking-widest text-[var(--yellow)]">記住口訣</p>
          <p className="mx-auto mt-3 max-w-[720px] text-[clamp(1.3rem,4vw,1.9rem)] font-black leading-snug">公因數要兩個都得，<br className="sm:hidden" />短除要除到盡，<br />左邊乘埋就係 H.C.F.</p>
          <p className="mt-4 text-[15px] font-bold opacity-80">慢慢嚟，你已經行咗好大一步喇。</p>
        </footer>
      </main>
    </div>
  );
}
