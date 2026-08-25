import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import FamilyTreeLayout from "../lib/family-tree-layout.js";
import {
  convertToAlgorithmFormat,
  findRootPerson,
} from "../lib/dataTransform.js";
import TreeCanvas from "../components/FamilyTree/TreeCanvas.jsx";
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
export default function PublicTree({ treeId, onBack }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ok | missing
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
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
  }, [treeId]);

  // The payload carries YEARS; TreeCanvas reads birthDate/deathDate and slices
  // the first four characters itself, so a bare year passes through unchanged.
  const people = useMemo(
    () =>
      (data?.people || []).map((p) => ({
        ...p,
        treeId: data.tree.id,
        birthDate: p.birthYear || null,
        deathDate: p.deathYear || null,
      })),
    [data],
  );

  const displayOptions = useMemo(() => {
    const f = new Set(data?.tree?.publicFields || []);
    return {
      showSurname: true,
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
    <div className="max-w-6xl mx-auto px-6 py-8">
      <button
        type="button"
        onClick={onBack}
        className="text-[13px] text-gray-500 hover:text-[#16233D] mb-4"
      >
        ← الدليل
      </button>

      <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-[#16233D] text-xl font-bold">
            عائلة {tree.familyName}
          </h1>
          <p className="text-gray-500 text-[12.5px] mt-1">
            {emirateLabel(tree.emirate) || "—"}
            <span className="text-gray-300 mx-2">·</span>
            {data.people.length} فرداً
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

      <div
        className="relative border border-gray-200 rounded-lg bg-white overflow-hidden"
        style={{ height: "70vh" }}
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
            className="w-8 h-8 text-[#16233D]"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
            className="w-8 h-8 text-[#16233D] border-t border-gray-200"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            className="w-8 h-8 text-[#16233D] border-t border-gray-200 text-xs"
          >
            ⤢
          </button>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
        نشرها مالك الشجرة. إن وجدت بياناتك هنا وترغب في إزالتها، راسلنا على
        support@uaeroots.com
      </p>
    </div>
  );
}
