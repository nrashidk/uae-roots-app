import { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { Button } from "@/components/ui/button.jsx";
import {
  Heart,
  Baby,
  Users,
  UserPlus,
  Trash2,
  X,
  Settings,
  Home,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Mail,
  Smartphone,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import FamilyTreeLayout from "./lib/family-tree-layout.js";
import {
  convertToAlgorithmFormat,
  findRootPerson,
  addPersonWithRelationship,
} from "./lib/dataTransform.js";
import TreeCanvas from "./components/FamilyTree/TreeCanvas.jsx";

function App() {
  const CARD = { w: 140, h: 90 };
  const REL = {
    PARTNER: "partner",
    PARENT_CHILD: "parent-child",
    SIBLING: "sibling",
  };

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState("auth");
  const [currentTree, setCurrentTree] = useState(null);
  const [people, setPeople] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [relationshipType, setRelationshipType] = useState(null);
  const [formKey, setFormKey] = useState(0); // Key to force form remount
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: 1200,
    height: 800,
  });
  const [showOptions, setShowOptions] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);

  const [displayOptions, setDisplayOptions] = useState({
    showName: true,
    showSurname: true,
    showBirthDate: false,
    showBirthPlace: false,
    showAge: false,
    showDeathDate: false,
    showProfession: false,
    showCompany: false,
    showEmail: false,
    showTelephone: false,
    showAddress: false,
  });

  const [stylingOptions, setStylingOptions] = useState({
    backgroundColor: "#f8fafc",
    maleBoxColor: "#e6f3ff",
    femaleBoxColor: "#ffe4e1",
    livingTextColor: "#000000",
    deceasedTextColor: "#6b7280",
    boxWidth: 140,
    textSize: 14,
    lineColor: "#8b8b8b",
  });

  useEffect(() => {
    if (!showPersonForm) {
      setShowActionMenu(false);
    }
  }, [showPersonForm]);

  useEffect(() => {
    const handleDocClick = (e) => {
      const target = e.target;
      const insideAction = target.closest("[data-action-button]");
      const insideForm = target.closest("[data-person-form]");
      const insideAddButton = target.closest("[data-add-person-button]");
      if (!insideAction && !insideForm && !insideAddButton) {
        setShowActionMenu(false);
      }
    };
    document.addEventListener("click", handleDocClick, true);
    return () => document.removeEventListener("click", handleDocClick, true);
  }, []);

  const t = {
    welcome: "مرحباً بكم في جذور الإمارات",
    continueWithGoogle: "التسجيل عبر البريد الإلكتروني",
    continueWithApple: "التسجيل عبر الهوية الرقمية",
    uaeMobile: "التسجيل عبر الهاتف الإماراتي",
    dashboard: "لوحة التحكم",
    myFamilyTrees: "أشجار عائلتي",
    familyMembers: "أفراد العائلة",
    relationships: "العلاقات",
    startBuilding: "ابدأ ببناء شجرة عائلتك",
    addFirstMember: "أضف أول فرد من العائلة للبدء",
    addPerson: "إضافة شخص",
    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    gender: "الجنس",
    male: "ذكر",
    female: "أنثى",
    birthDate: "تاريخ الميلاد",
    birthPlace: "مكان الميلاد",
    isLiving: "على قيد الحياة",
    deathDate: "تاريخ الوفاة",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    address: "العنوان",
    profession: "المهنة",
    company: "جهة العمل",
    save: "حفظ",
    cancel: "إلغاء",
    update: "تحديث",
    addSpouse: "إضافة زوج/زوجة",
    addParent: "إضافة والد",
    addChild: "إضافة طفل",
    addSibling: "إضافة شقيق",
    backToDashboard: "العودة إلى لوحة التحكم",
    familyTreeName: "شجرة عائلتي",
    deleteConfirm: "هل أنت متأكد من حذف هذا الشخص؟",
    logout: "تسجيل الخروج",
    options: "خيارات",
    fatherOf: "والد",
    motherOf: "والدة",
    spouseOf: "شريك",
    siblingOf: "شقيق",
    childOf: "طفل",
  };

  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setCanvasDimensions({ width: rect.width, height: rect.height });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [currentView]);

  // Generate tree layout using the working algorithm
  const treeLayout = useMemo(() => {
    const treePeople = people.filter((p) => p.treeId === currentTree?.id);
    const treeRels = relationships.filter((r) => r.treeId === currentTree?.id);

    if (treePeople.length === 0) {
      return null;
    }

    // Convert to algorithm format
    const familyData = convertToAlgorithmFormat(
      treePeople,
      treeRels,
      currentTree?.id,
    );

    // Choose root person: prefer currently selected person if present in this tree
    const preferredRoot = selectedPerson ? `P${selectedPerson}` : null;
    const rootPerson =
      preferredRoot && familyData[preferredRoot]
        ? preferredRoot
        : findRootPerson(familyData);

    // Generate layout

    const layout = FamilyTreeLayout.generateLayout(familyData, rootPerson, {
      childDepth: 10,
      parentDepth: 10,
      siblingDepth: 10,
      flipLayout: false,
      displayOptions: {},
      markedPersonId:
        preferredRoot && familyData[preferredRoot] ? preferredRoot : null,
    });

    // Return both layout and familyData so TreeCanvas can access person data
    return { layout, familyData };
  }, [people, relationships, currentTree?.id, selectedPerson]);

  // Compute auto-pan for single-entity centering (to keep overlays aligned with canvas)
  const autoPan = useMemo(() => {
    try {
      if (!treeLayout || !treeLayout.layout || !treeLayout.layout.e)
        return { x: 0, y: 0 };
      const entityKeys = Object.keys(treeLayout.layout.e);
      const isSingle =
        entityKeys.length === 1 &&
        (!treeLayout.layout.n || treeLayout.layout.n.length === 0);
      if (!isSingle) return { x: 0, y: 0 };
      const BOX_WIDTH = stylingOptions?.boxWidth || CARD.w;
      const BOX_HEIGHT = CARD.h;
      const onlyEntity = treeLayout.layout.e[entityKeys[0]];
      const px = (onlyEntity?.x || 0) * BOX_WIDTH;
      const py = (onlyEntity?.y || 0) * BOX_HEIGHT;
      const w = canvasDimensions.width || 0;
      const h = canvasDimensions.height || 0;
      return {
        x: w / (2 * zoom) - px,
        y: h / (2 * zoom) - py,
      };
    } catch (e) {
      return { x: 0, y: 0 };
    }
  }, [treeLayout, zoom, canvasDimensions, stylingOptions, CARD]);

  // Determine if the current layout is a single-entity tree (one person, no lines)
  const isSingleLayout = useMemo(() => {
    const entityKeys = Object.keys(treeLayout?.layout?.e || {});
    return (
      entityKeys.length === 1 &&
      (!treeLayout?.layout?.n || treeLayout.layout.n.length === 0)
    );
  }, [treeLayout]);

  // Preserve viewport when switching from single-entity auto-center to multi-entity
  const wasSingleRef = useRef(false);
  const combinedPanRef = useRef({ x: 0, y: 0 });
  useLayoutEffect(() => {
    if (wasSingleRef.current && !isSingleLayout) {
      // Materialize the previous combined pan (panOffset + autoPan) into panOffset before paint
      setPanOffset({
        x: combinedPanRef.current.x,
        y: combinedPanRef.current.y,
      });
    }
    wasSingleRef.current = isSingleLayout;
    // Track the combined pan used for rendering in the last frame
    combinedPanRef.current = {
      x: (panOffset?.x || 0) + (autoPan?.x || 0),
      y: (panOffset?.y || 0) + (autoPan?.y || 0),
    };
  }, [isSingleLayout, autoPan, panOffset]);

  // When not single-entity, TreeCanvas receives zero auto-pan; panOffset already includes the combined value
  const effectiveAutoPan = isSingleLayout ? autoPan : { x: 0, y: 0 };

  // Get people for the current tree
  const treePeople = useMemo(() => {
    return people.filter((p) => p.treeId === currentTree?.id);
  }, [people, currentTree?.id]);

  // Default spouse gender suggestion for first spouse
  const defaultSpouseGender = useMemo(() => {
    if (relationshipType !== "spouse" || editingPerson) return "";
    if (!selectedPerson) return "";

    const selected = treePeople.find((p) => p.id === selectedPerson);
    if (!selected) return "";
    if (selected.gender === "male") return "female";
    if (selected.gender === "female") return "male";
    return "";
  }, [relationshipType, editingPerson, selectedPerson, treePeople]);

  const handleGoogleAuth = () => {
    setIsAuthenticated(true);
    const newTree = {
      id: Date.now(),
      name: "شجرة عائلتي",
      createdAt: new Date().toISOString(),
    };
    setCurrentTree(newTree);
    setCurrentView("tree-builder");
  };

  // Add person using the data transformation utility
  const addPerson = (personData) => {
    // Enforce living spouse limit when adding a spouse
    if (relationshipType === "spouse" && selectedPerson) {
      const spouseRels = relationships.filter(
        (r) =>
          r.treeId === currentTree?.id &&
          r.type === "partner" &&
          (r.person1Id === selectedPerson || r.person2Id === selectedPerson),
      );
      const spouseIds = spouseRels.map((rel) =>
        rel.person1Id === selectedPerson ? rel.person2Id : rel.person1Id,
      );
      const livingSpousesCount = spouseIds.reduce((count, sid) => {
        const sp = people.find((p) => p.id === sid);
        return sp && sp.isLiving !== false ? count + 1 : count;
      }, 0);
      const selected = people.find((p) => p.id === selectedPerson);
      const spouseLimit = selected?.gender === "male" ? 4 : 1;
      const limitMessage =
        spouseLimit === 1
          ? "Maximum of 1 spouse allowed"
          : "Maximum of 4 living spouses allowed";
      if (livingSpousesCount >= spouseLimit && personData.isLiving !== false) {
        window.alert(limitMessage);
        return;
      }
    }

    const result = addPersonWithRelationship(
      people,
      relationships,
      personData,
      relationshipType,
      selectedPerson,
      currentTree?.id,
    );

    setPeople(result.updatedPeople);
    setRelationships(result.updatedRelationships);
    setShowPersonForm(false);
    setRelationshipType(null);
    setEditingPerson(null);
    // Preserve focused person selection; tooltip/menu will be hidden via sidebar close
  };

  const updatePerson = (personData) => {
    setPeople((prev) =>
      prev.map((p) => (p.id === editingPerson ? { ...p, ...personData } : p)),
    );

    if (pendingSecondParent) {
      const nextId = pendingSecondParent;
      setPendingSecondParent(null);
      // Switch to editing the second parent (mother)
      setEditingPerson(nextId);
      setSelectedPerson(nextId);
      setFormKey((prev) => prev + 1);
      setShowPersonForm(true);
    } else if (pendingSiblingId) {
      const nextSib = pendingSiblingId;
      setPendingSiblingId(null);
      // After parents, edit the newly created sibling
      setEditingPerson(nextSib);
      setSelectedPerson(nextSib);
      setFormKey((prev) => prev + 1);
      setShowPersonForm(true);
    } else {
      setShowPersonForm(false);
      setEditingPerson(null);
    }
  };

  const deletePerson = (personId) => {
    if (window.confirm(t.deleteConfirm)) {
      setPeople((prev) => {
        const updated = prev.filter((p) => p.id !== personId);
        if (updated.filter((p) => p.treeId === currentTree?.id).length === 0) {
          setCurrentView("dashboard");
        }
        return updated;
      });
      setRelationships((prev) =>
        prev.filter(
          (r) =>
            r.person1Id !== personId &&
            r.person2Id !== personId &&
            r.parentId !== personId &&
            r.childId !== personId,
        ),
      );
      setSelectedPerson(null);
      setShowActionMenu(false);
    }
  };

  // Track a pending sibling to edit after creating parents
  const [pendingSiblingId, setPendingSiblingId] = useState(null);

  // Add both parents in one action and open father's form first
  const [pendingSecondParent, setPendingSecondParent] = useState(null);
  const handleAddBothParents = (childId) => {
    const child = people.find((p) => p.id === childId);
    if (!child) return;

    // Prevent adding when both parents already exist
    const parentRels = relationships.filter(
      (r) =>
        r.treeId === currentTree?.id &&
        r.type === "parent-child" &&
        r.childId === childId,
    );
    const parentIds = parentRels.map((r) => r.parentId);
    const parentPeople = people.filter((p) => parentIds.includes(p.id));
    const hasFather = parentPeople.some((p) => p?.gender === "male");
    const hasMother = parentPeople.some((p) => p?.gender === "female");
    if (hasFather && hasMother) {
      window.alert("Both parents already exist for this person");
      return;
    }

    const childDisplay =
      child.firstName || child.lastName || `Person ${child.id}`;

    // Create father
    const fatherData = {
      firstName: `${t.fatherOf} ${childDisplay}`,
      lastName: "",
      gender: "male",
      isLiving: true,
    };
    const resFather = addPersonWithRelationship(
      people,
      relationships,
      fatherData,
      "parent",
      childId,
      currentTree?.id,
    );

    // Create mother
    const motherData = {
      firstName: `${t.motherOf} ${childDisplay}`,
      lastName: "",
      gender: "female",
      isLiving: true,
    };
    const resMother = addPersonWithRelationship(
      resFather.updatedPeople,
      resFather.updatedRelationships,
      motherData,
      "parent",
      childId,
      currentTree?.id,
    );

    // Link parents as partners
    const partnerRel = {
      id: Date.now() + 3,
      type: "partner",
      person1Id: resFather.newPersonId,
      person2Id: resMother.newPersonId,
      treeId: currentTree?.id,
    };

    setPeople(resMother.updatedPeople);
    setRelationships([...resMother.updatedRelationships, partnerRel]);

    // Open father's form first, then queue mother
    setEditingPerson(resFather.newPersonId);
    setSelectedPerson(resFather.newPersonId);
    setPendingSecondParent(resMother.newPersonId);
    setRelationshipType(null);
    setFormKey((prev) => prev + 1);
    setShowPersonForm(true);
  };

  // Quick-create relationship helpers (create with default name then open edit form)
  const handleQuickCreateSpouse = (personId) => {
    const selected = people.find((p) => p.id === personId);
    if (!selected) return;

    // Enforce living spouse limit per gender
    const spouseRels = relationships.filter(
      (r) =>
        r.treeId === currentTree?.id &&
        r.type === "partner" &&
        (r.person1Id === personId || r.person2Id === personId),
    );
    const spouseIds = spouseRels.map((rel) =>
      rel.person1Id === personId ? rel.person2Id : rel.person1Id,
    );
    const livingSpousesCount = spouseIds.reduce((count, sid) => {
      const sp = people.find((pp) => pp.id === sid);
      return sp && sp.isLiving !== false ? count + 1 : count;
    }, 0);
    const spouseLimit = selected.gender === "male" ? 4 : 1;
    const limitMessage =
      spouseLimit === 1
        ? "Maximum of 1 spouse allowed"
        : "Maximum of 4 living spouses allowed";
    if (livingSpousesCount >= spouseLimit) {
      window.alert(limitMessage);
      return;
    }

    const display =
      selected.firstName || selected.lastName || `Person ${selected.id}`;
    const defaultGender =
      selected.gender === "male"
        ? "female"
        : selected.gender === "female"
          ? "male"
          : "";

    const res = addPersonWithRelationship(
      people,
      relationships,
      {
        firstName: `${t.spouseOf} ${display}`,
        lastName: "",
        gender: defaultGender,
        isLiving: true,
      },
      "spouse",
      personId,
      currentTree?.id,
    );

    setPeople(res.updatedPeople);
    setRelationships(res.updatedRelationships);

    // Open form to edit the new spouse
    setEditingPerson(res.newPersonId);
    setFormKey((prev) => prev + 1);
    setShowPersonForm(true);
    setRelationshipType(null);
    // Keep selected person as original so the action menu stays anchored
  };

  const handleQuickCreateChild = (personId) => {
    const selected = people.find((p) => p.id === personId);
    if (!selected) return;
    const display =
      selected.firstName || selected.lastName || `Person ${selected.id}`;

    const res = addPersonWithRelationship(
      people,
      relationships,
      {
        firstName: `${t.childOf} ${display}`,
        lastName: "",
        gender: "",
        isLiving: true,
      },
      "child",
      personId,
      currentTree?.id,
    );

    setPeople(res.updatedPeople);
    setRelationships(res.updatedRelationships);

    // Open form to edit the new child
    setEditingPerson(res.newPersonId);
    setFormKey((prev) => prev + 1);
    setShowPersonForm(true);
    setRelationshipType(null);
  };

  const handleQuickCreateSibling = (personId) => {
    const selected = people.find((p) => p.id === personId);
    if (!selected) return;
    const display =
      selected.firstName || selected.lastName || `Person ${selected.id}`;

    // Find existing parents of the selected person
    const parentRels = relationships.filter(
      (r) =>
        r.treeId === currentTree?.id &&
        r.type === "parent-child" &&
        r.childId === personId,
    );
    const parentIds = parentRels.map((r) => r.parentId);
    const parentPeople = people.filter((p) => parentIds.includes(p.id));
    const father = parentPeople.find((p) => p?.gender === "male");
    const mother = parentPeople.find((p) => p?.gender === "female");

    const siblingData = {
      firstName: `${t.siblingOf} ${display}`,
      lastName: "",
      gender: "",
      isLiving: true,
    };

    if (!father && !mother) {
      // No parents yet: auto-create father and mother, then create sibling as their child
      const fatherData = {
        firstName: `${t.fatherOf} ${display}`,
        lastName: "",
        gender: "male",
        isLiving: true,
      };
      const resFather = addPersonWithRelationship(
        people,
        relationships,
        fatherData,
        "parent",
        personId,
        currentTree?.id,
      );

      const motherData = {
        firstName: `${t.motherOf} ${display}`,
        lastName: "",
        gender: "female",
        isLiving: true,
      };
      const resMother = addPersonWithRelationship(
        resFather.updatedPeople,
        resFather.updatedRelationships,
        motherData,
        "parent",
        personId,
        currentTree?.id,
      );

      // Link the parents as partners
      const partnerRel = {
        id: Date.now() + 3,
        type: "partner",
        person1Id: resFather.newPersonId,
        person2Id: resMother.newPersonId,
        treeId: currentTree?.id,
      };

      const withPartnerRels = [...resMother.updatedRelationships, partnerRel];

      // Create the sibling as a child of the father
      const resSib = addPersonWithRelationship(
        resMother.updatedPeople,
        withPartnerRels,
        siblingData,
        "child",
        resFather.newPersonId,
        currentTree?.id,
      );

      // Also add the mother as a parent of the new sibling
      const motherLink = {
        id: Date.now() + 10,
        type: "parent-child",
        parentId: resMother.newPersonId,
        childId: resSib.newPersonId,
        treeId: currentTree?.id,
      };

      setPeople(resSib.updatedPeople);
      setRelationships([...resSib.updatedRelationships, motherLink]);

      // Queue edit forms: father -> mother -> sibling
      setEditingPerson(resFather.newPersonId);
      setSelectedPerson(resFather.newPersonId);
      setPendingSecondParent(resMother.newPersonId);
      setPendingSiblingId(resSib.newPersonId);
      setRelationshipType(null);
      setFormKey((prev) => prev + 1);
      setShowPersonForm(true);
    } else {
      // Parents exist: create sibling as child of the existing parent(s)
      const firstParentId = father?.id || mother?.id || parentIds[0];
      const resSib = addPersonWithRelationship(
        people,
        relationships,
        siblingData,
        "child",
        firstParentId,
        currentTree?.id,
      );

      let updatedRels = resSib.updatedRelationships;
      const sibId = resSib.newPersonId;

      // Attach to the second parent too if present
      if (father?.id && father.id !== firstParentId) {
        updatedRels = [
          ...updatedRels,
          {
            id: Date.now() + 11,
            type: "parent-child",
            parentId: father.id,
            childId: sibId,
            treeId: currentTree?.id,
          },
        ];
      }
      if (mother?.id && mother.id !== firstParentId) {
        updatedRels = [
          ...updatedRels,
          {
            id: Date.now() + 12,
            type: "parent-child",
            parentId: mother.id,
            childId: sibId,
            treeId: currentTree?.id,
          },
        ];
      }

      setPeople(resSib.updatedPeople);
      setRelationships(updatedRels);

      // Open the sibling form
      setEditingPerson(sibId);
      setFormKey((prev) => prev + 1);
      setShowPersonForm(true);
      setRelationshipType(null);
    }
  };

  // Get siblings for a person (people who share at least one parent)
  const getSiblings = (personId) => {
    // Find all parents of this person
    const parentRels = relationships.filter(
      (r) =>
        r.treeId === currentTree?.id &&
        r.type === "parent-child" &&
        r.childId === personId,
    );
    const parentIds = parentRels.map((r) => r.parentId);
    if (parentIds.length === 0) return [];

    // Find all children of these parents (siblings)
    const siblingRels = relationships.filter(
      (r) =>
        r.treeId === currentTree?.id &&
        r.type === "parent-child" &&
        parentIds.includes(r.parentId) &&
        r.childId !== personId,
    );
    const siblingIds = [...new Set(siblingRels.map((r) => r.childId))];
    return people.filter((p) => siblingIds.includes(p.id));
  };

  // Reorder sibling: swap birthOrder with adjacent sibling
  // direction: 'older' (أكبر - move right) or 'younger' (أصغر - move left)
  const handleReorderSibling = async (personId, direction) => {
    const person = people.find((p) => p.id === personId);
    if (!person) return;

    const siblings = getSiblings(personId);
    if (siblings.length === 0) return;

    // Create array with current person and siblings, sorted by birthOrder (oldest first)
    const allSiblings = [person, ...siblings].sort((a, b) => {
      const orderA = a.birthOrder ?? 9999;
      const orderB = b.birthOrder ?? 9999;
      return orderA - orderB;
    });

    const currentIndex = allSiblings.findIndex((s) => s.id === personId);
    if (currentIndex === -1) return;

    // Determine swap target index
    // In Arabic RTL: older = right = lower index, younger = left = higher index
    // So 'older' means swap with the one BEFORE (lower birthOrder)
    // And 'younger' means swap with the one AFTER (higher birthOrder)
    let targetIndex;
    if (direction === "older") {
      targetIndex = currentIndex - 1;
    } else {
      targetIndex = currentIndex + 1;
    }

    // Check bounds
    if (targetIndex < 0 || targetIndex >= allSiblings.length) return;

    const targetPerson = allSiblings[targetIndex];
    const currentOrder = person.birthOrder ?? currentIndex + 1;
    const targetOrder = targetPerson.birthOrder ?? targetIndex + 1;

    // Optimistically update UI
    setPeople((prev) =>
      prev.map((p) => {
        if (p.id === personId) return { ...p, birthOrder: targetOrder };
        if (p.id === targetPerson.id) return { ...p, birthOrder: currentOrder };
        return p;
      }),
    );

    // Persist to database via API
    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/people/${personId}/birthOrder`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ birthOrder: targetOrder }),
        }),
        fetch(`/api/people/${targetPerson.id}/birthOrder`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ birthOrder: currentOrder }),
        }),
      ]);

      // Check if both requests succeeded
      if (!res1.ok || !res2.ok) {
        throw new Error("Failed to update birthOrder");
      }
    } catch (error) {
      console.error("Failed to persist birthOrder swap:", error);
      // Rollback on error
      setPeople((prev) =>
        prev.map((p) => {
          if (p.id === personId) return { ...p, birthOrder: currentOrder };
          if (p.id === targetPerson.id) return { ...p, birthOrder: targetOrder };
          return p;
        }),
      );
    }
  };

  const handleMouseDown = (e) => {
    const isBackground =
      !e.target.closest("[data-person-box]") &&
      !e.target.closest("[data-action-button]") &&
      !e.target.closest("[data-add-person-button]");
    if (isBackground) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragStartOffset({ ...panOffset });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPanOffset({
        x: Math.max(
          -5000,
          Math.min(5000, dragStartOffset.x + e.clientX - dragStart.x),
        ),
        y: Math.max(
          -200,
          Math.min(1000, dragStartOffset.y + e.clientY - dragStart.y),
        ),
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, dragStart, dragStartOffset]);

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom((prev) =>
      Math.max(0.3, Math.min(3, prev * (e.deltaY > 0 ? 0.9 : 1.1))),
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
            {t.welcome}
          </h1>
          <div className="space-y-4">
            <Button
              onClick={handleGoogleAuth}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
            >
              <Mail className="w-5 h-5 ml-2" />
              {t.continueWithGoogle}
            </Button>
            <Button
              onClick={handleGoogleAuth}
              className="w-full bg-black hover:bg-gray-800 text-white py-3"
            >
              <User className="w-5 h-5 ml-2" />
              {t.continueWithApple}
            </Button>
            <Button
              onClick={handleGoogleAuth}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3"
            >
              <Smartphone className="w-5 h-5 ml-2" />
              {t.uaeMobile}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === "dashboard") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b px-8 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold">{t.dashboard}</h1>
          <Button onClick={() => setIsAuthenticated(false)} variant="outline">
            {t.logout}
          </Button>
        </div>
        <div className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-3 gap-6">
          <div
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg"
            onClick={() => currentTree && setCurrentView("tree-builder")}
          >
            <h3 className="text-xl font-bold mb-4">{t.myFamilyTrees}</h3>
            <div className="text-3xl font-bold text-purple-600">
              {currentTree ? 1 : 0}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-4">{t.familyMembers}</h3>
            <div className="text-3xl font-bold text-blue-600">
              {people.filter((p) => p.treeId === currentTree?.id).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-4">{t.relationships}</h3>
            <div className="text-3xl font-bold text-green-600">
              {relationships.filter((r) => r.treeId === currentTree?.id).length}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 overflow-hidden">
      <div className="bg-white shadow-sm border-b px-4 py-3 flex items-center gap-4">
        <Button
          onClick={() => setCurrentView("dashboard")}
          variant="outline"
          size="sm"
        >
          <Home className="w-4 h-4 ml-2" />
          {t.backToDashboard}
        </Button>
        <h1 className="text-2xl font-bold">{t.familyTreeName}</h1>
      </div>

      <div className="relative" style={{ height: "calc(100vh - 64px)" }}>
        <div
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          style={{ backgroundColor: stylingOptions.backgroundColor }}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
        >
          {/* TreeCanvas component renders the family tree layout */}
          {treeLayout && (
            <TreeCanvas
              layout={treeLayout.layout}
              familyData={treeLayout.familyData}
              people={treePeople}
              selectedPerson={selectedPerson}
              onPersonClick={(personId) => {
                setSelectedPerson(personId);
                setEditingPerson(personId);
                setRelationshipType(null);
                setShowPersonForm(true);
                setShowActionMenu(true);
              }}
              onBackgroundClick={() => {
                setShowActionMenu(false);
              }}
              zoom={zoom}
              panOffset={panOffset}
              autoPan={effectiveAutoPan}
              stylingOptions={stylingOptions}
              displayOptions={displayOptions}
              cardDimensions={CARD}
            />
          )}

          {/* OLD SVG AND PERSON BOX RENDERING - REMOVED AND REPLACED WITH TreeCanvas */}

          {/* Action buttons for selected person */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${
                panOffset.x + (effectiveAutoPan?.x || 0)
              }px, ${
                panOffset.y + (effectiveAutoPan?.y || 0)
              }px) scale(${zoom})`,
              transformOrigin: "0 0",
              pointerEvents: "none",
            }}
          >
            {selectedPerson &&
              showActionMenu &&
              (() => {
                const entity = treeLayout?.layout?.e?.[`P${selectedPerson}`];
                if (!entity) return null;
                const BOX_WIDTH = stylingOptions?.boxWidth || CARD.w;
                const BOX_HEIGHT = CARD.h;
                const h = BOX_HEIGHT * 0.6;
                const x = entity.x * BOX_WIDTH;
                const y = entity.y * BOX_HEIGHT;

                // Living spouse limit per gender
                const spouseRels = relationships.filter(
                  (r) =>
                    r.treeId === currentTree?.id &&
                    r.type === "partner" &&
                    (r.person1Id === selectedPerson ||
                      r.person2Id === selectedPerson),
                );
                const spouseIds = spouseRels.map((rel) =>
                  rel.person1Id === selectedPerson
                    ? rel.person2Id
                    : rel.person1Id,
                );
                const livingSpousesCount = spouseIds.reduce((count, sid) => {
                  const sp = treePeople.find((pp) => pp.id === sid);
                  return sp && sp.isLiving !== false ? count + 1 : count;
                }, 0);
                const selected = treePeople.find(
                  (p) => p.id === selectedPerson,
                );
                const spouseLimit = selected?.gender === "male" ? 4 : 1;
                const limitMessage =
                  spouseLimit === 1
                    ? "Maximum of 1 spouse allowed"
                    : "Maximum of 4 living spouses allowed";
                const canAddSpouse = livingSpousesCount < spouseLimit;
                const addSpouseTooltip = canAddSpouse
                  ? t.addSpouse
                  : limitMessage;

                // Disable Add Parent when both parents already exist
                const parentRels = relationships.filter(
                  (r) =>
                    r.treeId === currentTree?.id &&
                    r.type === "parent-child" &&
                    r.childId === selectedPerson,
                );
                const parentIds = parentRels.map((r) => r.parentId);
                const parentPeople = treePeople.filter((p) =>
                  parentIds.includes(p.id),
                );
                const hasFather = parentPeople.some(
                  (p) => p?.gender === "male",
                );
                const hasMother = parentPeople.some(
                  (p) => p?.gender === "female",
                );
                const canAddParents = !(hasFather && hasMother);
                const addParentTooltip = canAddParents
                  ? t.addParent
                  : "Both parents already exist";

                // Check if person has siblings for reorder buttons
                const siblings = getSiblings(selectedPerson);
                const hasSiblings = siblings.length > 0;

                // Determine if can move older/younger based on current position
                let canMoveOlder = false;
                let canMoveYounger = false;
                if (hasSiblings) {
                  const currentPerson = treePeople.find((p) => p.id === selectedPerson);
                  const allSiblings = [currentPerson, ...siblings].sort((a, b) => {
                    const orderA = a.birthOrder ?? 9999;
                    const orderB = b.birthOrder ?? 9999;
                    return orderA - orderB;
                  });
                  const currentIndex = allSiblings.findIndex((s) => s.id === selectedPerson);
                  canMoveOlder = currentIndex > 0;
                  canMoveYounger = currentIndex < allSiblings.length - 1;
                }

                return (
                  <div
                    data-action-button
                    className="absolute bg-white border rounded-lg shadow-lg p-2 z-20 transition-opacity transition-transform duration-200"
                    style={{
                      left: x - 90,
                      top: y + h / 2 + 10,
                      pointerEvents: "auto",
                    }}
                  >
                    <div className="flex gap-1">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canAddSpouse) {
                            window.alert(limitMessage);
                            return;
                          }
                          handleQuickCreateSpouse(selectedPerson);
                          setShowActionMenu(false);
                        }}
                        disabled={!canAddSpouse}
                        size="sm"
                        variant="ghost"
                        className="w-8 h-8 p-0"
                        title={addSpouseTooltip}
                      >
                        <Heart className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickCreateChild(selectedPerson);
                          setShowActionMenu(false);
                        }}
                        size="sm"
                        variant="ghost"
                        className="w-8 h-8 p-0"
                        title={t.addChild}
                      >
                        <Baby className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canAddParents) {
                            window.alert("Both parents already exist");
                            return;
                          }
                          // Add both parents at once and open father's form
                          handleAddBothParents(selectedPerson);
                          setShowActionMenu(false);
                        }}
                        disabled={!canAddParents}
                        size="sm"
                        variant="ghost"
                        className="w-8 h-8 p-0"
                        title={addParentTooltip}
                      >
                        <Users className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickCreateSibling(selectedPerson);
                          setShowActionMenu(false);
                        }}
                        size="sm"
                        variant="ghost"
                        className="w-8 h-8 p-0"
                        title={t.addSibling}
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                      {hasSiblings && (
                        <>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReorderSibling(selectedPerson, "older");
                            }}
                            disabled={!canMoveOlder}
                            size="sm"
                            variant="ghost"
                            className="w-8 h-8 p-0"
                            title="أكبر"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReorderSibling(selectedPerson, "younger");
                            }}
                            disabled={!canMoveYounger}
                            size="sm"
                            variant="ghost"
                            className="w-8 h-8 p-0"
                            title="أصغر"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePerson(selectedPerson);
                          setShowActionMenu(false);
                        }}
                        size="sm"
                        variant="ghost"
                        className="w-8 h-8 p-0 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </Button>
                    </div>
                  </div>
                );
              })()}
          </div>

          {treePeople.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <div
                className="text-center pointer-events-auto"
                data-add-person-button
              >
                <h2 className="text-2xl font-bold text-gray-700 mb-4">
                  {t.startBuilding}
                </h2>
                <p className="text-gray-500 mb-6">{t.addFirstMember}</p>
                <Button
                  onClick={() => {
                    setRelationshipType(null);
                    setEditingPerson(null);
                    setShowPersonForm(true);
                  }}
                  size="lg"
                >
                  <UserPlus className="w-5 h-5 ml-2" />
                  {t.addPerson}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="fixed left-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-40">
          <Button
            onClick={() => setZoom((prev) => Math.min(3, prev * 1.2))}
            size="sm"
            className="w-10 h-10 p-0"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <div className="w-10 h-10 bg-white border rounded flex items-center justify-center text-xs font-bold">
            {Math.round(zoom * 100)}%
          </div>
          <Button
            onClick={() => setZoom((prev) => Math.max(0.3, prev / 1.2))}
            size="sm"
            className="w-10 h-10 p-0"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => {
              setZoom(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            size="sm"
            variant="outline"
            className="w-10 h-10 p-0"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
          <Button
            onClick={() => setShowOptions(true)}
            size="sm"
            variant="outline"
            className="bg-white shadow-lg"
          >
            <Settings className="w-4 h-4 ml-1" />
            {t.options}
          </Button>
        </div>

        {showPersonForm && (
          <div
            data-person-form
            className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-white shadow-2xl border rounded-lg z-50"
            style={{ width: "400px", height: "80vh" }}
          >
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-xl font-bold">
                  {editingPerson ? "تعديل فرد" : "إضافة فرد"}
                </h2>
                <Button
                  onClick={() => {
                    setShowPersonForm(false);
                    setEditingPerson(null);
                    setRelationshipType(null);
                  }}
                  variant="ghost"
                  size="sm"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <PersonForm
                  key={
                    editingPerson ? `edit-${editingPerson}` : `add-${formKey}`
                  }
                  person={
                    editingPerson
                      ? treePeople.find((p) => p.id === editingPerson)
                      : null
                  }
                  onSave={editingPerson ? updatePerson : addPerson}
                  onCancel={() => {
                    setShowPersonForm(false);
                    setEditingPerson(null);
                    setRelationshipType(null);
                  }}
                  relationshipType={relationshipType}
                  defaultGender={defaultSpouseGender}
                  t={t}
                />
              </div>
            </div>
          </div>
        )}

        {showOptions && (
          <div className="fixed inset-0 z-40 pointer-events-none">
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-95 backdrop-blur-sm shadow-2xl border rounded-lg z-50 pointer-events-auto w-[90vw] max-w-[1000px] p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{t.options}</h2>
                <Button
                  onClick={() => setShowOptions(false)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <h3 className="font-medium mb-3">عرض المعلومات</h3>
                  <div className="space-y-2">
                    {Object.keys(displayOptions).map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={displayOptions[key]}
                          onChange={(e) =>
                            setDisplayOptions((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                          className="rounded"
                        />
                        <span className="text-sm">
                          {key.replace("show", "إظهار ")}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-3">الألوان</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm w-32">لون الذكور</label>
                      <input
                        type="color"
                        value={stylingOptions.maleBoxColor}
                        onChange={(e) =>
                          setStylingOptions((prev) => ({
                            ...prev,
                            maleBoxColor: e.target.value,
                          }))
                        }
                        className="w-12 h-8 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm w-32">لون الإناث</label>
                      <input
                        type="color"
                        value={stylingOptions.femaleBoxColor}
                        onChange={(e) =>
                          setStylingOptions((prev) => ({
                            ...prev,
                            femaleBoxColor: e.target.value,
                          }))
                        }
                        className="w-12 h-8 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm w-32">لون الخلفية</label>
                      <input
                        type="color"
                        value={stylingOptions.backgroundColor}
                        onChange={(e) =>
                          setStylingOptions((prev) => ({
                            ...prev,
                            backgroundColor: e.target.value,
                          }))
                        }
                        className="w-12 h-8 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-3">الأحجام</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm block mb-1">
                        عرض الصندوق: {stylingOptions.boxWidth}
                      </label>
                      <input
                        type="range"
                        min="100"
                        max="200"
                        value={stylingOptions.boxWidth}
                        onChange={(e) =>
                          setStylingOptions((prev) => ({
                            ...prev,
                            boxWidth: parseInt(e.target.value),
                          }))
                        }
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-sm block mb-1">
                        حجم النص: {stylingOptions.textSize}
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="20"
                        value={stylingOptions.textSize}
                        onChange={(e) =>
                          setStylingOptions((prev) => ({
                            ...prev,
                            textSize: parseInt(e.target.value),
                          }))
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={() => setShowOptions(false)}>{t.save}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PersonForm({
  person,
  onSave,
  onCancel,
  relationshipType,
  t,
  defaultGender,
}) {
  const [formData, setFormData] = useState({
    firstName: person?.firstName || "",
    lastName: person?.lastName || "",
    gender: person?.gender || defaultGender || "",
    birthDate: person?.birthDate || "",
    birthPlace: person?.birthPlace || "",
    isLiving: person?.isLiving !== false,
    deathDate: person?.deathDate || "",
    phone: person?.phone || "",
    email: person?.email || "",
    address: person?.address || "",
    profession: person?.profession || "",
    company: person?.company || "",
  });

  // Reset form when person prop changes
  useEffect(() => {
    setFormData({
      firstName: person?.firstName || "",
      lastName: person?.lastName || "",
      gender: person?.gender || defaultGender || "",
      birthDate: person?.birthDate || "",
      birthPlace: person?.birthPlace || "",
      isLiving: person?.isLiving !== false,
      deathDate: person?.deathDate || "",
      phone: person?.phone || "",
      email: person?.email || "",
      address: person?.address || "",
      profession: person?.profession || "",
      company: person?.company || "",
    });
  }, [person]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.firstName.trim()) {
      alert("يرجى إدخال الاسم الأول");
      return;
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-bold mb-1">{t.firstName}</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, firstName: e.target.value }))
            }
            className="w-full px-3 py-2 border rounded-md"
            dir="rtl"
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">{t.lastName}</label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, lastName: e.target.value }))
            }
            className="w-full px-3 py-2 border rounded-md"
            dir="rtl"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold mb-1">{t.gender}</label>
        <select
          value={formData.gender}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, gender: e.target.value }))
          }
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="">اختر الجنس</option>
          <option value="male">{t.male}</option>
          <option value="female">{t.female}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold mb-1">{t.birthDate}</label>
        <input
          type="date"
          value={formData.birthDate}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, birthDate: e.target.value }))
          }
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-bold mb-1">{t.birthPlace}</label>
        <input
          type="text"
          value={formData.birthPlace}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, birthPlace: e.target.value }))
          }
          className="w-full px-3 py-2 border rounded-md"
          dir="rtl"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isLiving"
          checked={formData.isLiving}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, isLiving: e.target.checked }))
          }
          className="rounded"
        />
        <label htmlFor="isLiving" className="text-sm font-bold">
          {t.isLiving}
        </label>
      </div>

      {!formData.isLiving && (
        <div>
          <label className="block text-sm font-bold mb-1">{t.deathDate}</label>
          <input
            type="date"
            value={formData.deathDate}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, deathDate: e.target.value }))
            }
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-bold mb-1">{t.phone}</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, phone: e.target.value }))
            }
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">{t.email}</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold mb-1">{t.profession}</label>
        <input
          type="text"
          value={formData.profession}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, profession: e.target.value }))
          }
          className="w-full px-3 py-2 border rounded-md"
          dir="rtl"
        />
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t mt-4">
        <Button type="submit">{person ? t.update : t.save}</Button>
        <Button type="button" onClick={onCancel} variant="outline">
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

export default App;
