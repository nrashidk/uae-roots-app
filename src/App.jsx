import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button.jsx";
import {
  Heart,
  Baby,
  Users,
  UserPlus,
  Edit3,
  Trash2,
  X,
  Settings,
  Download,
  Home,
  Share,
  Calendar,
  Printer,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Mail,
  Smartphone,
  User,
} from "lucide-react";
import "./App.css";

// UAE Roots Family Tree Application - Enhanced with FamilyEcho Features
function App() {
  // Card dimensions constants
  const CARD = {
    w: 140,
    h: 90,
  };

  // Relationship type constants
  const REL = {
    PARTNER: "partner",
    PARENT_CHILD: "parent-child",
    SIBLING: "sibling",
  };

  // State Management
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState("auth");
  const [currentTree, setCurrentTree] = useState(null);
  const [people, setPeople] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [activeTab, setActiveTab] = useState("personal");
  const [showOptions, setShowOptions] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedDownloadFormat, setSelectedDownloadFormat] = useState("html");

  // Enhanced Display Options (FamilyEcho-style)
  const [displayOptions, setDisplayOptions] = useState({
    // Personal Information Display
    showName: true,
    showMiddleNames: false,
    showNickname: false,
    showTitleSuffix: false,
    showSurname: true,
    showPhoto: false,
    showAge: false,
    showLifeYears: false,

    // Dates and Events
    showBirthDate: false,
    showBirthPlace: false,
    showMarriageDate: false,
    showMarriagePlace: false,
    showDivorceDate: false,
    showDeathDate: false,
    showDeathPlace: false,
    showDeathCause: false,
    showBurialDate: false,
    showBurialPlace: false,

    // Contact and Personal Details
    showEmail: false,
    showTelephone: false,
    showAddress: false,
    showProfession: false,
    showCompany: false,
    showInterests: false,
    showActivities: false,
  });

  // Enhanced Styling Options
  const [stylingOptions, setStylingOptions] = useState({
    backgroundColor: "#f8fafc",
    maleBoxColor: "#bfdbfe",
    femaleBoxColor: "#fce7f3",
    otherBoxColor: "#e6e6fa",
    livingTextColor: "#000000",
    deceasedTextColor: "#6b7280",
    boxWidth: 140,
    textSize: 14,
  });

  // Connection Line Options
  const [connectionOptions, setConnectionOptions] = useState({
    currentPartners: "thick",
    otherPartners: "medium",
    parents: "medium",
    nonBiological: "gray",
  });

  // Enhanced Zoom & Pan with smooth controls
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 });

  // Relationship intent when adding a person
  const [relationshipType, setRelationshipType] = useState(null);

  // Canvas ref for viewport calculations
  const canvasRef = useRef(null);
  
  // Canvas dimensions for dynamic centering
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1200, height: 800 });

  // Arabic translations - Complete Arabic interface
  const t = {
    welcome: "مرحباً بكم في جذور الإمارات",
    continueWithGoogle: "التسجيل عبر البريد الإلكتروني",
    continueWithApple: "التسجيل عبر الهوية الرقمية",
    uaeMobile: "التسجيل عبر الهاتف الإماراتي",
    dashboard: "لوحة التحكم",
    myFamilyTrees: "أشجار عائلتي",
    familyMembers: "أفراد العائلة",
    relationships: "العلاقات",
    createNewTree: "إنشاء شجرة جديدة",
    noFamilyTrees: "لا توجد أشجار عائلة بعد",
    createFirstTree: "أنشئ شجرة عائلتك الأولى للبدء",
    addPerson: "إضافة شخص",
    startBuilding: "ابدأ ببناء شجرة عائلتك",
    addFirstMember: "أضف أول فرد من العائلة للبدء",
    personal: "البيانات الشخصية",
    contact: "معلومات التواصل",
    biography: "السيرة الذاتية",
    addFamilyMember: "إضافة فرد من العائلة",
    editFamilyMember: "تعديل فرد من العائلة",
    allFieldsOptional: "جميع الحقول اختيارية",
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
    company: "الشركة",
    bioNotes: "ملاحظات السيرة الذاتية",
    save: "حفظ",
    cancel: "إلغاء",
    update: "تحديث",
    addSpouse: "إضافة زوج/زوجة",
    addParent: "إضافة والد",
    addChild: "إضافة طفل",
    addSibling: "إضافة شقيق",
    options: "خيارات",
    displayOptions: "خيارات العرض",
    stylingOptions: "خيارات التصميم",
    showNames: "إظهار الأسماء",
    showSurnames: "إظهار أسماء العائلة",
    showBirthDates: "إظهار تواريخ الميلاد",
    showBirthPlaces: "إظهار أماكن الميلاد",
    showProfessions: "إظهار المهن",
    showPhones: "إظهار الهواتف",
    showEmails: "إظهار البريد الإلكتروني",
    showAddresses: "إظهار العناوين",
    maleBoxColor: "لون صندوق الذكر",
    femaleBoxColor: "لون صندوق الأنثى",
    textSize: "حجم النص",
    backgroundColor: "لون الخلفية",
    resetView: "إعادة تعيين العرض",
    logout: "تسجيل الخروج",
    backToDashboard: "العودة إلى لوحة التحكم",
    openFamilyTree: "فتح شجرة العائلة",
    applyChanges: "تطبيق التغييرات",
    familyTreeName: "شجرة عائلتي",
    deleteConfirm: "هل أنت متأكد من حذف هذا الشخص؟",
    editPerson: "تعديل",
    deletePerson: "حذف",
    enterFirstName: "يرجى إدخال الاسم الأول",
    boxWidth: "عرض الصندوق",
    familyStats: "أفراد العائلة",
    relationshipStats: "العلاقات",
    spouse: "زوج/زوجة",
    child: "طفل",
    parent: "والد",
    sibling: "شقيق",
    print: "طباعة",
    share: "مشاركة",
    calendar: "التقويم",
    download: "تنزيل",
    selectDownloadFormat: "اختر تنسيق التنزيل لهذه العائلة:",
    readOnlyHTML: "HTML للقراءة فقط (ملف واحد)",
    readOnlyHTMLDesc:
      "للتصفح من القرص أو الإضافة إلى موقع ويب، مع واجهة تفاعلية للقراءة فقط.",
    gedcom: "GEDCOM",
    gedcomDesc:
      "تنسيق قياسي لبيانات الأنساب. لاستيراد البيانات في برامج الأنساب المختلفة.",
    csv: "CSV (مفصولة بفواصل)",
    csvDesc: "لاستيراد البيانات في جداول البيانات أو قواعد البيانات.",
    plainText: "نص عادي",
    plainTextDesc:
      "للعرض في معالجات النصوص مثل المفكرة و Word، أو الإرسال بالبريد الإلكتروني.",
    downloadBtn: "تنزيل",
    done: "تم",
  };

  // Authentication handlers
  const handleGoogleAuth = () => {
    setIsAuthenticated(true);
    setCurrentView("dashboard");
  };
  const handleAppleAuth = () => {
    setIsAuthenticated(true);
    setCurrentView("dashboard");
  };
  const handleUAEMobileAuth = () => {
    setIsAuthenticated(true);
    setCurrentView("dashboard");
  };

  // Measure canvas dimensions for dynamic centering
  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setCanvasDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [currentView]);

  // --- AUTO-LAYOUT LOGIC ---
  // Compute generations and assign x/y positions for all people in the current tree
  const computeTreeLayout = (people, relationships, viewportWidth = 1200, viewportHeight = 800) => {
    // Build maps for quick lookup
    const idToPerson = Object.fromEntries(people.map((p) => [p.id, { ...p }]));
    const childrenMap = {};
    const parentMap = {};
    relationships.forEach((r) => {
      if (r.type === REL.PARENT_CHILD) {
        if (!childrenMap[r.parentId]) childrenMap[r.parentId] = [];
        childrenMap[r.parentId].push(r.childId);
        parentMap[r.childId] = r.parentId;
      }
    });

    // Find root people (no parents)
    const roots = people.filter((p) => !parentMap[p.id]);
    // Assign generation levels (BFS)
    const queue = [];
    roots.forEach((root) => {
      idToPerson[root.id].generation = 0;
      queue.push(root.id);
    });
    while (queue.length) {
      const pid = queue.shift();
      const gen = idToPerson[pid].generation;
      (childrenMap[pid] || []).forEach((cid) => {
        idToPerson[cid].generation = gen + 1;
        queue.push(cid);
      });
    }

    // Group spouses together and arrange properly
    const spouseMap = {};
    relationships.forEach((r) => {
      if (r.type === REL.PARTNER) {
        spouseMap[r.person1Id] = r.person2Id;
        spouseMap[r.person2Id] = r.person1Id;
      }
    });

    // Group by generation
    const genMap = {};
    Object.values(idToPerson).forEach((p) => {
      if (!genMap[p.generation]) genMap[p.generation] = [];
      genMap[p.generation].push(p);
    });

    // Assign x/y positions for each generation with proper spouse positioning
    const verticalSpacing = 140;
    const horizontalSpacing = 180;
    const spouseSpacing = 60; // Gap between spouses for visible connection line

    // Calculate total tree height and starting Y position for vertical centering
    const totalGenerations = Object.keys(genMap).length;
    const totalTreeHeight = totalGenerations * verticalSpacing;
    const verticalPadding = 50; // Minimum padding from top/bottom
    const startY = Math.max(verticalPadding, (viewportHeight - totalTreeHeight) / 2);

    Object.keys(genMap).forEach((g) => {
      const gen = parseInt(g);
      const row = genMap[gen];
      const processedIds = new Set();
      
      // Calculate total width needed for this generation
      let totalWidth = 0;
      const tempProcessed = new Set();
      row.forEach((person) => {
        if (tempProcessed.has(person.id)) return;
        const spouseId = spouseMap[person.id];
        const spouse = spouseId ? idToPerson[spouseId] : null;
        
        if (spouse && !tempProcessed.has(spouseId)) {
          totalWidth += CARD.w * 2 + spouseSpacing + horizontalSpacing;
          tempProcessed.add(person.id);
          tempProcessed.add(spouseId);
        } else if (!tempProcessed.has(person.id)) {
          totalWidth += CARD.w + horizontalSpacing;
          tempProcessed.add(person.id);
        }
      });
      
      // Center the generation dynamically based on viewport width
      const padding = 50; // Minimum padding from edge
      let currentX = Math.max(padding, (viewportWidth - totalWidth) / 2);

      row.forEach((person) => {
        if (processedIds.has(person.id)) return;

        const spouseId = spouseMap[person.id];
        const spouse = spouseId ? idToPerson[spouseId] : null;

        if (spouse && !processedIds.has(spouseId)) {
          // Position couple side by side
          person.x = currentX;
          person.y = startY + gen * verticalSpacing;

          spouse.x = currentX + CARD.w + spouseSpacing;
          spouse.y = startY + gen * verticalSpacing;

          processedIds.add(person.id);
          processedIds.add(spouseId);
          currentX += CARD.w * 2 + spouseSpacing + horizontalSpacing;
        } else if (!processedIds.has(person.id)) {
          // Single person
          person.x = currentX;
          person.y = startY + gen * verticalSpacing;
          processedIds.add(person.id);
          currentX += CARD.w + horizontalSpacing;
        }
      });
    });

    // Return new people array with updated positions
    return people.map((p) => ({ ...p, ...idToPerson[p.id] }));
  };

  // Use auto-layout for current tree
  const treePeople = computeTreeLayout(
    people.filter((p) => p.treeId === currentTree?.id),
    relationships.filter((r) => r.treeId === currentTree?.id),
    canvasDimensions.width,
    canvasDimensions.height
  );
  // --- END AUTO-LAYOUT LOGIC ---

  // Tree management
  const createNewTree = () => {
    const newTree = {
      id: Date.now(),
      name: "شجرة عائلتي",
      createdAt: new Date().toISOString(),
    };
    setCurrentTree(newTree);
    setCurrentView("tree-builder");
  };

  // Enhanced auto-center view on a specific person
  const centerOnPerson = (person) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const viewportCenterX = rect.width / 2;
    const viewportCenterY = rect.height / 2;

    const personCenterX = person.x + CARD.w / 2;
    const personCenterY = person.y + CARD.h / 2;

    const newOffsetX = viewportCenterX - personCenterX * zoom;
    const newOffsetY = viewportCenterY - personCenterY * zoom;

    setPanOffset({ x: newOffsetX, y: newOffsetY });
  };

  // Enhanced positioning algorithm with better collision detection
  const calculatePosition = (relType, anchorPerson) => {
    // For the first person, center them in the viewport accounting for zoom and pan
    if (!anchorPerson) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        // Account for current zoom and pan offset
        const centerX = (rect.width / 2 - panOffset.x) / zoom - CARD.w / 2;
        const centerY = (rect.height / 2 - panOffset.y) / zoom - CARD.h / 2;
        return {
          x: centerX,
          y: centerY,
        };
      }
      return { x: 400, y: 300 };
    }

    const horizontalSpacing = 200;
    const verticalSpacing = 160;
    const partnerSpacing = 160;
    const minDistance = 140;

    const hasCollision = (x, y, excludeId = null) => {
      return people.some((person) => {
        if (person.id === excludeId || person.treeId !== currentTree?.id)
          return false;
        const dx = Math.abs(person.x - x);
        const dy = Math.abs(person.y - y);
        return dx < minDistance && dy < minDistance;
      });
    };

    const findNonCollidingPosition = (targetX, targetY, excludeId = null) => {
      let x = targetX;
      let y = targetY;
      let attempts = 0;
      const maxAttempts = 20;

      while (hasCollision(x, y, excludeId) && attempts < maxAttempts) {
        const offset = Math.floor(attempts / 4) * 60 + 60;
        const direction = attempts % 4;

        switch (direction) {
          case 0:
            x = targetX + offset;
            y = targetY;
            break;
          case 1:
            x = targetX;
            y = targetY + offset;
            break;
          case 2:
            x = targetX - offset;
            y = targetY;
            break;
          case 3:
            x = targetX;
            y = targetY - offset;
            break;
        }
        attempts++;
      }

      return { x, y };
    };

    switch (relType) {
      case "spouse": {
        const targetX = anchorPerson.x + CARD.w + partnerSpacing;
        const targetY = anchorPerson.y;
        return findNonCollidingPosition(targetX, targetY);
      }

      case "child": {
        const existingChildren = relationships.filter(
          (r) =>
            r.type === REL.PARENT_CHILD &&
            r.parentId === anchorPerson.id &&
            r.treeId === currentTree?.id,
        );

        const partnerRel = relationships.find(
          (r) =>
            r.type === REL.PARTNER &&
            (r.person1Id === anchorPerson.id ||
              r.person2Id === anchorPerson.id) &&
            r.treeId === currentTree?.id,
        );

        let baseX = anchorPerson.x;
        if (partnerRel) {
          const partnerId =
            partnerRel.person1Id === anchorPerson.id
              ? partnerRel.person2Id
              : partnerRel.person1Id;
          const partner = people.find((p) => p.id === partnerId);
          if (partner) {
            const coupleCenter =
              (anchorPerson.x + CARD.w / 2 + partner.x + CARD.w / 2) / 2;
            baseX =
              coupleCenter -
              (existingChildren.length * horizontalSpacing) / 2 -
              CARD.w / 2;
          }
        } else {
          baseX =
            anchorPerson.x - (existingChildren.length * horizontalSpacing) / 2;
        }

        const targetX = baseX + existingChildren.length * horizontalSpacing;
        const targetY = anchorPerson.y + verticalSpacing;
        return findNonCollidingPosition(targetX, targetY);
      }

      case "parent": {
        const targetX = anchorPerson.x;
        const targetY = anchorPerson.y - verticalSpacing;
        return findNonCollidingPosition(targetX, targetY);
      }

      case "sibling": {
        const allSiblingRelations = relationships.filter(
          (r) =>
            r.type === REL.SIBLING &&
            (r.person1Id === anchorPerson.id ||
              r.person2Id === anchorPerson.id) &&
            r.treeId === currentTree?.id,
        );

        const siblingIds = new Set([anchorPerson.id]);
        allSiblingRelations.forEach((rel) => {
          siblingIds.add(rel.person1Id);
          siblingIds.add(rel.person2Id);
        });

        const siblings = Array.from(siblingIds)
          .map((id) => people.find((p) => p.id === id))
          .filter((p) => p)
          .sort((a, b) => a.x - b.x);

        const targetY = anchorPerson.y;
        const rightmostSibling = siblings[siblings.length - 1];
        const targetX = rightmostSibling.x + horizontalSpacing;

        return findNonCollidingPosition(targetX, targetY);
      }

      default: {
        const targetX = anchorPerson.x + horizontalSpacing;
        const targetY = anchorPerson.y;
        return findNonCollidingPosition(targetX, targetY);
      }
    }
  };

  // Enhanced add person with smart gender defaults
  const addPerson = (personData) => {
    const anchorPerson = selectedPerson
      ? people.find((p) => p.id === selectedPerson)
      : null;

    // Keep spouse gender enforcement (as requested)
    let finalPersonData = { ...personData };
    if (relationshipType === "spouse") {
      finalPersonData.gender = "female";
    }

    const position = calculatePosition(relationshipType, anchorPerson);

    const newPerson = {
      id: Date.now(),
      ...finalPersonData,
      x: position.x,
      y: position.y,
      treeId: currentTree?.id,
      isLiving: finalPersonData.isLiving !== false,
    };

    setPeople((prev) => [...prev, newPerson]);

    // Create relationships
    if (selectedPerson && relationshipType) {
      const newRelationship = { id: Date.now() + 1, treeId: currentTree?.id };

      switch (relationshipType) {
        case "spouse":
          newRelationship.type = REL.PARTNER;
          newRelationship.person1Id = selectedPerson;
          newRelationship.person2Id = newPerson.id;
          break;
        case "child":
          newRelationship.type = REL.PARENT_CHILD;
          newRelationship.parentId = selectedPerson;
          newRelationship.childId = newPerson.id;

          // Add relationship with spouse if exists
          const spouseRel = relationships.find(
            (r) =>
              r.type === REL.PARTNER &&
              (r.person1Id === selectedPerson ||
                r.person2Id === selectedPerson) &&
              r.treeId === currentTree?.id,
          );

          if (spouseRel) {
            const spouseId =
              spouseRel.person1Id === selectedPerson
                ? spouseRel.person2Id
                : spouseRel.person1Id;
            const spouseChildRelationship = {
              id: Date.now() + 2,
              type: REL.PARENT_CHILD,
              parentId: spouseId,
              childId: newPerson.id,
              treeId: currentTree?.id,
            };
            setRelationships((prev) => [...prev, spouseChildRelationship]);
          }
          break;
        case "parent":
          newRelationship.type = REL.PARENT_CHILD;
          newRelationship.parentId = newPerson.id;
          newRelationship.childId = selectedPerson;
          break;
        case "sibling":
          newRelationship.type = REL.SIBLING;
          newRelationship.person1Id = selectedPerson;
          newRelationship.person2Id = newPerson.id;
          break;
      }

      setRelationships((prev) => [...prev, newRelationship]);
    }

    // Auto-center on new person
    setTimeout(() => {
      centerOnPerson(newPerson);
    }, 100);

    setShowPersonForm(false);
    setRelationshipType(null);
    setEditingPerson(null);
    setSelectedPerson(null);
  };

  // Update person
  const updatePerson = (personData) => {
    setPeople((prev) =>
      prev.map((p) => (p.id === editingPerson ? { ...p, ...personData } : p)),
    );
    setShowPersonForm(false);
    setEditingPerson(null);
  };

  // Delete person
  const deletePerson = (personId) => {
    if (window.confirm(t.deleteConfirm)) {
      setPeople((prev) => {
        const updatedPeople = prev.filter((p) => p.id !== personId);
        
        // If tree becomes empty after deletion, close the form
        const remainingInTree = updatedPeople.filter(
          (p) => p.treeId === currentTree?.id
        );
        if (remainingInTree.length === 0) {
          setShowPersonForm(false);
          setEditingPerson(null);
          setRelationshipType(null);
        }
        
        return updatedPeople;
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
    }
  };

  // Enhanced pan handling with smooth dragging
  const handleMouseDown = (e) => {
    // Check if clicking on background (not on person boxes or buttons)
    const isBackground =
      !e.target.closest("[data-person-box]") &&
      !e.target.closest("[data-action-button]");
    if (isBackground) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragStartOffset({ ...panOffset });
      e.currentTarget.style.cursor = "grabbing";
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setPanOffset({
        x: dragStartOffset.x + deltaX,
        y: dragStartOffset.y + deltaY,
      });
    }
  };

  const handleMouseUp = (e) => {
    if (isDragging) {
      setIsDragging(false);
      e.currentTarget.style.cursor = "grab";
    }
  };

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

  // Enhanced zoom with smooth controls
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.3, Math.min(3, prev * delta)));
  };

  // Zoom controls
  const zoomIn = () => setZoom((prev) => Math.min(3, prev * 1.2));
  const zoomOut = () => setZoom((prev) => Math.max(0.3, prev / 1.2));
  const resetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Enhanced export functionality
  const handleDownload = (format) => {
    const treeData = {
      people: people.filter((p) => p.treeId === currentTree?.id),
      relationships: relationships.filter((r) => r.treeId === currentTree?.id),
      tree: currentTree,
    };

    switch (format) {
      case "html":
        downloadAsHTML(treeData);
        break;
      case "gedcom":
        downloadAsGEDCOM(treeData);
        break;
      case "csv":
        downloadAsCSV(treeData);
        break;
      case "plaintext":
        downloadAsPlainText(treeData);
        break;
    }
    setShowDownloadModal(false);
  };

  const downloadAsHTML = (treeData) => {
    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${currentTree?.name || "شجرة العائلة"}</title>
    <style>
        body { font-family: 'Sakkal Majalla', Arial, sans-serif; direction: rtl; }
        .person { border: 1px solid #ccc; padding: 10px; margin: 5px; display: inline-block; }
        .male { background-color: #bfdbfe; }
        .female { background-color: #fce7f3; }
    </style>
</head>
<body>
    <h1>${currentTree?.name || "شجرة العائلة"}</h1>
    <div>
        ${treeData.people
          .map(
            (person) => `
            <div class="person ${person.gender}">
                <strong>${person.firstName} ${person.lastName || ""}</strong>
                ${person.birthDate ? `<br>تاريخ الميلاد: ${person.birthDate}` : ""}
                ${person.profession ? `<br>المهنة: ${person.profession}` : ""}
            </div>
        `,
          )
          .join("")}
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentTree?.name || "family-tree"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsGEDCOM = (treeData) => {
    let gedcom = "0 HEAD\n1 SOUR UAE Roots\n1 GEDC\n2 VERS 5.5\n1 CHAR UTF-8\n";

    treeData.people.forEach((person, index) => {
      gedcom += `0 @I${index + 1}@ INDI\n`;
      gedcom += `1 NAME ${person.firstName} /${person.lastName || ""}/\n`;
      if (person.gender)
        gedcom += `1 SEX ${person.gender === "male" ? "M" : "F"}\n`;
      if (person.birthDate) gedcom += `1 BIRT\n2 DATE ${person.birthDate}\n`;
      if (person.birthPlace) gedcom += `2 PLAC ${person.birthPlace}\n`;
    });

    gedcom += "0 TRLR\n";

    const blob = new Blob([gedcom], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentTree?.name || "family-tree"}.ged`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsCSV = (treeData) => {
    const headers = [
      "الاسم الأول",
      "اسم العائلة",
      "الجنس",
      "تاريخ الميلاد",
      "مكان الميلاد",
      "المهنة",
      "الهاتف",
      "البريد الإلكتروني",
    ];
    const csvContent = [
      headers.join(","),
      ...treeData.people.map((person) =>
        [
          person.firstName || "",
          person.lastName || "",
          person.gender === "male"
            ? "ذكر"
            : person.gender === "female"
              ? "أنثى"
              : "",
          person.birthDate || "",
          person.birthPlace || "",
          person.profession || "",
          person.phone || "",
          person.email || "",
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentTree?.name || "family-tree"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsPlainText = (treeData) => {
    const textContent =
      `${currentTree?.name || "شجرة العائلة"}\n\n` +
      treeData.people
        .map(
          (person) =>
            `${person.firstName} ${person.lastName || ""}\n` +
            (person.birthDate ? `تاريخ الميلاد: ${person.birthDate}\n` : "") +
            (person.profession ? `المهنة: ${person.profession}\n` : "") +
            "\n",
        )
        .join("");

    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentTree?.name || "family-tree"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Share functionality
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentTree?.name || "شجرة العائلة",
          text: "شاهد شجرة عائلتي على جذور الإمارات",
          url: window.location.href,
        });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert("تم نسخ الرابط إلى الحافظة");
    }
  };

  // Print functionality
  const handlePrint = () => {
    window.print();
  };

  // Calendar functionality
  const handleCalendar = () => {
    const events = people
      .filter((p) => p.treeId === currentTree?.id && p.birthDate)
      .map((p) => ({
        title: `عيد ميلاد ${p.firstName}`,
        date: p.birthDate,
      }));

    // Create calendar data
    const calendarData = events
      .map(
        (event) =>
          `BEGIN:VEVENT\nSUMMARY:${event.title}\nDTSTART:${event.date.replace(/-/g, "")}\nEND:VEVENT`,
      )
      .join("\n");

    const icalContent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:UAE Roots\n${calendarData}\nEND:VCALENDAR`;

    const blob = new Blob([icalContent], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "family-events.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get relationship icon
  const getRelationshipIcon = (type) => {
    switch (type) {
      case "spouse":
        return <Heart className="w-4 h-4" />;
      case "child":
        return <Baby className="w-4 h-4" />;
      case "parent":
        return <Users className="w-4 h-4" />;
      case "sibling":
        return <UserPlus className="w-4 h-4" />;
      default:
        return <UserPlus className="w-4 h-4" />;
    }
  };

  // Authentication screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4 arabic-text" style={{ textAlign: 'center' }}>
              مرحباً بكم في جذور الإمارات
            </h1>
            <div className="w-16 h-1 bg-purple-500 mx-auto rounded"></div>
          </div>

          <div className="space-y-4">
            <Button
              onClick={handleGoogleAuth}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg flex items-center justify-center gap-3"
            >
              <Mail className="w-5 h-5" />
              <span className="arabic-text">{t.continueWithGoogle}</span>
            </Button>

            <Button
              onClick={handleAppleAuth}
              className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-lg flex items-center justify-center gap-3"
            >
              <User className="w-5 h-5" />
              <span className="arabic-text">{t.continueWithApple}</span>
            </Button>

            <Button
              onClick={handleUAEMobileAuth}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg flex items-center justify-center gap-3"
            >
              <Smartphone className="w-5 h-5" />
              <span className="arabic-text">{t.uaeMobile}</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard view
  if (currentView === "dashboard") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-gray-900 arabic-text">
                {t.dashboard}
              </h1>
              <Button
                onClick={() => setIsAuthenticated(false)}
                variant="outline"
                className="arabic-text"
              >
                {t.logout}
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 arabic-text">
                {t.myFamilyTrees}
              </h3>
              {currentTree ? (
                <div className="space-y-3">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-bold text-lg text-gray-900 arabic-text">
                      {currentTree.name}
                    </h4>
                    <div className="text-base text-gray-500 mt-2 arabic-text">
                      <span>
                        {
                          people.filter((p) => p.treeId === currentTree.id)
                            .length
                        }{" "}
                        {t.familyStats}
                      </span>
                      <span className="mx-2">•</span>
                      <span>
                        {
                          relationships.filter(
                            (r) => r.treeId === currentTree.id,
                          ).length
                        }{" "}
                        {t.relationshipStats}
                      </span>
                    </div>
                    <Button
                      onClick={() => setCurrentView("tree-builder")}
                      className="mt-3 w-full arabic-text"
                    >
                      {t.openFamilyTree}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4 arabic-text">
                    {t.noFamilyTrees}
                  </p>
                  <Button onClick={createNewTree} className="arabic-text">
                    {t.createNewTree}
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 arabic-text">
                {t.familyMembers}
              </h3>
              <div className="text-3xl font-bold text-blue-600">
                {people.filter((p) => p.treeId === currentTree?.id).length}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 arabic-text">
                {t.relationships}
              </h3>
              <div className="text-3xl font-bold text-green-600">
                {
                  relationships.filter((r) => r.treeId === currentTree?.id)
                    .length
                }
              </div>
            </div>
          </div>

          {!currentTree && (
            <div className="mt-8 text-center">
              <p className="text-gray-600 mb-4 arabic-text">
                {t.createFirstTree}
              </p>
              <Button onClick={createNewTree} size="lg" className="arabic-text">
                {t.createNewTree}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tree builder view
  if (currentView === "tree-builder") {
    // Use computed layout with x,y coordinates for positioning and connections

    return (
      <div className="h-screen bg-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setCurrentView("dashboard")}
              variant="outline"
              size="sm"
              className="arabic-text"
            >
              <Home className="w-4 h-4 ml-2" />
              {t.backToDashboard}
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 arabic-text">
              {currentTree?.name || t.familyTreeName}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              variant="outline"
              className="arabic-text"
            >
              <Printer className="w-4 h-4 ml-1" />
              {t.print}
            </Button>

            <Button
              onClick={() => setShowDownloadModal(true)}
              size="sm"
              variant="outline"
              className="arabic-text"
            >
              <Download className="w-4 h-4 ml-1" />
              {t.download}
            </Button>

            <Button
              onClick={handleShare}
              size="sm"
              variant="outline"
              className="arabic-text"
            >
              <Share className="w-4 h-4 ml-1" />
              {t.share}
            </Button>

            <Button
              onClick={handleCalendar}
              size="sm"
              variant="outline"
              className="arabic-text"
            >
              <Calendar className="w-4 h-4 ml-1" />
              {t.calendar}
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div
          className="relative"
          style={{
            height: "calc(100vh - 64px)", // Subtract header height
          }}
          onClick={(e) => {
            // Deselect person when clicking anywhere in the canvas area except on persons
            const isPersonClick = e.target.closest("[data-person-box]");
            const isActionButtonClick = e.target.closest(
              "[data-action-button]",
            );
            if (!isPersonClick && !isActionButtonClick) {
              setSelectedPerson(null);
            }
          }}
        >
          <div
            ref={canvasRef}
            className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden"
            style={{ backgroundColor: stylingOptions.backgroundColor }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          >
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {/* Enhanced family relationship connectors with smooth curves and professional styling */}
              <svg
                className="absolute inset-0 pointer-events-none"
                style={{ width: "100%", height: "100%" }}
              >
                {/* Straight bold lines connecting husband and spouse */}
                {relationships
                  .filter(
                    (r) =>
                      r.type === REL.PARTNER && r.treeId === currentTree?.id,
                  )
                  .map((r, i) => {
                    const p1 = treePeople.find((p) => p.id === r.person1Id);
                    const p2 = treePeople.find((p) => p.id === r.person2Id);
                    
                    if (!p1 || !p2) return null;

                    // Determine which person is on the left
                    const leftPerson = p1.x < p2.x ? p1 : p2;
                    const rightPerson = p1.x < p2.x ? p2 : p1;

                    // Connect from right edge of left person to left edge of right person
                    const startX = leftPerson.x + stylingOptions.boxWidth;
                    const endX = rightPerson.x;

                    // Use the center Y coordinate of both boxes
                    const startY = leftPerson.y + CARD.h / 2;
                    const endY = rightPerson.y + CARD.h / 2;

                    return (
                      <line
                        key={`spouse-${i}`}
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke="#dc2626"
                        strokeWidth={8}
                        strokeLinecap="round"
                        style={{
                          filter: "drop-shadow(0px 2px 4px rgba(220, 38, 38, 0.3))",
                        }}
                      />
                    );
                  })}
                {/* Enhanced T-connector for parent-child relationships with smooth curves */}
                {relationships
                  .filter(
                    (r) =>
                      r.type === REL.PARENT_CHILD &&
                      r.treeId === currentTree?.id,
                  )
                  .map((r, i) => {
                    const child = treePeople.find((p) => p.id === r.childId);
                    const parent = treePeople.find((p) => p.id === r.parentId);
                    if (!child || !parent) return null;

                    // Find spouse of parent (if any)
                    const spouseRel = relationships.find(
                      (rel) =>
                        rel.type === REL.PARTNER &&
                        (rel.person1Id === r.parentId ||
                          rel.person2Id === r.parentId) &&
                        rel.treeId === currentTree?.id,
                    );
                    let spouse = null;
                    if (spouseRel) {
                      spouse = treePeople.find(
                        (p) =>
                          p.id ===
                          (spouseRel.person1Id === r.parentId
                            ? spouseRel.person2Id
                            : spouseRel.person1Id),
                      );
                    }

                    const parentX = parent.x + stylingOptions.boxWidth / 2;
                    const spouseX = spouse
                      ? spouse.x + stylingOptions.boxWidth / 2
                      : parentX;
                    const midX = spouse ? (parentX + spouseX) / 2 : parentX;
                    const parentY = parent.y + CARD.h;
                    const childY = child.y;
                    const childX = child.x + stylingOptions.boxWidth / 2;

                    const curveRadius = 15;
                    const strokeColor = "#059669";

                    return (
                      <g key={i}>
                        {/* Horizontal connection between parents with curves */}
                        {spouse && (
                          <path
                            d={`M ${parentX} ${parentY + 15} L ${spouseX} ${parentY + 15}`}
                            stroke={strokeColor}
                            strokeWidth={3}
                            strokeLinecap="round"
                            fill="none"
                          />
                        )}
                        {/* Smooth curved path from parents to child */}
                        <path
                          d={`M ${midX} ${parentY + 15} 
                          L ${midX} ${parentY + 30}
                          Q ${midX} ${parentY + 30 + curveRadius} ${midX + (childX > midX ? curveRadius : -curveRadius)} ${parentY + 30 + curveRadius}
                          L ${childX - (childX > midX ? curveRadius : -curveRadius)} ${parentY + 30 + curveRadius}
                          Q ${childX} ${parentY + 30 + curveRadius} ${childX} ${parentY + 30 + 2 * curveRadius}
                          L ${childX} ${childY}`}
                          stroke={strokeColor}
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </g>
                    );
                  })}
                {/* Enhanced sibling connection lines with smooth curves */}
                {Object.values(
                  treePeople.reduce((acc, p) => {
                    // Group siblings by parent
                    const parentRel = relationships.find(
                      (r) =>
                        r.type === REL.PARENT_CHILD &&
                        r.childId === p.id &&
                        r.treeId === currentTree?.id,
                    );
                    if (parentRel) {
                      const parentId = parentRel.parentId;
                      if (!acc[parentId]) acc[parentId] = [];
                      acc[parentId].push(p);
                    }
                    return acc;
                  }, {}),
                ).map((siblings, i) => {
                  if (siblings.length < 2) return null;

                  const y = siblings[0].y - 20;
                  const minX = Math.min(
                    ...siblings.map((s) => s.x + stylingOptions.boxWidth / 2),
                  );
                  const maxX = Math.max(
                    ...siblings.map((s) => s.x + stylingOptions.boxWidth / 2),
                  );
                  const curveHeight = 10;
                  const strokeColor = "#7c3aed";
                  const dashArray = "5,5";

                  return (
                    <g key={i}>
                      {/* Main curved horizontal line connecting siblings */}
                      <path
                        d={`M ${minX} ${y} 
                          Q ${(minX + maxX) / 2} ${y - curveHeight} ${maxX} ${y}`}
                        stroke={strokeColor}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeDasharray={dashArray}
                        fill="none"
                      />
                      {/* Smooth vertical connectors to each sibling */}
                      {siblings.map((sibling, idx) => {
                        const siblingX =
                          sibling.x + stylingOptions.boxWidth / 2;
                        const connectionY =
                          y -
                          curveHeight *
                            Math.sin(
                              (Math.PI * (siblingX - minX)) / (maxX - minX),
                            );

                        return (
                          <path
                            key={idx}
                            d={`M ${siblingX} ${connectionY}
                              Q ${siblingX} ${(connectionY + sibling.y) / 2} ${siblingX} ${sibling.y}`}
                            stroke={strokeColor}
                            strokeWidth={2}
                            strokeLinecap="round"
                            fill="none"
                          />
                        );
                      })}
                    </g>
                  );
                })}
              </svg>
            </svg>

            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {treePeople.map((person) => (
                <div
                  key={person.id}
                  data-person-box
                  className={`absolute border-2 rounded-lg p-3 cursor-pointer transition-all duration-200 ${
                    selectedPerson === person.id
                      ? "border-green-500 shadow-lg"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                  style={{
                    left: person.x,
                    top: person.y,
                    width: stylingOptions.boxWidth,
                    height: CARD.h,
                    backgroundColor:
                      person.gender === "male"
                        ? stylingOptions.maleBoxColor
                        : person.gender === "female"
                        ? stylingOptions.femaleBoxColor
                        : "#e5e7eb",
                    fontSize: stylingOptions.textSize,
                    color: person.isLiving
                      ? stylingOptions.livingTextColor
                      : stylingOptions.deceasedTextColor,
                    zIndex: 10,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPerson(person.id);
                    setEditingPerson(person.id);
                    setRelationshipType(null);
                    setShowPersonForm(true);
                  }}
                  // Drag-and-drop removed for auto-layout
                >
                  <div className="h-full flex flex-col justify-center items-center text-center p-1">
                    {displayOptions.showName && (
                      <div className="font-bold arabic-text text-lg mb-1">
                        {person.firstName}
                      </div>
                    )}
                    {displayOptions.showSurname && person.lastName && (
                      <div className="text-base arabic-text">
                        {person.lastName}
                      </div>
                    )}
                    {displayOptions.showBirthDate && person.birthDate && (
                      <div className="text-sm">{person.birthDate}</div>
                    )}
                    {displayOptions.showProfession && person.profession && (
                      <div className="text-sm arabic-text">
                        {person.profession}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Action buttons for selected person - positioned below the box */}
              {selectedPerson &&
                treePeople.find((p) => p.id === selectedPerson) && (
                  <div
                    data-action-button
                    className="absolute bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-20"
                    style={{
                      left:
                        treePeople.find((p) => p.id === selectedPerson).x +
                        stylingOptions.boxWidth / 2 -
                        80,
                      top:
                        treePeople.find((p) => p.id === selectedPerson).y +
                        CARD.h +
                        10,
                    }}
                  >
                    <div className="flex justify-center gap-1">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPersonForm(false);
                          setEditingPerson(null);
                          setRelationshipType("spouse");
                          setTimeout(() => setShowPersonForm(true), 0);
                        }}
                        size="sm"
                        variant="ghost"
                        className="w-8 h-8 p-0 hover:bg-blue-50 rounded-full"
                        title={t.addSpouse}
                      >
                        {getRelationshipIcon("spouse")}
                      </Button>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPersonForm(false);
                          setEditingPerson(null);
                          setRelationshipType("child");
                          setTimeout(() => setShowPersonForm(true), 0);
                        }}
                        size="sm"
                        variant="ghost"
                        className="w-8 h-8 p-0 hover:bg-blue-50 rounded-full"
                        title={t.addChild}
                      >
                        {getRelationshipIcon("child")}
                      </Button>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPersonForm(false);
                          setEditingPerson(null);
                          setRelationshipType("parent");
                          setTimeout(() => setShowPersonForm(true), 0);
                        }}
                        size="sm"
                        variant="ghost"
                        className="w-8 h-8 p-0 hover:bg-blue-50 rounded-full"
                        title={t.addParent}
                      >
                        {getRelationshipIcon("parent")}
                      </Button>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPersonForm(false);
                          setEditingPerson(null);
                          setRelationshipType("sibling");
                          setTimeout(() => setShowPersonForm(true), 0);
                        }}
                        size="sm"
                        variant="ghost"
                        className="w-8 h-8 p-0 hover:bg-blue-50 rounded-full"
                        title={t.addSibling}
                      >
                        {getRelationshipIcon("sibling")}
                      </Button>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePerson(selectedPerson);
                        }}
                        size="sm"
                        variant="ghost"
                        className="w-8 h-8 p-0 hover:bg-red-50 rounded-full"
                        title={t.deletePerson}
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </Button>
                    </div>
                  </div>
                )}
            </div>

            {/* Add first person button */}
            {treePeople.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-700 mb-4 arabic-text">
                    {t.startBuilding}
                  </h2>
                  <p className="text-gray-500 mb-6 arabic-text">
                    {t.addFirstMember}
                  </p>
                  <Button
                    onClick={() => {
                      setRelationshipType(null);
                      setEditingPerson(null);
                      setShowPersonForm(true);
                    }}
                    size="lg"
                    className="arabic-text"
                  >
                    <UserPlus className="w-5 h-5 ml-2" />
                    {t.addPerson}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Floating Controls */}

          {/* Zoom Controls */}
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-2">
            <Button onClick={zoomIn} size="sm" className="w-10 h-10 p-0">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <div className="bg-white px-3 py-2 rounded text-base font-bold text-center">
              {Math.round(zoom * 100)}%
            </div>
            <Button onClick={zoomOut} size="sm" className="w-10 h-10 p-0">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              onClick={resetView}
              size="sm"
              variant="outline"
              className="w-10 h-10 p-0"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          {/* Bottom Toolbar */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="bg-white rounded-lg shadow-lg border flex items-center gap-2 px-4 py-2">
              <Button
                onClick={() => setShowOptions(true)}
                size="sm"
                variant="outline"
                className="arabic-text"
              >
                <Settings className="w-4 h-4 ml-1" />
                {t.options}
              </Button>

              <span className="text-base text-gray-600 arabic-text px-2">
                {treePeople.length} {t.familyStats} •{" "}
                {relationships.filter((r) => r.treeId === currentTree?.id).length}{" "}
                {t.relationshipStats}
              </span>
            </div>
          </div>
        </div>

        {/* Person Form Sidebar */}
        {showPersonForm && (
          <div
            className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-white shadow-2xl border border-gray-200 rounded-lg z-50"
            style={{
              width: "400px",
              height: "80vh",
            }}
          >
            <div className="flex flex-col max-h-full">
              <div className="flex justify-between items-center p-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 arabic-text">
                  {editingPerson ? t.editFamilyMember : t.addFamilyMember}
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
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-base text-blue-700 text-center arabic-text font-medium">
                    {t.allFieldsOptional}
                  </p>
                </div>

                <PersonForm
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
                  anchorPerson={
                    selectedPerson
                      ? treePeople.find((p) => p.id === selectedPerson)
                      : null
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Options Modal */}
        {showOptions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 arabic-text">
                    {t.options}
                  </h2>
                  <Button
                    onClick={() => setShowOptions(false)}
                    variant="ghost"
                    size="sm"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Display Options */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4 arabic-text">
                      {t.displayOptions}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(displayOptions).map(([key, value]) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) =>
                              setDisplayOptions((prev) => ({
                                ...prev,
                                [key]: e.target.checked,
                              }))
                            }
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700 arabic-text">
                            {t[key] || key}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Styling Options */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4 arabic-text">
                      {t.stylingOptions}
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-700 arabic-text">
                          {t.maleBoxColor}
                        </label>
                        <input
                          type="color"
                          value={stylingOptions.maleBoxColor}
                          onChange={(e) =>
                            setStylingOptions((prev) => ({
                              ...prev,
                              maleBoxColor: e.target.value,
                            }))
                          }
                          className="w-8 h-8 rounded border"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-700 arabic-text">
                          {t.femaleBoxColor}
                        </label>
                        <input
                          type="color"
                          value={stylingOptions.femaleBoxColor}
                          onChange={(e) =>
                            setStylingOptions((prev) => ({
                              ...prev,
                              femaleBoxColor: e.target.value,
                            }))
                          }
                          className="w-8 h-8 rounded border"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-700 arabic-text">
                          {t.backgroundColor}
                        </label>
                        <input
                          type="color"
                          value={stylingOptions.backgroundColor}
                          onChange={(e) =>
                            setStylingOptions((prev) => ({
                              ...prev,
                              backgroundColor: e.target.value,
                            }))
                          }
                          className="w-8 h-8 rounded border"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-700 arabic-text">
                          {t.boxWidth}
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
                          className="flex-1"
                        />
                        <span className="text-sm text-gray-600">
                          {stylingOptions.boxWidth}px
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-700 arabic-text">
                          {t.textSize}
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
                          className="flex-1"
                        />
                        <span className="text-sm text-gray-600">
                          {stylingOptions.textSize}px
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button
                    onClick={() => setShowOptions(false)}
                    variant="outline"
                    className="arabic-text"
                  >
                    {t.cancel}
                  </Button>
                  <Button
                    onClick={() => setShowOptions(false)}
                    className="arabic-text"
                  >
                    {t.applyChanges}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Download Modal */}
        {showDownloadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 arabic-text">
                    {t.download}
                  </h2>
                  <Button
                    onClick={() => setShowDownloadModal(false)}
                    variant="ghost"
                    size="sm"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <p className="text-gray-600 mb-4 arabic-text">
                  {t.selectDownloadFormat}
                </p>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="downloadFormat"
                      value="html"
                      checked={selectedDownloadFormat === "html"}
                      onChange={(e) =>
                        setSelectedDownloadFormat(e.target.value)
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900 arabic-text">
                        {t.readOnlyHTML}
                      </div>
                      <div className="text-sm text-gray-600 arabic-text">
                        {t.readOnlyHTMLDesc}
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="downloadFormat"
                      value="gedcom"
                      checked={selectedDownloadFormat === "gedcom"}
                      onChange={(e) =>
                        setSelectedDownloadFormat(e.target.value)
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900 arabic-text">
                        {t.gedcom}
                      </div>
                      <div className="text-sm text-gray-600 arabic-text">
                        {t.gedcomDesc}
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="downloadFormat"
                      value="csv"
                      checked={selectedDownloadFormat === "csv"}
                      onChange={(e) =>
                        setSelectedDownloadFormat(e.target.value)
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900 arabic-text">
                        {t.csv}
                      </div>
                      <div className="text-sm text-gray-600 arabic-text">
                        {t.csvDesc}
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="downloadFormat"
                      value="plaintext"
                      checked={selectedDownloadFormat === "plaintext"}
                      onChange={(e) =>
                        setSelectedDownloadFormat(e.target.value)
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900 arabic-text">
                        {t.plainText}
                      </div>
                      <div className="text-sm text-gray-600 arabic-text">
                        {t.plainTextDesc}
                      </div>
                    </div>
                  </label>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button
                    onClick={() => setShowDownloadModal(false)}
                    variant="outline"
                    className="arabic-text"
                  >
                    {t.cancel}
                  </Button>
                  <Button
                    onClick={() => handleDownload(selectedDownloadFormat)}
                    className="arabic-text"
                  >
                    {t.downloadBtn}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Person Form Component
function PersonForm({
  person,
  onSave,
  onCancel,
  relationshipType,
  anchorPerson,
}) {
  const [activeTab, setActiveTab] = useState("personal");
  const [formData, setFormData] = useState({
    firstName: person?.firstName || "",
    lastName: person?.lastName || "",
    gender:
      person?.gender ||
      (relationshipType === "spouse" && anchorPerson
        ? anchorPerson.gender === "male"
          ? "female"
          : "male"
        : ""),
    birthDate: person?.birthDate || "",
    birthPlace: person?.birthPlace || "",
    isLiving: person?.isLiving !== false,
    deathDate: person?.deathDate || "",
    phone: person?.phone || "",
    email: person?.email || "",
    address: person?.address || "",
    profession: person?.profession || "",
    company: person?.company || "",
    bioNotes: person?.bioNotes || "",
  });

  const t = {
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
    company: "الشركة",
    bioNotes: "ملاحظات السيرة الذاتية",
    save: "حفظ",
    cancel: "إلغاء",
    update: "تحديث",
    personal: "البيانات الشخصية",
    contact: "معلومات التواصل",
    biography: "السيرة الذاتية",
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.firstName.trim()) {
      alert("يرجى إدخال الاسم الأول");
      return;
    }
    onSave(formData);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Update form data when person changes
  useEffect(() => {
    if (person) {
      setFormData({
        firstName: person.firstName || "",
        lastName: person.lastName || "",
        gender: person.gender || "",
        birthDate: person.birthDate || "",
        birthPlace: person.birthPlace || "",
        isLiving: person.isLiving !== false,
        deathDate: person.deathDate || "",
        phone: person.phone || "",
        email: person.email || "",
        address: person.address || "",
        profession: person.profession || "",
        biography: person.biography || "",
      });
    } else if (relationshipType === "spouse" && anchorPerson) {
      // Auto-set opposite gender for spouse
      setFormData({
        firstName: "",
        lastName: "",
        gender: anchorPerson.gender === "male" ? "female" : "male",
        birthDate: "",
        birthPlace: "",
        isLiving: true,
        deathDate: "",
        phone: "",
        email: "",
        address: "",
        profession: "",
        biography: "",
      });
    } else {
      // Reset form for new person
      setFormData({
        firstName: "",
        lastName: "",
        gender: "",
        birthDate: "",
        birthPlace: "",
        isLiving: true,
        deathDate: "",
        phone: "",
        email: "",
        address: "",
        profession: "",
        biography: "",
      });
    }
  }, [person, relationshipType, anchorPerson]);

  const tabs = [
    { id: "personal", label: t.personal, icon: "👤" },
    { id: "contact", label: t.contact, icon: "📞" },
    { id: "biography", label: t.biography, icon: "📝" },
  ];

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-2 py-2 text-xs font-medium text-center arabic-text ${
              activeTab === tab.id
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "personal" && (
          <div className="space-y-3">
            {/* Personal Information */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-base font-bold text-gray-700 mb-1 arabic-text">
                  {t.firstName}
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-base font-bold text-gray-700 mb-1 arabic-text">
                  {t.lastName}
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
                  dir="rtl"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-bold text-gray-700 mb-1 arabic-text">
                {t.gender}
              </label>
              <select
                value={formData.gender}
                onChange={(e) => handleChange("gender", e.target.value)}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
              >
                <option value="">اختر الجنس</option>
                <option value="male">{t.male}</option>
                <option value="female">{t.female}</option>
              </select>
            </div>

            <div>
              <label className="block text-base font-bold text-gray-700 mb-1 arabic-text">
                {t.birthDate}
              </label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => handleChange("birthDate", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-base font-bold text-gray-700 mb-1 arabic-text">
                {t.birthPlace}
              </label>
              <input
                type="text"
                value={formData.birthPlace}
                onChange={(e) => handleChange("birthPlace", e.target.value)}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
                dir="rtl"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isLiving"
                checked={formData.isLiving}
                onChange={(e) => handleChange("isLiving", e.target.checked)}
                className="rounded"
              />
              <label
                htmlFor="isLiving"
                className="text-base font-bold text-gray-700 arabic-text"
              >
                {t.isLiving}
              </label>
            </div>

            {!formData.isLiving && (
              <div>
                <label className="block text-base font-bold text-gray-700 mb-1 arabic-text">
                  {t.deathDate}
                </label>
                <input
                  type="date"
                  value={formData.deathDate}
                  onChange={(e) => handleChange("deathDate", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "contact" && (
          <div className="space-y-3">
            {/* Contact Information */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-base font-bold text-gray-700 mb-1 arabic-text">
                  {t.phone}
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-base font-bold text-gray-700 mb-1 arabic-text">
                  {t.email}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-bold text-gray-700 mb-1 arabic-text">
                {t.address}
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
                dir="rtl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-base font-bold text-gray-700 mb-1 arabic-text">
                  {t.profession}
                </label>
                <input
                  type="text"
                  value={formData.profession}
                  onChange={(e) => handleChange("profession", e.target.value)}
                  className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-base font-bold text-gray-700 mb-1 arabic-text">
                  {t.company}
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => handleChange("company", e.target.value)}
                  className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
                  dir="rtl"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "biography" && (
          <div className="space-y-3">
            {/* Biography */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 arabic-text">
                {t.biography}
              </h3>
              <div>
                <label className="block text-base font-bold text-gray-700 mb-1 arabic-text">
                  {t.bioNotes}
                </label>
                <textarea
                  value={formData.bioNotes}
                  onChange={(e) => handleChange("bioNotes", e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
                  dir="rtl"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 mt-4">
        <Button type="submit" className="arabic-text">
          {person ? t.update : t.save}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="arabic-text"
        >
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

export default App;
