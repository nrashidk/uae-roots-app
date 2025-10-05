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
  ArrowLeft,
  ArrowRight,
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
  const [showManageParentsDialog, setShowManageParentsDialog] = useState(false);

  // Enhanced Display Options (FamilyEcho-style)
  const [displayOptions, setDisplayOptions] = useState({
    // Personal Information Display (6 options - Column 1)
    showName: true,
    showSurname: true,
    showBirthDate: false,
    showBirthPlace: false,
    showAge: false,
    showDeathDate: false,
    
    // Contact and Work (5 options - Column 2)
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
    company: "جهة العمل",
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
    // Display options translations (11 working options only)
    showName: "إظهار الاسم الأول",
    showSurname: "إظهار اسم العائلة",
    showBirthDate: "إظهار تاريخ الميلاد",
    showBirthPlace: "إظهار مكان الميلاد",
    showAge: "إظهار العمر",
    showDeathDate: "إظهار تاريخ الوفاة",
    showProfession: "إظهار المهنة",
    showCompany: "إظهار جهة العمل",
    showEmail: "إظهار البريد الإلكتروني",
    showTelephone: "إظهار الهاتف",
    showAddress: "إظهار العنوان",
    // Lineage view translations
    familyLineage: "نسب العائلة",
    theFather: "الأب",
    theSon: "الابن",
    theDaughter: "الابنة",
  };

  // Authentication handlers - auto-create first tree on registration
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
  const handleAppleAuth = () => {
    setIsAuthenticated(true);
    const newTree = {
      id: Date.now(),
      name: "شجرة عائلتي",
      createdAt: new Date().toISOString(),
    };
    setCurrentTree(newTree);
    setCurrentView("tree-builder");
  };
  const handleUAEMobileAuth = () => {
    setIsAuthenticated(true);
    const newTree = {
      id: Date.now(),
      name: "شجرة عائلتي",
      createdAt: new Date().toISOString(),
    };
    setCurrentTree(newTree);
    setCurrentView("tree-builder");
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

  // --- ENHANCED AUTO-LAYOUT LOGIC (FamilyEcho Style) ---
  const computeTreeLayout = (people, relationships, viewportWidth = 1200, viewportHeight = 800) => {
    if (people.length === 0) return people;

    // Build maps for quick lookup
    const idToPerson = Object.fromEntries(people.map((p) => [p.id, { ...p }]));
    const childrenMap = {};
    const parentMap = {};
    const spouseMap = {};

    // Build relationship maps
    relationships.forEach((r) => {
      if (r.type === REL.PARENT_CHILD) {
        if (!childrenMap[r.parentId]) childrenMap[r.parentId] = [];
        childrenMap[r.parentId].push(r.childId);
        parentMap[r.childId] = r.parentId;
      } else if (r.type === REL.PARTNER) {
        spouseMap[r.person1Id] = r.person2Id;
        spouseMap[r.person2Id] = r.person1Id;
      }
    });

    // Find root people (no parents) - prioritize couples
    const roots = people.filter((p) => !parentMap[p.id]);
    
    // Assign generation levels (BFS from roots)
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

    // Group by generation
    const genMap = {};
    Object.values(idToPerson).forEach((p) => {
      if (!genMap[p.generation]) genMap[p.generation] = [];
      genMap[p.generation].push(p);
    });

    // Sort generations and calculate dimensions
    const generations = Object.keys(genMap).map(Number).sort((a, b) => a - b);
    const verticalSpacing = 180;
    const horizontalSpacing = 200;
    const spouseSpacing = 60;

    // Calculate total tree height and starting position for vertical centering
    const totalGenerations = generations.length;
    const totalTreeHeight = totalGenerations * verticalSpacing;
    const startY = Math.max(50, (viewportHeight - totalTreeHeight) / 2);

    // Process each generation from oldest to youngest
    generations.forEach((genNum) => {
      const generationPeople = genMap[genNum];
      const processedIds = new Set();

      // First pass: Process couples together
      generationPeople.forEach((person) => {
        if (processedIds.has(person.id)) return;

        const spouseId = spouseMap[person.id];
        const spouse = spouseId ? idToPerson[spouseId] : null;

        if (spouse && !processedIds.has(spouseId) && spouse.generation === genNum) {
          // Process couple
          processedIds.add(person.id);
          processedIds.add(spouseId);
          
          // Position couple side by side
          person.x = 0; // Temporary - will be set later
          person.y = startY + genNum * verticalSpacing;
          spouse.x = 0; // Temporary
          spouse.y = startY + genNum * verticalSpacing;
        } else if (!processedIds.has(person.id)) {
          // Process single person
          processedIds.add(person.id);
          person.x = 0; // Temporary
          person.y = startY + genNum * verticalSpacing;
        }
      });
    });

    // Second pass: Position nodes horizontally with proper family grouping
    generations.forEach((genNum) => {
      const generationPeople = genMap[genNum];
      let currentX = 100; // Start with some padding

      // Group people by their children (family units)
      const familyUnits = [];
      const processedIds = new Set();

      generationPeople.forEach((person) => {
        if (processedIds.has(person.id)) return;

        const spouseId = spouseMap[person.id];
        const spouse = spouseId ? idToPerson[spouseId] : null;
        const children = childrenMap[person.id] || [];

        // Create family unit
        const family = {
          people: [person],
          children: [],
          width: 0
        };

        // Add spouse if exists
        if (spouse && !processedIds.has(spouseId)) {
          family.people.push(spouse);
          processedIds.add(spouseId);
          
          // Combine children from both spouses
          const spouseChildren = childrenMap[spouseId] || [];
          const allChildren = [...new Set([...children, ...spouseChildren])];
          family.children = allChildren.map(childId => idToPerson[childId]).filter(Boolean);
        } else {
          family.children = children.map(childId => idToPerson[childId]).filter(Boolean);
        }

        processedIds.add(person.id);
        familyUnits.push(family);
      });

      // Position family units horizontally
      familyUnits.forEach((family) => {
        // Calculate family width
        let familyWidth = 0;
        
        if (family.people.length === 2) {
          // Couple: two people + spacing
          familyWidth = stylingOptions.boxWidth * 2 + spouseSpacing;
        } else {
          // Single person
          familyWidth = stylingOptions.boxWidth;
        }

        // Add spacing for children if any
        if (family.children.length > 0) {
          const childrenWidth = family.children.length * (stylingOptions.boxWidth + horizontalSpacing);
          familyWidth = Math.max(familyWidth, childrenWidth);
        }

        // Position people in this family
        if (family.people.length === 2) {
          // Position couple
          const [person1, person2] = family.people;
          person1.x = currentX;
          person2.x = currentX + stylingOptions.boxWidth + spouseSpacing;
          
          // Center children under couple if they exist
          if (family.children.length > 0) {
            const coupleCenterX = (person1.x + person2.x + stylingOptions.boxWidth) / 2;
            const childrenTotalWidth = family.children.length * stylingOptions.boxWidth + 
                                     (family.children.length - 1) * horizontalSpacing;
            const childrenStartX = coupleCenterX - childrenTotalWidth / 2;
            
            // Position children in the next generation
            family.children.forEach((child, index) => {
              child.x = childrenStartX + index * (stylingOptions.boxWidth + horizontalSpacing);
              child.y = startY + (child.generation || genNum + 1) * verticalSpacing;
            });
          }
        } else {
          // Single person
          const person = family.people[0];
          person.x = currentX;
          
          // Center children under single parent if they exist
          if (family.children.length > 0) {
            const parentCenterX = person.x + stylingOptions.boxWidth / 2;
            const childrenTotalWidth = family.children.length * stylingOptions.boxWidth + 
                                     (family.children.length - 1) * horizontalSpacing;
            const childrenStartX = parentCenterX - childrenTotalWidth / 2;
            
            // Position children in the next generation
            family.children.forEach((child, index) => {
              child.x = childrenStartX + index * (stylingOptions.boxWidth + horizontalSpacing);
              child.y = startY + (child.generation || genNum + 1) * verticalSpacing;
            });
          }
        }

        currentX += familyWidth + horizontalSpacing;
      });

      // Handle people not in family units (shouldn't happen, but just in case)
      generationPeople.forEach((person) => {
        if (person.x === 0) { // Not positioned yet
          person.x = currentX;
          currentX += stylingOptions.boxWidth + horizontalSpacing;
        }
      });
    });

    // Third pass: Center the entire tree horizontally
    const allXPositions = Object.values(idToPerson).map(p => p.x);
    const minX = Math.min(...allXPositions);
    const maxX = Math.max(...allXPositions);
    const treeWidth = maxX - minX;
    const horizontalOffset = (viewportWidth - treeWidth) / 2 - minX;

    // Apply horizontal centering
    Object.values(idToPerson).forEach((person) => {
      person.x += horizontalOffset;
    });

    // Return updated people array
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

    let newOffsetX = viewportCenterX - personCenterX * zoom;
    let newOffsetY = viewportCenterY - personCenterY * zoom;

    // Apply pan constraints
    const minY = -200;
    const maxY = 1000;
    const minX = -5000;
    const maxX = 5000;
    
    newOffsetY = Math.max(minY, Math.min(maxY, newOffsetY));
    newOffsetX = Math.max(minX, Math.min(maxX, newOffsetX));

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

    // Auto-set spouse gender to opposite of anchor person (if not already set by form)
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
        // Find all children who share the SAME parent set (full siblings only)
        const parentIds = [selectedPerson];
        
        // Check if selected parent has a spouse
        const spouseRel = relationships.find(
          (r) =>
            r.type === REL.PARTNER &&
            (r.person1Id === selectedPerson || r.person2Id === selectedPerson) &&
            r.treeId === currentTree?.id,
        );
        
        if (spouseRel) {
          const spouseId = spouseRel.person1Id === selectedPerson 
            ? spouseRel.person2Id 
            : spouseRel.person1Id;
          parentIds.push(spouseId);
        }
        
        // Get all children and build parent sets for each
        const allChildren = relationships
          .filter(r => r.type === REL.PARENT_CHILD && r.treeId === currentTree?.id)
          .reduce((acc, r) => {
            if (!acc[r.childId]) acc[r.childId] = new Set();
            acc[r.childId].add(r.parentId);
            return acc;
          }, {});
        
        // Find children who have exactly the same parent set (full siblings)
        const targetParentSet = parentIds.sort().join('-');
        existingSiblings = Object.entries(allChildren)
          .filter(([childId, childParents]) => {
            const childParentSet = Array.from(childParents).sort().join('-');
            return childParentSet === targetParentSet;
          })
          .map(([childId]) => people.find(p => p.id === parseInt(childId)))
          .filter(Boolean);
      } else if (relationshipType === "sibling") {
        // Find existing siblings
        existingSiblings = relationships
          .filter(r => r.type === REL.SIBLING && 
                  (r.person1Id === selectedPerson || r.person2Id === selectedPerson) &&
                  r.treeId === currentTree?.id)
          .map(r => people.find(p => p.id === (r.person1Id === selectedPerson ? r.person2Id : r.person1Id)))
          .filter(Boolean);
        existingSiblings.push(anchorPerson); // Include the anchor person
      }
      
      // Find max birth order and add 1
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
          newRelationship.isBreastfeeding = personData.isBreastfeeding || false;
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
        
        // If tree becomes empty after deletion, reset tree and go to dashboard
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

  // Get siblings with same parent set for reordering
  const getSiblingsWithSameParents = (personId) => {
    // Build parent set for this person
    const personParents = new Set();
    relationships
      .filter(r => r.type === REL.PARENT_CHILD && r.childId === personId && r.treeId === currentTree?.id)
      .forEach(r => personParents.add(r.parentId));
    
    if (personParents.size === 0) return []; // No parents, no siblings
    
    const parentKey = Array.from(personParents).sort().join('-');
    
    // Find all people with the same parent set
    const allChildren = relationships
      .filter(r => r.type === REL.PARENT_CHILD && r.treeId === currentTree?.id)
      .reduce((acc, r) => {
        if (!acc[r.childId]) acc[r.childId] = new Set();
        acc[r.childId].add(r.parentId);
        return acc;
      }, {});
    
    return Object.entries(allChildren)
      .filter(([childId, childParents]) => {
        const childParentKey = Array.from(childParents).sort().join('-');
        return childParentKey === parentKey;
      })
      .map(([childId]) => people.find(p => p.id === parseInt(childId)))
      .filter(Boolean)
      .sort((a, b) => (b.birthOrder || 0) - (a.birthOrder || 0)); // Sort by birth order descending
  };

  // Move person left (swap with ADJACENT higher birth order sibling - older)
  const moveBirthOrderLeft = (personId) => {
    const person = people.find(p => p.id === personId);
    if (!person) return;
    
    const siblings = getSiblingsWithSameParents(personId);
    if (siblings.length < 2) return; // Need at least 2 siblings to reorder
    
    const currentBirthOrder = person.birthOrder || 0;
    
    // Find the CLOSEST sibling with next higher birth order (immediately to the left)
    // Higher birth order = older = positioned more to the left
    const candidateSiblings = siblings
      .filter(s => (s.birthOrder || 0) > currentBirthOrder)
      .sort((a, b) => (a.birthOrder || 0) - (b.birthOrder || 0)); // Sort ascending to get the smallest higher value
    
    const targetSibling = candidateSiblings[0]; // Get the one with smallest birthOrder > current
    if (!targetSibling) return; // Already leftmost (highest birth order)
    
    // Swap birth orders
    setPeople(prev => prev.map(p => {
      if (p.id === personId) return { ...p, birthOrder: targetSibling.birthOrder || 0 };
      if (p.id === targetSibling.id) return { ...p, birthOrder: currentBirthOrder };
      return p;
    }));
  };

  // Move person right (swap with ADJACENT lower birth order sibling - younger)
  const moveBirthOrderRight = (personId) => {
    const person = people.find(p => p.id === personId);
    if (!person) return;
    
    const siblings = getSiblingsWithSameParents(personId);
    if (siblings.length < 2) return; // Need at least 2 siblings to reorder
    
    const currentBirthOrder = person.birthOrder || 0;
    
    // Find the CLOSEST sibling with next lower birth order (immediately to the right)
    // Lower birth order = younger = positioned more to the right
    const candidateSiblings = siblings
      .filter(s => (s.birthOrder || 0) < currentBirthOrder)
      .sort((a, b) => (b.birthOrder || 0) - (a.birthOrder || 0)); // Sort descending to get the largest lower value
    
    const targetSibling = candidateSiblings[0]; // Get the one with largest birthOrder < current
    if (!targetSibling) return; // Already rightmost (lowest birth order)
    
    // Swap birth orders
    setPeople(prev => prev.map(p => {
      if (p.id === personId) return { ...p, birthOrder: targetSibling.birthOrder || 0 };
      if (p.id === targetSibling.id) return { ...p, birthOrder: currentBirthOrder };
      return p;
    }));
  };

  // Get available parent spouses that can be linked to a child
  const getAvailableParentSpouses = (childId) => {
    const childParentRels = relationships.filter(
      r => r.type === REL.PARENT_CHILD && r.childId === childId && r.treeId === currentTree?.id
    );
    
    const currentParentIds = childParentRels.map(r => r.parentId);
    
    // If child already has 2 parents, no more can be added
    if (currentParentIds.length >= 2) return [];
    
    // Find spouses of current parents that are not already linked to the child
    const availableSpouses = [];
    
    currentParentIds.forEach(parentId => {
      const parentSpouseRels = relationships.filter(
        r => r.type === REL.PARTNER && 
            (r.person1Id === parentId || r.person2Id === parentId) &&
            r.treeId === currentTree?.id
      );
      
      parentSpouseRels.forEach(rel => {
        const spouseId = rel.person1Id === parentId ? rel.person2Id : rel.person1Id;
        
        // Only add if not already a parent of this child
        if (!currentParentIds.includes(spouseId)) {
          const spouse = people.find(p => p.id === spouseId);
          const parent = people.find(p => p.id === parentId);
          if (spouse && parent) {
            availableSpouses.push({
              spouse,
              linkedToParent: parent
            });
          }
        }
      });
    });
    
    return availableSpouses;
  };

  // Link child to an additional parent (spouse of existing parent)
  const linkChildToParent = (childId, newParentId) => {
    // Validate that child doesn't already have 2 parents
    const currentParentRels = relationships.filter(
      r => r.type === REL.PARENT_CHILD && r.childId === childId && r.treeId === currentTree?.id
    );
    
    if (currentParentRels.length >= 2) {
      alert("هذا الطفل لديه والدين بالفعل"); // This child already has 2 parents
      return;
    }
    
    // Validate that new parent is actually a spouse of an existing parent
    const currentParentIds = currentParentRels.map(r => r.parentId);
    const isValidSpouse = currentParentIds.some(parentId => {
      return relationships.some(
        r => r.type === REL.PARTNER &&
            ((r.person1Id === parentId && r.person2Id === newParentId) ||
             (r.person2Id === parentId && r.person1Id === newParentId)) &&
            r.treeId === currentTree?.id
      );
    });
    
    if (!isValidSpouse) {
      alert("الشخص المحدد ليس زوجاً/زوجة لأي من والدي الطفل"); // Selected person is not spouse of child's parent
      return;
    }
    
    // Create new parent-child relationship
    const newRelationship = {
      id: Date.now(),
      type: REL.PARENT_CHILD,
      parentId: newParentId,
      childId: childId,
      treeId: currentTree?.id
    };
    
    // Recalculate birth order for the child in their new parent set
    // The new parent set now includes both the original parent and the new parent
    const newParentIds = [...currentParentIds, newParentId].sort();
    
    // Find all children with the same parent set (will be siblings after this operation)
    const updatedRelationships = [...relationships, newRelationship];
    
    // Build map of children to their parent sets
    const childrenParentMap = updatedRelationships
      .filter(r => r.type === REL.PARENT_CHILD && r.treeId === currentTree?.id)
      .reduce((acc, r) => {
        if (!acc[r.childId]) acc[r.childId] = [];
        acc[r.childId].push(r.parentId);
        return acc;
      }, {});
    
    // Find siblings with the same parent set
    const targetParentSet = newParentIds.join('-');
    const siblings = Object.entries(childrenParentMap)
      .filter(([cId, parentIds]) => {
        const parentSet = parentIds.sort().join('-');
        return parentSet === targetParentSet;
      })
      .map(([cId]) => people.find(p => p.id === parseInt(cId)))
      .filter(Boolean)
      .filter(p => p.id !== childId); // Exclude the child being linked
    
    // Calculate new birth order (max of siblings + 1)
    const maxBirthOrder = siblings.length > 0 
      ? Math.max(...siblings.map(s => s.birthOrder || 0))
      : 0;
    const newBirthOrder = maxBirthOrder + 1;
    
    // Update the child's birth order
    setPeople(prev => prev.map(p => 
      p.id === childId ? { ...p, birthOrder: newBirthOrder } : p
    ));
    
    setRelationships(prev => [...prev, newRelationship]);
    setShowManageParentsDialog(false);
  };

  // Enhanced pan handling with smooth dragging
  const handleMouseDown = (e) => {
    // Check if clicking on background (not on person boxes or buttons)
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
      
      // Calculate new pan offset with constraints
      let newX = dragStartOffset.x + deltaX;
      let newY = dragStartOffset.y + deltaY;
      
      // Prevent tree from going up into the menu bar
      // Menu bar is ~64px, so minimum Y offset should be around -200 to keep tree visible
      const minY = -200;
      const maxY = 1000; // Allow panning down
      const minX = -5000; // Allow wide panning horizontally
      const maxX = 5000;
      
      newY = Math.max(minY, Math.min(maxY, newY));
      newX = Math.max(minX, Math.min(maxX, newX));
      
      setPanOffset({
        x: newX,
        y: newY,
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
              onClick={() => currentTree && setCurrentView("relationships-detail")}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4 arabic-text">
                {t.relationships}
              </h3>
              <div className="text-3xl font-bold text-green-600">
                {(() => {
                  if (!currentTree) return 0;
                  
                  const treePeople = people.filter((p) => p.treeId === currentTree?.id);
                  const treeRelationships = relationships.filter((r) => r.treeId === currentTree?.id);
                  
                  // Count unique male parents (husbands who have children)
                  const parentIds = new Set();
                  treeRelationships
                    .filter(r => r.type === REL.PARENT_CHILD)
                    .forEach(r => parentIds.add(r.parentId));
                  
                  // Filter to only count males
                  let maleParentCount = 0;
                  parentIds.forEach(parentId => {
                    const parent = treePeople.find(p => p.id === parentId);
                    if (parent && parent.gender === 'male') {
                      maleParentCount++;
                    }
                  });
                  
                  return maleParentCount;
                })()}
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

  // Lineage view - displays family members organized by husband's lineage first, then wife's ancestors
  if (currentView === "lineage") {
    // Build lineage - organize by family groups (husband's lineage + wife's ancestors)
    const buildLineage = () => {
      const treePeople = people.filter((p) => p.treeId === currentTree?.id);
      const treeRelationships = relationships.filter((r) => r.treeId === currentTree?.id);
      
      if (treePeople.length === 0) return [];
      
      const result = [];
      const addedPeople = new Set();
      
      // Helper: Get all ancestors going up
      const getAncestors = (personId) => {
        const ancestors = [];
        const visited = new Set();
        
        const traceUp = (id) => {
          if (visited.has(id)) return;
          visited.add(id);
          
          const parentRels = treeRelationships.filter(
            rel => rel.type === REL.PARENT_CHILD && rel.childId === id
          );
          
          // Find male parent (father) for paternal line
          let parentId = null;
          const maleParent = parentRels.find(rel => {
            const parent = treePeople.find(p => p.id === rel.parentId);
            return parent?.gender === 'male';
          });
          
          if (maleParent) {
            parentId = maleParent.parentId;
          } else if (parentRels.length > 0) {
            parentId = parentRels[0].parentId;
          }
          
          if (parentId) {
            traceUp(parentId);
            const parent = treePeople.find(p => p.id === parentId);
            if (parent) ancestors.push(parent);
          }
        };
        
        traceUp(personId);
        return ancestors;
      };
      
      // Helper: Get all descendants going down
      const getDescendants = (personId) => {
        const descendants = [];
        const visited = new Set();
        
        const traceDown = (id) => {
          if (visited.has(id)) return;
          visited.add(id);
          
          const childRels = treeRelationships.filter(
            rel => rel.type === REL.PARENT_CHILD && rel.parentId === id
          );
          
          childRels.forEach(rel => {
            const child = treePeople.find(p => p.id === rel.childId);
            if (child) {
              descendants.push(child);
              traceDown(child.id);
            }
          });
        };
        
        traceDown(personId);
        return descendants;
      };
      
      // Find all partnerships
      const partnerships = treeRelationships.filter(r => r.type === REL.PARTNER);
      
      // Process each partnership: husband's lineage first, then wife's ancestors
      partnerships.forEach(partnership => {
        const person1 = treePeople.find(p => p.id === partnership.person1Id);
        const person2 = treePeople.find(p => p.id === partnership.person2Id);
        
        if (!person1 || !person2) return;
        
        // Identify husband (male) and wife (female)
        const husband = person1.gender === 'male' ? person1 : person2;
        const wife = person1.gender === 'male' ? person2 : person1;
        
        // Skip if both already processed
        if (addedPeople.has(husband.id) && addedPeople.has(wife.id)) return;
        
        // Process husband's full lineage
        const husbandAncestors = getAncestors(husband.id);
        husbandAncestors.forEach(ancestor => {
          if (!addedPeople.has(ancestor.id)) {
            result.push(ancestor);
            addedPeople.add(ancestor.id);
          }
        });
        
        // Add husband
        if (!addedPeople.has(husband.id)) {
          result.push(husband);
          addedPeople.add(husband.id);
        }
        
        // Add husband's descendants
        const husbandDescendants = getDescendants(husband.id);
        husbandDescendants.forEach(descendant => {
          if (!addedPeople.has(descendant.id)) {
            result.push(descendant);
            addedPeople.add(descendant.id);
          }
        });
        
        // Process wife's ancestors and add wife
        const wifeAncestors = getAncestors(wife.id);
        wifeAncestors.forEach(ancestor => {
          if (!addedPeople.has(ancestor.id)) {
            result.push(ancestor);
            addedPeople.add(ancestor.id);
          }
        });
        
        // Add wife
        if (!addedPeople.has(wife.id)) {
          result.push(wife);
          addedPeople.add(wife.id);
        }
      });
      
      // Add any remaining people not in partnerships
      treePeople.forEach(person => {
        if (!addedPeople.has(person.id)) {
          result.push(person);
          addedPeople.add(person.id);
        }
      });
      
      return result;
    };
    
    const lineage = buildLineage();
    
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
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

        {/* Lineage Display */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {lineage.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-gray-500 text-lg arabic-text">
                لا يوجد أفراد في العائلة
              </div>
              <p className="text-gray-400 text-sm mt-2 arabic-text">
                أضف أفراد العائلة لرؤية التفاصيل هنا
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {lineage.map((person, index) => {
                  // Build genealogical chain by tracing up through parent relationships
                  // This dynamically updates when ancestors are added
                  const buildGenealogicalName = () => {
                    const names = [];
                    const visited = new Set(); // Prevent infinite loops
                    
                    // Start with current person and trace up to oldest ancestor
                    let currentPerson = person;
                    
                    while (currentPerson && !visited.has(currentPerson.id)) {
                      visited.add(currentPerson.id);
                      names.push(currentPerson.firstName);
                      
                      // Find parent (father) - prioritize male parent for paternal line
                      const parentRels = relationships.filter(
                        r => r.type === REL.PARENT_CHILD && 
                             r.childId === currentPerson.id && 
                             r.treeId === currentTree?.id
                      );
                      
                      if (parentRels.length === 0) {
                        // No parents found - this is the oldest ancestor
                        // Add family name from this person
                        if (currentPerson.lastName) {
                          names.push(currentPerson.lastName);
                        }
                        break;
                      }
                      
                      // Get all parents
                      const parents = parentRels
                        .map(rel => people.find(p => p.id === rel.parentId))
                        .filter(Boolean);
                      
                      // Prefer male parent for paternal lineage
                      const father = parents.find(p => p.gender === 'male');
                      currentPerson = father || parents[0]; // Fall back to first parent if no male
                    }
                    
                    return names.join(' ');
                  };
                  
                  return (
                    <div 
                      key={person.id}
                      className="bg-white rounded-lg shadow-md p-6"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-xl font-semibold text-gray-400">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="text-lg text-gray-900 arabic-text">
                            {buildGenealogicalName()}
                          </div>
                          {person.birthDate && (
                            <div className="text-sm text-gray-600 arabic-text mt-1">
                              {person.birthDate}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Relationships detail view - displays parent profiles with genealogical names, spouse count, and children count
  if (currentView === "relationships-detail") {
    // Helper: Get parent profiles with full genealogical names
    const getParentProfiles = () => {
      if (!currentTree) return [];
      
      const treePeople = people.filter((p) => p.treeId === currentTree?.id);
      const treeRelationships = relationships.filter((r) => r.treeId === currentTree?.id);
      
      // Find all parents (people who have children)
      const parentIds = new Set();
      treeRelationships
        .filter(r => r.type === REL.PARENT_CHILD)
        .forEach(r => parentIds.add(r.parentId));
      
      const profiles = [];
      
      parentIds.forEach(parentId => {
        const parent = treePeople.find(p => p.id === parentId);
        if (!parent) return;
        
        // Only show male parents (husbands) - females are already counted as wives
        if (parent.gender !== 'male') return;
        
        // Count siblings (brothers and sisters, including breastfeeding)
        const siblingRels = treeRelationships.filter(
          r => r.type === REL.SIBLING && (r.person1Id === parentId || r.person2Id === parentId)
        );
        
        let brothersCount = 0;
        let sistersCount = 0;
        let breastfeedingBrothersCount = 0;
        let breastfeedingSistersCount = 0;
        
        siblingRels.forEach(rel => {
          const siblingId = rel.person1Id === parentId ? rel.person2Id : rel.person1Id;
          const sibling = treePeople.find(p => p.id === siblingId);
          if (sibling) {
            const isBreastfeeding = rel.isBreastfeeding === true;
            if (sibling.gender === 'male') {
              if (isBreastfeeding) {
                breastfeedingBrothersCount++;
              } else {
                brothersCount++;
              }
            } else if (sibling.gender === 'female') {
              if (isBreastfeeding) {
                breastfeedingSistersCount++;
              } else {
                sistersCount++;
              }
            }
          }
        });
        
        // Count spouses (partners)
        const spouseCount = treeRelationships.filter(
          r => r.type === REL.PARTNER && (r.person1Id === parentId || r.person2Id === parentId)
        ).length;
        
        // Count children
        const childrenCount = treeRelationships.filter(
          r => r.type === REL.PARENT_CHILD && r.parentId === parentId
        ).length;
        
        // Build full genealogical name: firstName + parent's firstName + family name
        let fullName = parent.firstName || "";
        
        // Get parent's name (for genealogical chain)
        const parentRels = treeRelationships.filter(
          rel => rel.type === REL.PARENT_CHILD && rel.childId === parentId
        );
        
        // Find male parent (father) for paternal line
        const maleParentRel = parentRels.find(rel => {
          const p = treePeople.find(person => person.id === rel.parentId);
          return p?.gender === 'male';
        });
        
        const parentRel = maleParentRel || parentRels[0];
        
        if (parentRel) {
          const parentPerson = treePeople.find(p => p.id === parentRel.parentId);
          if (parentPerson?.firstName) {
            fullName += " " + parentPerson.firstName;
          }
        }
        
        // Add family name (lastName) - get from oldest ancestor or self
        const getOldestAncestor = (personId) => {
          let current = personId;
          let visited = new Set();
          
          while (true) {
            if (visited.has(current)) break;
            visited.add(current);
            
            const parentRels = treeRelationships.filter(
              rel => rel.type === REL.PARENT_CHILD && rel.childId === current
            );
            
            const maleParent = parentRels.find(rel => {
              const p = treePeople.find(person => person.id === rel.parentId);
              return p?.gender === 'male';
            });
            
            const nextParentRel = maleParent || parentRels[0];
            
            if (!nextParentRel) break;
            current = nextParentRel.parentId;
          }
          
          return current;
        };
        
        const oldestAncestorId = getOldestAncestor(parentId);
        const oldestAncestor = treePeople.find(p => p.id === oldestAncestorId);
        const familyName = oldestAncestor?.lastName || parent.lastName || "";
        
        if (familyName) {
          fullName += " " + familyName;
        }
        
        profiles.push({
          id: parentId,
          fullName: fullName.trim(),
          brothersCount,
          sistersCount,
          breastfeedingBrothersCount,
          breastfeedingSistersCount,
          spouseCount,
          childrenCount,
        });
      });
      
      return profiles;
    };
    
    const parentProfiles = getParentProfiles();

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
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
                  {t.relationships}
                </h1>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {parentProfiles.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-gray-500 text-lg arabic-text">
                لا توجد علاقات بعد
              </div>
              <p className="text-gray-400 text-sm mt-2 arabic-text">
                أضف أفراد العائلة وعلاقاتهم لرؤية التفاصيل هنا
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {parentProfiles.map(profile => (
                <div key={profile.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                  <div className="text-lg font-bold text-gray-900 arabic-text mb-4 border-b pb-3">
                    الاسم: {profile.fullName}
                  </div>
                  <div className="space-y-2">
                    <div className="text-base text-gray-700 arabic-text flex justify-between">
                      <span>عدد الأخوة:</span>
                      <span className="font-semibold text-green-600">{profile.brothersCount}</span>
                    </div>
                    <div className="text-base text-gray-700 arabic-text flex justify-between">
                      <span>عدد الأخوات:</span>
                      <span className="font-semibold text-pink-600">{profile.sistersCount}</span>
                    </div>
                    {(profile.breastfeedingBrothersCount > 0 || profile.breastfeedingSistersCount > 0) && (
                      <div className="mt-2 pt-2 border-t border-green-200">
                        {profile.breastfeedingBrothersCount > 0 && (
                          <div className="text-base text-gray-700 arabic-text flex justify-between">
                            <span>أخوة من الرضاعة:</span>
                            <span className="font-semibold text-green-500">{profile.breastfeedingBrothersCount}</span>
                          </div>
                        )}
                        {profile.breastfeedingSistersCount > 0 && (
                          <div className="text-base text-gray-700 arabic-text flex justify-between">
                            <span>أخوات من الرضاعة:</span>
                            <span className="font-semibold text-green-500">{profile.breastfeedingSistersCount}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="text-base text-gray-700 arabic-text flex justify-between">
                      <span>عدد الزوجات:</span>
                      <span className="font-semibold text-purple-600">{profile.spouseCount}</span>
                    </div>
                    <div className="text-base text-gray-700 arabic-text flex justify-between">
                      <span>عدد الأبناء:</span>
                      <span className="font-semibold text-blue-600">{profile.childrenCount}</span>
                    </div>
                  </div>
                </div>
              ))}
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
            // Deselect person and close form when clicking on background
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
              {/* 1. PARTNER RELATIONSHIPS - Enhanced with status styling */}
              {relationships
                .filter(r => r.type === REL.PARTNER && r.treeId === currentTree?.id)
                .map((r, i) => {
                  const p1 = treePeople.find(p => p.id === r.person1Id);
                  const p2 = treePeople.find(p => p.id === r.person2Id);
                  
                  if (!p1 || !p2) return null;

                  // Determine left and right partners
                  const leftPerson = p1.x < p2.x ? p1 : p2;
                  const rightPerson = p1.x < p2.x ? p2 : p1;

                  // Connect from right edge of left person to left edge of right person
                  const startX = leftPerson.x + stylingOptions.boxWidth;
                  const startY = leftPerson.y + CARD.h / 2;
                  const endX = rightPerson.x;
                  const endY = rightPerson.y + CARD.h / 2;

                  // Enhanced styling: current partners (solid thick) vs ex-partners (dashed thin)
                  const isCurrentPartner = !r.divorceDate && !r.endDate;
                  const stroke = isCurrentPartner ? "#1e293b" : "#64748b";
                  const strokeWidth = isCurrentPartner ? 4 : 2;
                  const strokeDasharray = isCurrentPartner ? "none" : "8,4";

                  return (
                    <line
                      key={`partner-${i}`}
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeDasharray={strokeDasharray}
                    />
                  );
                })}
              {/* 2. PARENT-CHILD RELATIONSHIPS - Classic Family Tree Hierarchy */}
              {(() => {
                // Group children by their parent sets
                const parentGroups = {};
                
                relationships
                  .filter(r => r.type === REL.PARENT_CHILD && r.treeId === currentTree?.id)
                  .forEach(r => {
                    const child = treePeople.find(p => p.id === r.childId);
                    const parent = treePeople.find(p => p.id === r.parentId);
                    
                    if (!child || !parent) return;

                    // Find all parents of this child (both mother and father)
                    const childParentIds = relationships
                      .filter(rel => rel.type === REL.PARENT_CHILD && rel.childId === child.id && rel.treeId === currentTree?.id)
                      .map(rel => rel.parentId)
                      .sort((a, b) => a - b);
                    
                    const groupKey = childParentIds.join('-');
                    
                    if (!parentGroups[groupKey]) {
                      parentGroups[groupKey] = {
                        parentIds: childParentIds,
                        children: []
                      };
                    }
                    
                    // Add child if not already in group
                    if (!parentGroups[groupKey].children.find(c => c.id === child.id)) {
                      parentGroups[groupKey].children.push(child);
                    }
                  });

                return Object.values(parentGroups).map((group, groupIndex) => {
                  if (group.children.length === 0) return null;

                  const parents = group.parentIds.map(id => treePeople.find(p => p.id === id)).filter(Boolean);
                  if (parents.length === 0) return null;

                  // Sort children by birth order (right to left for RTL)
                  const children = group.children.sort((a, b) => (b.birthOrder || 0) - (a.birthOrder || 0));

                  // Calculate the connection point from parents
                  let parentConnectionX, parentConnectionY;
                  
                  if (parents.length === 2) {
                    // For couples: use the midpoint of the spouse line
                    const parent1CenterX = parents[0].x + stylingOptions.boxWidth / 2;
                    const parent2CenterX = parents[1].x + stylingOptions.boxWidth / 2;
                    parentConnectionX = (parent1CenterX + parent2CenterX) / 2;
                    parentConnectionY = Math.max(parents[0].y, parents[1].y) + CARD.h;
                  } else {
                    // Single parent: use bottom center
                    parentConnectionX = parents[0].x + stylingOptions.boxWidth / 2;
                    parentConnectionY = parents[0].y + CARD.h;
                  }

                  // CONDITIONAL RENDERING: First child only vs. multiple children
                  if (children.length === 1) {
                    // FIRST CHILD ONLY: Direct smooth curved line from parent to child
                    const childCenterX = children[0].x + stylingOptions.boxWidth / 2;
                    const childTopY = children[0].y;

                    // Calculate control point for smooth S-curve
                    const midY = (parentConnectionY + childTopY) / 2;
                    const pathD = `M ${parentConnectionX} ${parentConnectionY} C ${parentConnectionX} ${midY}, ${childCenterX} ${midY}, ${childCenterX} ${childTopY}`;

                    return (
                      <path
                        key={`parent-group-${groupIndex}`}
                        d={pathD}
                        stroke="#059669"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        fill="none"
                      />
                    );
                  } else {
                    // MULTIPLE CHILDREN: Enhanced T-shape with rounded corners
                    const childCenters = children.map(child => ({
                      x: child.x + stylingOptions.boxWidth / 2,
                      y: child.y
                    }));

                    const leftmostChildX = Math.min(...childCenters.map(c => c.x));
                    const rightmostChildX = Math.max(...childCenters.map(c => c.x));
                    const topChildY = Math.min(...childCenters.map(c => c.y));

                    // Position the horizontal sibling line 40px above the top child
                    const siblingLineY = topChildY - 40;
                    const cornerRadius = 8; // Rounded corner radius

                    return (
                      <g key={`parent-group-${groupIndex}`}>
                        {/* Main vertical line from parent to junction */}
                        <line
                          x1={parentConnectionX}
                          y1={parentConnectionY}
                          x2={parentConnectionX}
                          y2={siblingLineY - cornerRadius}
                          stroke="#059669"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                        />

                        {/* Horizontal sibling bar with smooth rounded corners */}
                        <path
                          d={`
                            M ${leftmostChildX} ${siblingLineY}
                            L ${parentConnectionX - cornerRadius} ${siblingLineY}
                            Q ${parentConnectionX} ${siblingLineY} ${parentConnectionX} ${siblingLineY - cornerRadius}
                            M ${parentConnectionX} ${siblingLineY - cornerRadius}
                            Q ${parentConnectionX} ${siblingLineY} ${parentConnectionX + cornerRadius} ${siblingLineY}
                            L ${rightmostChildX} ${siblingLineY}
                          `}
                          stroke="#059669"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          fill="none"
                        />

                        {/* Vertical lines from sibling line to each child with gentle curves */}
                        {childCenters.map((childCenter, idx) => {
                          const curveOffset = 15;
                          const pathD = `M ${childCenter.x} ${siblingLineY} Q ${childCenter.x} ${siblingLineY + curveOffset} ${childCenter.x} ${childCenter.y}`;
                          return (
                            <path
                              key={`child-vertical-${idx}`}
                              d={pathD}
                              stroke="#059669"
                              strokeWidth={2}
                              strokeLinecap="round"
                              fill="none"
                            />
                          );
                        })}
                      </g>
                    );
                  }
                });
              })()}

              {/* 3. SIBLING RELATIONSHIPS - Enhanced curves for orphaned siblings */}
              {(() => {
                const siblingPairs = [];
                const processedPairs = new Set();

                relationships
                  .filter(r => r.type === REL.SIBLING && r.treeId === currentTree?.id)
                  .forEach(r => {
                    const key = [r.person1Id, r.person2Id].sort().join('-');
                    if (processedPairs.has(key)) return;
                    
                    const p1 = treePeople.find(p => p.id === r.person1Id);
                    const p2 = treePeople.find(p => p.id === r.person2Id);
                    
                    if (p1 && p2) {
                      // Only connect siblings that don't have parents in the tree
                      const p1HasParents = relationships.some(rel => 
                        rel.type === REL.PARENT_CHILD && rel.childId === p1.id && rel.treeId === currentTree?.id
                      );
                      const p2HasParents = relationships.some(rel => 
                        rel.type === REL.PARENT_CHILD && rel.childId === p2.id && rel.treeId === currentTree?.id
                      );
                      
                      if (!p1HasParents && !p2HasParents) {
                        siblingPairs.push([p1, p2]);
                        processedPairs.add(key);
                      }
                    }
                  });

                return siblingPairs.map(([p1, p2], i) => {
                  const siblings = [p1, p2].sort((a, b) => a.x - b.x);
                  const y = siblings[0].y - 25;
                  const minX = Math.min(...siblings.map(s => s.x + stylingOptions.boxWidth / 2));
                  const maxX = Math.max(...siblings.map(s => s.x + stylingOptions.boxWidth / 2));
                  
                  // Enhanced smooth arc for sibling connections
                  const midX = (minX + maxX) / 2;
                  const curveHeight = 20;
                  const pathD = `M ${minX} ${y} Q ${midX} ${y - curveHeight} ${maxX} ${y}`;
                  
                  return (
                    <path
                      key={`sibling-${i}`}
                      d={pathD}
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      strokeDasharray="6,3"
                      strokeLinecap="round"
                      fill="none"
                    />
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
              {treePeople.map((person) => {
                // Check if this person has any breastfeeding sibling relationships
                const isBreastfeedingSibling = relationships.some(
                  r => r.type === REL.SIBLING && 
                       r.isBreastfeeding === true &&
                       (r.person1Id === person.id || r.person2Id === person.id) &&
                       r.treeId === currentTree?.id
                );
                
                return (
                <div
                  key={person.id}
                  data-person-box
                  className={`absolute border-2 rounded-lg p-3 cursor-pointer transition-all duration-200 select-none ${
                    selectedPerson === person.id
                      ? "border-green-500 shadow-lg"
                      : isBreastfeedingSibling
                      ? "border-green-400 border-4 hover:border-green-500"
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
                  // Drag-and-drop removed for auto-layout
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
                );
              })}

              {/* Action buttons for selected person - positioned below the box */}
              {selectedPerson &&
                treePeople.find((p) => p.id === selectedPerson) && (() => {
                  const selectedPersonData = treePeople.find((p) => p.id === selectedPerson);
                  
                  // Check if selected person is female and already has a male spouse
                  const isFemale = selectedPersonData.gender === "female";
                  const hasMaleSpouse = isFemale && relationships.some(r => 
                    r.type === REL.PARTNER && 
                    r.treeId === currentTree?.id &&
                    (r.person1Id === selectedPerson || r.person2Id === selectedPerson) &&
                    people.find(p => 
                      p.id === (r.person1Id === selectedPerson ? r.person2Id : r.person1Id)
                    )?.gender === "male"
                  );
                  
                  // Check if living male already has 4 living spouses
                  const isLivingMale = selectedPersonData.gender === "male" && selectedPersonData.isLiving !== false;
                  const livingSpousesCount = isLivingMale ? relationships.filter(r => {
                    if (r.type !== REL.PARTNER || r.treeId !== currentTree?.id) return false;
                    if (r.person1Id !== selectedPerson && r.person2Id !== selectedPerson) return false;
                    
                    const spouseId = r.person1Id === selectedPerson ? r.person2Id : r.person1Id;
                    const spouse = people.find(p => p.id === spouseId);
                    return spouse && spouse.isLiving !== false;
                  }).length : 0;
                  const hasMaxSpouses = isLivingMale && livingSpousesCount >= 4;
                  
                  // Hide spouse button if female has male spouse OR if living male has 4 living spouses
                  const hideSpouseButton = hasMaleSpouse || hasMaxSpouses;
                  
                  // Check if person has siblings for reordering
                  const siblings = getSiblingsWithSameParents(selectedPerson);
                  const canReorder = siblings.length > 1;
                  const person = people.find(p => p.id === selectedPerson);
                  const currentBirthOrder = person?.birthOrder || 0;
                  const canMoveLeft = canReorder && siblings.some(s => (s.birthOrder || 0) > currentBirthOrder);
                  const canMoveRight = canReorder && siblings.some(s => (s.birthOrder || 0) < currentBirthOrder);
                  
                  // Check if "Manage Parents" button should show (child with available parent spouses)
                  const availableParentSpouses = getAvailableParentSpouses(selectedPerson);
                  const showManageParentsButton = availableParentSpouses.length > 0;
                  
                  // Calculate button container width based on visible buttons
                  const buttonWidth = 32; // w-8 = 32px
                  const gap = 4; // gap-1 = 4px
                  const padding = 8; // p-2 = 8px on each side
                  let numButtons = hideSpouseButton ? 4 : 5; // Base buttons
                  if (canMoveLeft) numButtons++;
                  if (canMoveRight) numButtons++;
                  if (showManageParentsButton) numButtons++;
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

                      {canMoveRight && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveBirthOrderRight(selectedPerson);
                          }}
                          size="sm"
                          variant="ghost"
                          className="w-8 h-8 p-0 hover:bg-purple-50 rounded-full"
                          title="أكبر"
                        >
                          <ArrowRight className="w-3 h-3 text-purple-600" />
                        </Button>
                      )}

                      {canMoveLeft && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveBirthOrderLeft(selectedPerson);
                          }}
                          size="sm"
                          variant="ghost"
                          className="w-8 h-8 p-0 hover:bg-purple-50 rounded-full"
                          title="أصغر"
                        >
                          <ArrowLeft className="w-3 h-3 text-purple-600" />
                        </Button>
                      )}

                      {showManageParentsButton && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowManageParentsDialog(true);
                          }}
                          size="sm"
                          variant="ghost"
                          className="w-8 h-8 p-0 hover:bg-green-50 rounded-full"
                          title="ربط بوالد آخر"
                        >
                          <Users className="w-3 h-3 text-green-600" />
                        </Button>
                      )}

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

          {/* Zoom Controls - moved outside canvas to remain fixed */}
        </div>

        {/* Zoom Controls - Fixed position, won't move with pan/zoom */}
        <div className="fixed left-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-40">
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

        {/* Bottom Toolbar - Fixed position, won't move with pan/zoom */}
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
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
                />
              </div>
            </div>
          </div>
        )}

        {/* Options Panel - Semi-transparent overlay for live preview */}
        {showOptions && (
          <div className="fixed inset-0 z-40 pointer-events-none">
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-95 backdrop-blur-sm shadow-2xl border border-gray-300 rounded-lg z-50 pointer-events-auto w-[90vw] max-w-[1200px] overflow-auto max-h-[60vh]">
              <div className="px-6 py-4">
                <div className="flex justify-between items-center mb-4">
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

                <div className="grid grid-cols-4 gap-1">
                  {/* Column 1: Display Options - First List (6 options) */}
                  <div>
                    <h3 className="text-base font-medium text-gray-900 mb-3 arabic-text">
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

                  {/* Column 2: Display Options - Second List (5 options) */}
                  <div>
                    <h3 className="text-base font-medium text-gray-900 mb-3 arabic-text">
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

                  {/* Column 3: Colors */}
                  <div>
                    <h3 className="text-base font-medium text-gray-900 mb-3 arabic-text">
                      الألوان
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700 arabic-text min-w-[110px]">
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
                          className="w-12 h-10 rounded border cursor-pointer"
                        />
                        <Button
                          onClick={() =>
                            setStylingOptions((prev) => ({
                              ...prev,
                              maleBoxColor: "#bfdbfe",
                            }))
                          }
                          size="sm"
                          variant="ghost"
                          className="w-8 h-8 p-0"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700 arabic-text min-w-[110px]">
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
                          className="w-12 h-10 rounded border cursor-pointer"
                        />
                        <Button
                          onClick={() =>
                            setStylingOptions((prev) => ({
                              ...prev,
                              femaleBoxColor: "#fce7f3",
                            }))
                          }
                          size="sm"
                          variant="ghost"
                          className="w-8 h-8 p-0"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700 arabic-text min-w-[110px]">
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
                          className="w-12 h-10 rounded border cursor-pointer"
                        />
                        <Button
                          onClick={() =>
                            setStylingOptions((prev) => ({
                              ...prev,
                              backgroundColor: "#f8fafc",
                            }))
                          }
                          size="sm"
                          variant="ghost"
                          className="w-8 h-8 p-0"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Column 4: Sliders */}
                  <div>
                    <h3 className="text-base font-medium text-gray-900 mb-3 arabic-text">
                      الأحجام
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700 arabic-text min-w-[80px]">
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
                        <span className="text-sm text-gray-600 min-w-[30px] text-center">
                          {stylingOptions.boxWidth}
                        </span>
                        <Button
                          onClick={() =>
                            setStylingOptions((prev) => ({
                              ...prev,
                              boxWidth: 140,
                            }))
                          }
                          size="sm"
                          variant="ghost"
                          className="w-8 h-8 p-0"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700 arabic-text min-w-[80px]">
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
                        <span className="text-sm text-gray-600 min-w-[30px] text-center">
                          {stylingOptions.textSize}
                        </span>
                        <Button
                          onClick={() =>
                            setStylingOptions((prev) => ({
                              ...prev,
                              textSize: 14,
                            }))
                          }
                          size="sm"
                          variant="ghost"
                          className="w-8 h-8 p-0"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Below the grid */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                  <Button
                    onClick={() => setShowOptions(false)}
                    className="arabic-text"
                  >
                    {t.save}
                  </Button>
                  <Button
                    onClick={() => setShowOptions(false)}
                    variant="outline"
                    className="arabic-text"
                  >
                    {t.cancel}
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

        {showManageParentsDialog && selectedPerson && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 arabic-text">
                    ربط بوالد آخر
                  </h2>
                  <Button
                    onClick={() => setShowManageParentsDialog(false)}
                    variant="ghost"
                    size="sm"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="text-gray-700 arabic-text">
                    <p className="mb-2">الوالدان الحاليان:</p>
                    <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                      {relationships
                        .filter(r => r.type === REL.PARENT_CHILD && r.childId === selectedPerson && r.treeId === currentTree?.id)
                        .map(r => {
                          const parent = people.find(p => p.id === r.parentId);
                          return parent ? (
                            <div key={r.parentId} className="text-sm">
                              • {parent.firstName} {parent.lastName}
                            </div>
                          ) : null;
                        })}
                    </div>
                  </div>

                  {getAvailableParentSpouses(selectedPerson).length > 0 && (
                    <div className="text-gray-700 arabic-text">
                      <p className="mb-2">يمكن ربط الطفل بـ:</p>
                      <div className="space-y-2">
                        {getAvailableParentSpouses(selectedPerson).map(({ spouse, linkedToParent }) => (
                          <button
                            key={spouse.id}
                            onClick={() => linkChildToParent(selectedPerson, spouse.id)}
                            className="w-full flex items-start justify-between p-3 border rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors text-right"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {spouse.firstName} {spouse.lastName}
                              </div>
                              <div className="text-sm text-gray-600">
                                زوج/ة {linkedToParent.firstName} {linkedToParent.lastName}
                              </div>
                            </div>
                            <UserPlus className="w-5 h-5 text-green-600 flex-shrink-0 mr-2" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button
                    onClick={() => setShowManageParentsDialog(false)}
                    variant="outline"
                    className="arabic-text"
                  >
                    إلغاء
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
    isBreastfeeding: false, // For sibling relationships only
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
    company: "جهة العمل",
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
    
    // Validate email format if provided
    if (formData.email && formData.email.trim()) {
      const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailPattern.test(formData.email)) {
        alert("يرجى إدخال بريد إلكتروني صحيح بالإنجليزية (مثل: test@test.com)");
        return;
      }
    }
    
    onSave(formData);
  };

  const handleChange = (field, value) => {
    // Phone number validation: limit to 10 digits only
    if (field === "phone") {
      const digitsOnly = value.replace(/\D/g, "");
      if (digitsOnly.length <= 10) {
        setFormData((prev) => ({ ...prev, [field]: digitsOnly }));
      }
      return;
    }
    
    // Email validation: ensure English characters only with @ and .
    if (field === "email") {
      const englishEmailPattern = /^[a-zA-Z0-9@._-]*$/;
      if (englishEmailPattern.test(value)) {
        setFormData((prev) => ({ ...prev, [field]: value }));
      }
      return;
    }
    
    // Clear death date when isLiving is set to true
    if (field === "isLiving" && value === true) {
      setFormData((prev) => ({ ...prev, isLiving: true, deathDate: "" }));
      return;
    }
    
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
        company: person.company || "",
        bioNotes: person.bioNotes || "",
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
        company: "",
        bioNotes: "",
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
        company: "",
        bioNotes: "",
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
                className="text-lg font-bold text-gray-700 arabic-text"
              >
                {t.isLiving}
              </label>
            </div>

            {relationshipType === "sibling" && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isBreastfeeding"
                  checked={formData.isBreastfeeding || false}
                  onChange={(e) => handleChange("isBreastfeeding", e.target.checked)}
                  className="rounded"
                />
                <label
                  htmlFor="isBreastfeeding"
                  className="text-lg font-bold text-gray-700 arabic-text"
                >
                  أخ/أخت من الرضاعة
                </label>
              </div>
            )}

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
              <textarea
                value={formData.bioNotes}
                onChange={(e) => handleChange("bioNotes", e.target.value)}
                rows={5}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
                dir="rtl"
              />
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
