import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

/**
 * The public directory.
 *
 * Two pieces that share one data source:
 *   DirectoryTiles    — the stats band and the eight tiles, shown on the landing
 *                       page between «مصمّمة لعائلاتنا» and «بيانات عائلتك محفوظة».
 *   DirectoryFamilies — the family cards for one emirate, at /directory/:code.
 *
 * Everything here comes from /api/public/*, which serves ONLY published trees
 * and never the owner id. Nothing on these screens requires a session.
 */

// Order matters: this is the order the tiles appear in, and it is the
// conventional ordering of the emirates, not alphabetical.
export const EMIRATES = [
  { code: "AZ", label: "أبوظبي" },
  { code: "DU", label: "دبي" },
  { code: "SH", label: "الشارقة" },
  { code: "AJ", label: "عجمان" },
  { code: "UQ", label: "أم القيوين" },
  { code: "RK", label: "رأس الخيمة" },
  { code: "FU", label: "الفجيرة" },
];

export const emirateLabel = (code) =>
  code === "all"
    ? "كل الإمارات"
    : EMIRATES.find((e) => e.code === code)?.label || null;

const ar = (n) => (n == null ? "—" : Number(n).toLocaleString("ar-EG"));

// A YEAR is not a quantity: toLocaleString gives ١٬٩٦٥ for 1965. Same digits,
// no grouping separator.
const arYear = (n) =>
  n == null
    ? "—"
    : String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

/* ─── the band + tiles ─────────────────────────────────────────────────────── */

export function DirectoryTiles({ onOpenEmirate }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api.publicDirectory
      .summary()
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  // Render NOTHING until at least one family is published. Seven grey tiles
  // reading «—» sitting in the middle of the pitch says "this is empty" to every
  // visitor — worse than the section not existing yet. Also covers the failure
  // case: a directory that cannot load should be absent, not broken.
  if (failed || !data || !data.families) return null;

  return (
    // Uses the landing page's own classes, not Tailwind: this section sits
    // between two editorial sections and has to be made of the same material.
    <section className="lp-dir" id="lp-directory">
      <div className="lp-wrap">
        <div className="lp-sec-head">
          <h2>عائلات نشرت شجرتها</h2>
          <p>
            مصنّفة حسب إمارة القيد — الإمارة التي صدرت منها خلاصة القيد، لا مكان
            السكن.
          </p>
        </div>

        <div className="lp-dir-figs">
          <div className="lp-dir-fig">
            <b>{ar(data.families)}</b>
            <span>عائلة</span>
          </div>
          <div className="lp-dir-fig">
            <b>{ar(data.people)}</b>
            <span>فرداً</span>
          </div>
          <div className="lp-dir-fig">
            <b>{arYear(data.oldestYear)}</b>
            <span>أقدم سجل</span>
          </div>
        </div>

        <div className="lp-dir-grid">
          {EMIRATES.map((em) => {
            const count = data.byEmirate?.[em.code] || 0;
            // ALL SEVEN always render. A tile that disappears when empty makes
            // the country look partial; outlined with «—» reads as "nothing yet".
            return (
              <button
                key={em.code}
                type="button"
                className={`lp-em${count ? "" : " is-empty"}`}
                disabled={!count}
                onClick={() => onOpenEmirate(em.code)}
              >
                <b>{em.label}</b>
                <i>{count ? ar(count) : "—"}</i>
                <span>{count ? "عائلة" : "لا توجد بعد"}</span>
              </button>
            );
          })}

          {/* The eighth tile. Without it the only way in is by emirate, and the
              common case is someone who knows a family name but not which
              emirate its family book was issued in. It also catches a published
              tree whose owner never set an emirate. */}
          <button
            type="button"
            className="lp-em is-all"
            onClick={() => onOpenEmirate("all")}
          >
            <b>كل الإمارات</b>
            <i>{ar(data.families)}</i>
            <span>عائلة</span>
          </button>
        </div>
      </div>
    </section>
  );
}


/* ─── one emirate's families ───────────────────────────────────────────────── */

export function DirectoryFamilies({ emirate, onBack, onOpenFamily }) {
  const [families, setFamilies] = useState(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    setFamilies(null);
    setFailed(false);
    api.publicDirectory
      .families(emirate === "all" ? null : emirate)
      .then((d) => alive && setFamilies(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [emirate]);

  const q = query.trim();
  const shown = (families || []).filter(
    (f) => !q || (f.familyName || "").includes(q),
  );

  return (
    <div className="lp-wrap lp-dir-page">
      <button
        type="button"
        onClick={onBack}
        className="lp-dir-back"
      >
        ← الرئيسية
      </button>

      <h1 className="lp-dir-title">
        {emirateLabel(emirate) || "الإمارة"}
      </h1>
      <p className="lp-dir-sub">
        {families === null
          ? "جاري التحميل…"
          : `${ar(families.length)} عائلة منشورة`}
      </p>

      <div className="mb-5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث باسم العائلة…"
          className="lp-dir-search"
          dir="rtl"
        />
      </div>

      {failed && (
        <p className="lp-dir-sub">
          تعذّر تحميل الدليل. حاول مرة أخرى.
        </p>
      )}

      {families !== null && !failed && shown.length === 0 && (
        <p className="lp-dir-sub">
          {q ? "لا توجد عائلة بهذا الاسم." : "لا توجد عائلات منشورة هنا بعد."}
        </p>
      )}

      <div className="lp-fam-grid">
        {shown.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onOpenFamily(f.id)}
            className="lp-fam"
          >
            <div className="lp-fam-name">
              عائلة {f.familyName}
            </div>
            <div className="lp-fam-meta">
              {/* Emirate shown only under «كل الإمارات», where the cards come
                  from everywhere and the emirate is the distinguishing fact. */}
              {emirate === "all" && f.emirate && (
                <>
                  {emirateLabel(f.emirate)}
                  <span className="lp-fam-dot">·</span>
                </>
              )}
              {ar(f.people)} فرداً
              {f.oldestYear && (
                <>
                  <span className="lp-fam-dot">·</span>
                  منذ {arYear(f.oldestYear)}
                </>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
