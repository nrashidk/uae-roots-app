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
    <section className="bg-white py-14 px-6" id="lp-directory">
      <div className="max-w-5xl mx-auto">
        <div className="bg-[#16233D] rounded-lg py-8 px-6 grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-white text-3xl font-bold leading-none">
              {ar(data.families)}
            </div>
            <div className="text-[#9AA4B8] text-[11px] mt-2">عائلة موثّقة</div>
          </div>
          <div>
            <div className="text-white text-3xl font-bold leading-none">
              {ar(data.people)}
            </div>
            <div className="text-[#9AA4B8] text-[11px] mt-2">
              فرداً في الشجرات
            </div>
          </div>
          <div>
            <div className="text-white text-3xl font-bold leading-none">
              {ar(data.oldestYear)}
            </div>
            <div className="text-[#9AA4B8] text-[11px] mt-2">أقدم سجل</div>
          </div>
        </div>

        <h2 className="text-[#16233D] text-lg font-bold mt-10 mb-1">
          تصفّح حسب الإمارة
        </h2>
        <p className="text-gray-500 text-[13px] mb-5 leading-relaxed">
          العائلات مصنّفة حسب إمارة القيد — الإمارة التي صدرت منها خلاصة القيد.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {EMIRATES.map((em) => {
            const count = data.byEmirate?.[em.code] || 0;
            // ALL SEVEN always render. A tile that disappears when empty makes
            // the country look partial; greyed with «—» reads as "nothing yet".
            return (
              <button
                key={em.code}
                type="button"
                disabled={!count}
                onClick={() => onOpenEmirate(em.code)}
                className={`text-right border rounded-lg p-4 transition ${
                  count
                    ? "bg-white border-gray-200 hover:shadow-md cursor-pointer"
                    : "bg-gray-50 border-gray-100 cursor-default"
                }`}
              >
                <div
                  className={`text-sm font-bold ${
                    count ? "text-[#16233D]" : "text-gray-400"
                  }`}
                >
                  {em.label}
                </div>
                <div
                  className={`text-2xl font-bold mt-2 leading-none ${
                    count ? "text-[#A5813F]" : "text-gray-300"
                  }`}
                >
                  {count ? ar(count) : "—"}
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  {count ? "عائلة" : "لا توجد عائلات منشورة"}
                </div>
              </button>
            );
          })}

          {/* The eighth tile. Without it the only way in is by emirate, and the
              common case is someone who knows a family name but not which
              emirate its family book was issued in. It also catches a published
              tree whose owner never set an emirate — it belongs somewhere. */}
          <button
            type="button"
            onClick={() => onOpenEmirate("all")}
            className="text-right border-2 border-[#A5813F] rounded-lg p-4 bg-[#FBF8F2] hover:shadow-md transition"
          >
            <div className="text-sm font-bold text-[#16233D]">كل الإمارات</div>
            <div className="text-2xl font-bold mt-2 leading-none text-[#A5813F]">
              {ar(data.families)}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">عائلة</div>
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
    <div className="max-w-5xl mx-auto px-6 py-10">
      <button
        type="button"
        onClick={onBack}
        className="text-[13px] text-gray-500 hover:text-[#16233D] mb-4"
      >
        ← الرئيسية
      </button>

      <h1 className="text-[#16233D] text-xl font-bold mb-1">
        {emirateLabel(emirate) || "الإمارة"}
      </h1>
      <p className="text-gray-500 text-[13px] mb-6">
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
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[13px]"
          dir="rtl"
        />
      </div>

      {failed && (
        <p className="text-gray-500 text-[13px]">
          تعذّر تحميل الدليل. حاول مرة أخرى.
        </p>
      )}

      {families !== null && !failed && shown.length === 0 && (
        <p className="text-gray-500 text-[13px]">
          {q ? "لا توجد عائلة بهذا الاسم." : "لا توجد عائلات منشورة هنا بعد."}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shown.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onOpenFamily(f.id)}
            className="text-right bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition"
          >
            <div className="text-[15px] font-bold text-[#16233D] leading-relaxed">
              عائلة {f.familyName}
            </div>
            <div className="text-[12px] text-gray-500 mt-2">
              {/* Emirate shown only under «كل الإمارات», where the cards come
                  from everywhere and the emirate is the distinguishing fact. */}
              {emirate === "all" && f.emirate && (
                <>
                  {emirateLabel(f.emirate)}
                  <span className="text-gray-300 mx-2">·</span>
                </>
              )}
              {ar(f.people)} فرداً
              {f.oldestYear && (
                <>
                  <span className="text-gray-300 mx-2">·</span>
                  منذ {ar(f.oldestYear)}
                </>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
