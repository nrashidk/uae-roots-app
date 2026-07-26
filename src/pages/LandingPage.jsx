import { useEffect, useRef, useState } from "react";
import PublicLayout from "./PublicLayout.jsx";
import "./LandingPage.css";

// The lineage chain that assembles itself in the hero. This is the one bold
// element on the page: Gulf lineage is recited through the fathers, and the
// app's own getGenealogicalName builds exactly this. Placeholder family —
// replace with a neutral example before any public launch.
const CHAIN = [
  { rel: "", name: "شيخة" },
  { rel: "بنت", name: "راشد" },
  { rel: "بن", name: "عبيد" },
  { rel: "بن", name: "عيسى" },
  { rel: "", name: "آل مكتوم" },
];

const CLAIMS = [
  {
    num: "٠١",
    title: "تعدد الزوجات",
    body: "أبناء كل زوجة يظهرون في مجموعتهم، مع ترتيب الزواج محفوظاً. لا خلط ولا أم واحدة مفترضة.",
    wrong: (
      <>
        راشد <s>+ زوجة واحدة</s>
      </>
    ),
    right: <>شيخة ← ٤ أبناء · سمر ← ٢ أبناء</>,
  },
  {
    num: "٠٢",
    title: "روابط الرضاعة",
    body: "الأخ من الرضاعة محرم، وليس قريباً بالدم. يظهر برابط أخضر متقطع لا يُقرأ أبداً كزواج، ولا يدخل في سلسلة النسب.",
    wrong: <s>لا يوجد</s>,
    right: (
      <>
        لطيفة<span className="lp-dash" aria-hidden="true"></span>شيخة
      </>
    ),
  },
  {
    num: "٠٣",
    title: "سلسلة النسب",
    body: "الاسم الكامل يُبنى عبر الأب والجد حتى أقدم جدٍّ مسجَّل، لا حقل «اسم أول» و«اسم عائلة».",
    wrong: <s>شيخة مكتوم</s>,
    right: <>شيخة بنت راشد بن عبيد</>,
  },
];

const PRIVACY = [
  {
    h: "شجرتك خاصة",
    p: "لا تظهر في نتائج البحث، ولا يراها مستخدم آخر. لا ملفات عامة ولا فهرسة.",
  },
  {
    h: "مشفّرة",
    p: "أرقام الهواتف والبريد الإلكتروني وأرقام الهوية مشفّرة داخل قاعدة البيانات.",
  },
  {
    h: "لك حق الحذف",
    p: "احذف فرداً أو حسابك بالكامل. الحذف قابل للتراجع فوراً، ونهائي عند حذف الحساب.",
  },
  {
    h: "لا بيع ولا إعلانات",
    p: "لا نبيع البيانات ولا نشاركها إلا مع مزوّدي الخدمة اللازمين للتشغيل.",
  },
];

function LineageChain() {
  const [shown, setShown] = useState(0);
  const timers = useRef([]);

  const run = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(CHAIN.length);
      return;
    }
    setShown(0);
    CHAIN.forEach((_, i) => {
      timers.current.push(
        setTimeout(() => setShown((n) => Math.max(n, i + 1)), 250 + i * 470),
      );
    });
  };

  useEffect(() => {
    run();
    return () => timers.current.forEach(clearTimeout);
  }, []);

  return (
    <div className="lp-chain-frame">
      <span className="lp-chain-label">النسب كما يُقال</span>
      <div
        className="lp-chain"
        aria-label={CHAIN.map((s) => `${s.rel} ${s.name}`.trim()).join(" ")}
      >
        {CHAIN.map((s, i) => (
          <span key={i} className={`lp-seg${i < shown ? " on" : ""}`}>
            {s.rel && <span className="lp-rel">{s.rel} </span>}
            {s.name}
          </span>
        ))}
      </div>
      <div className="lp-chain-foot">
        <span>
          الاسم يُبنى من الأب إلى الجد إلى أقدم جدٍّ في الشجرة — تلقائياً.
        </span>
        <button type="button" className="lp-replay" onClick={run}>
          أعد التسلسل
        </button>
      </div>
    </div>
  );
}

