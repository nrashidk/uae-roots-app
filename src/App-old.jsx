import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import './App.css'

// UAE Roots Family Tree Application - Complete React Application
function App() {
  // Card dimensions constants
  const CARD = {
    w: 120,
    h: 80
  };

  // Relationship type constants (single source of truth)
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
  const [familyViewFilter, setFamilyViewFilter] = useState('all'); // 'all', 'husband', 'wife'

  // COMPREHENSIVE DISPLAY OPTIONS (FamilyEcho-style)
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

  // STYLING OPTIONS
  const [stylingOptions, setStylingOptions] = useState({
    backgroundColor: '#f5f5dc',
    maleBoxColor: '#87ceeb',
    femaleBoxColor: '#ffb6c1',
    otherBoxColor: '#e6e6fa',
    livingTextColor: '#000000',
    deceasedTextColor: '#666666',
    boxWidth: 120,
    textSize: 12
  });

  // GENERATION DISPLAY OPTIONS
  const [generationOptions, setGenerationOptions] = useState({
    surnameDisplay: 'now', // 'now', 'before'
    givenNameDisplay: 'before', // 'before', 'after'
    leftPartner: 'female', // 'female', 'male'
    parentsGenerations: 5,
    childrenGenerations: 8,
    othersGenerations: 2
  });

  // CONNECTION LINE OPTIONS
  const [connectionOptions, setConnectionOptions] = useState({
    currentPartners: 'thick', // 'thick', 'medium', 'thin'
    otherPartners: 'medium',
    parents: 'medium',
    nonBiological: 'gray'
  });

  // Zoom & Pan
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const startOffsetRef = useRef({ x: 0, y: 0 });

  // Add global mouse event listeners for better drag functionality
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (!isPanningRef.current) return;
      
      e.preventDefault();
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPanOffset({ 
        x: startOffsetRef.current.x + dx, 
        y: startOffsetRef.current.y + dy 
      });
    };
    
    const handleGlobalMouseUp = (e) => { 
      if (isPanningRef.current) {
        e.preventDefault();
        isPanningRef.current = false;
        document.body.style.cursor = 'default';
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // Relationship intent when adding a person
  const [relationshipType, setRelationshipType] = useState(null);

  // Canvas ref for viewport calculations
  const canvasRef = useRef(null);

  // Arabic translations
  const t = {
    welcome: 'مرحباً بكم في جذور الإمارات',
    continueWithGoogle: 'المتابعة مع Google',
    continueWithApple: 'المتابعة مع Apple',
    uaeMobile: 'رقم الإمارات (+971)',
    dashboard: 'لوحة التحكم',
    myFamilyTrees: 'أشجار عائلتي',
    familyMembers: 'أفراد العائلة',
    relationships: 'العلاقات',
    createNewTree: 'إنشاء شجرة جديدة',
    noFamilyTrees: 'لا توجد أشجار عائلة بعد',
    createFirstTree: 'أنشئ شجرة عائلتك الأولى للبدء',
    backToDashboard: 'العودة إلى لوحة التحكم',
    addPerson: 'إضافة شخص',
    options: 'خيارات',
    print: 'طباعة',
    calendar: 'التقويم',
    share: 'مشاركة',
    startBuilding: 'ابدأ ببناء شجرة عائلتك',
    addFirstMember: 'أضف أول فرد من العائلة للبدء',
    personal: 'البيانات',
    partners: 'الشركاء',
    contact: 'معلومات التواصل',
    biography: 'السيرة الذاتية',
    addFamilyMember: 'إضافة فرد من العائلة',
    editFamilyMember: 'تعديل فرد من العائلة',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    arabicFirstName: 'الاسم الأول (عربي)',
    arabicLastName: 'اسم العائلة (عربي)',
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
    ok: 'موافق',
    addPartner: 'إضافة شريك',
    addParent: 'إضافة والد',
    addChild: 'إضافة طفل',
    addSibling: 'إضافة شقيق',
    // Options panel
    displayOptions: 'خيارات العرض',
    showNames: 'إظهار الأسماء',
    showBirthDates: 'إظهار تواريخ الميلاد',
    showBirthPlaces: 'إظهار أماكن الميلاد',
    colorOptions: 'خيارات الألوان',
    maleBoxColor: 'لون صندوق الذكر',
    femaleBoxColor: 'لون صندوق الأنثى',
    lineThickness: 'سماكة الخطوط',
    textSize: 'حجم النص',
    // Download functionality
    download: 'تنزيل',
    selectDownloadFormat: 'اختر تنسيق التنزيل لهذه العائلة:',
    readOnlyHTML: 'HTML للقراءة فقط (ملف واحد)',
    readOnlyHTMLDesc: 'للتصفح من القرص أو الإضافة إلى موقع ويب، مع واجهة تفاعلية للقراءة فقط.',
    gedcom: 'GEDCOM',
    gedcomDesc: 'تنسيق قياسي لبيانات الأنساب. لاستيراد البيانات في برامج الأنساب المختلفة.',
    familyScript: 'FamilyScript',
    familyScriptDesc: 'تنسيق أصلي للأشجار العائلية. لاستيراد البيانات في برامج تدعمه.',
    csv: 'CSV (مفصولة بفواصل)',
    csvDesc: 'لاستيراد البيانات في جداول البيانات أو قواعد البيانات.',
    plainText: 'نص عادي',
    plainTextDesc: 'للعرض في معالجات النصوص مثل المفكرة و Word، أو الإرسال بالبريد الإلكتروني.',
    downloadBtn: 'تنزيل',
    done: 'تم',
    familyView: 'عرض العائلة',
    showAllFamily: 'إظهار جميع أفراد العائلة',
    showHusbandFamily: 'إظهار عائلة الزوج',
    showWifeFamily: 'إظهار عائلة الزوجة'
  };

  // Authentication handlers (mock)
  const handleGoogleAuth = () => { setIsAuthenticated(true); setCurrentView('dashboard'); };
  const handleAppleAuth = () => { setIsAuthenticated(true); setCurrentView('dashboard'); };
  const handleUAEMobileAuth = () => { setIsAuthenticated(true); setCurrentView('dashboard'); };

  // Tree management
  const createNewTree = () => {
    const newTree = { id: Date.now(), name: 'شجرة عائلتي', createdAt: new Date().toISOString() };
    setCurrentTree(newTree);
    setCurrentView('tree-builder');
  };

  // Auto positioning for new relative with better spacing and collision detection
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

    const horizontalSpacing = 220; // Increased spacing to prevent overlap
    const verticalSpacing = 180;   // Increased vertical spacing between generations
    const partnerSpacing = 190;    // Space between partners
    const minDistance = 150;       // Minimum distance between any two cards
    const generationSpacing = 200; // Extra spacing between different generations

    // Helper function to check if a position conflicts with existing people
    const hasCollision = (x, y, excludeId = null) => {
      return people.some(person => {
        if (person.id === excludeId || person.treeId !== currentTree?.id) return false;
        const dx = Math.abs(person.x - x);
        const dy = Math.abs(person.y - y);
        return dx < minDistance && dy < minDistance;
      });
    };

    // Helper function to find a non-colliding position near the target
    const findNonCollidingPosition = (targetX, targetY, excludeId = null) => {
      let x = targetX;
      let y = targetY;
      let attempts = 0;
      const maxAttempts = 20;

      while (hasCollision(x, y, excludeId) && attempts < maxAttempts) {
        // Try different offsets in a spiral pattern
        const offset = Math.floor(attempts / 4) * 50 + 50;
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
      case REL.PARTNER:
        {
          // Position partner to the right with proper spacing
          const targetX = anchorPerson.x + CARD.w + partnerSpacing;
          const targetY = anchorPerson.y;
          return findNonCollidingPosition(targetX, targetY);
        }
      
      case REL.PARENT_CHILD: // adding as a child OF anchor
        {
          // Get existing children of this parent
          const existingChildren = relationships.filter(
            r => r.type === REL.PARENT_CHILD && r.parentId === anchorPerson.id && r.treeId === currentTree?.id
          );
          
          // Find partner to calculate couple center
          const partnerRel = relationships.find(
            r => r.type === REL.PARTNER && (r.person1Id === anchorPerson.id || r.person2Id === anchorPerson.id) && r.treeId === currentTree?.id
          );
          
          let baseX = anchorPerson.x;
          if (partnerRel) {
            const partnerId = partnerRel.person1Id === anchorPerson.id ? partnerRel.person2Id : partnerRel.person1Id;
            const partner = people.find(p => p.id === partnerId);
            if (partner) {
              // Center children under the couple
              const coupleCenter = (anchorPerson.x + CARD.w/2 + partner.x + CARD.w/2) / 2;
              baseX = coupleCenter - (existingChildren.length * horizontalSpacing / 2) - CARD.w/2;
            }
          } else {
            // Single parent - center children under parent
            baseX = anchorPerson.x - (existingChildren.length * horizontalSpacing / 2);
          }
          
          const targetX = baseX + (existingChildren.length * horizontalSpacing);
          const targetY = anchorPerson.y + generationSpacing;
          return findNonCollidingPosition(targetX, targetY);
        }
      
      case 'parent': // internal hint when user clicks "add parent"
        {
          // The anchor is the person whose parent we're adding
          const person = anchorPerson;
          const targetX = person.x; // keep same x as the child
          const targetY = person.y - generationSpacing; // one generation above
          return findNonCollidingPosition(targetX, targetY);
        }
      
      case REL.SIBLING:
        {
          // Get all siblings of the anchor person (including the anchor)
          const allSiblingRelations = relationships.filter(
            r => r.type === REL.SIBLING && (r.person1Id === anchorPerson.id || r.person2Id === anchorPerson.id) && r.treeId === currentTree?.id
          );
          
          // Get all sibling IDs including the anchor person
          const siblingIds = new Set([anchorPerson.id]);
          allSiblingRelations.forEach(rel => {
            siblingIds.add(rel.person1Id);
            siblingIds.add(rel.person2Id);
          });
          
          // Get all sibling persons and sort by x position to maintain order
          const siblings = Array.from(siblingIds)
            .map(id => people.find(p => p.id === id))
            .filter(p => p)
            .sort((a, b) => a.x - b.x);
          
          // Use the same Y position as existing siblings (horizontal alignment)
          const targetY = anchorPerson.y;
          
          // Position new sibling to the right of the rightmost sibling
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

  // Add a person + appropriate relationship
  const addPerson = (personData) => {
    const anchorPerson = selectedPerson ? people.find(p => p.id === selectedPerson) : null;
    // map UI click types to relationship constants
    const relIntent = relationshipType === 'child' ? REL.PARENT_CHILD : relationshipType;

    // Calculate position - ensure first person is centered
    let position;
    if (anchorPerson && relationshipType) {
      position = calculatePosition(relIntent, anchorPerson);
    } else {
      // First person or standalone - center in viewport
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        position = { 
          x: (rect.width / 2) - (CARD.w / 2), 
          y: (rect.height / 2) - (CARD.h / 2) 
        };
      } else {
        // Fallback to center of a standard viewport
        position = { 
          x: 600 - (CARD.w / 2), // Center horizontally 
          y: 400 - (CARD.h / 2)  // Center vertically
        };
      }
    }

    const newPerson = {
      id: Date.now(),
      ...personData,
      x: position.x,
      y: position.y,
      treeId: currentTree?.id,
      isLiving: personData.isLiving !== false
    };

    setPeople(prev => [...prev, newPerson]);

    // Create relationship if adding relative to an existing person
    if (selectedPerson && relationshipType) {
      const newRelationship = { id: Date.now() + 1, treeId: currentTree?.id };

      switch (relationshipType) {
        case 'partner':
          newRelationship.type = REL.PARTNER;
          newRelationship.person1Id = selectedPerson;
          newRelationship.person2Id = newPerson.id;
          break;
        case 'child':
          // Create parent-child relationship with the selected person
          newRelationship.type = REL.PARENT_CHILD;
          newRelationship.parentId = selectedPerson;
          newRelationship.childId = newPerson.id;
          
          // If the selected person has a spouse, also create a parent-child relationship with the spouse
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
          // Create parent-child relationship with the new person as parent
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

    setShowPersonForm(false);
    setRelationshipType(null);
    setEditingPerson(null);
  };

  // Delete person and their relationships
  const deletePerson = (personId) => {
    setPeople(prev => prev.filter(p => p.id !== personId));
    setRelationships(prev => prev.filter(r => 
      r.person1Id !== personId && 
      r.person2Id !== personId && 
      r.parentId !== personId && 
      r.childId !== personId
    ));
  };

  // Handle canvas mouse events for panning
  const handleCanvasMouseDown = (e) => {
    if (e.target === e.currentTarget) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      startOffsetRef.current = { ...panOffset };
      document.body.style.cursor = 'grabbing';
      e.preventDefault();
    }
  };

  // Handle zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(3, prev * delta)));
  };

  // Reset view
  const resetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Get filtered people based on family view
  const getFilteredPeople = () => {
    const filtered = people.filter(p => p.treeId === currentTree?.id);
    
    if (familyViewFilter === 'all') return filtered;
    
    // For husband/wife filtering, we'd need to implement logic to determine family sides
    // For now, return all people
    return filtered;
  };

  // Render authentication screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
              {t.welcome}
            </h1>
            <div className="w-16 h-1 bg-emerald-500 mx-auto rounded"></div>
          </div>
          
          <div className="space-y-4">
            <Button 
              onClick={handleGoogleAuth}
              className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-3 flex items-center justify-center space-x-3 space-x-reverse"
            >
              <span className="text-lg">🟢</span>
              <span style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>التسجيل من خلال Google</span>
            </Button>
            
            <Button 
              onClick={handleAppleAuth}
              className="w-full bg-black text-white hover:bg-gray-800 py-3 flex items-center justify-center space-x-3 space-x-reverse"
            >
              <span className="text-lg">🍎</span>
              <span style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>التسجيل من خلال Apple</span>
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>أو</span>
              </div>
            </div>
            
            <Button 
              onClick={handleUAEMobileAuth}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700 py-3 flex items-center justify-center space-x-3 space-x-reverse"
            >
              <span className="text-lg">🇦🇪</span>
              <span style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>التسجيل من خلال الهاتف</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render dashboard
  if (currentView === 'dashboard') {
    return (
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <h1 className="text-2xl font-bold text-gray-900" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
                {t.dashboard}
              </h1>
              <Button 
                onClick={() => setIsAuthenticated(false)}
                variant="outline"
              >
                تسجيل الخروج
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div 
                className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => currentTree && setCurrentView('tree-builder')}
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="mr-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
                          {t.myFamilyTrees}
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {currentTree ? 1 : 0}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div 
                className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => currentTree && setCurrentView('tree-builder')}
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <div className="mr-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
                          {t.familyMembers}
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {people.filter(p => p.treeId === currentTree?.id).length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div 
                className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => currentTree && setCurrentView('tree-builder')}
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <div className="mr-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
                          {t.relationships}
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {relationships.filter(r => r.treeId === currentTree?.id).length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                {currentTree ? (
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
                      {currentTree.name}
                    </h3>
                    <Button 
                      onClick={() => setCurrentView('tree-builder')}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      فتح شجرة العائلة
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
                      {t.noFamilyTrees}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
                      {t.createFirstTree}
                    </p>
                    <div className="mt-6">
                      <Button 
                        onClick={createNewTree}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {t.createNewTree}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Render tree builder
  return (
    <div className="h-screen flex flex-col bg-gray-100" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm border-b flex items-center justify-between px-4 py-2">
        <div className="flex items-center">
          <Button 
            onClick={() => setCurrentView('dashboard')}
            variant="outline"
            size="sm"
          >
            العودة إلى لوحة التحكم
          </Button>
        </div>
        
        <div className="flex-1 flex justify-center">
          <h1 className="text-xl font-semibold" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
            شجرة عائلتي
          </h1>
        </div>
        
        <div className="flex items-center space-x-2 space-x-reverse">
          <Button 
            onClick={() => window.print()}
            variant="outline"
            size="sm"
          >
            🖨️ طباعة
          </Button>
        </div>
      </header>

      {/* Add Person Button - Center of Page */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
        <Button 
          onClick={() => {
            setSelectedPerson(null);
            setRelationshipType(null);
            setEditingPerson(null);
            setShowPersonForm(true);
          }}
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 text-lg shadow-lg"
        >
          + إضافة شخص
        </Button>
      </div>

      {/* Options Button and Stats - Bottom Center */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center space-y-2">
        <Button 
          onClick={() => setShowOptions(!showOptions)}
          variant="outline"
          size="lg"
          className="bg-white shadow-lg px-6 py-3"
        >
          ⚙️ خيارات
        </Button>
        
        <div className="bg-white rounded-lg shadow-lg px-4 py-2 flex items-center space-x-4 space-x-reverse">
          <span className="text-sm text-gray-600" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
            {getFilteredPeople().length} أفراد العائلة
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-sm text-gray-600" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
            {relationships.filter(r => r.treeId === currentTree?.id).length} العلاقات
          </span>
        </div>
      </div>

      {/* Zoom Controls - Middle Left */}
      <div className="fixed left-6 top-1/2 transform -translate-y-1/2 z-20 flex flex-col space-y-2">
        <Button
          onClick={() => setZoom(prev => Math.min(prev * 1.2, 3))}
          variant="outline"
          size="lg"
          className="bg-white shadow-lg w-12 h-12 p-0"
        >
          +
        </Button>
        <div className="bg-white rounded-lg shadow-lg px-3 py-2 text-center">
          <span className="text-sm font-medium">{Math.round(zoom * 100)}%</span>
        </div>
        <Button
          onClick={() => setZoom(prev => Math.max(prev / 1.2, 0.3))}
          variant="outline"
          size="lg"
          className="bg-white shadow-lg w-12 h-12 p-0"
        >
          -
        </Button>
        <Button 
          onClick={resetView}
          variant="outline"
          size="sm"
          className="bg-white shadow-lg px-2 py-1 text-xs"
        >
          🔄
        </Button>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        <div 
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleCanvasMouseDown}
          onWheel={handleWheel}
          style={{
            transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            transformOrigin: '0 0',
            backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        >
          {/* Family Tree Canvas */}
          <div className="relative w-full h-full min-w-[2000px] min-h-[1500px]">
            {/* SVG for connection lines */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 1 }}
            >
              {/* Render relationship lines */}
              {relationships
                .filter(r => r.treeId === currentTree?.id)
                .map(relationship => {
                  const person1 = people.find(p => p.id === relationship.person1Id || p.id === relationship.parentId);
                  const person2 = people.find(p => p.id === relationship.person2Id || p.id === relationship.childId);
                  
                  if (!person1 || !person2) return null;
                  
                  const x1 = person1.x + CARD.w / 2;
                  const y1 = person1.y + CARD.h / 2;
                  const x2 = person2.x + CARD.w / 2;
                  const y2 = person2.y + CARD.h / 2;
                  
                  // Different line styles for different relationship types
                  let strokeWidth = 2;
                  let strokeColor = '#6b7280';
                  let strokeDasharray = 'none';
                  
                  switch (relationship.type) {
                    case REL.PARTNER:
                      strokeWidth = connectionOptions.currentPartners === 'thick' ? 3 : 
                                   connectionOptions.currentPartners === 'medium' ? 2 : 1;
                      strokeColor = '#dc2626'; // Red for partners
                      break;
                    case REL.PARENT_CHILD:
                      strokeWidth = connectionOptions.parents === 'thick' ? 3 : 
                                   connectionOptions.parents === 'medium' ? 2 : 1;
                      strokeColor = '#059669'; // Green for parent-child
                      break;
                    case REL.SIBLING:
                      strokeWidth = 2;
                      strokeColor = '#7c3aed'; // Purple for siblings
                      strokeDasharray = '5,5'; // Dashed line for siblings
                      break;
                  }
                  
                  // For parent-child relationships, use L-shaped lines
                  if (relationship.type === REL.PARENT_CHILD) {
                    const midY = y1 + (y2 - y1) / 2;
                    return (
                      <g key={relationship.id}>
                        <path
                          d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`}
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          fill="none"
                          strokeDasharray={strokeDasharray}
                        />
                      </g>
                    );
                  }
                  
                  // For other relationships, use straight lines
                  return (
                    <line
                      key={relationship.id}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDasharray}
                    />
                  );
                })}
            </svg>
            
            {getFilteredPeople().length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold text-gray-700 mb-2" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
                    {t.startBuilding}
                  </h2>
                  <p className="text-gray-500" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
                    {t.addFirstMember}
                  </p>
                </div>
              </div>
            ) : (
              getFilteredPeople().map(person => (
                <div
                  key={person.id}
                  className="absolute bg-white border-2 border-gray-300 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                  style={{
                    left: person.x,
                    top: person.y,
                    width: CARD.w,
                    height: CARD.h,
                    zIndex: 10,
                    backgroundColor: person.gender === 'male' ? stylingOptions.maleBoxColor : 
                                   person.gender === 'female' ? stylingOptions.femaleBoxColor : 
                                   stylingOptions.otherBoxColor
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPerson(person.id);
                  }}
                >
                  <div className="p-2 h-full flex flex-col justify-center">
                    <div className="text-center">
                      <div 
                        className="font-semibold text-sm truncate"
                        style={{
                          fontFamily: 'Sakkal Majalla, Arial, sans-serif',
                          fontSize: `${stylingOptions.textSize}px`,
                          color: person.isLiving ? stylingOptions.livingTextColor : stylingOptions.deceasedTextColor
                        }}
                      >
                        {displayOptions.showName && `${person.firstName} ${person.lastName}`}
                      </div>
                      {displayOptions.showBirthDate && person.birthDate && (
                        <div className="text-xs text-gray-600 truncate">
                          {person.birthDate}
                        </div>
                      )}
                      {displayOptions.showBirthPlace && person.birthPlace && (
                        <div className="text-xs text-gray-600 truncate">
                          {person.birthPlace}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Relationship buttons */}
                  {selectedPerson === person.id && (
                    <div className="absolute -bottom-8 left-0 right-0 flex justify-center space-x-1 space-x-reverse">
                      <Button
                        size="sm"
                        className="text-xs bg-blue-500 hover:bg-blue-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRelationshipType('partner');
                          setShowPersonForm(true);
                        }}
                      >
                        👫
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-green-500 hover:bg-green-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRelationshipType('child');
                          setShowPersonForm(true);
                        }}
                      >
                        👶
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-purple-500 hover:bg-purple-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRelationshipType('parent');
                          setShowPersonForm(true);
                        }}
                      >
                        👨‍👩‍👧‍👦
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-orange-500 hover:bg-orange-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRelationshipType('sibling');
                          setShowPersonForm(true);
                        }}
                      >
                        👫
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-gray-500 hover:bg-gray-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPerson(person);
                          setShowPersonForm(true);
                        }}
                      >
                        ✏️
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-red-500 hover:bg-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('هل أنت متأكد من حذف هذا الشخص؟')) {
                            deletePerson(person.id);
                            setSelectedPerson(null);
                          }
                        }}
                      >
                        🗑️
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Person Form Modal */}
      {showPersonForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <PersonForm
              person={editingPerson}
              onSave={addPerson}
              onCancel={() => {
                setShowPersonForm(false);
                setEditingPerson(null);
                setRelationshipType(null);
              }}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              t={t}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Person Form Component
function PersonForm({ person, onSave, onCancel, activeTab, setActiveTab, t }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: 'male',
    birthDate: '',
    birthPlace: '',
    isLiving: true,
    deathDate: '',
    phone: '',
    email: '',
    address: '',
    profession: '',
    company: '',
    bioNotes: '',
    ...person
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Only require firstName for form submission
    if (!formData.firstName.trim()) {
      alert('يرجى إدخال الاسم الأول على الأقل');
      return;
    }
    onSave(formData);
  };

  const tabs = [
    { id: 'personal', label: t.personal },
    { id: 'partners', label: t.partners },
    { id: 'contact', label: t.contact },
    { id: 'biography', label: t.biography }
  ];

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
          {person ? t.editFamilyMember : t.addFamilyMember}
        </h2>
        <Button 
          type="button"
          onClick={onCancel}
          variant="outline"
          size="sm"
        >
          ✕
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === tab.id
                ? 'border-b-2 border-emerald-500 text-emerald-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'personal' && (
        <div className="space-y-4">
          {/* First Name Field */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
              الاسم الأول (اختياري)
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="مثال: أحمد، فاطمة، محمد"
              dir="rtl"
            />
          </div>

          {/* Family Name Field */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
              اسم العائلة (اختياري)
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="مثال: الزعابي، المنصوري، الكعبي"
              dir="rtl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
              الجنس
            </label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
                تاريخ الميلاد (اختياري)
              </label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
                مكان الميلاد (اختياري)
              </label>
              <input
                type="text"
                value={formData.birthPlace}
                onChange={(e) => setFormData(prev => ({ ...prev, birthPlace: e.target.value }))}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="مثال: أبوظبي، دبي، الشارقة"
                dir="rtl"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <input
              type="checkbox"
              id="isLiving"
              checked={formData.isLiving}
              onChange={(e) => setFormData(prev => ({ ...prev, isLiving: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="isLiving" className="text-sm font-medium" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
              على قيد الحياة
            </label>
          </div>

          {!formData.isLiving && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
                تاريخ الوفاة (اختياري)
              </label>
              <input
                type="date"
                value={formData.deathDate}
                onChange={(e) => setFormData(prev => ({ ...prev, deathDate: e.target.value }))}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'partners' && (
        <div className="text-center py-8">
          <p className="text-gray-500" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
            سيتم إضافة إدارة الشركاء قريباً
          </p>
        </div>
      )}

      {activeTab === 'contact' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-700" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
              جميع معلومات التواصل اختيارية ويمكن إضافتها لاحقاً
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
              رقم الهاتف (اختياري)
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="مثال: +971501234567"
              dir="ltr"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
              البريد الإلكتروني (اختياري)
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="example@email.com"
              dir="ltr"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
              العنوان (اختياري)
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              rows="3"
              placeholder="مثال: أبوظبي، الإمارات العربية المتحدة"
              dir="rtl"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
                المهنة (اختياري)
              </label>
              <input
                type="text"
                value={formData.profession}
                onChange={(e) => setFormData(prev => ({ ...prev, profession: e.target.value }))}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="مثال: مهندس، طبيب، معلم"
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
                الشركة (اختياري)
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="مثال: أدنوك، طيران الإمارات، بنك الإمارات"
                dir="rtl"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'biography' && (
        <div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-purple-700" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
              السيرة الذاتية اختيارية ويمكن إضافة معلومات شخصية أو قصص عائلية
            </p>
          </div>
          
          <label className="block text-sm font-medium mb-1" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
            ملاحظات السيرة الذاتية (اختياري)
          </label>
          <textarea
            value={formData.bioNotes}
            onChange={(e) => setFormData(prev => ({ ...prev, bioNotes: e.target.value }))}
            className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            rows="8"
            placeholder="أضف معلومات عن الشخص مثل:
• الإنجازات والمساهمات
• القصص العائلية المهمة
• الهوايات والاهتمامات
• التعليم والخبرات
• أي معلومات أخرى مهمة للعائلة"
            dir="rtl"
          />
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-between items-center mt-6 pt-6 border-t">
        <div className="text-sm text-gray-600" style={{fontFamily: 'Sakkal Majalla, Arial, sans-serif'}}>
          جميع الحقول اختيارية
        </div>
        <div className="flex space-x-2 space-x-reverse">
          <Button 
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 px-6"
          >
            {person ? 'تحديث' : 'حفظ'}
          </Button>
          <Button 
            type="button"
            onClick={onCancel}
            variant="outline"
            className="px-6"
          >
            إلغاء
          </Button>
        </div>
      </div>
    </form>
  );
}

export default App
