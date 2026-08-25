import { useEffect, useRef, useState } from "react";
import PublicLayout from "./PublicLayout.jsx";
import "./LandingPage.css";

// The lineage chain that assembles itself in the hero. This is the one bold
// element on the page: Gulf lineage is recited through the fathers, and the
// app's own getGenealogicalName builds exactly this.
//
// The names are deliberately generic and the family name is «آل فلان» — فلان is
// the Arabic placeholder for "so-and-so", the equivalent of Doe. A real tribal
// or family name here would attach an invented lineage to actual people, and
// any Arabic family name plausibly belongs to someone.
const CHAIN = [
  { rel: "", name: "حصه" },
  { rel: "بنت", name: "ناصر" },
  { rel: "بن", name: "راشد" },
  { rel: "بن", name: "عبيد" },
  { rel: "بن", name: "عيسى" },
  { rel: "", name: "آل فلان" },
];

const CLAIMS = [
  {
    num: "٠١",
    title: "تعدد الزوجات",
    body: "أبناء كل زوجة في مجموعتهم.",
  },
  {
    num: "٠٢",
    title: "روابط الرضاعة",
    body: "الأخ من الرضاعة محرم لا قريب بالدم، برابط أخضر لا يدخل في النسب.",
  },
  {
    num: "٠٣",
    title: "سلسلة النسب",
    body: "الاسم الكامل عبر الأب والجد حتى أقدم جدٍّ مسجَّل.",
  },
];

const PRIVACY = [
  {
    h: "شجرتك خاصة",
    p: "لا تظهر في نتائج البحث، ولا يراها مستخدم آخر. لا ملفات عامة ولا فهرسة.",
  },
  {
    // Names the THREE fields that are actually encrypted (encryptPII is applied to
    // phone and email, and to nothing else). A broader claim
    // — "your family's data is encrypted" — would not be true: names, dates, birth
    // places, professions and every relationship are stored in the clear.
    //
    // The عائلتك / بريدك split matters. Without it the sentence appears to say that
    // phone and email are encrypted except phone and email; the two halves are
    // about different people — the relatives you enter, and you.
    h: "مشفّرة",
    p: "هاتف وبريد أفراد عائلتك مشفّران، ما عدا بريدك ورقمك لتسجيل الدخول.",
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
      <div
        className="lp-chain"
        // Matches what is drawn: the بن/بنت connectors were removed from the
        // display, so reading them aloud would describe a different chain.
        aria-label={CHAIN.map((s) => s.name).join(" ")}
      >
        {CHAIN.map((s, i) => (
          <span key={i} className={`lp-seg${i < shown ? " on" : ""}`}>
            {i > 0 && " "}
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
export default function LandingPage({
  onSignIn,
  onSignUp,
  onPrivacy,
  directory = null,
}) {
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
          <p className="lp-eyebrow">لعائلاتنا</p>
          <h1>شجرة عائلتك، كما هي فعلاً</h1>
          <p className="lp-lede">
            مبنية على سلسلة النسب، وتعدد الزوجات، وروابط الرضاعة
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
            <h2>مصمّمة لعائلاتنا، بكل تفاصيلها</h2>
            <p>
              هي الطريقة التي تُقاس بها العائلة عندنا، وبدونها تكون الشجرة غير
              مكتملة.
            </p>
          </div>
          {CLAIMS.map((c) => (
            <div className="lp-claim" key={c.num}>
              <div className="lp-num" aria-hidden="true">
                {c.num}
              </div>
              <div className="lp-claim-line">
                <h3>{c.title}</h3>
                <span className="lp-claim-sep" aria-hidden="true">—</span>
                <p>{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The directory sits AFTER the claims and BEFORE the privacy section: the
          claims are the pitch, the directory is the proof, and the privacy
          section is where trust is asked for. It renders nothing at all while no
          family is published — an empty grid mid-page reads as a broken feature
          rather than a young one. */}
      {directory}

      <section className="lp-privacy" id="lp-privacy">
        <div className="lp-wrap">
          <h2>بيانات عائلتك محفوظة</h2>
          <div className="lp-privacy-grid">
            {PRIVACY.map((x) => (
              <div key={x.h}>
                <h4>{x.h}</h4>
                <p>{x.p}</p>
              </div>
            ))}
          </div>
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
