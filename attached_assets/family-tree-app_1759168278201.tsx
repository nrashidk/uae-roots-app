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

function App() {
  // Constants
  const CARD_WIDTH = 140;
  const CARD_HEIGHT = 90;

  // State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState("auth");
  const [currentTree, setCurrentTree] = useState(null);
  const [people, setPeople] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [relationshipType, setRelationshipType] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  // Display options
  const [displayOptions, setDisplayOptions] = useState({
    showName: true,
    showSurname: true,
    showBirthDate: false,
    showProfession: false,
  });

  // Styling options  
  const [stylingOptions, setStylingOptions] = useState({
    backgroundColor: "#f8fafc",
    maleBoxColor: "#bfdbfe",
    femaleBoxColor: "#fce7f3",
    boxWidth: 140,
    textSize: 14,
  });

  // Arabic translations
  const t = {
    welcome: "مرحباً بكم في جذور الإمارات",
    continueWithGoogle: "التسجيل عبر البريد الإلكتروني",
    continueWithApple: "التسجيل عبر الهوية الرقمية", 
    uaeMobile: "التسجيل عبر الهاتف الإماراتي",
    dashboard: "لوحة التحكم",
    myFamilyTrees: "أشجار عائلتي",
    createNewTree: "إنشاء شجرة جديدة",
    noFamilyTrees: "لا توجد أشجار عائلة بعد",
    addPerson: "إضافة شخص",
    startBuilding: "ابدأ ببناء شجرة عائلتك",
    addFirstMember: "أضف أول فرد من العائلة للبدء",
    personal: "البيانات الشخصية",
    contact: "معلومات التواصل",
    biography: "السيرة الذاتية",
    addFamilyMember: "إضافة فرد من العائلة",
    editFamilyMember: "تعديل فرد من العائلة",
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
    editPerson: "تعديل",
    deletePerson: "حذف",
    deleteConfirm: "هل أنت متأكد من حذف هذا الشخص؟",
    options: "خيارات",
    displayOptions: "خيارات العرض",
    stylingOptions: "خيارات التصميم",
    showNames: "إظهار الأسماء",
    showSurnames: "إظهار أسماء العائلة",
    showBirthDates: "إظهار تواريخ الميلاد",
    showProfessions: "إظهار المهن",
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
    familyStats: "أفراد العائلة",
    relationshipStats: "العلاقات",
    download: "تنزيل",
    print: "طباعة",
    share: "مشاركة",
    calendar: "التقويم",
  };

  // Get current tree people
  const treePeople = people.filter(p => p.treeId === currentTree?.id);
  const treeRelationships = relationships.filter(r => r.treeId === currentTree?.id);

  // Authentication handlers
  const handleAuth = () => {
    setIsAuthenticated(true);
    setCurrentView("dashboard");
  };

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

  // Calculate position for new person
  const calculatePosition = (relType, anchorPerson) => {
    if (!anchorPerson) {
      return { x: 400, y: 300 };
    }

    const spacing = 180;
    const verticalSpacing = 150;

    switch (relType) {
      case "spouse":
        return { x: anchorPerson.x + spacing, y: anchorPerson.y };
      case "child":
        return { x: anchorPerson.x, y: anchorPerson.y + verticalSpacing };
      case "parent":
        return { x: anchorPerson.x, y: anchorPerson.y - verticalSpacing };
      case "sibling":
        return { x: anchorPerson.x + spacing, y: anchorPerson.y };
      default:
        return { x: anchorPerson.x + spacing, y: anchorPerson.y };
    }
  };

  // Add/Update person
  const savePerson = (personData) => {
    if (editingPerson) {
      // Update existing person
      setPeople(prev => 
        prev.map(p => p.id === editingPerson ? { ...p, ...personData } : p)
      );
    } else {
      // Add new person
      const anchorPerson = selectedPerson ? 
        people.find(p => p.id === selectedPerson) : null;
      const position = calculatePosition(relationshipType, anchorPerson);
      
      const newPerson = {
        id: Date.now(),
        ...personData,
        x: position.x,
        y: position.y,
        treeId: currentTree?.id,
        isLiving: personData.isLiving !== false,
      };

      setPeople(prev => [...prev, newPerson]);

      // Create relationship if needed
      if (selectedPerson && relationshipType) {
        const newRel = {
          id: Date.now() + 1,
          treeId: currentTree?.id,
          type: relationshipType,
        };

        if (relationshipType === "spouse") {
          newRel.person1Id = selectedPerson;
          newRel.person2Id = newPerson.id;
        } else if (relationshipType === "child") {
          newRel.parentId = selectedPerson;
          newRel.childId = newPerson.id;
        } else if (relationshipType === "parent") {
          newRel.parentId = newPerson.id;
          newRel.childId = selectedPerson;
        } else if (relationshipType === "sibling") {
          newRel.person1Id = selectedPerson;
          newRel.person2Id = newPerson.id;
        }

        setRelationships(prev => [...prev, newRel]);
      }
    }

    setShowPersonForm(false);
    setEditingPerson(null);
    setRelationshipType(null);
  };

  // Delete person
  const deletePerson = (personId) => {
    if (window.confirm(t.deleteConfirm)) {
      setPeople(prev => prev.filter(p => p.id !== personId));
      setRelationships(prev => prev.filter(r => 
        r.person1Id !== personId && r.person2Id !== personId &&
        r.parentId !== personId && r.childId !== personId
      ));
      setSelectedPerson(null);
    }
  };

  // Pan and zoom handlers
  const handleMouseDown = (e) => {
    if (!e.target.closest("[data-person-box]") && !e.target.closest("button")) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

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

  // Draw connection lines
  const renderConnections = () => {
    const lines = [];

    // Spouse connections (horizontal red lines)
    treeRelationships
      .filter(r => r.type === "spouse")
      .forEach((rel, i) => {
        const p1 = treePeople.find(p => p.id === rel.person1Id);
        const p2 = treePeople.find(p => p.id === rel.person2Id);
        if (p1 && p2) {
          const leftPerson = p1.x < p2.x ? p1 : p2;
          const rightPerson = p1.x < p2.x ? p2 : p1;
          lines.push(
            <line
              key={`spouse-${i}`}
              x1={leftPerson.x + stylingOptions.boxWidth}
              y1={leftPerson.y + CARD_HEIGHT / 2}
              x2={rightPerson.x}
              y2={rightPerson.y + CARD_HEIGHT / 2}
              stroke="#dc2626"
              strokeWidth="3"
            />
          );
        }
      });

    // Parent-child connections (vertical green lines)
    treeRelationships
      .filter(r => r.type === "child")
      .forEach((rel, i) => {
        const parent = treePeople.find(p => p.id === rel.parentId);
        const child = treePeople.find(p => p.id === rel.childId);
        if (parent && child) {
          const parentX = parent.x + stylingOptions.boxWidth / 2;
          const parentY = parent.y + CARD_HEIGHT;
          const childX = child.x + stylingOptions.boxWidth / 2;
          const childY = child.y;

          // Check if parent has a spouse
          const spouseRel = treeRelationships.find(r => 
            r.type === "spouse" && 
            (r.person1Id === parent.id || r.person2Id === parent.id)
          );
          
          if (spouseRel) {
            const spouseId = spouseRel.person1Id === parent.id ? 
              spouseRel.person2Id : spouseRel.person1Id;
            const spouse = treePeople.find(p => p.id === spouseId);
            
            if (spouse) {
              const spouseX = spouse.x + stylingOptions.boxWidth / 2;
              const midX = (parentX + spouseX) / 2;
              
              // T-connector for couples with children
              lines.push(
                <g key={`parent-child-${i}`}>
                  <line
                    x1={Math.min(parentX, spouseX)}
                    y1={parentY + 20}
                    x2={Math.max(parentX, spouseX)}
                    y2={parentY + 20}
                    stroke="#059669"
                    strokeWidth="2"
                  />
                  <line
                    x1={midX}
                    y1={parentY + 20}
                    x2={midX}
                    y2={parentY + 40}
                    stroke="#059669"
                    strokeWidth="2"
                  />
                  <line
                    x1={midX}
                    y1={parentY + 40}
                    x2={childX}
                    y2={parentY + 40}
                    stroke="#059669"
                    strokeWidth="2"
                  />
                  <line
                    x1={childX}
                    y1={parentY + 40}
                    x2={childX}
                    y2={childY}
                    stroke="#059669"
                    strokeWidth="2"
                  />
                </g>
              );
            } else {
              // Single parent line
              lines.push(
                <line
                  key={`parent-child-${i}`}
                  x1={parentX}
                  y1={parentY}
                  x2={childX}
                  y2={childY}
                  stroke="#059669"
                  strokeWidth="2"
                />
              );
            }
          } else {
            // Single parent line
            lines.push(
              <line
                key={`parent-child-${i}`}
                x1={parentX}
                y1={parentY}
                x2={childX}
                y2={childY}
                stroke="#059669"
                strokeWidth="2"
              />
            );
          }
        }
      });

    // Sibling connections (purple dashed lines)
    treeRelationships
      .filter(r => r.type === "sibling")
      .forEach((rel, i) => {
        const p1 = treePeople.find(p => p.id === rel.person1Id);
        const p2 = treePeople.find(p => p.id === rel.person2Id);
        if (p1 && p2) {
          lines.push(
            <line
              key={`sibling-${i}`}
              x1={p1.x + stylingOptions.boxWidth / 2}
              y1={p1.y - 10}
              x2={p2.x + stylingOptions.boxWidth / 2}
              y2={p2.y - 10}
              stroke="#7c3aed"
              strokeWidth="2"
              strokeDasharray="5,3"
            />
          );
        }
      });

    return lines;
  };

  // Authentication screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-center mb-8 arabic-text">
            {t.welcome}
          </h1>
          <div className="space-y-4">
            <Button onClick={handleAuth} className="w-full bg-green-600 hover:bg-green-700">
              <Mail className="w-5 h-5 ml-2" />
              {t.continueWithGoogle}
            </Button>
            <Button onClick={handleAuth} className="w-full bg-black hover:bg-gray-800">
              <User className="w-5 h-5 ml-2" />
              {t.continueWithApple}
            </Button>
            <Button onClick={handleAuth} className="w-full bg-orange-500 hover:bg-orange-600">
              <Smartphone className="w-5 h-5 ml-2" />
              {t.uaeMobile}
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
        <div className="bg-white shadow-sm border-b p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold arabic-text">{t.dashboard}</h1>
            <Button onClick={() => setIsAuthenticated(false)} variant="outline">
              {t.logout}
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-4 arabic-text">{t.myFamilyTrees}</h3>
            {currentTree ? (
              <div className="border rounded-lg p-4">
                <h4 className="font-bold text-lg arabic-text">{currentTree.name}</h4>
                <div className="text-sm text-gray-500 mt-2">
                  {treePeople.length} {t.familyStats} • {treeRelationships.length} {t.relationshipStats}
                </div>
                <Button onClick={() => setCurrentView("tree-builder")} className="mt-3">
                  {t.openFamilyTree}
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">{t.noFamilyTrees}</p>
                <Button onClick={createNewTree}>{t.createNewTree}</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Tree builder view
  return (
    <div className="h-screen bg-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button onClick={() => setCurrentView("dashboard")} variant="outline" size="sm">
            <Home className="w-4 h-4 ml-2" />
            {t.backToDashboard}
          </Button>
          <h1 className="text-xl font-bold arabic-text">{currentTree?.name}</h1>
        </div>
        <div className="text-sm text-gray-600">
          {treePeople.length} {t.familyStats} • {treeRelationships.length} {t.relationshipStats}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative h-[calc(100vh-64px)]"
        style={{ backgroundColor: stylingOptions.backgroundColor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            position: "absolute",
            width: "100%",
            height: "100%",
            cursor: isDragging ? "grabbing" : "grab",
          }}
        >
          {/* Connection lines */}
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "5000px",
              height: "5000px",
              pointerEvents: "none",
            }}
          >
            {renderConnections()}
          </svg>

          {/* Person boxes */}
          {treePeople.map(person => (
            <div
              key={person.id}
              data-person-box
              className={`absolute border-2 rounded-lg p-2 cursor-pointer transition-all ${
                selectedPerson === person.id ? "border-blue-500 shadow-lg" : "border-gray-300"
              }`}
              style={{
                left: person.x,
                top: person.y,
                width: stylingOptions.boxWidth,
                height: CARD_HEIGHT,
                backgroundColor: person.gender === "male" ? 
                  stylingOptions.maleBoxColor : stylingOptions.femaleBoxColor,
                fontSize: stylingOptions.textSize,
              }}
              onClick={() => setSelectedPerson(person.id)}
              onDoubleClick={() => {
                setEditingPerson(person.id);
                setRelationshipType(null);
                setShowPersonForm(true);
              }}
            >
              <div className="h-full flex flex-col justify-center items-center text-center">
                {displayOptions.showName && (
                  <div className="font-bold arabic-text">{person.firstName}</div>
                )}
                {displayOptions.showSurname && person.lastName && (
                  <div className="text-sm arabic-text">{person.lastName}</div>
                )}
                {displayOptions.showBirthDate && person.birthDate && (
                  <div className="text-xs">{person.birthDate}</div>
                )}
                {displayOptions.showProfession && person.profession && (
                  <div className="text-xs arabic-text">{person.profession}</div>
                )}
              </div>
            </div>
          ))}

          {/* Action buttons for selected person */}
          {selectedPerson && treePeople.find(p => p.id === selectedPerson) && (
            <div
              className="absolute bg-white border rounded-lg shadow-lg p-2"
              style={{
                left: treePeople.find(p => p.id === selectedPerson).x,
                top: treePeople.find(p => p.id === selectedPerson).y + CARD_HEIGHT + 10,
                zIndex: 50,
              }}
            >
              <div className="flex gap-1">
                <Button
                  onClick={() => {
                    setEditingPerson(selectedPerson);
                    setRelationshipType(null);
                    setShowPersonForm(true);
                  }}
                  size="sm"
                  variant="ghost"
                  title={t.editPerson}
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => {
                    setRelationshipType("spouse");
                    setEditingPerson(null);
                    setShowPersonForm(true);
                  }}
                  size="sm"
                  variant="ghost"
                  title={t.addSpouse}
                >
                  <Heart className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => {
                    setRelationshipType("child");
                    setEditingPerson(null);
                    setShowPersonForm(true);
                  }}
                  size="sm"
                  variant="ghost"
                  title={t.addChild}
                >
                  <Baby className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => {
                    setRelationshipType("parent");
                    setEditingPerson(null);
                    setShowPersonForm(true);
                  }}
                  size="sm"
                  variant="ghost"
                  title={t.addParent}
                >
                  <Users className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => {
                    setRelationshipType("sibling");
                    setEditingPerson(null);
                    setShowPersonForm(true);
                  }}
                  size="sm"
                  variant="ghost"
                  title={t.addSibling}
                >
                  <UserPlus className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => deletePerson(selectedPerson)}
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  title={t.deletePerson}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Empty state */}
        {treePeople.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-700 mb-4 arabic-text">
                {t.startBuilding}
              </h2>
              <p className="text-gray-500 mb-6 arabic-text">{t.addFirstMember}</p>
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

        {/* Zoom controls */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2">
          <Button onClick={zoomIn} size="sm" className="w-10 h-10 p-0">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <div className="bg-white px-2 py-1 rounded text-sm text-center">
            {Math.round(zoom * 100)}%
          </div>
          <Button onClick={zoomOut} size="sm" className="w-10 h-10 p-0">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button onClick={resetView} size="sm" variant="outline" className="w-10 h-10 p-0">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Bottom toolbar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="bg-white rounded-lg shadow-lg border flex gap-2 px-4 py-2">
            {treePeople.length > 0 && (
              <Button
                onClick={() => {
                  setRelationshipType(null);
                  setEditingPerson(null);
                  setSelectedPerson(null);
                  setShowPersonForm(true);
                }}
                size="sm"
              >
                <UserPlus className="w-4 h-4 ml-1" />
                {t.addPerson}
              </Button>
            )}
            <Button
              onClick={() => alert("Options panel coming soon!")}
              size="sm"
              variant="outline"
            >
              <Settings className="w-4 h-4 ml-1" />
              {t.options}
            </Button>
          </div>
        </div>
      </div>

      {/* Person form sidebar */}
      {showPersonForm && (
        <PersonForm
          person={editingPerson ? treePeople.find(p => p.id === editingPerson) : null}
          onSave={savePerson}
          onCancel={() => {
            setShowPersonForm(false);
            setEditingPerson(null);
            setRelationshipType(null);
          }}
          t={t}
        />
      )}
    </div>
  );
}

