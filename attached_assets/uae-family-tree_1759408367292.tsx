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
    readOnlyHTMLDesc: "للتصفح من القرص أو الإضافة إلى موقع ويب، مع واجهة تفاعلية للقراءة فقط.",
    gedcom: "GEDCOM",
    gedcomDesc: "تنسيق قياسي لبيانات الأنساب. لاستيراد البيانات في برامج الأنساب المختلفة.",
    csv: "CSV (مفصولة بفواصل)",
    csvDesc: "لاستيراد البيانات في جداول البيانات أو قواعد البيانات.",
    plainText: "نص عادي",
    plainTextDesc: "للعرض في معالجات النصوص مثل المفكرة و Word، أو الإرسال بالبريد الإلكتروني.",
    downloadBtn: "تنزيل",
    done: "تم",
    showName: "إظهار الاسم الأول",
    showSurname: "إظهار اسم العائلة",
    showBirthDate: "إظهار تاريخ الميلاد",
    showBirthPlace: "إظهار مكان الميلاد",
    showAge: "إظهار العمر",
    showDeathDate: "إظهار تاريخ الوفاة",
    showProfession: "إظهار المهنة",
    showCompany: "إظهار الشركة",
    showEmail: "إظهار البريد الإلكتروني",
    showTelephone: "إظهار الهاتف",
    showAddress: "إظهار العنوان",
    familyLineage: "نسب العائلة",
    theFather: "الأب",
    theSon: "الابن",
    theDaughter: "الابنة",
    birthOrder: "ترتيب الأبناء",
    eldest: "الأكبر",
    youngest: "الأصغر",
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

  // Calculate age from birth date
  const calculateAge = (birthDate, deathDate = null) => {
    if (!birthDate) return null;
    
    const birth = new Date(birthDate);
    const today = deathDate ? new Date(deathDate) : new Date();
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
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
  const computeTreeLayout = (people, relationships, viewportWidth = 1200, viewportHeight = 800) => {
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

    const roots = people.filter((p) => !parentMap[p.id]);
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

    const spouseMap = {};
    relationships.forEach((r) => {
      if (r.type === REL.PARTNER) {
        spouseMap[r.person1Id] = r.person2Id;
        spouseMap[r.person2Id] = r.person1Id;
      }
    });

    const genMap = {};
    Object.values(idToPerson).forEach((p) => {
      if (!genMap[p.generation]) genMap[p.generation] = [];
      genMap[p.generation].push(p);
    });

    const verticalSpacing = 140;
    const horizontalSpacing = 180;
    const spouseSpacing = 60;

    const totalGenerations = Object.keys(genMap).length;
    const totalTreeHeight = totalGenerations * verticalSpacing;
    const verticalPadding = 50;
    const startY = Math.max(verticalPadding, (viewportHeight - totalTreeHeight) / 2);

    Object.keys(genMap).forEach((g) => {
      const gen = parseInt(g);
      const row = genMap[gen];
      const processedIds = new Set();
      
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
      
      const padding = 50;
      let currentX = Math.max(padding, (viewportWidth - totalWidth) / 2);

      row.forEach((person) => {
        if (processedIds.has(person.id)) return;

        const spouseId = spouseMap[person.id];
        const spouse = spouseId ? idToPerson[spouseId] : null;

        if (spouse && !processedIds.has(spouseId)) {
          person.x = currentX;
          person.y = startY + gen * verticalSpacing;

          spouse.x = currentX + CARD.w + spouseSpacing;
          spouse.y = startY + gen * verticalSpacing;

          processedIds.add(person.id);
          processedIds.add(spouseId);
          currentX += CARD.w * 2 + spouseSpacing + horizontalSpacing;
        } else if (!processedIds.has(person.id)) {
          person.x = currentX;
          person.y = startY + gen * verticalSpacing;
          processedIds.add(person.id);
          currentX += CARD.w + horizontalSpacing;
        }
      });
    });

    return people.map((p) => ({ ...p, ...idToPerson[p.id] }));
  };

  const treePeople = computeTreeLayout(
    people.filter((p) => p.treeId === currentTree?.id),
    relationships.filter((r) => r.treeId === currentTree?.id),
    canvasDimensions.width,
    canvasDimensions.height
  );

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

  const calculatePosition = (relType, anchorPerson) => {
    if (!anchorPerson) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
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

  // Enhanced add person with smart gender defaults and birth order
  const addPerson = (personData) => {
    const anchorPerson = selectedPerson
      ? people.find((p) => p.id === selectedPerson)
      : null;

    let finalPersonData = { ...personData };
    
    if (relationshipType === "spouse" && anchorPerson && !personData.gender) {
      if (anchorPerson.gender === "male") {
        finalPersonData.gender = "female";
      } else if (anchorPerson.gender === "female") {
        finalPersonData.gender = "male";
      }
    }

    // Calculate birth order for children and siblings
    if (relationshipType === "child" || relationshipType === "sibling") {
      let existingSiblings = [];
      
      if (relationshipType === "child") {
        existingSiblings = relationships
          .filter(r => r.type === REL.PARENT_CHILD && r.parentId === selectedPerson && r.treeId === currentTree?.id)
          .map(r => people.find(p => p.id === r.childId))
          .filter(Boolean);
      } else if (relationshipType === "sibling") {
        existingSiblings = relationships
          .filter(r => r.type === REL.SIBLING && 
                  (r.person1Id === selectedPerson || r.person2Id === selectedPerson) &&
                  r.treeId === currentTree?.id)
          .map(r => people.find(p => p.id === (r.person1Id === selectedPerson ? r.person2Id : r.person1Id)))
          .filter(Boolean);
        existingSiblings.push(anchorPerson);
      }
      
      const maxBirthOrder = existingSiblings.length > 0 
        ? Math.max(...existingSiblings.map(s => s.birthOrder || 0))
        : 0;
      
      finalPersonData.birthOrder = maxBirthOrder + 1;
    }

    const position = calculatePosition(relationshipType, anchorPerson);

    const newPerson = {
      id: Date.now(),
      ...finalPersonData,
      x: position.x,
      y: position.y,
      treeId: currentTree?.id,
      isLiving: finalPersonData.isLiving !== false,
      birthOrder: finalPersonData.birthOrder || 0,
    };

    setPeople((prev) => [...prev, newPerson]);

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

    setTimeout(() => {
      centerOnPerson(newPerson);
    }, 100);

    setShowPersonForm(false);
    setRelationshipType(null);
    setEditingPerson(null);
    setSelectedPerson(null);
  };

  // Update person with birth order swapping
  const updatePerson = (personData) => {
    const oldPerson = people.find(p => p.id === editingPerson);
    const oldBirthOrder = oldPerson?.birthOrder || 0;
    const newBirthOrder = personData.birthOrder || 0;
    
    if (oldBirthOrder !== newBirthOrder && newBirthOrder > 0) {
      const siblingIds = new Set([editingPerson]);
      
      relationships
        .filter(r => r.type === REL.SIBLING && r.treeId === currentTree?.id)
        .forEach(r => {
          if (r.person1Id === editingPerson) siblingIds.add(r.person2Id);
          if (r.person2Id === editingPerson) siblingIds.add(r.person1Id);
        });
      
      const parentIds = relationships
        .filter(r => r.type === REL.PARENT_CHILD && r.childId === editingPerson && r.treeId === currentTree?.id)
        .map(r => r.parentId);
      
      if (parentIds.length > 0) {
        relationships
          .filter(r => r.type === REL.PARENT_CHILD && 
                      parentIds.includes(r.parentId) && 
                      r.treeId === currentTree?.id)
          .forEach(r => {
            siblingIds.add(r.childId);
          });
      }
      
      const siblingToSwap = people.find(p => 
        siblingIds.has(p.id) && 
        p.id !== editingPerson && 
        p.birthOrder === newBirthOrder
      );
      
      setPeople((prev) =>
        prev.map((p) => {
          if (p.id === editingPerson) {
            return { ...p, ...personData };
          } else if (siblingToSwap && p.id === siblingToSwap.id) {
            return { ...p, birthOrder: oldBirthOrder };
          }
          return p;
        })
      );
    } else {
      setPeople((prev) =>
        prev.map((p) => (p.id === editingPerson ? { ...p, ...personData } : p))
      );
    }
    
    setShowPersonForm(false);
    setEditingPerson(null);
  };

  // Delete person
  const deletePerson = (personId) => {
    if (window.confirm(t.deleteConfirm)) {
      setPeople((prev) => {
        const updatedPeople = prev.filter((p) => p.id !== personId);
        
        const remainingInTree = updatedPeople.filter(
          (p) => p.treeId === currentTree?.id
        );
        if (remainingInTree.length === 0) {
          setShowPersonForm(false);
          setEditingPerson(null);
          setRelationshipType(null);
          setCurrentTree(null);
          setCurrentView("dashboard");
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
    const isBackground =
      !e.target.closest("[data-person-box]") &&
      !e.target.closest("[data-action-button]") &&
      !e.target.closest("[data-add-person-button]");
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

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.3, Math.min(3, prev * delta)));
  };

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
      navigator.clipboard.writeText(window.location.href);
      alert("تم نسخ الرابط إلى الحافظة");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCalendar = () => {
    const events = people
      .filter((p) => p.treeId === currentTree?.id && p.birthDate)
      .map((p) => ({
        title: `عيد ميلاد ${p.firstName}`,
        date: p.birthDate,
      }));

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
            <div 
              className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => currentTree && setCurrentView("tree-builder")}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4 arabic-text">
                {t.myFamilyTrees}
              </h3>
              <div className="text-3xl font-bold text-purple-600">
                {currentTree ? 1 : 0}
              </div>
            </div>

            <div 
              className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => currentTree && setCurrentView("lineage")}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4 arabic-text">
                {t.familyMembers}
              </h3>
              <div className="text-3xl font-bold text-blue-600">
                {people.filter((p) => p.treeId === currentTree?.id).length}
              </div>
            </div>

            <div 
              className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => currentTree && setCurrentView("tree-builder")}
            >
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
              <Button onClick={createNewTree} size="lg" className="arabic-text">
                {t.createNewTree}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Lineage view
  if (currentView === "lineage") {
    const buildLineage = () => {
      const treePeople = people.filter((p) => p.treeId === currentTree?.id);
      const treeRelationships = relationships.filter((r) => r.treeId === currentTree?.id);
      
      if (treePeople.length === 0) return [];
      
      const oldestAncestors = treePeople.filter(person => {
        const hasParent = treeRelationships.some(
          rel => (rel.type === REL.PARENT_CHILD) && rel.childId === person.id
        );
        return !hasParent;
      });
      
      if (oldestAncestors.length === 0) return treePeople;
      
      const lineage = [];
      let current = oldestAncestors[0];
      lineage.push(current);
      
      while (current) {
        const childRel = treeRelationships.find(
          rel => rel.type === REL.PARENT_CHILD && rel.parentId === current.id
        );
        
        if (childRel) {
          const child = treePeople.find(p => p.id === childRel.childId);
          if (child) {
            lineage.push(child);
            current = child;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      
      return lineage;
    };
    
    const lineage = buildLineage();
    
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
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
                <h1 className="text-3xl font-bold text-gray-900 arabic-text">
                  {t.familyLineage}
                </h1>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-lg shadow-lg p-8">
            {lineage.length === 0 ? (
              <p className="text-center text-gray-500 arabic-text">
                لا يوجد أفراد في العائلة
              </p>
            ) : (
              <div className="space-y-6">
                {lineage.map((person, index) => {
                  const prefix = index === 0 
                    ? t.theFather 
                    : (person.gender === "male" ? t.theSon : t.theDaughter);
                  
                  return (
                    <div 
                      key={person.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="text-2xl font-bold text-gray-400 min-w-[40px]">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-xl font-bold text-gray-900 arabic-text">
                          {prefix} {person.firstName} {person.lastName}
                        </div>
                        {person.birthDate && (
                          <div className="text-sm text-gray-500 mt-1 arabic-text">
                            {person.birthDate}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Tree builder view
  if (currentView === "tree-builder") {
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
            height: "calc(100vh - 64px)",
          }}
          onClick={(e) => {
            const isPersonClick = e.target.closest("[data-person-box]");
            const isActionButtonClick = e.target.closest(
              "[data-action-button]",
            );
            const isFormClick = e.target.closest("[data-person-form]");
            const isAddPersonButton = e.target.closest("[data-add-person-button]");
            
            if (!isPersonClick && !isActionButtonClick && !isFormClick && !isAddPersonButton) {
              setSelectedPerson(null);
              setShowPersonForm(false);
              setEditingPerson(null);
              setRelationshipType(null);
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
                width: "100%",
                height: "100%",
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {/* Partner relationships - straight bold lines */}
              {relationships
                .filter(
                  (r) =>
                    r.type === REL.PARTNER && r.treeId === currentTree?.id,
                )
                .map((r, i) => {
                  const p1 = treePeople.find((p) => p.id === r.person1Id);
                  const p2 = treePeople.find((p) => p.id === r.person2Id);
                  
                  if (!p1 || !p2) return null;

                  const leftPerson = p1.x < p2.x ? p1 : p2;
                  const rightPerson = p1.x < p2.x ? p2 : p1;

                  const startX = leftPerson.x + stylingOptions.boxWidth;
                  const endX = rightPerson.x;
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

              {/* Parent-child relationships - Hierarchy chart style */}
              {(() => {
                const childToParents = {};
                
                relationships
                  .filter((r) => r.type === REL.PARENT_CHILD && r.treeId === currentTree?.id)
                  .forEach((r) => {
                    const child = treePeople.find((p) => p.id === r.childId);
                    const parent = treePeople.find((p) => p.id === r.parentId);
                    
                    if (!child || !parent) return;
                    
                    if (!childToParents[child.id]) {
                      childToParents[child.id] = new Set();
                    }
                    childToParents[child.id].add(parent.id);
                  });
                
                relationships
                  .filter((r) => r.type === REL.SIBLING && r.treeId === currentTree?.id)
                  .forEach((r) => {
                    const person1Parents = childToParents[r.person1Id];
                    const person2Parents = childToParents[r.person2Id];
                    
                    if (person1Parents && !person2Parents) {
                      childToParents[r.person2Id] = new Set(person1Parents);
                    } else if (person2Parents && !person1Parents) {
                      childToParents[r.person1Id] = new Set(person2Parents);
                    } else if (person1Parents && person2Parents) {
                      const mergedParents = new Set([...person1Parents, ...person2Parents]);
                      childToParents[r.person1Id] = mergedParents;
                      childToParents[r.person2Id] = mergedParents;
                    }
                  });
                
                const parentGroups = {};
                
                Object.entries(childToParents).forEach(([childId, parentIds]) => {
                  const parentArray = Array.from(parentIds).sort();
                  const groupKey = parentArray.join('-');
                  
                  if (!parentGroups[groupKey]) {
                    parentGroups[groupKey] = {
                      parentIds: parentArray,
                      children: []
                    };
                  }
                  
                  const child = treePeople.find(p => p.id === parseInt(childId));
                  if (child) {
                    parentGroups[groupKey].children.push(child);
                  }
                });
                
                return Object.values(parentGroups).map((group, groupIndex) => {
                  if (group.children.length === 0) return null;
                  
                  const parents = group.parentIds
                    .map(id => treePeople.find(p => p.id === id))
                    .filter(Boolean);
                  
                  if (parents.length === 0) return null;
                  
                  const children = group.children.sort((a, b) => {
                    const orderA = a.birthOrder || 0;
                    const orderB = b.birthOrder || 0;
                    if (orderA !== orderB) {
                      return orderA - orderB;
                    }
                    return a.x - b.x;
                  }).reverse();
                  
                  let parentConnectionX, parentConnectionY;
                  
                  if (parents.length === 2) {
                    const partnerRel = relationships.find(
                      r => r.type === REL.PARTNER && 
                      r.treeId === currentTree?.id &&
                      ((r.person1Id === parents[0].id && r.person2Id === parents[1].id) ||
                       (r.person1Id === parents[1].id && r.person2Id === parents[0].id))
                    );
                    
                    if (partnerRel) {
                      const p1X = parents[0].x + stylingOptions.boxWidth / 2;
                      const p2X = parents[1].x + stylingOptions.boxWidth / 2;
                      parentConnectionX = (p1X + p2X) / 2;
                      parentConnectionY = Math.max(parents[0].y + CARD.h, parents[1].y + CARD.h);
                    } else {
                      parentConnectionX = parents[0].x + stylingOptions.boxWidth / 2;
                      parentConnectionY = parents[0].y + CARD.h;
                    }
                  } else {
                    parentConnectionX = parents[0].x + stylingOptions.boxWidth / 2;
                    parentConnectionY = parents[0].y + CARD.h;
                  }
                  
                  const childrenTopY = Math.min(...children.map(c => c.y));
                  const verticalGap = 50;
                  const horizontalLineY = childrenTopY - verticalGap;
                  
                  const childXPositions = children.map(c => c.x + stylingOptions.boxWidth / 2);
                  const leftmostX = Math.min(...childXPositions, parentConnectionX);
                  const rightmostX = Math.max(...childXPositions, parentConnectionX);
                  
                  const strokeColor = "#059669";
                  const strokeWidth = 3;
                  
                  return (
                    <g key={`parent-group-${groupIndex}`}>
                      <line
                        x1={parentConnectionX}
                        y1={parentConnectionY}
                        x2={parentConnectionX}
                        y2={horizontalLineY}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                      />
                      
                      {children.length > 1 ? (
                        <line
                          x1={leftmostX}
                          y1={horizontalLineY}
                          x2={rightmostX}
                          y2={horizontalLineY}
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeLinecap="round"
                        />
                      ) : (
                        <line
                          x1={parentConnectionX}
                          y1={horizontalLineY}
                          x2={children[0].x + stylingOptions.boxWidth / 2}
                          y2={horizontalLineY}
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeLinecap="round"
                        />
                      )}
                      
                      {children.map((child, idx) => {
                        const childCenterX = child.x + stylingOptions.boxWidth / 2;
                        return (
                          <line
                            key={`child-${idx}`}
                            x1={childCenterX}
                            y1={horizontalLineY}
                            x2={childCenterX}
                            y2={child.y}
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                          />
                        );
                      })}
                    </g>
                  );
                });
              })()}

              {/* Sibling connections - ONLY for siblings WITHOUT shared parents */}
              {(() => {
                const childrenWithParents = new Set();
                relationships
                  .filter((r) => r.type === REL.PARENT_CHILD && r.treeId === currentTree?.id)
                  .forEach((r) => {
                    childrenWithParents.add(r.childId);
                  });
                
                const siblingsWithoutParents = {};
                relationships
                  .filter((r) => r.type === REL.SIBLING && r.treeId === currentTree?.id)
                  .forEach((r) => {
                    if (!childrenWithParents.has(r.person1Id) && !childrenWithParents.has(r.person2Id)) {
                      const key = [r.person1Id, r.person2Id].sort().join('-');
                      if (!siblingsWithoutParents[key]) {
                        siblingsWithoutParents[key] = [r.person1Id, r.person2Id];
                      }
                    }
                  });
                
                return Object.values(siblingsWithoutParents).map((siblingIds, i) => {
                  const siblings = siblingIds
                    .map(id => treePeople.find(p => p.id === id))
                    .filter(Boolean)
                    .sort((a, b) => a.x - b.x);
                  
                  if (siblings.length < 2) return null;

                  const y = siblings[0].y - 20;
                  const minX = Math.min(...siblings.map((s) => s.x + stylingOptions.boxWidth / 2));
                  const maxX = Math.max(...siblings.map((s) => s.x + stylingOptions.boxWidth / 2));
                  const curveHeight = 10;
                  const strokeColor = "#7c3aed";
                  const dashArray = "5,5";

                  return (
                    <g key={`siblings-orphan-${i}`}>
                      <path
                        d={`M ${minX} ${y} Q ${(minX + maxX) / 2} ${y - curveHeight} ${maxX} ${y}`}
                        stroke={strokeColor}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeDasharray={dashArray}
                        fill="none"
                      />
                      {siblings.map((sibling, idx) => {
                        const siblingX = sibling.x + stylingOptions.boxWidth / 2;
                        const connectionY = y - curveHeight * Math.sin((Math.PI * (siblingX - minX)) / (maxX - minX));
                        return (
                          <path
                            key={`sibling-line-${idx}`}
                            d={`M ${siblingX} ${connectionY} Q ${siblingX} ${(connectionY + sibling.y) / 2} ${siblingX} ${sibling.y}`}
                            stroke={strokeColor}
                            strokeWidth={2}
                            strokeLinecap="round"
                            fill="none"
                          />
                        );
                      })}
                    </g>
                  );
                });
              })()}
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
                  className={`absolute border-2 rounded-lg p-3 cursor-pointer transition-all duration-200 select-none ${
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
                    userSelect: "none",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPerson(person.id);
                    setEditingPerson(person.id);
                    setRelationshipType(null);
                    setShowPersonForm(true);
                  }}
                >
                  <div className="h-full flex flex-col justify-center items-center text-center p-1">
                    {(displayOptions.showName || (displayOptions.showSurname && person.lastName)) && (
                      <div className="font-bold arabic-text mb-1" style={{ fontSize: `${stylingOptions.textSize * 1.2}px` }}>
                        {displayOptions.showName && person.firstName}
                        {displayOptions.showName && displayOptions.showSurname && person.lastName && " "}
                        {displayOptions.showSurname && person.lastName}
                      </div>
                    )}
                    {displayOptions.showAge && person.birthDate && (
                      <div style={{ fontSize: `${stylingOptions.textSize * 0.9}px` }}>
                        {calculateAge(person.birthDate, person.deathDate)} سنة
                      </div>
                    )}
                    {displayOptions.showBirthDate && person.birthDate && (
                      <div style={{ fontSize: `${stylingOptions.textSize * 0.9}px` }}>{person.birthDate}</div>
                    )}
                    {displayOptions.showBirthPlace && person.birthPlace && (
                      <div className="arabic-text" style={{ fontSize: `${stylingOptions.textSize * 0.9}px` }}>{person.birthPlace}</div>
                    )}
                    {displayOptions.showDeathDate && person.deathDate && (
                      <div style={{ fontSize: `${stylingOptions.textSize * 0.9}px` }}>{person.deathDate}</div>
                    )}
                    {displayOptions.showProfession && person.profession && (
                      <div className="arabic-text" style={{ fontSize: `${stylingOptions.textSize * 0.9}px` }}>
                        {person.profession}
                      </div>
                    )}
                    {displayOptions.showCompany && person.company && (
                      <div className="arabic-text" style={{ fontSize: `${stylingOptions.textSize * 0.9}px` }}>{person.company}</div>
                    )}
                    {displayOptions.showEmail && person.email && (
                      <div style={{ fontSize: `${stylingOptions.textSize * 0.9}px` }}>{person.email}</div>
                    )}
                    {displayOptions.showTelephone && person.phone && (
                      <div style={{ fontSize: `${stylingOptions.textSize * 0.9}px` }}>{person.phone}</div>
                    )}
                    {displayOptions.showAddress && person.address && (
                      <div className="arabic-text" style={{ fontSize: `${stylingOptions.textSize * 0.9}px` }}>{person.address}</div>
                    )}
                  </div>
                </div>
              ))}

              {/* Action buttons for selected person */}
              {selectedPerson &&
                treePeople.find((p) => p.id === selectedPerson) && (() => {
                  const selectedPersonData = treePeople.find((p) => p.id === selectedPerson);
                  
                  const isFemale = selectedPersonData.gender === "female";
                  const hasMaleSpouse = isFemale && relationships.some(r => 
                    r.type === REL.PARTNER && 
                    r.treeId === currentTree?.id &&
                    (r.person1Id === selectedPerson || r.person2Id === selectedPerson) &&
                    people.find(p => 
                      p.id === (r.person1Id === selectedPerson ? r.person2Id : r.person1Id)
                    )?.gender === "male"
                  );
                  
                  const isLivingMale = selectedPersonData.gender === "male" && selectedPersonData.isLiving !== false;
                  const livingSpousesCount = isLivingMale ? relationships.filter(r => {
                    if (r.type !== REL.PARTNER || r.treeId !== currentTree?.id) return false;
                    if (r.person1Id !== selectedPerson && r.person2Id !== selectedPerson) return false;
                    
                    const spouseId = r.person1Id === selectedPerson ? r.person2Id : r.person1Id;
                    const spouse = people.find(p => p.id === spouseId);
                    return spouse && spouse.isLiving !== false;
                  }).length : 0;
                  const hasMaxSpouses = isLivingMale && livingSpousesCount >= 4;
                  
                  const hideSpouseButton = hasMaleSpouse || hasMaxSpouses;
                  
                  const buttonWidth = 32;
                  const gap = 4;
                  const padding = 8;
                  const numButtons = hideSpouseButton ? 4 : 5;
                  const containerWidth = (buttonWidth * numButtons) + (gap * (numButtons - 1)) + (padding * 2);
                  
                  return (
                    <div
                      data-action-button
                      className="absolute bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-20"
                      style={{
                        left: selectedPersonData.x + (stylingOptions.boxWidth / 2) - (containerWidth / 2),
                        top: selectedPersonData.y + CARD.h + 10,
                      }}
                    >
                      <div className="flex justify-center gap-1">
                        {!hideSpouseButton && (
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
                        )}

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
                  );
                })()}
            </div>

            {/* Add first person button */}
            {treePeople.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <div className="text-center pointer-events-auto" data-add-person-button>
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
            <Button
              size="sm"
              variant="outline"
              className="w-10 h-10 p-0 text-base font-bold flex items-center justify-center select-none"
            >
              {Math.round(zoom * 100)}%
            </Button>
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
            <Button
              onClick={() => setShowOptions(true)}
              size="sm"
              variant="outline"
              className="arabic-text bg-white shadow-lg"
            >
              <Settings className="w-4 h-4 ml-1" />
              {t.options}
            </Button>
          </div>
        </div>

        {/* Person Form Sidebar */}
        {showPersonForm && (
          <div
            data-person-form
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
                  currentTree={currentTree}
                  relationships={relationships}
                  people={people}
                  REL={REL}
                />
              </div>
            </div>
          </div>
        )}

        {/* Options Panel */}
        {showOptions && (
          <div className="fixed inset-0 z-40 pointer-events-none">
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-95 backdrop-blur-sm shadow-2xl border border-gray-300 rounded-lg z-50 pointer-events-auto max-w-[96vw] overflow-auto max-h-[85vh]">
              <div className="px-8 py-5">
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

                <div className="flex flex-col xl:flex-row gap-10">
                  {/* Display Options - First List */}
                  <div className="min-w-[220px] border-r border-gray-200 pr-10">
                    <h3 className="text-base font-medium text-gray-900 mb-4 arabic-text">
                      {t.displayOptions}
                    </h3>
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={displayOptions.showName}
                          onChange={(e) =>
                            setDisplayOptions((prev) => ({
                              ...prev,
                              showName: e.target.checked,
                            }))
                          }
                          className="rounded w-4 h-4 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 arabic-text whitespace-nowrap">
                          {t.showName}
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={displayOptions.showSurname}
                          onChange={(e) =>
                            setDisplayOptions((prev) => ({
                              ...prev,
                              showSurname: e.target.checked,
                            }))
                          }
                          className="rounded w-4 h-4 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 arabic-text whitespace-nowrap">
                          {t.showSurname}
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={displayOptions.showBirthDate}
                          onChange={(e) =>
                            setDisplayOptions((prev) => ({
                              ...prev,
                              showBirthDate: e.target.checked,
                            }))
                          }
                          className="rounded w-4 h-4 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 arabic-text whitespace-nowrap">
                          {t.showBirthDate}
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={displayOptions.showBirthPlace}
                          onChange={(e) =>
                            setDisplayOptions((prev) => ({
                              ...prev,
                              showBirthPlace: e.target.checked,
                            }))
                          }
                          className="rounded w-4 h-4 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 arabic-text whitespace-nowrap">
                          {t.showBirthPlace}
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={displayOptions.showAge}
                          onChange={(e) =>
                            setDisplayOptions((prev) => ({
                              ...prev,
                              showAge: e.target.checked,
                            }))
                          }
                          className="rounded w-4 h-4 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 arabic-text whitespace-nowrap">
                          {t.showAge}
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={displayOptions.showDeathDate}
                          onChange={(e) =>
                            setDisplayOptions((prev) => ({
                              ...prev,
                              showDeathDate: e.target.checked,
                            }))
                          }
                          className="rounded w-4 h-4 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 arabic-text whitespace-nowrap">
                          {t.showDeathDate}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Display Options - Second List */}
                  <div className="min-w-[220px] border-r border-gray-200 pr-10">
                    <h3 className="text-base font-medium text-gray-900 mb-4 arabic-text">
                      {t.displayOptions}
                    </h3>
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={displayOptions.showProfession}
                          onChange={(e) =>
                            setDisplayOptions((prev) => ({
                              ...prev,
                              showProfession: e.target.checked,
                            }))
                          }
                          className="rounded w-4 h-4 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 arabic-text whitespace-nowrap">
                          {t.showProfession}
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={displayOptions.showCompany}
                          onChange={(e) =>
                            setDisplayOptions((prev) => ({
                              ...prev,
                              showCompany: e.target.checked,
                            }))
                          }
                          className="rounded w-4 h-4 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 arabic-text whitespace-nowrap">
                          {t.showCompany}
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={displayOptions.showEmail}
                          onChange={(e) =>
                            setDisplayOptions((prev) => ({
                              ...prev,
                              showEmail: e.target.checked,
                            }))
                          }
                          className="rounded w-4 h-4 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 arabic-text whitespace-nowrap">
                          {t.showEmail}
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={displayOptions.showTelephone}
                          onChange={(e) =>
                            setDisplayOptions((prev) => ({
                              ...prev,
                              showTelephone: e.target.checked,
                            }))
                          }
                          className="rounded w-4 h-4 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 arabic-text whitespace-nowrap">
                          {t.showTelephone}
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={displayOptions.showAddress}
                          onChange={(e) =>
                            setDisplayOptions((prev) => ({
                              ...prev,
                              showAddress: e.target.checked,
                            }))
                          }
                          className="rounded w-4 h-4 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 arabic-text whitespace-nowrap">
                          {t.showAddress}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Size Sliders and Colors */}
                  <div className="min-w-[260px]">
                    <h3 className="text-base font-medium text-gray-900 mb-4 arabic-text">
                      الأحجام
                    </h3>
                    <div className="space-y-4 mb-8">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700 arabic-text min-w-[110px]">
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
                          className="w-16"
                        />
                        <span className="text-sm text-gray-600 min-w-[30px] text-center">
                          {stylingOptions.boxWidth}
                        </span>
                        <Button
                          onClick