import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import FamilyTreeLayout from "../lib/family-tree-layout.js";
import {
  convertToAlgorithmFormat,
  findRootPerson,
} from "../lib/dataTransform.js";
import TreeCanvas from "../components/FamilyTree/TreeCanvas.jsx";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { emirateLabel } from "./Directory.jsx";

/**
 * The published tree, at /family/:id.
 *
 * Reuses convertToAlgorithmFormat, FamilyTreeLayout and TreeCanvas — the SAME
 * pipeline the signed-in app uses. A second renderer would drift from the first,
 * and the public one is what strangers see.
 *
 * No filtering happens here. The server decides which people, which
 * relationships and which fields a visitor may have; this draws whatever
 * arrives. Anything filtered in the browser can be read around.
 */
export default function PublicTree({
  treeId,
  onBack,
  embedded = false,
  // Changes whenever the owner saves a setting. The fetch is keyed on treeId,
  // which never changes while the settings screen is open — so without this the
  // preview kept showing the FIRST response and silently disagreed with the
  // options above it.
  reloadToken = "",
}) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ok | missing
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const boxRef = useRef(null);
  const fittedRef = useRef(null);
  // Current view, mirrored into a ref so the native wheel listener always reads
  // the latest values without being torn down and re-attached on every change.
  const viewRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  viewRef.current = { zoom, pan: panOffset };

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    // Any reload starts from the default view. Keeping the previous zoom and pan
    // meant switching ظهور النساء redrew a different tree at whatever
    // magnification the last one was left at, so the preview no longer showed
    // what a visitor arriving fresh would see. fittedRef is cleared too, or the
    // fit below would consider this view already fitted.
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    fittedRef.current = null;
    api.publicTree
      .get(treeId)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setStatus("ok");
      })
      .catch(() => alive && setStatus("missing"));
    return () => {
      alive = false;
    };
  }, [treeId, reloadToken]);

  // The payload carries YEARS; TreeCanvas reads birthDate/deathDate and slices
  // the first four characters itself, so a bare year passes through unchanged.
  const people = useMemo(
    () =>
      (data?.people || []).map((p) => ({
        ...p,
        treeId: data.tree.id,
        // TreeCanvas derives the age from birthDate itself. The server omits
        // birthYear when that field is switched off — which is precisely when
        // age is meant to appear — so age never rendered. Reconstruct a year
        // from the age the server already computed.
        birthDate:
          p.birthYear ||
          (p.age != null ? String(new Date().getFullYear() - p.age) : null),
        deathDate: p.deathYear || null,
      })),
    [data],
  );

  const displayOptions = useMemo(() => {
    const f = new Set(data?.tree?.publicFields || []);
    return {
      showSurname: f.has("surname"),
      showBirthDate: f.has("birthYear"),
      showDeathDate: f.has("deathYear"),
      showAge: f.has("age"),
      showBirthPlace: f.has("birthPlace"),
    };
  }, [data]);

  const treeLayout = useMemo(() => {
    if (!data || people.length === 0) return null;
    // convertToAlgorithmFormat filters BOTH lists by treeId, so every row needs
    // it. Stamped here rather than relied on from the payload: a missing treeId
    // drops every relationship silently and the tree renders as one lone box.
    const rels = (data.relationships || []).map((r) => ({
      ...r,
      treeId: data.tree.id,
    }));
    const familyData = convertToAlgorithmFormat(people, rels, data.tree.id);
    const layout = FamilyTreeLayout.generateLayout(
      familyData,
      findRootPerson(familyData),
      {
        childDepth: 10,
        parentDepth: 10,
        siblingDepth: 10,
        flipLayout: false,
        displayOptions: {},
        markedPersonId: null,
      },
    );
    layout.e = layout.e || {};
    layout.n = layout.n || [];
    return { layout, familyData };
  }, [data, people]);

  // How many people the layout actually REACHES from its root.
  //
  // Not the same as people.length. Removing women can sever a branch whose only
  // link to the trunk ran through one of them — a mother, or a رضاعة bond — so
  // the drawn tree can be a fraction of the payload. Printing the payload count
  // while drawing eight boxes is the kind of mismatch a visitor notices and
  // stops trusting.
  const drawnCount = useMemo(() => {
    if (!treeLayout) return 0;
    const seen = new Set();
    Object.entries(treeLayout.layout.e || {}).forEach(([key, ent]) => {
      seen.add(key);
      if (ent?.es) seen.add(ent.es);
    });
    return seen.size;
  }, [treeLayout]);

  // Centre and fit the whole tree in the viewport.
  //
  // The signed-in app never needs this: it centres on selectedPerson, and there
  // always is one. A visitor arrives with no selection, so panOffset {0,0} left
  // the tree wherever the layout engine put it — off-screen, showing an empty
  // canvas with one corner of a box visible.
  const fitToView = () => {
    if (!treeLayout || !boxRef.current) return;
    const entities = Object.values(treeLayout.layout.e || {});
    if (entities.length === 0) return;

    const BOX_W = 140;
    const BOX_H = 90;
    const xs = entities.map((e) => e.x * BOX_W);
    const ys = entities.map((e) => e.y * BOX_H);
    const minX = Math.min(...xs) - BOX_W;
    const maxX = Math.max(...xs) + BOX_W;
    const minY = Math.min(...ys) - BOX_H;
    const maxY = Math.max(...ys) + BOX_H;

    const rect = boxRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // Never zoom IN past 1:1 — a three-person tree blown up to fill the screen
    // looks broken rather than generous.
    const z = Math.max(
      0.3,
      Math.min(1, rect.width / (maxX - minX), rect.height / (maxY - minY)),
    );

    setZoom(z);
    setPanOffset({
      x: rect.width / 2 - ((minX + maxX) / 2) * z,
      y: rect.height / 2 - ((minY + maxY) / 2) * z,
    });
  };

  // Once per tree, so it does not fight the user's own panning afterwards.
  useEffect(() => {
    if (!treeLayout) return;
    const key = `${treeId}:${reloadToken}`;
    if (fittedRef.current === key) return;
    fitToView();
    fittedRef.current = key;
  }, [treeLayout, treeId, reloadToken]);

  // Wheel zoom, anchored at the cursor.
  //
  // Attached natively with { passive: false } rather than via onWheel: React
  // registers wheel listeners as PASSIVE at the root, so preventDefault() inside
  // a JSX handler is ignored and the page scrolls while the tree zooms.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      const { zoom: z0, pan } = viewRef.current;
      const z1 = Math.min(2, Math.max(0.3, z0 * (e.deltaY > 0 ? 0.9 : 1.1)));
      if (z1 === z0) return;

      // Keep the point under the cursor fixed: convert it to layout space at the
      // old zoom, then place it back at the new one. Without this the tree
      // drifts away from wherever the user is looking.
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setPanOffset({
        x: mx - ((mx - pan.x) / z0) * z1,
        y: my - ((my - pan.y) / z0) * z1,
      });
      setZoom(z1);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [status]);

  if (status === "loading") {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 text-center text-gray-500 text-[13px]">
        جاري التحميل…
      </div>
    );
  }

  // The server answers 404 for an unpublished tree, so this is also what a link
  // to a private tree looks like — deliberately indistinguishable from a tree
  // that does not exist.
  if (status === "missing") {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <p className="text-[#16233D] text-lg font-bold mb-2">
          هذه الشجرة غير متاحة
        </p>
        <p className="text-gray-500 text-[13px] mb-6">
          قد تكون غير منشورة أو غير موجودة.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="text-[13px] text-[#A5813F] hover:underline"
        >
          ← الرئيسية
        </button>
      </div>
    );
  }

  const { tree } = data;

  return (
    <div className={embedded ? "" : "max-w-6xl mx-auto px-6 py-8"}>
      {!embedded && (
        <button
          type="button"
          onClick={onBack}
          className="text-[13px] text-gray-500 hover:text-[#16233D] mb-4"
        >
          ← الدليل
        </button>
      )}

      {!embedded && (
      <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-[#16233D] text-xl font-bold">
            عائلة {tree.familyName}
          </h1>
          <p className="text-gray-500 text-[12.5px] mt-1">
            {emirateLabel(tree.emirate) || "—"}
            <span className="text-gray-300 mx-2">·</span>
            {drawnCount} فرداً
            {tree.femaleDisplay !== "full" && (
              <>
                <span className="text-gray-300 mx-2">·</span>
                {tree.femaleDisplay === "hidden"
                  ? "الرجال وأبناؤهم الذكور"
                  : "أسماء النساء غير معروضة"}
              </>
            )}
          </p>
        </div>
        <span className="text-[10px] text-[#A5813F] border border-[#A5813F] rounded px-2 py-0.5">
          عرض عام
        </span>
      </div>
      )}

      <div
        ref={boxRef}
        className="relative border border-gray-200 rounded-lg overflow-hidden cursor-grab"
        style={{
          height: embedded ? "520px" : "70vh",
          // TreeCanvas clears the canvas to TRANSPARENT — the app paints its
          // tree surface as a CSS background on this wrapper, not through
          // stylingOptions, which carries no backgroundColor at all. Parchment
          // rather than white: the page around it is parchment, and a white
          // rectangle in the middle reads as a hole rather than a surface.
          background: "#f4efe3",
        }}
        onMouseDown={(e) => {
          // Record where the drag started AND the pan at that moment, so the
          // offset is computed from the origin rather than accumulating.
          dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            panX: panOffset.x,
            panY: panOffset.y,
          };
        }}
        onMouseMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          setPanOffset({
            x: d.panX + (e.clientX - d.startX),
            y: d.panY + (e.clientY - d.startY),
          });
        }}
        onMouseUp={() => {
          dragRef.current = null;
        }}
        onMouseLeave={() => {
          dragRef.current = null;
        }}
      >
        {treeLayout ? (
          <TreeCanvas
            layout={treeLayout.layout}
            familyData={treeLayout.familyData}
            people={people}
            selectedPerson={null}
            highlightedPerson={null}
            // Read-only: no click handlers, so nothing opens and nothing edits.
            onPersonClick={() => {}}
            onBackgroundClick={() => {}}
            zoom={zoom}
            panOffset={panOffset}
            displayOptions={displayOptions}
            // EMPTY ON PURPOSE — not an oversight to be tidied away.
            // TreeCanvas falls back to its built-in colours for every value it
            // is not given, so every visitor sees the same tree. Passing the
            // owner's stylingOptions would publish whatever palette that one
            // person happened to pick. (It could not happen by accident either:
            // stylingOptions lives in localStorage and never reaches the server,
            // so it is not in this payload at all.)
            //
            stylingOptions={{}}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 text-[13px]">
            لا توجد بيانات لعرضها
          </div>
        )}

        <div className="absolute bottom-3 left-3 flex flex-col border border-gray-200 rounded-md overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            className="w-8 h-8 flex items-center justify-center text-[#16233D]"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
            className="w-8 h-8 flex items-center justify-center text-[#16233D] border-t border-gray-200"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            // Re-FIT, not reset to origin: {0,0} is exactly the off-screen
            // position this page opens away from.
            onClick={fitToView}
            className="w-8 h-8 flex items-center justify-center text-[#16233D] border-t border-gray-200"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!embedded && (
        <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
          نشرها مالك الشجرة. إن وجدت بياناتك هنا وترغب في إزالتها، راسلنا على
          support@uaeroots.com
        </p>
      )}
    </div>
  );
}