// Person Form Component
function PersonForm({ person, onSave, onCancel, t }) {
  const [formData, setFormData] = useState({
    firstName: person?.firstName || "",
    lastName: person?.lastName || "",
    gender: person?.gender || "",
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

  const handleSubmit = () => {
    if (!formData.firstName.trim()) {
      alert("يرجى إدخال الاسم الأول");
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-white shadow-2xl z-50 flex flex-col">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold arabic-text">
            {person ? t.editFamilyMember : t.addFamilyMember}
          </h2>
          <Button onClick={onCancel} variant="ghost" size="sm">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 arabic-text">
                {t.firstName} *
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 arabic-text">
                {t.lastName}
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                dir="rtl"
              />
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium mb-1 arabic-text">
              {t.gender}
            </label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({...formData, gender: e.target.value})}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">اختر الجنس</option>
              <option value="male">{t.male}</option>
              <option value="female">{t.female}</option>
            </select>
          </div>

          {/* Birth info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 arabic-text">
                {t.birthDate}
              </label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 arabic-text">
                {t.birthPlace}
              </label>
              <input
                type="text"
                value={formData.birthPlace}
                onChange={(e) => setFormData({...formData, birthPlace: e.target.value})}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                dir="rtl"
              />
            </div>
          </div>

          {/* Living status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isLiving"
              checked={formData.isLiving}
              onChange={(e) => setFormData({...formData, isLiving: e.target.checked})}
              className="rounded"
            />
            <label htmlFor="isLiving" className="text-sm font-medium arabic-text">
              {t.isLiving}
            </label>
          </div>

          {/* Death date if not living */}
          {!formData.isLiving && (
            <div>
              <label className="block text-sm font-medium mb-1 arabic-text">
                {t.deathDate}
              </label>
              <input
                type="date"
                value={formData.deathDate}
                onChange={(e) => setFormData({...formData, deathDate: e.target.value})}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 arabic-text">
                {t.phone}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 arabic-text">
                {t.email}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                dir="ltr"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium mb-1 arabic-text">
              {t.address}
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              dir="rtl"
            />
          </div>

          {/* Professional info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 arabic-text">
                {t.profession}
              </label>
              <input
                type="text"
                value={formData.profession}
                onChange={(e) => setFormData({...formData, profession: e.target.value})}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 arabic-text">
                {t.company}
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({...formData, company: e.target.value})}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                dir="rtl"
              />
            </div>
          </div>

          {/* Bio notes */}
          <div>
            <label className="block text-sm font-medium mb-1 arabic-text">
              {t.bioNotes}
            </label>
            <textarea
              value={formData.bioNotes}
              onChange={(e) => setFormData({...formData, bioNotes: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              dir="rtl"
            />
          </div>
        </div>

        {/* Form actions */}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button onClick={handleSubmit}>{person ? t.update : t.save}</Button>
          <Button onClick={onCancel} variant="outline">
            {t.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default App;