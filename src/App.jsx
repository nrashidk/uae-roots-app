import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Heart, Baby, Users, UserPlus, Edit3, Trash2, X, Settings, Download, Home, Share, Calendar, Printer, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import './App.css'

// UAE Roots Family Tree Application - Enhanced with FamilyEcho Features
function App() {
  // Card dimensions constants
  const CARD = {
    w: 140,
    h: 90
  };

  // Relationship type constants
  const REL = {
    PARTNER: 'partner',
    PARENT_CHILD: 'parent-child',
    SIBLING: 'sibling',
  };

  // State Management
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('auth');
  const [currentTree, setCurrentTree] = useState(null);
  const [people, setPeople] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [showOptions, setShowOptions] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedDownloadFormat, setSelectedDownloadFormat] = useState('html');

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
    showActivities: false
  });

  // Enhanced Styling Options
  const [stylingOptions, setStylingOptions] = useState({
    backgroundColor: '#f8fafc',
    maleBoxColor: '#bfdbfe',
    femaleBoxColor: '#fce7f3',
    otherBoxColor: '#e6e6fa',
    livingTextColor: '#000000',
    deceasedTextColor: '#6b7280',
    boxWidth: 140,
    textSize: 14
  });

  // Connection Line Options
  const [connectionOptions, setConnectionOptions] = useState({
    currentPartners: 'thick',
    otherPartners: 'medium',
    parents: 'medium',
    nonBiological: 'gray'
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

  // Arabic translations - Complete Arabic interface
  const t = {
    welcome: 'مرحباً بكم في جذور الإمارات',
    continueWithGoogle: 'التسجيل عبر Google',
    continueWithApple: 'التسجيل عبر Apple', 
    uaeMobile: 'التسجيل عبر الهاتف الإماراتي',
    dashboard: 'لوحة التحكم',
    myFamilyTrees: 'أشجار عائلتي',
    familyMembers: 'أفراد العائلة',
    relationships: 'العلاقات',
    createNewTree: 'إنشاء شجرة جديدة',
    noFamilyTrees: 'لا توجد أشجار عائلة بعد',
    createFirstTree: 'أنشئ شجرة عائلتك الأولى للبدء',
    addPerson: 'إضافة شخص',
    startBuilding: 'ابدأ ببناء شجرة عائلتك',
    addFirstMember: 'أضف أول فرد من العائلة للبدء',
    personal: 'البيانات الشخصية',
    contact: 'معلومات التواصل',
    biography: 'السيرة الذاتية',
    addFamilyMember: 'إضافة فرد من العائلة',
    editFamilyMember: 'تعديل فرد من العائلة',
    allFieldsOptional: 'جميع الحقول اختيارية',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    gender: 'الجنس',
    male: 'ذكر',
    female: 'أنثى',
    birthDate: 'تاريخ الميلاد',
    birthPlace: 'مكان الميلاد',
    isLiving: 'على قيد الحياة',
    deathDate: 'تاريخ الوفاة',
    phone: 'الهاتف',
    email: 'البريد الإلكتروني',
    address: 'العنوان',
    profession: 'المهنة',
    company: 'الشركة',
    bioNotes: 'ملاحظات السيرة الذاتية',
    save: 'حفظ',
    cancel: 'إلغاء',
    update: 'تحديث',
    addSpouse: 'إضافة زوج/زوجة',
    addParent: 'إضافة والد',
    addChild: 'إضافة طفل',
    addSibling: 'إضافة شقيق',
    options: 'خيارات',
    displayOptions: 'خيارات العرض',
    stylingOptions: 'خيارات التصميم',
    showNames: 'إظهار الأسماء',
    showSurnames: 'إظهار أسماء العائلة',
    showBirthDates: 'إظهار تواريخ الميلاد',
    showBirthPlaces: 'إظهار أماكن الميلاد',
    showProfessions: 'إظهار المهن',
    showPhones: 'إظهار الهواتف',
    showEmails: 'إظهار البريد الإلكتروني',
    showAddresses: 'إظهار العناوين',
    maleBoxColor: 'لون صندوق الذكر',
    femaleBoxColor: 'لون صندوق الأنثى',
    textSize: 'حجم النص',
    backgroundColor: 'لون الخلفية',
    resetView: 'إعادة تعيين العرض',
    logout: 'تسجيل الخروج',
    backToDashboard: 'العودة إلى لوحة التحكم',
    openFamilyTree: 'فتح شجرة العائلة',
    applyChanges: 'تطبيق التغييرات',
    familyTreeName: 'شجرة عائلتي',
    deleteConfirm: 'هل أنت متأكد من حذف هذا الشخص؟',
    editPerson: 'تعديل',
    deletePerson: 'حذف',
    enterFirstName: 'يرجى إدخال الاسم الأول',
    boxWidth: 'عرض الصندوق',
    familyStats: 'أفراد العائلة',
    relationshipStats: 'العلاقات',
    spouse: 'زوج/زوجة',
    child: 'طفل', 
    parent: 'والد',
    sibling: 'شقيق',
    print: 'طباعة',
    share: 'مشاركة',
    calendar: 'التقويم',
    download: 'تنزيل',
    selectDownloadFormat: 'اختر تنسيق التنزيل لهذه العائلة:',
    readOnlyHTML: 'HTML للقراءة فقط (ملف واحد)',
    readOnlyHTMLDesc: 'للتصفح من القرص أو الإضافة إلى موقع ويب، مع واجهة تفاعلية للقراءة فقط.',
    gedcom: 'GEDCOM',
    gedcomDesc: 'تنسيق قياسي لبيانات الأنساب. لاستيراد البيانات في برامج الأنساب المختلفة.',
    csv: 'CSV (مفصولة بفواصل)',
    csvDesc: 'لاستيراد البيانات في جداول البيانات أو قواعد البيانات.',
    plainText: 'نص عادي',
    plainTextDesc: 'للعرض في معالجات النصوص مثل المفكرة و Word، أو الإرسال بالبريد الإلكتروني.',
    downloadBtn: 'تنزيل',
    done: 'تم'
  };

  // Authentication handlers
  const handleGoogleAuth = () => { setIsAuthenticated(true); setCurrentView('dashboard'); };
  const handleAppleAuth = () => { setIsAuthenticated(true); setCurrentView('dashboard'); };
  const handleUAEMobileAuth = () => { setIsAuthenticated(true); setCurrentView('dashboard'); };

  // --- AUTO-LAYOUT LOGIC ---
  // Compute generations and assign x/y positions for all people in the current tree
  const computeTreeLayout = (people, relationships) => {
    // Build maps for quick lookup
    const idToPerson = Object.fromEntries(people.map(p => [p.id, { ...p }]));
    const childrenMap = {};
    const parentMap = {};
    relationships.forEach(r => {
      if (r.type === REL.PARENT_CHILD) {
        if (!childrenMap[r.parentId]) childrenMap[r.parentId] = [];
        childrenMap[r.parentId].push(r.childId);
        parentMap[r.childId] = r.parentId;
      }
    });

    // Find root people (no parents)
    const roots = people.filter(p => !parentMap[p.id]);
    // Assign generation levels (BFS)
    const queue = [];
    roots.forEach(root => {
      idToPerson[root.id].generation = 0;
      queue.push(root.id);
    });
    while (queue.length) {
      const pid = queue.shift();
      const gen = idToPerson[pid].generation;
      (childrenMap[pid] || []).forEach(cid => {
        idToPerson[cid].generation = gen + 1;
        queue.push(cid);
      });
    }

    // Group by generation
    const genMap = {};
    Object.values(idToPerson).forEach(p => {
      if (!genMap[p.generation]) genMap[p.generation] = [];
      genMap[p.generation].push(p);
    });

    // Assign x/y positions for each generation (horizontal alignment)
    const verticalSpacing = 140;
    const horizontalSpacing = 180;
    Object.keys(genMap).forEach(g => {
      const gen = parseInt(g);
      const row = genMap[gen];
      row.forEach((p, i) => {
        p.x = 100 + i * horizontalSpacing;
        p.y = 100 + gen * verticalSpacing;
      });
    });

    // Return new people array with updated positions
    return people.map(p => ({ ...p, ...idToPerson[p.id] }));
  };

  // Use auto-layout for current tree
  const treePeople = computeTreeLayout(
    people.filter(p => p.treeId === currentTree?.id),
    relationships.filter(r => r.treeId === currentTree?.id)
  );
  // --- END AUTO-LAYOUT LOGIC ---

  // Tree management
  const createNewTree = () => {
    const newTree = { id: Date.now(), name: 'شجرة عائلتي', createdAt: new Date().toISOString() };
    setCurrentTree(newTree);
    setCurrentView('tree-builder');
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
    // For the first person, center them in the viewport
    if (!anchorPerson) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        return { 
          x: (rect.width / 2) - (CARD.w / 2), 
          y: (rect.height / 2) - (CARD.h / 2) 
        };
      }
      return { x: 400, y: 300 };
    }

    const horizontalSpacing = 200;
    const verticalSpacing = 160;
    const partnerSpacing = 160;
    const minDistance = 140;

    const hasCollision = (x, y, excludeId = null) => {
      return people.some(person => {
        if (person.id === excludeId || person.treeId !== currentTree?.id) return false;
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
          case 0: x = targetX + offset; y = targetY; break;
          case 1: x = targetX; y = targetY + offset; break;
          case 2: x = targetX - offset; y = targetY; break;
          case 3: x = targetX; y = targetY - offset; break;
        }
        attempts++;
      }

      return { x, y };
    };

    switch (relType) {
      case 'spouse':
        {
          const targetX = anchorPerson.x + CARD.w + partnerSpacing;
          const targetY = anchorPerson.y;
          return findNonCollidingPosition(targetX, targetY);
        }
      
      case 'child':
        {
          const existingChildren = relationships.filter(
            r => r.type === REL.PARENT_CHILD && r.parentId === anchorPerson.id && r.treeId === currentTree?.id
          );
          
          const partnerRel = relationships.find(
            r => r.type === REL.PARTNER && (r.person1Id === anchorPerson.id || r.person2Id === anchorPerson.id) && r.treeId === currentTree?.id
          );
          
          let baseX = anchorPerson.x;
          if (partnerRel) {
            const partnerId = partnerRel.person1Id === anchorPerson.id ? partnerRel.person2Id : partnerRel.person1Id;
            const partner = people.find(p => p.id === partnerId);
            if (partner) {
              const coupleCenter = (anchorPerson.x + CARD.w/2 + partner.x + CARD.w/2) / 2;
              baseX = coupleCenter - (existingChildren.length * horizontalSpacing / 2) - CARD.w/2;
            }
          } else {
            baseX = anchorPerson.x - (existingChildren.length * horizontalSpacing / 2);
          }
          
          const targetX = baseX + (existingChildren.length * horizontalSpacing);
          const targetY = anchorPerson.y + verticalSpacing;
          return findNonCollidingPosition(targetX, targetY);
        }
      
      case 'parent':
        {
          const targetX = anchorPerson.x;
          const targetY = anchorPerson.y - verticalSpacing;
          return findNonCollidingPosition(targetX, targetY);
        }
      
      case 'sibling':
        {
          const allSiblingRelations = relationships.filter(
            r => r.type === REL.SIBLING && (r.person1Id === anchorPerson.id || r.person2Id === anchorPerson.id) && r.treeId === currentTree?.id
          );
          
          const siblingIds = new Set([anchorPerson.id]);
          allSiblingRelations.forEach(rel => {
            siblingIds.add(rel.person1Id);
            siblingIds.add(rel.person2Id);
          });
          
          const siblings = Array.from(siblingIds)
            .map(id => people.find(p => p.id === id))
            .filter(p => p)
            .sort((a, b) => a.x - b.x);
          
          const targetY = anchorPerson.y;
          const rightmostSibling = siblings[siblings.length - 1];
          const targetX = rightmostSibling.x + horizontalSpacing;
          
          return findNonCollidingPosition(targetX, targetY);
        }
      
      default:
        {
          const targetX = anchorPerson.x + horizontalSpacing;
          const targetY = anchorPerson.y;
          return findNonCollidingPosition(targetX, targetY);
        }
    }
  };

  // Enhanced add person with smart gender defaults
  const addPerson = (personData) => {
    const anchorPerson = selectedPerson ? people.find(p => p.id === selectedPerson) : null;
    
    // Enforce spouse gender as female
    let finalPersonData = { ...personData };
    if (relationshipType === 'spouse') {
      finalPersonData.gender = 'female';
    }

    const position = calculatePosition(relationshipType, anchorPerson);

    const newPerson = {
      id: Date.now(),
      ...finalPersonData,
      x: position.x,
      y: position.y,
      treeId: currentTree?.id,
      isLiving: finalPersonData.isLiving !== false
    };

    setPeople(prev => [...prev, newPerson]);

    // Create relationships
    if (selectedPerson && relationshipType) {
      const newRelationship = { id: Date.now() + 1, treeId: currentTree?.id };

      switch (relationshipType) {
        case 'spouse':
          newRelationship.type = REL.PARTNER;
          newRelationship.person1Id = selectedPerson;
          newRelationship.person2Id = newPerson.id;
          break;
        case 'child':
          newRelationship.type = REL.PARENT_CHILD;
          newRelationship.parentId = selectedPerson;
          newRelationship.childId = newPerson.id;
          
          // Add relationship with spouse if exists
          const spouseRel = relationships.find(
            r => r.type === REL.PARTNER && 
            (r.person1Id === selectedPerson || r.person2Id === selectedPerson) && 
            r.treeId === currentTree?.id
          );
          
          if (spouseRel) {
            const spouseId = spouseRel.person1Id === selectedPerson ? spouseRel.person2Id : spouseRel.person1Id;
            const spouseChildRelationship = {
              id: Date.now() + 2,
              type: REL.PARENT_CHILD,
              parentId: spouseId,
              childId: newPerson.id,
              treeId: currentTree?.id
            };
            setRelationships(prev => [...prev, spouseChildRelationship]);
          }
          break;
        case 'parent':
          newRelationship.type = REL.PARENT_CHILD;
          newRelationship.parentId = newPerson.id;
          newRelationship.childId = selectedPerson;
          break;
        case 'sibling':
          newRelationship.type = REL.SIBLING;
          newRelationship.person1Id = selectedPerson;
          newRelationship.person2Id = newPerson.id;
          break;
      }

      setRelationships(prev => [...prev, newRelationship]);
    }

    // Auto-center on new person
    setTimeout(() => {
      centerOnPerson(newPerson);
    }, 100);

    setShowPersonForm(false);
    setRelationshipType(null);
    setEditingPerson(null);
    setSelectedPerson(newPerson.id);
  };

  // Update person
  const updatePerson = (personData) => {
    setPeople(prev => prev.map(p => 
      p.id === editingPerson ? { ...p, ...personData } : p
    ));
    setShowPersonForm(false);
    setEditingPerson(null);
  };

  // Delete person
  const deletePerson = (personId) => {
    if (window.confirm(t.deleteConfirm)) {
      setPeople(prev => prev.filter(p => p.id !== personId));
      setRelationships(prev => prev.filter(r => 
        r.person1Id !== personId && 
        r.person2Id !== personId && 
        r.parentId !== personId && 
        r.childId !== personId
      ));
      setSelectedPerson(null);
    }
  };

  // Enhanced pan handling with smooth dragging
  const handleMouseDown = (e) => {
    if (e.target === e.currentTarget) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragStartOffset({ ...panOffset });
      e.currentTarget.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setPanOffset({
        x: dragStartOffset.x + deltaX,
        y: dragStartOffset.y + deltaY
      });
    }
  };

  const handleMouseUp = (e) => {
    if (isDragging) {
      setIsDragging(false);
      e.currentTarget.style.cursor = 'grab';
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, dragStartOffset]);

  // Enhanced zoom with smooth controls
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.3, Math.min(3, prev * delta)));
  };

  // Zoom controls
  const zoomIn = () => setZoom(prev => Math.min(3, prev * 1.2));
  const zoomOut = () => setZoom(prev => Math.max(0.3, prev / 1.2));
  const resetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Enhanced export functionality
  const handleDownload = (format) => {
    const treeData = {
      people: people.filter(p => p.treeId === currentTree?.id),
      relationships: relationships.filter(r => r.treeId === currentTree?.id),
      tree: currentTree
    };

    switch (format) {
      case 'html':
        downloadAsHTML(treeData);
        break;
      case 'gedcom':
        downloadAsGEDCOM(treeData);
        break;
      case 'csv':
        downloadAsCSV(treeData);
        break;
      case 'plaintext':
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
    <title>${currentTree?.name || 'شجرة العائلة'}</title>
    <style>
        body { font-family: 'Sakkal Majalla', Arial, sans-serif; direction: rtl; }
        .person { border: 1px solid #ccc; padding: 10px; margin: 5px; display: inline-block; }
        .male { background-color: #bfdbfe; }
        .female { background-color: #fce7f3; }
    </style>
</head>
<body>
    <h1>${currentTree?.name || 'شجرة العائلة'}</h1>
    <div>
        ${treeData.people.map(person => `
            <div class="person ${person.gender}">
                <strong>${person.firstName} ${person.lastName || ''}</strong>
                ${person.birthDate ? `<br>تاريخ الميلاد: ${person.birthDate}` : ''}
                ${person.profession ? `<br>المهنة: ${person.profession}` : ''}
            </div>
        `).join('')}
    </div>
</body>
</html>`;
    
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTree?.name || 'family-tree'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsGEDCOM = (treeData) => {
    let gedcom = '0 HEAD\n1 SOUR UAE Roots\n1 GEDC\n2 VERS 5.5\n1 CHAR UTF-8\n';
    
    treeData.people.forEach((person, index) => {
      gedcom += `0 @I${index + 1}@ INDI\n`;
      gedcom += `1 NAME ${person.firstName} /${person.lastName || ''}/\n`;
      if (person.gender) gedcom += `1 SEX ${person.gender === 'male' ? 'M' : 'F'}\n`;
      if (person.birthDate) gedcom += `1 BIRT\n2 DATE ${person.birthDate}\n`;
      if (person.birthPlace) gedcom += `2 PLAC ${person.birthPlace}\n`;
    });
    
    gedcom += '0 TRLR\n';
    
    const blob = new Blob([gedcom], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTree?.name || 'family-tree'}.ged`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsCSV = (treeData) => {
    const headers = ['الاسم الأول', 'اسم العائلة', 'الجنس', 'تاريخ الميلاد', 'مكان الميلاد', 'المهنة', 'الهاتف', 'البريد الإلكتروني'];
    const csvContent = [
      headers.join(','),
      ...treeData.people.map(person => [
        person.firstName || '',
        person.lastName || '',
        person.gender === 'male' ? 'ذكر' : person.gender === 'female' ? 'أنثى' : '',
        person.birthDate || '',
        person.birthPlace || '',
        person.profession || '',
        person.phone || '',
        person.email || ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTree?.name || 'family-tree'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsPlainText = (treeData) => {
    const textContent = `${currentTree?.name || 'شجرة العائلة'}\n\n` +
      treeData.people.map(person => 
        `${person.firstName} ${person.lastName || ''}\n` +
        (person.birthDate ? `تاريخ الميلاد: ${person.birthDate}\n` : '') +
        (person.profession ? `المهنة: ${person.profession}\n` : '') +
        '\n'
      ).join('');
    
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTree?.name || 'family-tree'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Share functionality
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentTree?.name || 'شجرة العائلة',
          text: 'شاهد شجرة عائلتي على جذور الإمارات',
          url: window.location.href
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('تم نسخ الرابط إلى الحافظة');
    }
  };

  // Print functionality
  const handlePrint = () => {
    window.print();
  };

  // Calendar functionality
  const handleCalendar = () => {
    const events = people
      .filter(p => p.treeId === currentTree?.id && p.birthDate)
      .map(p => ({
        title: `عيد ميلاد ${p.firstName}`,
        date: p.birthDate
      }));
    
    // Create calendar data
    const calendarData = events.map(event => 
      `BEGIN:VEVENT\nSUMMARY:${event.title}\nDTSTART:${event.date.replace(/-/g, '')}\nEND:VEVENT`
    ).join('\n');
    
    const icalContent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:UAE Roots\n${calendarData}\nEND:VCALENDAR`;
    
    const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'family-events.ics';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get relationship icon
  const getRelationshipIcon = (type) => {
    switch (type) {
      case 'spouse': return <Heart className="w-4 h-4" />;
      case 'child': return <Baby className="w-4 h-4" />;
      case 'parent': return <Users className="w-4 h-4" />;
      case 'sibling': return <UserPlus className="w-4 h-4" />;
      default: return <UserPlus className="w-4 h-4" />;
    }
  };

  // Render connection lines
  const renderConnectionLines = () => {
    const lines = [];
    
    relationships.forEach(rel => {
      if (rel.treeId !== currentTree?.id) return;
      
      if (rel.type === REL.PARTNER) {
        const person1 = people.find(p => p.id === rel.person1Id);
        const person2 = people.find(p => p.id === rel.person2Id);
        
        if (person1 && person2) {
          const x1 = person1.x + CARD.w;
          const y1 = person1.y + CARD.h / 2;
          const x2 = person2.x;
          const y2 = person2.y + CARD.h / 2;
          
          lines.push(
            <line
              key={`partner-${rel.id}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#ef4444"
              strokeWidth="3"
            />
          );
        }
      }
      
      if (rel.type === REL.PARENT_CHILD) {
        const parent = people.find(p => p.id === rel.parentId);
        const child = people.find(p => p.id === rel.childId);
        
        if (parent && child) {
          const x1 = parent.x + CARD.w / 2;
          const y1 = parent.y + CARD.h;
          const x2 = child.x + CARD.w / 2;
          const y2 = child.y;
          
          lines.push(
            <line
              key={`parent-child-${rel.id}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#3b82f6"
              strokeWidth="2"
            />
          );
        }
      }
    });
    
    return lines;
  };

  // Authentication screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4 arabic-text text-center">
              مرحباً بكم في جذور الإمارات
            </h1>
            <div className="w-16 h-1 bg-purple-500 mx-auto rounded"></div>
          </div>
          
          <div className="space-y-4">
            <Button
              onClick={handleGoogleAuth}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg flex items-center justify-center gap-3"
            >
              <span className="text-2xl">📧</span>
              <span className="arabic-text">التسجيل عبر Gmail</span>
            </Button>
            
            <Button
              onClick={handleAppleAuth}
              className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-lg flex items-center justify-center gap-3"
            >
              <span className="text-2xl">🍎</span>
              <span className="arabic-text">التسجيل عبر Apple ID</span>
            </Button>
            
            <Button
              onClick={handleUAEMobileAuth}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg flex items-center justify-center gap-3"
            >
              <span className="text-2xl">🇦🇪</span>
              <span className="arabic-text">{t.uaeMobile}</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard view
  if (currentView === 'dashboard') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900 arabic-text">{t.dashboard}</h1>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4 arabic-text">{t.myFamilyTrees}</h3>
              {currentTree ? (
                <div className="space-y-3">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 arabic-text">{currentTree.name}</h4>
                    <div className="text-sm text-gray-500 mt-2 arabic-text">
                      <span>{people.filter(p => p.treeId === currentTree.id).length} {t.familyStats}</span>
                      <span className="mx-2">•</span>
                      <span>{relationships.filter(r => r.treeId === currentTree.id).length} {t.relationshipStats}</span>
                    </div>
                    <Button
                      onClick={() => setCurrentView('tree-builder')}
                      className="mt-3 w-full arabic-text"
                    >
                      {t.openFamilyTree}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4 arabic-text">{t.noFamilyTrees}</p>
                  <Button onClick={createNewTree} className="arabic-text">
                    {t.createNewTree}
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 arabic-text">{t.familyMembers}</h3>
              <div className="text-3xl font-bold text-blue-600">
                {people.filter(p => p.treeId === currentTree?.id).length}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 arabic-text">{t.relationships}</h3>
              <div className="text-3xl font-bold text-green-600">
                {relationships.filter(r => r.treeId === currentTree?.id).length}
              </div>
            </div>
          </div>

          {!currentTree && (
            <div className="mt-8 text-center">
              <p className="text-gray-600 mb-4 arabic-text">{t.createFirstTree}</p>
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
  if (currentView === 'tree-builder') {
    const treePeople = people.filter(p => p.treeId === currentTree?.id);
    
    return (
      <div className="h-screen bg-gray-100 overflow-hidden">
        {/* Header */}
        <div 
          className="bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center transition-all duration-300 ease-in-out"
          style={{ marginRight: showPersonForm ? '400px' : '0' }}
        >
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setCurrentView('dashboard')}
              variant="outline"
              size="sm"
              className="arabic-text"
            >
              <Home className="w-4 h-4 ml-2" />
              {t.backToDashboard}
            </Button>
            <h1 className="text-xl font-semibold text-gray-900 arabic-text">
              {currentTree?.name || t.familyTreeName}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 arabic-text">
              {treePeople.length} {t.familyStats} • {relationships.filter(r => r.treeId === currentTree?.id).length} {t.relationshipStats}
            </span>
          </div>
        </div>

        {/* Canvas */}
        <div 
          className="relative transition-all duration-300 ease-in-out"
          style={{ 
            marginRight: showPersonForm ? '400px' : '0',
            height: 'calc(100vh - 64px)' // Subtract header height
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
                transformOrigin: '0 0'
              }}
            >
            {/* Render connectors: spouses (thick), T for children, horizontal for siblings */}
            <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
              {/* Spouse lines */}
              {relationships.filter(r => r.type === REL.PARTNER && r.treeId === currentTree?.id).map((r, i) => {
                const p1 = treePeople.find(p => p.id === r.person1Id);
                const p2 = treePeople.find(p => p.id === r.person2Id);
                if (!p1 || !p2) return null;
                const y = (p1.y + p2.y) / 2 + CARD.h / 2;
                return (
                  <line
                    key={i}
                    x1={p1.x + stylingOptions.boxWidth}
                    y1={y}
                    x2={p2.x}
                    y2={y}
                    stroke="#4b5563"
                    strokeWidth={6}
                  />
                );
              })}
              {/* T-connector for children */}
              {relationships.filter(r => r.type === REL.PARENT_CHILD && r.treeId === currentTree?.id).map((r, i) => {
                const child = treePeople.find(p => p.id === r.childId);
                const parent = treePeople.find(p => p.id === r.parentId);
                if (!child || !parent) return null;
                // Find spouse of parent (if any)
                const spouseRel = relationships.find(
                  rel => rel.type === REL.PARTNER &&
                    (rel.person1Id === r.parentId || rel.person2Id === r.parentId) &&
                    rel.treeId === currentTree?.id
                );
                let spouse = null;
                if (spouseRel) {
                  spouse = treePeople.find(p => p.id === (spouseRel.person1Id === r.parentId ? spouseRel.person2Id : spouseRel.person1Id));
                }
                // T-connector: vertical from mid between parents to child
                const parentX = parent.x + stylingOptions.boxWidth / 2;
                const spouseX = spouse ? spouse.x + stylingOptions.boxWidth / 2 : parentX;
                const midX = spouse ? (parentX + spouseX) / 2 : parentX;
                const parentY = parent.y + CARD.h;
                const childY = child.y;
                return (
                  <g key={i}>
                    {/* Horizontal bar */}
                    {spouse && (
                      <line
                        x1={parentX}
                        y1={parentY + 10}
                        x2={spouseX}
                        y2={parentY + 10}
                        stroke="#4b5563"
                        strokeWidth={4}
                      />
                    )}
                    {/* Vertical bar */}
                    <line
                      x1={midX}
                      y1={parentY + 10}
                      x2={midX}
                      y2={childY}
                      stroke="#4b5563"
                      strokeWidth={4}
                    />
                  </g>
                );
              })}
              {/* Sibling horizontal lines */}
              {Object.values(treePeople.reduce((acc, p) => {
                // Group siblings by parent
                const parentRel = relationships.find(r => r.type === REL.PARENT_CHILD && r.childId === p.id && r.treeId === currentTree?.id);
                if (parentRel) {
                  const parentId = parentRel.parentId;
                  if (!acc[parentId]) acc[parentId] = [];
                  acc[parentId].push(p);
                }
                return acc;
              }, {})).map((siblings, i) => {
                if (siblings.length < 2) return null;
                // Draw horizontal line connecting all siblings
                const y = siblings[0].y;
                const minX = Math.min(...siblings.map(s => s.x + stylingOptions.boxWidth / 2));
                const maxX = Math.max(...siblings.map(s => s.x + stylingOptions.boxWidth / 2));
                return (
                  <line
                    key={i}
                    x1={minX}
                    y1={y}
                    x2={maxX}
                    y2={y}
                    stroke="#4b5563"
                    strokeWidth={3}
                  />
                );
              })}
            </svg>
            </svg>
            
            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                transformOrigin: '0 0'
              }}
            >
              {treePeople.map(person => (
                <div
                  key={person.id}
                  className={`absolute border-2 rounded-lg p-3 cursor-pointer transition-all duration-200 ${
                    selectedPerson === person.id 
                      ? 'border-green-500 shadow-lg' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  style={{
                    left: person.x,
                    top: person.y,
                    width: stylingOptions.boxWidth,
                    height: CARD.h,
                    backgroundColor: person.gender === 'male' 
                      ? stylingOptions.maleBoxColor 
                      : stylingOptions.femaleBoxColor,
                    fontSize: stylingOptions.textSize,
                    color: person.isLiving ? stylingOptions.livingTextColor : stylingOptions.deceasedTextColor,
                    zIndex: 10
                  }}
                  onClick={() => setSelectedPerson(person.id)}
                  // Drag-and-drop removed for auto-layout
                >
                  <div className="text-center h-full flex flex-col justify-center">
                    {displayOptions.showName && (
                      <div className="font-semibold truncate arabic-text">
                        {person.firstName}
                      </div>
                    )}
                    {displayOptions.showSurname && person.lastName && (
                      <div className="text-sm truncate arabic-text">
                        {person.lastName}
                      </div>
                    )}
                    {displayOptions.showBirthDate && person.birthDate && (
                      <div className="text-xs truncate">
                        {person.birthDate}
                      </div>
                    )}
                    {displayOptions.showProfession && person.profession && (
                      <div className="text-xs truncate arabic-text">
                        {person.profession}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add first person button */}
            {treePeople.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-gray-700 mb-4 arabic-text">
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
            <Button
              onClick={zoomIn}
              size="sm"
              className="w-10 h-10 p-0"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <div className="bg-white px-2 py-1 rounded text-sm font-medium text-center">
              {Math.round(zoom * 100)}%
            </div>
            <Button
              onClick={zoomOut}
              size="sm"
              className="w-10 h-10 p-0"
            >
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
              {treePeople.length > 0 && (
                <Button
                  onClick={() => {
                    setRelationshipType(null);
                    setEditingPerson(null);
                    setShowPersonForm(true);
                  }}
                  size="sm"
                  className="arabic-text"
                >
                  <UserPlus className="w-4 h-4 ml-1" />
                  {t.addPerson}
                </Button>
              )}
              
              <Button
                onClick={() => setShowOptions(true)}
                size="sm"
                variant="outline"
                className="arabic-text"
              >
                <Settings className="w-4 h-4 ml-1" />
                {t.options}
              </Button>
              
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

          {/* Relationship Controls */}
          {selectedPerson && treePeople.find(p => p.id === selectedPerson) && (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <div className="bg-white rounded-lg shadow-lg border p-3 space-y-2">
                <div className="text-sm font-medium text-gray-700 text-center arabic-text mb-3">
                  {treePeople.find(p => p.id === selectedPerson)?.firstName}
                </div>
                
                <Button
                  onClick={() => {
                    setRelationshipType('spouse');
                    setEditingPerson(null);
                    setShowPersonForm(true);
                  }}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start arabic-text"
                >
                  {getRelationshipIcon('spouse')}
                  <span className="mr-2">{t.addSpouse}</span>
                </Button>
                
                <Button
                  onClick={() => {
                    setRelationshipType('child');
                    setEditingPerson(null);
                    setShowPersonForm(true);
                  }}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start arabic-text"
                >
                  {getRelationshipIcon('child')}
                  <span className="mr-2">{t.addChild}</span>
                </Button>
                
                <Button
                  onClick={() => {
                    setRelationshipType('parent');
                    setEditingPerson(null);
                    setShowPersonForm(true);
                  }}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start arabic-text"
                >
                  {getRelationshipIcon('parent')}
                  <span className="mr-2">{t.addParent}</span>
                </Button>
                
                <Button
                  onClick={() => {
                    setRelationshipType('sibling');
                    setEditingPerson(null);
                    setShowPersonForm(true);
                  }}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start arabic-text"
                >
                  {getRelationshipIcon('sibling')}
                  <span className="mr-2">{t.addSibling}</span>
                </Button>
                
                <hr className="my-2" />
                
                <Button
                  onClick={() => {
                    setEditingPerson(selectedPerson);
                    setRelationshipType(null);
                    setShowPersonForm(true);
                  }}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start arabic-text"
                >
                  <Edit3 className="w-4 h-4" />
                  <span className="mr-2">{t.editPerson}</span>
                </Button>
                
                <Button
                  onClick={() => deletePerson(selectedPerson)}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start text-red-600 hover:text-red-700 arabic-text"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="mr-2">{t.deletePerson}</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Person Form Sidebar */}
        {showPersonForm && (
          <div className="fixed right-0 bg-white shadow-2xl border-l border-gray-200 z-40"
               style={{ 
                 width: '400px',
                 top: '64px', // Start below header
                 bottom: '0'
               }}>
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 arabic-text">
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
                  <p className="text-sm text-blue-700 text-center arabic-text">
                    {t.allFieldsOptional}
                  </p>
                </div>

                <PersonForm
                  person={editingPerson ? treePeople.find(p => p.id === editingPerson) : null}
                  onSave={editingPerson ? updatePerson : addPerson}
                  onCancel={() => {
                    setShowPersonForm(false);
                    setEditingPerson(null);
                    setRelationshipType(null);
                  }}
                  relationshipType={relationshipType}
                  anchorPerson={selectedPerson ? treePeople.find(p => p.id === selectedPerson) : null}
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
                  <h2 className="text-xl font-semibold text-gray-900 arabic-text">{t.options}</h2>
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
                    <h3 className="text-lg font-medium text-gray-900 mb-4 arabic-text">{t.displayOptions}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(displayOptions).map(([key, value]) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => setDisplayOptions(prev => ({
                              ...prev,
                              [key]: e.target.checked
                            }))}
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
                    <h3 className="text-lg font-medium text-gray-900 mb-4 arabic-text">{t.stylingOptions}</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-700 arabic-text">{t.maleBoxColor}</label>
                        <input
                          type="color"
                          value={stylingOptions.maleBoxColor}
                          onChange={(e) => setStylingOptions(prev => ({
                            ...prev,
                            maleBoxColor: e.target.value
                          }))}
                          className="w-8 h-8 rounded border"
                        />
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-700 arabic-text">{t.femaleBoxColor}</label>
                        <input
                          type="color"
                          value={stylingOptions.femaleBoxColor}
                          onChange={(e) => setStylingOptions(prev => ({
                            ...prev,
                            femaleBoxColor: e.target.value
                          }))}
                          className="w-8 h-8 rounded border"
                        />
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-700 arabic-text">{t.backgroundColor}</label>
                        <input
                          type="color"
                          value={stylingOptions.backgroundColor}
                          onChange={(e) => setStylingOptions(prev => ({
                            ...prev,
                            backgroundColor: e.target.value
                          }))}
                          className="w-8 h-8 rounded border"
                        />
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-700 arabic-text">{t.boxWidth}</label>
                        <input
                          type="range"
                          min="100"
                          max="200"
                          value={stylingOptions.boxWidth}
                          onChange={(e) => setStylingOptions(prev => ({
                            ...prev,
                            boxWidth: parseInt(e.target.value)
                          }))}
                          className="flex-1"
                        />
                        <span className="text-sm text-gray-600">{stylingOptions.boxWidth}px</span>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-700 arabic-text">{t.textSize}</label>
                        <input
                          type="range"
                          min="10"
                          max="20"
                          value={stylingOptions.textSize}
                          onChange={(e) => setStylingOptions(prev => ({
                            ...prev,
                            textSize: parseInt(e.target.value)
                          }))}
                          className="flex-1"
                        />
                        <span className="text-sm text-gray-600">{stylingOptions.textSize}px</span>
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
                  <h2 className="text-xl font-semibold text-gray-900 arabic-text">{t.download}</h2>
                  <Button
                    onClick={() => setShowDownloadModal(false)}
                    variant="ghost"
                    size="sm"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <p className="text-gray-600 mb-4 arabic-text">{t.selectDownloadFormat}</p>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="downloadFormat"
                      value="html"
                      checked={selectedDownloadFormat === 'html'}
                      onChange={(e) => setSelectedDownloadFormat(e.target.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900 arabic-text">{t.readOnlyHTML}</div>
                      <div className="text-sm text-gray-600 arabic-text">{t.readOnlyHTMLDesc}</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="downloadFormat"
                      value="gedcom"
                      checked={selectedDownloadFormat === 'gedcom'}
                      onChange={(e) => setSelectedDownloadFormat(e.target.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900 arabic-text">{t.gedcom}</div>
                      <div className="text-sm text-gray-600 arabic-text">{t.gedcomDesc}</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="downloadFormat"
                      value="csv"
                      checked={selectedDownloadFormat === 'csv'}
                      onChange={(e) => setSelectedDownloadFormat(e.target.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900 arabic-text">{t.csv}</div>
                      <div className="text-sm text-gray-600 arabic-text">{t.csvDesc}</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="downloadFormat"
                      value="plaintext"
                      checked={selectedDownloadFormat === 'plaintext'}
                      onChange={(e) => setSelectedDownloadFormat(e.target.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900 arabic-text">{t.plainText}</div>
                      <div className="text-sm text-gray-600 arabic-text">{t.plainTextDesc}</div>
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
function PersonForm({ person, onSave, onCancel, relationshipType, anchorPerson }) {
  const [activeTab, setActiveTab] = useState('personal');
  const [formData, setFormData] = useState({
    firstName: person?.firstName || '',
    lastName: person?.lastName || '',
    gender: person?.gender || (relationshipType === 'spouse' && anchorPerson ? 
      (anchorPerson.gender === 'male' ? 'female' : 'male') : ''),
    birthDate: person?.birthDate || '',
    birthPlace: person?.birthPlace || '',
    isLiving: person?.isLiving !== false,
    deathDate: person?.deathDate || '',
    phone: person?.phone || '',
    email: person?.email || '',
    address: person?.address || '',
    profession: person?.profession || '',
    company: person?.company || '',
    bioNotes: person?.bioNotes || ''
  });

  const t = {
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    gender: 'الجنس',
    male: 'ذكر',
    female: 'أنثى',
    birthDate: 'تاريخ الميلاد',
    birthPlace: 'مكان الميلاد',
    isLiving: 'على قيد الحياة',
    deathDate: 'تاريخ الوفاة',
    phone: 'الهاتف',
    email: 'البريد الإلكتروني',
    address: 'العنوان',
    profession: 'المهنة',
    company: 'الشركة',
    bioNotes: 'ملاحظات السيرة الذاتية',
    save: 'حفظ',
    cancel: 'إلغاء',
    update: 'تحديث',
    personal: 'البيانات الشخصية',
    contact: 'معلومات التواصل',
    biography: 'السيرة الذاتية'
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.firstName.trim()) {
      alert('يرجى إدخال الاسم الأول');
      return;
    }
    onSave(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const tabs = [
    { id: 'personal', label: t.personal, icon: '👤' },
    { id: 'contact', label: t.contact, icon: '📞' },
    { id: 'biography', label: t.biography, icon: '📝' }
  ];

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 text-sm font-medium text-center arabic-text ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'personal' && (
          <div className="space-y-3">
            {/* Personal Information */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 arabic-text">
                {t.firstName}
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
                dir="rtl"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 arabic-text">
                {t.lastName}
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
                dir="rtl"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 arabic-text">
              {t.gender}
            </label>
            <select
              value={formData.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
            >
              <option value="">اختر الجنس</option>
              <option value="male">{t.male}</option>
              <option value="female">{t.female}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 arabic-text">
              {t.birthDate}
            </label>
            <input
              type="date"
              value={formData.birthDate}
              onChange={(e) => handleChange('birthDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 arabic-text">
              {t.birthPlace}
            </label>
            <input
              type="text"
              value={formData.birthPlace}
              onChange={(e) => handleChange('birthPlace', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
              dir="rtl"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isLiving"
              checked={formData.isLiving}
              onChange={(e) => handleChange('isLiving', e.target.checked)}
              className="rounded"
            />
            <label htmlFor="isLiving" className="text-sm text-gray-700 arabic-text">
              {t.isLiving}
            </label>
          </div>

          {!formData.isLiving && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 arabic-text">
                {t.deathDate}
              </label>
              <input
                type="date"
                value={formData.deathDate}
                onChange={(e) => handleChange('deathDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="space-y-3">
            {/* Contact Information */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 arabic-text">
                  {t.phone}
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 arabic-text">
                  {t.email}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 arabic-text">
                {t.address}
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
                dir="rtl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 arabic-text">
                  {t.profession}
                </label>
                <input
                  type="text"
                  value={formData.profession}
                  onChange={(e) => handleChange('profession', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 arabic-text">
                  {t.company}
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => handleChange('company', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
                  dir="rtl"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'biography' && (
          <div className="space-y-3">
            {/* Biography */}
            <div>
              <h3 className="text-md font-medium text-gray-900 mb-2 arabic-text">{t.biography}</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 arabic-text">
                  {t.bioNotes}
                </label>
                <textarea
                  value={formData.bioNotes}
                  onChange={(e) => handleChange('bioNotes', e.target.value)}
                  rows={3}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 arabic-text"
                  dir="rtl"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 mt-4">
        <Button
          type="submit"
          className="arabic-text"
        >
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