/**
 * The public landing page — the first screen anyone not signed in sees.
 * `onSignIn` reveals the existing login form; `onPrivacy` opens the policy.
 * Both are callbacks rather than links so this works before URL routing exists;
 * when routing lands, they become route pushes and nothing else changes.
 */
export default function LandingPage({ onSignIn, onSignUp, onPrivacy }) {
  const scrollToClaims = () =>
    document.getElementById("lp-claims")?.scrollIntoView({ behavior: "smooth" });

  return (
    <PublicLayout
      onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      onClaims={scrollToClaims}
      onSignIn={onSignIn}
      onSignUp={onSignUp}
      onPrivacy={onPrivacy}
    >

      <header className="lp-hero">
        <div className="lp-wrap">
          <p className="lp-eyebrow">للعائلة الخليجية</p>
          <h1>شجرة عائلتك، كما هي فعلاً</h1>
          <p className="lp-lede">
            البرامج العالمية تفترض عائلة من زوج وزوجة وأبناء. عائلتنا ليست كذلك.
            هنا تُبنى الشجرة على سلسلة النسب، وتعدد الزوجات، وروابط الرضاعة — كما
            هي.
          </p>
          <div className="lp-cta">
            <button
              type="button"
              className="lp-btn lp-btn-solid"
              onClick={onSignUp}
            >
              ابدأ شجرتك
            </button>
            <button
              type="button"
              className="lp-btn lp-btn-line"
              onClick={onSignIn}
            >
              لدي حساب
            </button>
          </div>
          <LineageChain />
        </div>
      </header>

      <section className="lp-claims" id="lp-claims">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <h2>ثلاثة أشياء تخطئ فيها البرامج الأخرى</h2>
            <p>
              ليست ميزات إضافية. هي الطريقة التي تُقاس بها العائلة عندنا، وبدونها
              تكون الشجرة غير صحيحة.
            </p>
          </div>
          {CLAIMS.map((c) => (
            <div className="lp-claim" key={c.num}>
              <div className="lp-num" aria-hidden="true">
                {c.num}
              </div>
              <div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
              <div className="lp-compare">
                <div className="lp-row">
                  <span className="lp-tag lp-tag-no">غيرنا</span>
                  <span className="lp-mini">{c.wrong}</span>
                </div>
                <div className="lp-row">
                  <span className="lp-tag lp-tag-yes">عندنا</span>
                  <span className="lp-mini">{c.right}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-privacy" id="lp-privacy">
        <div className="lp-wrap">
          <h2>بيانات عائلتك ليست منتجاً</h2>
          <div className="lp-privacy-grid">
            {PRIVACY.map((x) => (
              <div key={x.h}>
                <h4>{x.h}</h4>
                <p>{x.p}</p>
              </div>
            ))}
          </div>
          <p className="lp-note">
            عند بناء الشجرة ستُدخل بيانات أقارب لم يسجّلوا بأنفسهم. نطلب منك إدخال
            ما تعرفه عائلياً فقط، ونتيح لأي فرد طلب تصحيح بياناته أو حذفها.{" "}
            <button type="button" onClick={onPrivacy}>
              اقرأ سياسة الخصوصية
            </button>
          </p>
        </div>
      </section>

      <section className="lp-close">
        <div className="lp-wrap">
          <h2>ابدأ بنفسك. أضف والديك. وستكبر الشجرة.</h2>
          <p>لا تحتاج إلى تجهيز أي شيء مسبقاً — أضف ما تعرفه، وأكمل لاحقاً.</p>
          <button
            type="button"
            className="lp-btn lp-btn-solid"
            onClick={onSignUp}
          >
            ابدأ شجرتك
          </button>
        </div>
      </section>

    </PublicLayout>
  );
}
