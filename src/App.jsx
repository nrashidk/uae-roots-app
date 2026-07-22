import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
  useCallback,
} from "react";
import { Button } from "@/components/ui/button.jsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.jsx";
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
  MoveLeft,
  MoveRight,
  Loader2,
  Eye,
  EyeOff,
  LogOut,
} from "lucide-react";
import FamilyTreeLayout from "./lib/family-tree-layout.js";
import {
  convertToAlgorithmFormat,
  findRootPerson,
  addPersonWithRelationship,
} from "./lib/dataTransform.js";
import TreeCanvas from "./components/FamilyTree/TreeCanvas.jsx";
import { useAuth } from "./hooks/useAuth";
import { api, setAuthToken, clearAuthToken, getAuthToken } from "./lib/api.js";

function App() {
  const CARD = { w: 140, h: 90 };
  const REL = {
    PARTNER: "partner",
    PARENT_CHILD: "parent-child",
    SIBLING: "sibling",
  };

  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    loginWithGoogle,
    loginWithMicrosoft,
    loginWithEmail,
    signUpWithEmail,
    logout,
    deleteAccount,
  } = useAuth();
  const [authMode, setAuthMode] = useState("login");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [processingMethod, setProcessingMethod] = useState(null);
  // Any auth in progress (keeps all buttons disabled to prevent double-submit)
  const authProcessing = processingMethod !== null;
  // Shim so existing setAuthProcessing(false) calls still clear the state
  const setAuthProcessing = (val) =>
    setProcessingMethod(val ? "generic" : null);
  const [showSmsLogin, setShowSmsLogin] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [smsStep, setSmsStep] = useState("phone");
  const [smsError, setSmsError] = useState("");
  const [currentView, setCurrentView] = useState("auth");
  const [currentTree, setCurrentTree] = useState(null);
  const [people, setPeople] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  // Drives ONLY the green selection border. Kept separate from selectedPerson
  // (which drives the tree root/branch) so clearing the border on click-away
  // doesn't re-root/relocate the tree.
  const [highlightedPerson, setHighlightedPerson] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [relationshipType, setRelationshipType] = useState(null);
  const [formKey, setFormKey] = useState(0); // Key to force form remount
  const [pendingFatherId, setPendingFatherId] = useState(null);
  const [pendingMotherId, setPendingMotherId] = useState(null);
  // Slice 1: when adding a child to a parent with 2+ spouses, pick which spouse is the other parent
  const [motherPickerFor, setMotherPickerFor] = useState(null); // { parentId, candidates, pickLabel, helpText }
  const [chosenChildOtherParentId, setChosenChildOtherParentId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(null);
  const [isPinching, setIsPinching] = useState(false);
  const canvasRef = useRef(null);
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: 1200,
    height: 800,
  });
  const [showOptions, setShowOptions] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [userProfile, setUserProfile] = useState(null);

  // Default values for options
  const DEFAULT_DISPLAY_OPTIONS = {
    // showName: true,
    showSurname: true,
    showBirthDate: false,
    showBirthPlace: false,
    // showAge: false,
    showDeathDate: false,
    showProfession: false,
    showEmail: false,
    showTelephone: false,
  };

  const DEFAULT_STYLING_OPTIONS = {
    backgroundColor: "#f8fafc",
    maleBoxColor: "#e6f3ff",
    femaleBoxColor: "#ffe4e1",
    breastfedBoxColor: "#d1fae5",
    livingTextColor: "#000000",
    deceasedTextColor: "#6b7280",
    boxWidth: 140,
    textSize: 14,
    lineColor: "#8b8b8b",
  };

  const [displayOptions, setDisplayOptions] = useState(DEFAULT_DISPLAY_OPTIONS);
  const [stylingOptions, setStylingOptions] = useState(DEFAULT_STYLING_OPTIONS);

  // Reset options to default
  const handleResetOptions = () => {
    setDisplayOptions(DEFAULT_DISPLAY_OPTIONS);
    setStylingOptions(DEFAULT_STYLING_OPTIONS);
  };

  useEffect(() => {
    if (!showPersonForm) {
      setShowActionMenu(false);
    }
  }, [showPersonForm]);

  // Close any open person form when switching views (e.g. dashboard <-> tree),
  // so an edit form opened in Family Members doesn't linger on other screens.
  useEffect(() => {
    setShowPersonForm(false);
    setEditingPerson(null);
  }, [currentView]);

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

  const displayOptionLabels = {
    showName: "الاسم",
    showSurname: "اسم العائلة",
    showBirthDate: "تاريخ الميلاد",
    showBirthPlace: "مكان الميلاد",
    // showAge: "العمر",
    showDeathDate: "تاريخ الوفاة",
    showProfession: "المهنة",
    showEmail: "البريد الإلكتروني",
    showTelephone: "الهاتف",
  };

  const t = {
    welcome: "مرحباً بكم في جذور الإمارات",
    continueWithGoogle: "التسجيل عبر البريد الإلكتروني",
    continueWithApple: "التسجيل عبر الهوية الرقمية",
    uaeMobile: "الدخول عبر الهاتف الإماراتي",
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
    breastfed: "بالرضاعة",
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
    profile: "الملف الشخصي",
    profileSettings: "إعدادات الحساب",
    updateEmail: "تحديث البريد الإلكتروني",
    updatePhone: "تحديث رقم الهاتف",
    deleteAccount: "حذف الحساب",
    deleteAccountWarning: "تحذير: سيتم حذف جميع بياناتك وأشجار العائلة نهائياً",
    deleteAccountConfirm: "اكتب 'حذف' لتأكيد حذف الحساب",
    confirmDelete: "تأكيد الحذف",
    saving: "جاري الحفظ...",
    saved: "تم الحفظ",
    accountDeleted: "تم حذف الحساب",
    back: "رجوع",
    currentEmail: "البريد الإلكتروني الحالي",
    currentPhone: "رقم الهاتف الحالي",
    newEmail: "البريد الإلك �روني الجديد",
    newPhone: "رقم الهاتف الجديد",
    notSet: "غير محدد",
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

  // Track if session restoration has been attempted (persists across re-renders)
  const restorationAttemptedRef = useRef(false);
  // Track if an interactive login is in progress (prevents race with session restore)
  const interactiveLoginInProgressRef = useRef(false);
  const [sessionRestoreLoading, setSessionRestoreLoading] = useState(false);
  const [sessionRestoreError, setSessionRestoreError] = useState(null);

  // Cookie-based session restoration (for Phone SMS users who don't have Firebase sessions)
  // This runs when Firebase says NOT authenticated but a valid JWT cookie exists
  useEffect(() => {
    const restoreFromCookie = async () => {
      // Skip if Firebase says authenticated (Firebase-based restoration will handle it)
      if (isAuthenticated) {
        console.log("[Cookie Restore] Skipping - Firebase session exists");
        return;
      }

      // Wait for Firebase auth to finish loading first
      if (authLoading) {
        console.log("[Cookie Restore] Waiting for Firebase auth to finish...");
        return;
      }

      // Skip if tree already loaded
      if (currentTree) {
        console.log("[Cookie Restore] Skipping - tree already loaded");
        return;
      }

      // Skip if not on auth view (user navigated elsewhere)
      if (currentView !== "auth") {
        console.log("[Cookie Restore] Skipping - not on auth view");
        return;
      }

      // Skip if an interactive login is in progress
      if (interactiveLoginInProgressRef.current) {
        console.log(
          "[Cookie Restore] Skipping - interactive login in progress",
        );
        return;
      }

      // Prevent multiple restoration attempts
      if (restorationAttemptedRef.current) {
        console.log("[Cookie Restore] Already attempted");
        return;
      }

      console.log(
        "[Cookie Restore] Starting cookie-based restoration (non-Firebase user)...",
      );
      restorationAttemptedRef.current = true;
      setSessionRestoreLoading(true);
      setSessionRestoreError(null);

      try {
        // Check if backend cookie is still valid
        const backendAuth = await api.auth.check();
        console.log("[Cookie Restore] Backend auth check:", backendAuth);

        if (!backendAuth?.authenticated || !backendAuth?.userId) {
          console.log("[Cookie Restore] No valid backend session found");
          setSessionRestoreLoading(false);
          // Keep restorationAttemptedRef = true to prevent infinite loop
          // It will be reset on logout or when user successfully logs in
          return;
        }

        const resolvedUserId = backendAuth.userId;
        console.log(
          "[Cookie Restore] Found valid session for userId:",
          resolvedUserId,
        );

        // Store the resolved userId in sessionStorage
        setAuthToken(null, resolvedUserId);

        // Load user profile
        try {
          const savedUser = await api.users.get(resolvedUserId);
          console.log("[Cookie Restore] User profile loaded:", savedUser?.id);
          setUserProfile(savedUser);
        } catch (userError) {
          console.log(
            "[Cookie Restore] Could not load user profile:",
            userError.message,
          );
          // Continue anyway - user profile is optional for tree loading
        }

        // Load user's trees using the consolidated helper
        await loadUserTreeData(resolvedUserId);

        console.log(
          "[Cookie Restore] Session restored successfully from cookie!",
        );
        setSessionRestoreLoading(false);
      } catch (error) {
        console.error("[Cookie Restore] Failed to restore session:", error);
        setSessionRestoreError(
          "فشل استعادة الجلسة. يرجى تسجيل الدخول مرة أخرى.",
        );
        setSessionRestoreLoading(false);
        clearAuthToken();
        // Keep restorationAttemptedRef = true to prevent infinite loop
        // User will need to click login button to try again
      }
    };

    restoreFromCookie();
  }, [authLoading, isAuthenticated, currentTree, currentView]);

  // Robust session restoration when Firebase restores authentication
  useEffect(() => {
    const restoreSession = async () => {
      // Prevent multiple restoration attempts
      if (restorationAttemptedRef.current) return;

      // Skip if an interactive login is happening (handleAuthSuccess will handle it)
      if (interactiveLoginInProgressRef.current) return;

      // Wait for Firebase auth to finish loading
      if (authLoading) return;

      // Only proceed if authenticated but no tree loaded
      if (!isAuthenticated || !user || currentTree) {
        return;
      }

      // Mark as attempted immediately to prevent re-entry
      restorationAttemptedRef.current = true;
      setSessionRestoreLoading(true);
      setSessionRestoreError(null);
      console.log(
        "[Session Restore] Starting restoration for user:",
        user.uid || user.phoneNumber,
      );

      try {
        // Fallback userId from Firebase user
        const fallbackUserId = user.uid || user.phoneNumber || user.id;
        let resolvedUserId = fallbackUserId;

        // STEP 1: Check if backend cookie is still valid
        let backendAuth = null;
        try {
          backendAuth = await api.auth.check();
          console.log("[Session Restore] Backend auth check:", backendAuth);
        } catch (e) {
          console.log(
            "[Session Restore] Backend auth check failed:",
            e.message,
          );
        }

        // STEP 2: If backend cookie is valid, use that userId
        if (backendAuth?.authenticated && backendAuth?.userId) {
          resolvedUserId = backendAuth.userId;
          console.log(
            "[Session Restore] Using backend userId:",
            resolvedUserId,
          );
          setAuthToken(null, resolvedUserId);
        } else {
          // STEP 3: Backend cookie expired/missing - need to re-authenticate
          console.log(
            "[Session Restore] Backend cookie invalid, re-authenticating...",
          );

          // Check sessionStorage for cached resolvedUserId first
          const cachedAuth = getAuthToken();
          if (cachedAuth?.resolvedUserId) {
            resolvedUserId = cachedAuth.resolvedUserId;
            console.log(
              "[Session Restore] Using cached userId:",
              resolvedUserId,
            );
          }

          // Get fresh Firebase ID token (force refresh to avoid expired token)
          let firebaseIdToken = null;
          try {
            if (user.getIdToken) {
              firebaseIdToken = await user.getIdToken(true); // force refresh = true
              console.log("[Session Restore] Got fresh Firebase ID token");
            }
          } catch (tokenError) {
            console.error(
              "[Session Restore] Failed to get Firebase token:",
              tokenError,
            );
            // Continue with fallback userId - user may need to re-login
          }

          if (firebaseIdToken) {
            // Get backend JWT and resolved userId
            const provider =
              user.providerData?.[0]?.providerId ||
              (user.phoneNumber ? "phone" : "email");

            try {
              const tokenResponse = await api.auth.getToken(
                fallbackUserId,
                provider,
                firebaseIdToken,
                user.email,
              );

              if (tokenResponse.userId) {
                resolvedUserId = tokenResponse.userId;
              }
              console.log(
                "[Session Restore] Got new backend token, userId:",
                resolvedUserId,
              );

              // Store the resolved userId (not the JWT - that's in httpOnly cookie)
              setAuthToken(null, resolvedUserId);
            } catch (tokenErr) {
              console.error(
                "[Session Restore] Backend token request failed:",
                tokenErr,
              );
              // Continue with fallback/cached userId
            }
          }
        }

        // STEP 4: Create/update user record
        const provider =
          user.providerData?.[0]?.providerId ||
          (user.phoneNumber ? "phone" : "email");
        const savedUser = await api.users.createOrUpdate({
          id: resolvedUserId,
          email: user.email || null,
          displayName: user.displayName || null,
          phoneNumber: user.phoneNumber || null,
          provider: provider,
        });
        console.log("[Session Restore] User record updated:", savedUser);
        setUserProfile(savedUser);

        // STEP 5: Load user's trees using the RESOLVED userId (inline to avoid hoisting issues)
        console.log(
          "[Session Restore] Fetching trees for userId:",
          resolvedUserId,
        );
        const userTrees = await api.trees.getAll(resolvedUserId);
        console.log("[Session Restore] Found trees:", userTrees.length);

        if (userTrees.length > 0) {
          setCurrentTree(userTrees[0]);
          const treePeopleData = await api.people.getAll(userTrees[0].id);
          const treeRelData = await api.relationships.getAll(userTrees[0].id);
          setPeople(treePeopleData);
          setRelationships(treeRelData);
          console.log(
            "[Session Restore] Loaded tree:",
            userTrees[0].name,
            "with",
            treePeopleData.length,
            "people",
          );
        } else {
          console.log(
            "[Session Restore] No trees found, creating default tree",
          );
          const newTree = await api.trees.create({
            name: "شجرة عائلتي",
            description: "شجرة العائلة الأولى",
            createdBy: resolvedUserId,
          });
          setCurrentTree(newTree);
          setPeople([]);
          setRelationships([]);
        }

        setCurrentView("tree-builder");
        console.log("[Session Restore] Session restored successfully");
        setSessionRestoreLoading(false);
      } catch (error) {
        console.error("[Session Restore] Failed to restore session:", error);
        setSessionRestoreLoading(false);
        setSessionRestoreError(error.message || "فشل في استعادة الجلسة");
        // Clear auth state and log out so user can try again
        clearAuthToken();
        try {
          await logout();
        } catch (logoutErr) {
          console.error("[Session Restore] Logout failed:", logoutErr);
        }
        // Reset flag after logout so user can retry
        restorationAttemptedRef.current = false;
      }
    };

    restoreSession();
  }, [authLoading, isAuthenticated, user, currentTree, logout]);

  // Reset restoration flag when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      restorationAttemptedRef.current = false;
      clearAuthToken();
    }
  }, [isAuthenticated]);

  // Generate tree layout using the working algorithm
  // Only shows members connected to the root person in the tree visualization
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

    // Generate layout for main tree
    const layout = FamilyTreeLayout.generateLayout(familyData, rootPerson, {
      childDepth: 10,
      parentDepth: 10,
      siblingDepth: 10,
      flipLayout: false,
      displayOptions: {},
      markedPersonId:
        preferredRoot && familyData[preferredRoot] ? preferredRoot : null,
    });

    // Ensure layout structures exist to prevent runtime errors
    layout.e = layout.e || {};
    layout.n = layout.n || [];

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
        x: w / (2 * zoom) - px - BOX_WIDTH / 2,
        y: h / (2 * zoom) - py - BOX_HEIGHT / 2,
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

  // Calculate center offset for the tree (for reset functionality)
  const calculateCenterOffset = useCallback(() => {
    if (!treeLayout?.layout?.e) return { x: 0, y: 0 };

    const BOX_WIDTH = stylingOptions?.boxWidth || CARD.w;
    const BOX_HEIGHT = CARD.h;
    const entities = Object.values(treeLayout.layout.e);

    if (entities.length === 0) return { x: 0, y: 0 };

    // Find bounds of all entities
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    entities.forEach((entity) => {
      const x = entity.x * BOX_WIDTH;
      const y = entity.y * BOX_HEIGHT;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + BOX_WIDTH);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + BOX_HEIGHT);
    });

    // Calculate center of the tree
    const treeCenterX = (minX + maxX) / 2;
    const treeCenterY = (minY + maxY) / 2;

    // Calculate viewport center
    const viewportCenterX = canvasDimensions.width / 2;
    const viewportCenterY = canvasDimensions.height / 2;

    // Return offset to center the tree in viewport (accounting for zoom)
    return {
      x: viewportCenterX / zoom - treeCenterX,
      y: viewportCenterY / zoom - treeCenterY,
    };
  }, [treeLayout, stylingOptions, CARD, canvasDimensions, zoom]);

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

  // Center the tree when it first loads or when switching to tree-builder view
  const hasInitializedCenter = useRef(false);
  useEffect(() => {
    if (
      currentView === "tree-builder" &&
      treeLayout &&
      !hasInitializedCenter.current &&
      canvasDimensions.width > 0 &&
      canvasDimensions.height > 0
    ) {
      // Center the tree on initial load - use a small timeout to ensure layout is ready
      const timer = setTimeout(() => {
        setZoom(1); // Reset zoom to 1 for centered view
        // For single-entity layouts, autoPan handles centering, so keep panOffset at 0
        if (!isSingleLayout) {
          setPanOffset(calculateCenterOffset());
        } else {
          setPanOffset({ x: 0, y: 0 });
        }
        hasInitializedCenter.current = true;
      }, 0);
      return () => clearTimeout(timer);
    }
    // Reset flag when leaving tree-builder view
    if (currentView !== "tree-builder") {
      hasInitializedCenter.current = false;
    }
  }, [
    currentView,
    treeLayout,
    calculateCenterOffset,
    canvasDimensions,
    isSingleLayout,
  ]);

  // When a person is selected, the tree re-roots to reveal their branch (e.g.
  // clicking a spouse shows their side of the family). Recenter the view on that
  // person so they stay in view instead of flying off-screen. Only for
  // multi-entity layouts (single-entity is handled by autoPan).
  const lastCenteredPersonRef = useRef(null);
  const lastCenteredLayoutRef = useRef(null);
  useEffect(() => {
    if (!selectedPerson || isSingleLayout) {
      lastCenteredPersonRef.current = null;
      lastCenteredLayoutRef.current = null;
      return;
    }
    // Recenter when the selected person changes OR the layout reflows (e.g. after
    // a delete, the tree repacks and the rooted person moves). Manual dragging
    // changes panOffset — not treeLayout — so this never fights dragging.
    if (
      lastCenteredPersonRef.current === selectedPerson &&
      lastCenteredLayoutRef.current === treeLayout
    )
      return;
    const entity = treeLayout?.layout?.e?.[`P${selectedPerson}`];
    if (!entity || !canvasDimensions.width || !canvasDimensions.height) return;
    const BOX_WIDTH = stylingOptions?.boxWidth || CARD.w;
    const BOX_HEIGHT = CARD.h;
    const px = entity.x * BOX_WIDTH;
    const py = entity.y * BOX_HEIGHT;
    setPanOffset({
      x: canvasDimensions.width / 2 - (px + BOX_WIDTH / 2),
      y: canvasDimensions.height / 2 - (py + BOX_HEIGHT / 2),
    });
    lastCenteredPersonRef.current = selectedPerson;
    lastCenteredLayoutRef.current = treeLayout;
  }, [selectedPerson, treeLayout, isSingleLayout, canvasDimensions]);

  // Get people for the current tree
  const treePeople = useMemo(() => {
    return people.filter((p) => p.treeId === currentTree?.id);
  }, [people, currentTree?.id]);

  // The people actually shown as Family Members cards — tree people minus
  // legacy names-only milk-parent records (real people rows created before the
  // text-field pivot). Computed once here so the dashboard count and the
  // Family Members list can never disagree: both read this same set.
  const visibleFamilyMembers = useMemo(() => {
    const treeId = currentTree?.id;
    const milkRels = relationships.filter(
      (r) => r.treeId === treeId && r.type === "sibling" && r.isBreastfeeding,
    );
    // Anyone on either side of a milk-bond keeps their card.
    const milkPersonIds = new Set();
    milkRels.forEach((r) => {
      milkPersonIds.add(r.person1Id);
      milkPersonIds.add(r.person2Id);
    });
    // Incoming milk-relatives (person2) are the ones whose parents are
    // names-only records to be hidden.
    const milkRelativeIds = new Set();
    milkRels.forEach((r) => milkRelativeIds.add(r.person2Id));
    const milkParentIds = new Set();
    relationships
      .filter(
        (r) =>
          r.treeId === treeId &&
          r.type === "parent-child" &&
          milkRelativeIds.has(r.childId),
      )
      .forEach((r) => milkParentIds.add(r.parentId));
    // Hide milk-parents, but never hide someone who is themselves a milk-sibling.
    return treePeople.filter(
      (p) => !(milkParentIds.has(p.id) && !milkPersonIds.has(p.id)),
    );
  }, [treePeople, relationships, currentTree?.id]);

  // Organize the visible members into ORDERED FAMILY BLOCKS for the Family
  // Members page. Each block = a couple (or single parent) plus their UNMARRIED
  // children, children ordered by birthOrder (oldest first). A married person
  // leaves their parents' block and heads their own. Blocks are ordered
  // depth-first down the eldest line: a person's own block appears immediately
  // after the block they belong to as a child. Every visible person appears
  // exactly once. Reflows automatically when birthOrder changes.
  const familyGroups = useMemo(() => {
    const treeId = currentTree?.id;
    const visible = visibleFamilyMembers;
    const visibleIds = new Set(visible.map((p) => p.id));
    const byId = new Map(visible.map((p) => [p.id, p]));

    const rels = relationships.filter((r) => r.treeId === treeId);
    const partnerRels = rels.filter((r) => r.type === "partner");
    const parentChildRels = rels.filter((r) => r.type === "parent-child");

    // All spouses per person, in marriage order (relationship id ascending =
    // order the marriages were recorded, so first wife first).
    const spousesOf = new Map();
    [...partnerRels]
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
      .forEach((r) => {
        if (visibleIds.has(r.person1Id) && visibleIds.has(r.person2Id)) {
          if (!spousesOf.has(r.person1Id)) spousesOf.set(r.person1Id, []);
          if (!spousesOf.has(r.person2Id)) spousesOf.set(r.person2Id, []);
          spousesOf.get(r.person1Id).push(r.person2Id);
          spousesOf.get(r.person2Id).push(r.person1Id);
        }
      });
    // Convenience: first/primary spouse (kept for root-couple detection).
    const spouseOf = new Map();
    spousesOf.forEach((list, id) => {
      if (list.length > 0) spouseOf.set(id, list[0]);
    });
    const isMarried = (id) =>
      partnerRels.some((r) => r.person1Id === id || r.person2Id === id);

    // parent -> [childIds], and child -> [parentIds]
    const childrenOf = new Map();
    const parentsOf = new Map();
    parentChildRels.forEach((r) => {
      if (!childrenOf.has(r.parentId)) childrenOf.set(r.parentId, []);
      childrenOf.get(r.parentId).push(r.childId);
      if (!parentsOf.has(r.childId)) parentsOf.set(r.childId, []);
      parentsOf.get(r.childId).push(r.parentId);
    });

    // Milk-siblings: for each person, the visible people they're milk-bonded to.
    // A milk-sibling is rendered right AFTER the family block of the person they
    // are bonded to, so they stay adjacent to their bond no matter how the tree
    // grows.
    const milkSiblingsOf = new Map();
    rels
      .filter((r) => r.type === "sibling" && r.isBreastfeeding)
      .forEach((r) => {
        if (!visibleIds.has(r.person1Id) || !visibleIds.has(r.person2Id)) return;
        if (!milkSiblingsOf.has(r.person1Id)) milkSiblingsOf.set(r.person1Id, []);
        if (!milkSiblingsOf.has(r.person2Id)) milkSiblingsOf.set(r.person2Id, []);
        milkSiblingsOf.get(r.person1Id).push(r.person2Id);
        milkSiblingsOf.get(r.person2Id).push(r.person1Id);
      });

    // Oldest-first ordering. The reorder arrows assign YOUNGER children a
    // LOWER (more negative) birthOrder; the eldest/original child is null.
    // So oldest-first = null (unset original) first, then DESCENDING birthOrder.
    const bo = (id) => byId.get(id)?.birthOrder;
    const sortByBirth = (ids) =>
      [...ids].sort((a, b) => {
        const va = bo(a);
        const vb = bo(b);
        // null/undefined = oldest → sort first
        if (va == null && vb == null) return a - b;
        if (va == null) return -1;
        if (vb == null) return 1;
        // higher birthOrder = older → older first
        return vb - va || a - b;
      });

    const rendered = new Set();

    // Build one family block headed by `headId` (+ spouse if any).
    // Returns { key, heads:[personObjs], children:[personObjs] } or null.
    const buildBlock = (headId) => {
      if (rendered.has(headId) || !byId.has(headId)) return null;
      const head = byId.get(headId);
      rendered.add(headId);

      // Spouses of the head, in marriage order (first wife first).
      const spouseIds = (spousesOf.get(headId) || []).filter(
        (sid) => byId.has(sid) && !rendered.has(sid),
      );
      spouseIds.forEach((sid) => rendered.add(sid));

      // MALE FIRST: the block always reads husband, then wife — consistent with
      // the father-then-mother reading, regardless of which side the blood
      // descendant is on (the name chain already carries the lineage).
      const headIsMale = head.gender === "male";
      const maleFirstHead = headIsMale
        ? head
        : (spouseIds.map((s) => byId.get(s)).find((p) => p.gender === "male") ||
           head);
      const otherSpouseIds = headIsMale
        ? spouseIds
        : [
            ...(maleFirstHead.id !== head.id ? [head.id] : []),
            ...spouseIds.filter((s) => s !== maleFirstHead.id),
          ];

      const marriedChildren = [];
      const cards = [maleFirstHead];
      const takenKids = new Set();

      // Each spouse is immediately followed by HER OWN unmarried children, so
      // the maternal grouping is visually obvious:
      //   father, wife1, wife1's children, wife2, wife2's children
      const pushChildrenOf = (spouseId) => {
        const shared = (childrenOf.get(spouseId) || []).filter(
          (c) =>
            visibleIds.has(c) &&
            !takenKids.has(c) &&
            (childrenOf.get(maleFirstHead.id) || []).includes(c),
        );
        sortByBirth(shared).forEach((cid) => {
          takenKids.add(cid);
          if (isMarried(cid)) {
            marriedChildren.push(cid);
          } else if (!rendered.has(cid)) {
            rendered.add(cid);
            cards.push(byId.get(cid));
          }
        });
      };

      otherSpouseIds.forEach((sid, idx) => {
        if (!byId.has(sid)) return;
        const sp = byId.get(sid);
        // Mark wives from the SECOND onward: they start a new row and get a
        // «الزوجة الثانية/الثالثة…» label so their group is unmistakable.
        cards.push(
          idx > 0
            ? { ...sp, _spouseIndex: idx + 1, _startsNewRow: true }
            : sp,
        );
        pushChildrenOf(sid);
      });

      // Any remaining children of the head not attributed to a listed spouse.
      const leftoverKids = (childrenOf.get(maleFirstHead.id) || []).filter(
        (c) => visibleIds.has(c) && !takenKids.has(c),
      );
      sortByBirth(leftoverKids).forEach((cid) => {
        takenKids.add(cid);
        if (isMarried(cid)) {
          marriedChildren.push(cid);
        } else if (!rendered.has(cid)) {
          rendered.add(cid);
          cards.push(byId.get(cid));
        }
      });

      return {
        key: `fam-${headId}`,
        heads: [maleFirstHead],
        cards,
        _marriedChildren: marriedChildren,
      };
    };


    const groups = [];
    const emit = (headId) => {
      const block = buildBlock(headId);
      if (!block) return;
      const married = block._marriedChildren;
      delete block._marriedChildren;
      groups.push(block);

      // Render milk-siblings of this block's heads right after the block, so a
      // milk-sibling always sits next to the person they're bonded to. Only
      // milk-siblings who don't have their own family block (no children) get
      // pulled here; a milk-sibling who heads their own family keeps that block.
      (block.cards || block.heads).forEach((h) => {
        const ms = milkSiblingsOf.get(h.id) || [];
        sortByBirth(ms).forEach((mid) => {
          if (rendered.has(mid)) return;
          const hasOwnFamily =
            (childrenOf.get(mid) || []).some((c) => visibleIds.has(c)) ||
            spouseOf.get(mid) != null;
          if (hasOwnFamily) return; // will be emitted as its own block elsewhere
          rendered.add(mid);
          groups.push({ key: `milk-${mid}`, heads: [byId.get(mid)], children: [] });
        });
      });

      // Depth-first: each married child's own block immediately follows,
      // in birthOrder.
      married.forEach((cid) => emit(cid));
    };

    // ROOTS: the founding couples of the tree. A genuine root is a visible
    // person with NO visible parents who anchors a lineage — i.e. they (or
    // their spouse) have children. This deliberately EXCLUDES:
    //   - married-in spouses (they get pulled into their partner's block)
    //   - childless parentless people like off-tree milk-siblings (they fall
    //     to the safety-net leftovers at the end)
    // Prefer the MALE of a founding couple as the head (father-first reading).
    const hasVisibleParent = (id) =>
      (parentsOf.get(id) || []).some((pid) => visibleIds.has(pid));
    const hasVisibleChildren = (id) =>
      (childrenOf.get(id) || []).some((cid) => visibleIds.has(cid));

    // A person anchors a lineage if they, or their spouse, have children.
    const anchorsLineage = (id) => {
      if (hasVisibleChildren(id)) return true;
      const sp = spouseOf.get(id);
      return sp != null && hasVisibleChildren(sp);
    };

    // Candidate roots: parentless lineage-anchors whose SPOUSE is also
    // parentless. If the spouse HAS parents, this couple belongs under the
    // spouse's parents (reached by nesting), not as an independent root.
    const rawRoots = visible
      .filter((p) => {
        if (hasVisibleParent(p.id)) return false;
        if (!anchorsLineage(p.id)) return false;
        const sp = spouseOf.get(p.id);
        if (sp != null && hasVisibleParent(sp)) return false;
        return true;
      })
      .map((p) => p.id);

    const rootHeadIds = [];
    const fragmentHeadIds = [];
    const seenCouple = new Set();
    rawRoots.forEach((id) => {
      if (seenCouple.has(id)) return;
      const sp = spouseOf.get(id);
      if (sp != null && byId.has(sp)) {
        // A founding COUPLE (both parentless, they anchor the tree). Emit among
        // the primary founders. Choose male as head for father-first reading.
        const me = byId.get(id);
        const partner = byId.get(sp);
        const head = me.gender === "male"
          ? id
          : partner.gender === "male"
            ? sp
            : id;
        seenCouple.add(id);
        seenCouple.add(sp);
        if (!rootHeadIds.includes(head)) rootHeadIds.push(head);
      } else {
        // A LONE parentless parent — no spouse. This is typically an orphaned
        // fragment: e.g. a widowed in-law whose blood-linked spouse was deleted,
        // leaving them and their children disconnected from the founding tree.
        // These render AFTER the real founding families, not leading the page.
        seenCouple.add(id);
        fragmentHeadIds.push(id);
      }
    });

    // Order founding couples by the head's birthOrder (eldest lineage first).
    const orderedRoots = sortByBirth(rootHeadIds);

    orderedRoots.forEach((id) => {
      if (rendered.has(id)) return;
      emit(id);
    });

    // Then orphaned fragments (widowed in-law branches, etc.), after the real
    // founding families, ordered by birthOrder.
    sortByBirth(fragmentHeadIds).forEach((id) => {
      if (rendered.has(id)) return;
      emit(id);
    });

    // Safety net: any visible person not yet placed (e.g. off-tree milk-sibling
    // with no parent/partner links) gets their own single-card block at the end,
    // in birthOrder.
    const leftovers = sortByBirth(
      visible.filter((p) => !rendered.has(p.id)).map((p) => p.id),
    );
    leftovers.forEach((id) => {
      if (rendered.has(id)) return;
      rendered.add(id);
      groups.push({ key: `solo-${id}`, heads: [byId.get(id)], children: [] });
    });

    return groups;
  }, [visibleFamilyMembers, relationships, currentTree?.id]);
  const defaultSpouseGender = useMemo(() => {
    if (relationshipType !== "spouse" || editingPerson) return "";
    if (!selectedPerson) return "";

    const selected = treePeople.find((p) => p.id === selectedPerson);
    if (!selected) return "";
    if (selected.gender === "male") return "female";
    if (selected.gender === "female") return "male";
    return "";
  }, [relationshipType, editingPerson, selectedPerson, treePeople]);

  // Reusable helper to load user's trees and navigate to tree-builder
  const loadUserTreeData = async (resolvedUserId) => {
    console.log("[loadUserTreeData] Loading trees for userId:", resolvedUserId);
    const userTrees = await api.trees.getAll(resolvedUserId);
    console.log("[loadUserTreeData] Found trees:", userTrees.length);

    if (userTrees.length > 0) {
      setCurrentTree(userTrees[0]);
      const treePeopleData = await api.people.getAll(userTrees[0].id);
      const treeRelData = await api.relationships.getAll(userTrees[0].id);
      setPeople(treePeopleData);
      setRelationships(treeRelData);
      console.log(
        "[loadUserTreeData] Loaded tree:",
        userTrees[0].name,
        "with",
        treePeopleData.length,
        "people",
      );
    } else {
      console.log("[loadUserTreeData] No trees found, creating default tree");
      const newTree = await api.trees.create({
        name: "شجرة عائلتي",
        description: "شجرة العائلة الأولى",
        createdBy: resolvedUserId,
      });
      setCurrentTree(newTree);
      setPeople([]);
      setRelationships([]);
    }

    setCurrentView("tree-builder");
  };

  const handleAuthSuccess = async (phoneUser = null, authToken = null) => {
    try {
      const currentUser = phoneUser || user;
      console.log("handleAuthSuccess called with user:", currentUser);
      if (!currentUser) {
        console.error("No user found after auth success");
        return;
      }

      const userId =
        currentUser.uid || currentUser.phoneNumber || currentUser.id;
      console.log("Creating/updating user with ID:", userId);
      const provider =
        currentUser.providerData?.[0]?.providerId ||
        (currentUser.phoneNumber ? "phone" : "email");

      let resolvedUserId = userId;

      if (authToken) {
        // Phone login already has token - store with userId
        setAuthToken(authToken, userId);
      } else {
        // Firebase login - get fresh token with force refresh
        let firebaseIdToken = null;
        if (currentUser.getIdToken) {
          firebaseIdToken = await currentUser.getIdToken(true); // force refresh
        }
        const tokenResponse = await api.auth.getToken(
          userId,
          provider,
          firebaseIdToken,
          currentUser.email,
        );
        if (tokenResponse.userId) {
          resolvedUserId = tokenResponse.userId;
          console.log("Resolved to linked account:", resolvedUserId);
        }
        // Store token with resolved userId
        setAuthToken(tokenResponse.token, resolvedUserId);
      }

      console.log("[handleAuthSuccess] Calling createOrUpdate with:", { id: resolvedUserId, provider });
      const savedUser = await api.users.createOrUpdate({
        id: resolvedUserId,
        email: currentUser.email || null,
        displayName: currentUser.displayName || null,
        phoneNumber: currentUser.phoneNumber || null,
        provider: provider,
      });
      console.log("[handleAuthSuccess] User saved:", savedUser);
      setUserProfile(savedUser);

      console.log("[handleAuthSuccess] Loading tree data...");
      await loadUserTreeData(resolvedUserId);
      console.log("[handleAuthSuccess] Complete!");
    } catch (err) {
      console.error("[handleAuthSuccess] Error:", err);
      console.error("[handleAuthSuccess] Error stack:", err.stack);
      alert("خطأ أثناء تسجيل الدخول: " + err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      interactiveLoginInProgressRef.current = true;
      restorationAttemptedRef.current = true;
      setProcessingMethod("google");
      const loggedInUser = await loginWithGoogle();
      await handleAuthSuccess(loggedInUser);
    } catch (err) {
      console.error("Google login failed:", err);
    } finally {
      setAuthProcessing(false);
      interactiveLoginInProgressRef.current = false;
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      interactiveLoginInProgressRef.current = true;
      restorationAttemptedRef.current = true;
      setProcessingMethod("microsoft");
      const loggedInUser = await loginWithMicrosoft();
      await handleAuthSuccess(loggedInUser);
    } catch (err) {
      console.error("Microsoft login failed:", err);
    } finally {
      setAuthProcessing(false);
      interactiveLoginInProgressRef.current = false;
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) return;

    try {
      interactiveLoginInProgressRef.current = true;
      restorationAttemptedRef.current = true;
      setProcessingMethod("email");
      let loggedInUser;
      if (authMode === "login") {
        loggedInUser = await loginWithEmail(emailInput, passwordInput);
      } else {
        loggedInUser = await signUpWithEmail(emailInput, passwordInput);
      }
      await handleAuthSuccess(loggedInUser);
    } catch (err) {
      console.error("Email auth failed:", err);
    } finally {
      setAuthProcessing(false);
      interactiveLoginInProgressRef.current = false;
    }
  };

  const handleLogout = async () => {
    try {
      // Call backend logout API to clear httpOnly cookie
      try {
        await api.auth.logout();
      } catch (apiErr) {
        console.error("Backend logout failed:", apiErr);
        // Continue with frontend logout even if backend fails
      }

      // Sign out from Firebase
      await logout();

      // Clear frontend auth state
      clearAuthToken();
      setCurrentTree(null);
      setPeople([]);
      setRelationships([]);
      setUserProfile(null);
      setCurrentView("auth");

      // Reset restoration flag so it can run again on next login
      restorationAttemptedRef.current = false;
      setSessionRestoreError(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleOpenProfile = () => {
    setProfileEmail(userProfile?.email || user?.email || "");
    setProfilePhone(userProfile?.phoneNumber || "");
    setShowProfile(true);
    setShowDeleteConfirm(false);
    setDeleteConfirmText("");
    setProfileMessage("");
  };

  const handleSaveProfile = async () => {
    const userId = userProfile?.id || user?.uid;
    if (!userId) return;
    try {
      setProfileSaving(true);
      setProfileMessage("");
      const updatedUser = await api.users.update(userId, {
        email: profileEmail || null,
        phoneNumber: profilePhone || null,
        displayName: userProfile?.displayName || user?.displayName || null,
      });
      setUserProfile(updatedUser);
      setProfileMessage("تم حفظ التغييرات بنجاح");
      setTimeout(() => {
        setShowProfile(false);
        setProfileMessage("");
      }, 1500);
    } catch (err) {
      console.error("Profile save error:", err);
      setProfileMessage("فشل في حفظ التغييرات");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const userId = userProfile?.id || user?.uid;
    if (!userId || deleteConfirmText !== "حذف") return;
    try {
      setProfileSaving(true);
      await api.users.delete(userId);
      try {
        await deleteAccount();
      } catch (authErr) {
        if (authErr.code === "auth/requires-recent-login") {
          alert(
            "يرجى تسجيل الخروج وإعادة تسجيل الدخول ثم المحاولة مرة أخرى لحذف حساب Firebase",
          );
        }
        console.error("Firebase delete error (non-blocking):", authErr);
      }
      setCurrentTree(null);
      setPeople([]);
      setRelationships([]);
      setUserProfile(null);
      setCurrentView("auth");
      setShowProfile(false);
    } catch (err) {
      console.error("Account delete error:", err);
      setProfileMessage("فشل في حذف الحساب");
    } finally {
      setProfileSaving(false);
    }
  };

  const renderProfileDialog = () => {
    const isPhoneUser = userProfile?.provider === "phone";

    return (
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">
              {t.profileSettings}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4" dir="rtl">
            {isPhoneUser ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  {t.currentPhone}
                </label>
                <input
                  type="tel"
                  value={profilePhone}
                  readOnly
                  className="w-full px-3 py-2 border rounded-lg text-right bg-gray-100"
                  dir="ltr"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  {t.currentEmail}
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  readOnly
                  className="w-full px-3 py-2 border rounded-lg text-right bg-gray-100"
                />
              </div>
            )}

            {profileMessage && (
              <div
                className={`p-3 rounded-lg text-center text-sm ${profileMessage.includes("نجاح") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
              >
                {profileMessage}
              </div>
            )}

            <div className="flex justify-center">
              <Button onClick={() => setShowProfile(false)} variant="outline">
                {t.back}
              </Button>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="space-y-3">
                {!showDeleteConfirm ? (
                  <Button
                    onClick={() => setShowDeleteConfirm(true)}
                    variant="destructive"
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 ml-2" />
                    {t.deleteAccount}
                  </Button>
                ) : (
                  <div className="space-y-3 p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-red-600 text-sm">
                      {t.deleteAccountWarning}
                    </p>
                    <p className="text-sm">{t.deleteAccountConfirm}</p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="حذف"
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-right"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== "حذف" || profileSaving}
                        variant="destructive"
                        className="flex-1"
                      >
                        {t.confirmDelete}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText("");
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        {t.cancel}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const handleSendSmsCode = async () => {
    if (!phoneInput) {
      setSmsError("الرجاء إدخال رقم الهاتف");
      return;
    }

    try {
      setProcessingMethod("phone");
      setSmsError("");

      const response = await fetch("/api/sms/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phoneNumber: phoneInput }),
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || "خطأ غير متوقع من الخادم" };
      }

      if (!response.ok) {
        throw new Error(data.error || "فشل إرسال رمز التحقق");
      }

      setSmsStep("code");
    } catch (err) {
      setSmsError(err.message);
    } finally {
      setAuthProcessing(false);
    }
  };

  const handleVerifySmsCode = async () => {
    if (!smsCode) {
      setSmsError("الرجاء إدخال رمز التحقق");
      return;
    }

    try {
      interactiveLoginInProgressRef.current = true;
      restorationAttemptedRef.current = true;
      setProcessingMethod("code");
      setSmsError("");

      const response = await fetch("/api/sms/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phoneNumber: phoneInput, code: smsCode }),
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || "خطأ غير متوقع من الخادم" };
      }

      if (!response.ok) {
        throw new Error(data.error || "رمز التحقق غير صحيح");
      }

      if (data.verified) {
        const normalizePhoneClient = (phone) => {
          if (!phone) return null;
          let formatted = phone.trim();
          if (formatted.startsWith("00971")) {
            return "+971" + formatted.slice(5);
          } else if (
            formatted.startsWith("971") &&
            !formatted.startsWith("+")
          ) {
            return "+" + formatted;
          } else if (!formatted.startsWith("+")) {
            return "+971" + formatted.replace(/^0/, "");
          }
          return formatted;
        };
        const formattedPhone = normalizePhoneClient(phoneInput);
        const resolvedUserId = data.userId || formattedPhone;
        const phoneUser = {
          uid: resolvedUserId,
          phoneNumber: formattedPhone,
          displayName: null,
          email: null,
        };
        setShowSmsLogin(false);
        setSmsStep("phone");
        setPhoneInput("");
        setSmsCode("");
        await handleAuthSuccess(phoneUser, data.token);
      }
    } catch (err) {
      setSmsError(err.message);
    } finally {
      setAuthProcessing(false);
      interactiveLoginInProgressRef.current = false;
    }
  };

  // Add person using the data transformation utility
  const addPerson = async (personData) => {
    // Remember which person we're adding relative to, so after adding we keep the
    // tree rooted on that branch instead of jumping back to the natural root.
    const anchorPerson = selectedPerson;
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

    try {
      // Create person via API
      console.log("=== ADDING PERSON ===");
      console.log("Person data:", personData);
      console.log("Relationship type:", relationshipType);
      console.log("Selected person:", selectedPerson);
      console.log("Tree ID:", currentTree?.id);

      // Compute a far-left birthOrder for a new child BEFORE creating it,
      // so we can set it in the create call (no mid-flow await that would
      // split setRelationships/setPeople and crash the layout mid-render).
      let childBirthOrder = null;
      if (relationshipType === "child" && selectedPerson) {
        const sibIds = relationships
          .filter(
            (r) => r.type === "parent-child" && r.parentId === selectedPerson,
          )
          .map((r) => r.childId);
        const sibOrders = people
          .filter((p) => sibIds.includes(p.id) && p.birthOrder != null)
          .map((p) => p.birthOrder);
        childBirthOrder =
          sibOrders.length > 0 ? Math.min(...sibOrders) - 1 : 1;
      } else if (relationshipType === "sibling" && selectedPerson) {
        // A new sibling shares the clicked person's parents; its sibling group
        // is the children of those parents. Land it far-left too (consistent with add-child).
        const parentIds = relationships
          .filter(
            (r) => r.type === "parent-child" && r.childId === selectedPerson,
          )
          .map((r) => r.parentId);
        const sibIds = relationships
          .filter(
            (r) =>
              r.type === "parent-child" && parentIds.includes(r.parentId),
          )
          .map((r) => r.childId);
        const sibOrders = people
          .filter((p) => sibIds.includes(p.id) && p.birthOrder != null)
          .map((p) => p.birthOrder);
        childBirthOrder =
          sibOrders.length > 0 ? Math.min(...sibOrders) - 1 : 1;
      }

      // milkFatherName/milkMotherName are now real person columns — save them
      // directly on the person (only meaningful for milk-siblings; empty otherwise).
      const newPerson = await api.people.create({
        ...personData,
        treeId: currentTree?.id,
        ...(childBirthOrder != null ? { birthOrder: childBirthOrder } : {}),
      });

      console.log("New person created:", newPerson);

      // If there's a relationship, create it
      if (relationshipType && selectedPerson) {
        if (relationshipType === "sibling") {
          if (personData.isBreastfed) {
            // Milk sibling (رضاعة): direct sibling link ONLY, flagged breastfeeding,
            // with NO blood parents inherited (like the first person in a tree).
            const siblingRel = await api.relationships.create({
              treeId: currentTree?.id,
              type: "sibling",
              person1Id: selectedPerson,
              person2Id: newPerson.id,
              isBreastfeeding: true,
            });
            setRelationships((prev) => [...prev, siblingRel]);
            // Milk-parent names are stored as text on the milk-sibling record
            // (milkFatherName/milkMotherName) — NOT as separate people or
            // parent-child links, so they never render in the tree.
          } else {
            // Blood sibling: link to the same parents (parent-child relations)
            const parentRels = relationships.filter(
              (r) =>
                r.treeId === currentTree?.id &&
                r.type === "parent-child" &&
                r.childId === selectedPerson,
            );

            if (parentRels.length > 0) {
              const createdRels = await Promise.all(
                parentRels.map((r) =>
                  api.relationships.create({
                    treeId: currentTree?.id,
                    type: "parent-child",
                    parentId: r.parentId,
                    childId: newPerson.id,
                  }),
                ),
              );
              setRelationships((prev) => [...prev, ...createdRels]);
            } else {
              // Fallback: direct sibling relation if no parents exist yet
              const siblingRel = await api.relationships.create({
                treeId: currentTree?.id,
                type: "sibling",
                person1Id: selectedPerson,
                person2Id: newPerson.id,
              });
              setRelationships((prev) => [...prev, siblingRel]);
            }
          }
        } else {
          const relData = {
            treeId: currentTree?.id,
            type:
              relationshipType === "spouse"
                ? "partner"
                : relationshipType === "child"
                  ? "parent-child"
                  : /* parent */ "parent-child",
          };

          if (relationshipType === "spouse") {
            relData.person1Id = selectedPerson;
            relData.person2Id = newPerson.id;
            const newRel = await api.relationships.create(relData);
            setRelationships((prev) => [...prev, newRel]);
          } else if (relationshipType === "child") {
            // Child links to exactly ONE father + ONE mother.
            // The other parent was resolved before the form opened (auto if 1 spouse, chosen if 2+).
            const allParentIds = chosenChildOtherParentId
              ? [selectedPerson, chosenChildOtherParentId]
              : [selectedPerson];

            const createdRels = await Promise.all(
              allParentIds.map((parentId) =>
                api.relationships.create({
                  treeId: currentTree?.id,
                  type: "parent-child",
                  parentId: parentId,
                  childId: newPerson.id,
                }),
              ),
            );
            setRelationships((prev) => [...prev, ...createdRels]);
            setChosenChildOtherParentId(null);
          } else if (relationshipType === "parent") {
            relData.parentId = newPerson.id;
            relData.childId = selectedPerson;
            const newRel = await api.relationships.create(relData);
            setRelationships((prev) => [...prev, newRel]);
          }
        }
      }

      // Update local state
      setPeople((prev) => [...prev, newPerson]);

      // Special handling for parent relationship - auto-add second parent
      if (relationshipType === "parent" && selectedPerson) {
        // Check if both parents exist now
        const childId = selectedPerson;
        const parentRels = relationships.filter(
          (r) =>
            r.treeId === currentTree?.id &&
            r.type === "parent-child" &&
            r.childId === childId,
        );
        // Include the newly created relationship
        const allParentRels = [...parentRels, { parentId: newPerson.id }];
        const allParentIds = allParentRels.map((r) => r.parentId);
        const allParents = people
          .filter((p) => allParentIds.includes(p.id))
          .concat([newPerson]);

        const hasFather = allParents.some((p) => p?.gender === "male");
        const hasMother = allParents.some((p) => p?.gender === "female");

        if (hasFather && !hasMother) {
          // Father added, now add mother
          // Create partner relationship between father and the mother we're about to add
          setPendingFatherId(newPerson.id);
          setRelationshipType("parent");
          setFormKey((prev) => prev + 1);
          setShowPersonForm(true);
          return;
        } else if (hasMother && !hasFather) {
          // Mother added, now add father
          setPendingMotherId(newPerson.id);
          setRelationshipType("parent");
          setFormKey((prev) => prev + 1);
          setShowPersonForm(true);
          return;
        }

        // If we have pending father/mother, create the partner relationship
        if (pendingFatherId) {
          const partnerRel = await api.relationships.create({
            treeId: currentTree?.id,
            type: "partner",
            person1Id: pendingFatherId,
            person2Id: newPerson.id,
          });
          setRelationships((prev) => [...prev, partnerRel]);
          setPendingFatherId(null);
        } else if (pendingMotherId) {
          const partnerRel = await api.relationships.create({
            treeId: currentTree?.id,
            type: "partner",
            person1Id: newPerson.id,
            person2Id: pendingMotherId,
          });
          setRelationships((prev) => [...prev, partnerRel]);
          setPendingMotherId(null);
        }
      }

      setShowPersonForm(false);
      setRelationshipType(null);
      setEditingPerson(null);
      // Keep the tree rooted on the branch we were working on (the anchor),
      // so adding a relative doesn't jump the view back to the natural root.
      setSelectedPerson(anchorPerson);
      setHighlightedPerson(anchorPerson);
    } catch (error) {
      console.error("Failed to add person:", error);
      alert("فشل في إضافة الشخص: " + error.message);
    }
  };

  const updatePerson = async (personData) => {
    try {
      const editingId = editingPerson;
      // milkFatherName/milkMotherName are real person columns now — update them
      // directly on the person. No parent people, no parent-child links.
      const updatedPerson = await api.people.update(editingId, personData);

      // Update local state
      setPeople((prev) =>
        prev.map((p) => (p.id === editingId ? updatedPerson : p)),
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
    } catch (error) {
      console.error("Failed to update person:", error);
      alert("فشل في تحديث الشخص: " + error.message);
    }
  };

  const deletePerson = async (personId) => {
    // Build a consequence-aware confirmation. For a "bridge" person (one with a
    // spouse and/or children) or a milk-bonded person, name who will be
    // disconnected from the tree — they SURVIVE in Family Members but stop
    // rendering in the tree once their only connection (this person) is gone.
    // Leaf deletes keep the plain confirmation.
    const buildDeleteMessage = () => {
      const rels = relationships.filter((r) => r.treeId === currentTree?.id);
      const nameOf = (id) => {
        const p = people.find((pp) => pp.id === id);
        return p ? p.firstName : "";
      };

      // Spouse(s)
      const spouseIds = rels
        .filter(
          (r) =>
            r.type === "partner" &&
            (r.person1Id === personId || r.person2Id === personId),
        )
        .map((r) => (r.person1Id === personId ? r.person2Id : r.person1Id));

      // Children (this person as a parent)
      const childIds = rels
        .filter((r) => r.type === "parent-child" && r.parentId === personId)
        .map((r) => r.childId);

      // Milk-sibling(s) (breastfeeding sibling bond)
      const milkIds = rels
        .filter(
          (r) =>
            r.type === "sibling" &&
            r.isBreastfeeding &&
            (r.person1Id === personId || r.person2Id === personId),
        )
        .map((r) => (r.person1Id === personId ? r.person2Id : r.person1Id));

      // No consequences → plain confirmation.
      if (
        spouseIds.length === 0 &&
        childIds.length === 0 &&
        milkIds.length === 0
      ) {
        return t.deleteConfirm;
      }

      const parts = [];
      if (spouseIds.length > 0) {
        const names = spouseIds.map(nameOf).filter(Boolean).join("، ");
        parts.push(`الزوج/الزوجة: ${names}`);
      }
      if (childIds.length > 0) {
        parts.push(`عدد الأبناء: ${childIds.length}`);
      }
      if (milkIds.length > 0) {
        const names = milkIds.map(nameOf).filter(Boolean).join("، ");
        parts.push(`روابط الرضاعة مع: ${names}`);
      }

      return (
        `حذف هذا الشخص سيؤدي إلى فصل الأشخاص التالين عن الشجرة ` +
        `(سيبقون في قائمة أفراد العائلة):\n\n` +
        parts.join("\n") +
        `\n\nهل تريد المتابعة؟`
      );
    };

    if (window.confirm(buildDeleteMessage())) {
      try {
        // Before deleting, find a neighbour (parent, then spouse, sibling, child)
        // to re-root on. Deleting always removes the SELECTED (rooted) person, so
        // without this the tree falls back to the natural root (father's side).
        const treeRels = relationships.filter(
          (r) => r.treeId === currentTree?.id,
        );
        const findNeighbour = () => {
          // Prefer a parent — and when there are two (father + mother), prefer the
          // FATHER (male parent) so deleting a child keeps the view on the paternal
          // line consistently, instead of flipping based on link creation order.
          const parentLinks = treeRels.filter(
            (r) => r.type === "parent-child" && r.childId === personId,
          );
          if (parentLinks.length > 0) {
            const parentPeople = parentLinks
              .map((r) => people.find((p) => p.id === r.parentId))
              .filter(Boolean);
            const father = parentPeople.find((p) => p.gender === "male");
            return (father || parentPeople[0])?.id ?? parentLinks[0].parentId;
          }
          const spouse = treeRels.find(
            (r) =>
              r.type === "partner" &&
              (r.person1Id === personId || r.person2Id === personId),
          );
          if (spouse)
            return spouse.person1Id === personId
              ? spouse.person2Id
              : spouse.person1Id;
          const sibling = treeRels.find(
            (r) =>
              r.type === "sibling" &&
              (r.person1Id === personId || r.person2Id === personId),
          );
          if (sibling)
            return sibling.person1Id === personId
              ? sibling.person2Id
              : sibling.person1Id;
          const child = treeRels.find(
            (r) => r.type === "parent-child" && r.parentId === personId,
          );
          if (child) return child.childId;
          return null;
        };
        const neighbour = findNeighbour();

        // Delete person via API (this will also delete related relationships on backend)
        await api.people.delete(personId);

        // Update local state
        setPeople((prev) => {
          const updated = prev.filter((p) => p.id !== personId);
          if (
            updated.filter((p) => p.treeId === currentTree?.id).length === 0
          ) {
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
        // If we deleted the currently-rooted person, re-root on a neighbour so the
        // view stays on this branch instead of jumping to the natural root.
        setSelectedPerson((prev) => (prev === personId ? neighbour : prev));
        setHighlightedPerson((prev) => (prev === personId ? null : prev));
        setShowActionMenu(false);
      } catch (error) {
        console.error("Failed to delete person:", error);
        alert("فشل في حذف الشخص: " + error.message);
      }
    }
  };

  // Track a pending sibling to edit after creating parents
  const [pendingSiblingId, setPendingSiblingId] = useState(null);

  // Add both parents in one action and open father's form first
  const [pendingSecondParent, setPendingSecondParent] = useState(null);
  const handleAddBothParents = async (childId) => {
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

    try {
      // Create father
      const father = await api.people.create({
        treeId: currentTree?.id,
        firstName: `والد ${child.firstName}`,
        lastName: child.lastName || "",
        gender: "male",
        isLiving: true,
      });

      // Create mother
      const mother = await api.people.create({
        treeId: currentTree?.id,
        firstName: `والدة ${child.firstName}`,
        lastName: child.lastName || "",
        gender: "female",
        isLiving: true,
      });

      // Create parent-child relationships
      const fatherChildRel = await api.relationships.create({
        treeId: currentTree?.id,
        type: "parent-child",
        parentId: father.id,
        childId: childId,
      });

      const motherChildRel = await api.relationships.create({
        treeId: currentTree?.id,
        type: "parent-child",
        parentId: mother.id,
        childId: childId,
      });

      // Create partner relationship between father and mother
      const partnerRel = await api.relationships.create({
        treeId: currentTree?.id,
        type: "partner",
        person1Id: father.id,
        person2Id: mother.id,
      });

      // Update local state
      setPeople((prev) => [...prev, father, mother]);
      setRelationships((prev) => [
        ...prev,
        fatherChildRel,
        motherChildRel,
        partnerRel,
      ]);
    } catch (error) {
      console.error("Failed to create parents:", error);
      alert("فشل في إضافة الوالدين: " + error.message);
    }
  };

  // Quick-create relationship helpers (open form for adding related person)
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

    // Open form for adding spouse
    setSelectedPerson(personId);
    setRelationshipType("spouse");
    setEditingPerson(null);
    setFormKey((prev) => prev + 1);
    setShowPersonForm(true);
  };

  const proceedAddChild = (parentId, otherParentId) => {
    setChosenChildOtherParentId(otherParentId ?? null);
    setMotherPickerFor(null);
    setSelectedPerson(parentId);
    setRelationshipType("child");
    setEditingPerson(null);
    setFormKey((prev) => prev + 1);
    setShowPersonForm(true);
  };

  const handleQuickCreateChild = (personId) => {
    const selected = people.find((p) => p.id === personId);
    if (!selected) return;

    // Find the selected parent's spouses (the child's other parent must be one of them)
    const spouseIds = relationships
      .filter(
        (r) =>
          r.treeId === currentTree?.id &&
          r.type === "partner" &&
          (r.person1Id === personId || r.person2Id === personId),
      )
      .map((r) => (r.person1Id === personId ? r.person2Id : r.person1Id));

    if (spouseIds.length >= 2) {
      // Ambiguous: ask which spouse is the other parent (starts blank — user must choose)
      const isMale = selected.gender === "male";
      const candidates = spouseIds.map((sid) => {
        const sp = people.find((p) => p.id === sid);
        return { id: sid, name: sp?.firstName || `Person ${sid}` };
      });
      setMotherPickerFor({
        parentId: personId,
        candidates,
        pickLabel: isMale ? "اختر الأم" : "اختر الأب",
        helpText: isMale
          ? "لهذا الأب أكثر من زوجة. اختر أم هذا الطفل:"
          : "لهذه الأم أكثر من زوج. اختر أب هذا الطفل:",
      });
      return;
    }

    // 0 or 1 spouse — unambiguous, proceed directly
    proceedAddChild(personId, spouseIds[0]);
  };

  const handleQuickCreateSibling = (personId) => {
    const selected = people.find((p) => p.id === personId);
    if (!selected) return;

    // Open form for adding sibling
    setSelectedPerson(personId);
    setRelationshipType("sibling");
    setEditingPerson(null);
    setFormKey((prev) => prev + 1);
    setShowPersonForm(true);
  };

  // Get siblings for a person (people who share at least one parent)
  const getSiblings = (personId) => {
    // Primary path: siblings via shared parents
    const parentRels = relationships.filter(
      (r) =>
        r.treeId === currentTree?.id &&
        r.type === "parent-child" &&
        r.childId === personId,
    );
    const parentIds = parentRels.map((r) => r.parentId);
    if (parentIds.length > 0) {
      const siblingRels = relationships.filter(
        (r) =>
          r.treeId === currentTree?.id &&
          r.type === "parent-child" &&
          parentIds.includes(r.parentId) &&
          r.childId !== personId,
      );
      const siblingIds = [...new Set(siblingRels.map((r) => r.childId))];
      return people.filter((p) => siblingIds.includes(p.id));
    }

    // Fallback path: direct sibling relationships (when no parents exist yet)
    const directSiblingRels = relationships.filter(
      (r) =>
        r.treeId === currentTree?.id &&
        r.type === "sibling" &&
        (r.person1Id === personId || r.person2Id === personId),
    );
    const directSiblingIds = [
      ...new Set(
        directSiblingRels.map((r) =>
          r.person1Id === personId ? r.person2Id : r.person1Id,
        ),
      ),
    ];
    return people.filter((p) => directSiblingIds.includes(p.id));
  };

  // Reorder sibling: swap birthOrder with adjacent sibling
  // direction: 'older' (أكبر - move left) or 'younger' (أصغر - move right)
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
    // 'older' means move to earlier position in sorted list (lower birthOrder)
    // 'younger' means move to later position in sorted list (higher birthOrder)
    let targetIndex;
    if (direction === "older") {
      targetIndex = currentIndex + 1; // Swap with next (younger) sibling
    } else {
      targetIndex = currentIndex - 1; // Swap with previous (older) sibling
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
      await Promise.all([
        api.people.updateBirthOrder(personId, targetOrder),
        api.people.updateBirthOrder(targetPerson.id, currentOrder),
      ]);
    } catch (error) {
      console.error("Failed to persist birthOrder swap:", error);
      // Rollback on error
      setPeople((prev) =>
        prev.map((p) => {
          if (p.id === personId) return { ...p, birthOrder: currentOrder };
          if (p.id === targetPerson.id)
            return { ...p, birthOrder: targetOrder };
          return p;
        }),
      );
    }
  };

  const handleMouseDown = (e) => {
    const isBackground =
      !e.target.closest("[data-person-box]") &&
      !e.target.closest("[data-action-button]") &&
      !e.target.closest("[data-add-person-button]") &&
      !e.target.closest("[data-person-form]");
    if (isBackground) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragStartOffset({ ...panOffset });
      // Close the form if it's open
      if (showPersonForm) {
        setShowPersonForm(false);
      }
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

  // Add touch event listeners with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const options = { passive: false };

    canvas.addEventListener("touchstart", handleTouchStart, options);
    canvas.addEventListener("touchmove", handleTouchMove, options);
    canvas.addEventListener("touchend", handleTouchEnd, options);
    canvas.addEventListener("wheel", handleWheel, options);

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart, options);
      canvas.removeEventListener("touchmove", handleTouchMove, options);
      canvas.removeEventListener("touchend", handleTouchEnd, options);
      canvas.removeEventListener("wheel", handleWheel, options);
    };
  }, [
    isPinching,
    isDragging,
    lastTouchDistance,
    dragStart,
    dragStartOffset,
    panOffset,
    showPersonForm,
  ]);

  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling up
    setZoom((prev) =>
      Math.max(0.3, Math.min(3, prev * (e.deltaY > 0 ? 0.9 : 1.1))),
    );
  };

  // Calculate distance between two touch points
  const getTouchDistance = (touch1, touch2) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.touches.length === 2) {
      // Pinch zoom start
      setIsPinching(true);
      setIsDragging(false);
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1) {
      // Single touch for panning
      setIsPinching(false);
      const isBackground =
        e.target === canvasRef.current ||
        (e.target.closest("svg") &&
          !e.target.closest("[data-person-card]") &&
          !e.target.closest("[data-person-form]"));

      if (isBackground) {
        setIsDragging(true);
        setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        setDragStartOffset({ ...panOffset });
        if (showPersonForm) {
          setShowPersonForm(false);
        }
      }
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.touches.length === 2 && isPinching) {
      // Pinch zoom
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      if (lastTouchDistance) {
        const scale = distance / lastTouchDistance;
        setZoom((prev) => Math.max(0.3, Math.min(3, prev * scale)));
      }
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && isDragging && !isPinching) {
      // Panning
      setPanOffset({
        x: Math.max(
          -5000,
          Math.min(
            5000,
            dragStartOffset.x + e.touches[0].clientX - dragStart.x,
          ),
        ),
        y: Math.max(
          -200,
          Math.min(
            1000,
            dragStartOffset.y + e.touches[0].clientY - dragStart.y,
          ),
        ),
      });
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.touches.length < 2) {
      setIsPinching(false);
      setLastTouchDistance(null);
    }
    if (e.touches.length === 0) {
      setIsDragging(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-purple-600" />
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (sessionRestoreLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-purple-600" />
          <p className="mt-4 text-gray-600">جاري استعادة بيانات العائلة...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
            {t.welcome}
          </h1>

          {authError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-center text-sm">
              {authError}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
            <div>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="البريد الإلكتروني"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-right"
                dir="rtl"
                disabled={authProcessing}
              />
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="كلمة المرور"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-right"
                dir="rtl"
                disabled={authProcessing}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <Button
              type="submit"
              disabled={authProcessing || !emailInput || !passwordInput}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3"
            >
              {processingMethod === "email" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : authMode === "login" ? (
                "تسجيل الدخول"
              ) : (
                "إنشاء حساب"
              )}
            </Button>
          </form>

          <div className="text-center mb-6">
            <button
              type="button"
              onClick={() =>
                setAuthMode(authMode === "login" ? "signup" : "login")
              }
              className="text-purple-600 hover:text-purple-800 text-sm"
            >
              {authMode === "login"
                ? "ليس لديك حساب؟ إنشاء حساب جديد"
                : "لديك حساب؟ تسجيل الدخول"}
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">أو</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleGoogleLogin}
              disabled={authProcessing}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 py-3"
            >
              {processingMethod === "google" ? (
                <Loader2 className="w-5 h-5 animate-spin ml-2" />
              ) : (
                <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              تسجيل الدخول عبر Google
            </Button>
            <Button
              onClick={handleMicrosoftLogin}
              disabled={authProcessing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
            >
              {processingMethod === "microsoft" ? (
                <Loader2 className="w-5 h-5 animate-spin ml-2" />
              ) : (
                <User className="w-5 h-5 ml-2" />
              )}
              تسجيل الدخول عبر Microsoft
            </Button>
            <Button
              onClick={() => setShowSmsLogin(true)}
              disabled={authProcessing}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3"
            >
              <Smartphone className="w-5 h-5 ml-2" />
              {t.uaeMobile}
            </Button>
          </div>
        </div>

        <Dialog
          open={showSmsLogin}
          onOpenChange={(open) => {
            setShowSmsLogin(open);
            if (!open) {
              setSmsStep("phone");
              setPhoneInput("");
              setSmsCode("");
              setSmsError("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right text-xl">
                الدخول عبر الهاتف الإماراتي
              </DialogTitle>
            </DialogHeader>

            {smsError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-right">
                {smsError}
              </div>
            )}

            {smsStep === "phone" ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                    رقم الهاتف الإماراتي
                  </label>
                  <div className="flex gap-2" dir="ltr">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                      +971
                    </span>
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) =>
                        setPhoneInput(e.target.value.replace(/\D/g, ""))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && phoneInput && !authProcessing) {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSendSmsCode();
                        }
                      }}
                      placeholder="501234567"
                      className="flex-1 block w-full rounded-r-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-purple-500"
                      maxLength={9}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-right">
                    أدخل رقم الهاتف بدون صفر البداية
                  </p>
                </div>
                <Button
                  onClick={handleSendSmsCode}
                  disabled={authProcessing || !phoneInput}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {processingMethod === "phone" ? (
                    <Loader2 className="w-5 h-5 animate-spin ml-2" />
                  ) : null}
                  إرسال رمز التحقق
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                    رمز التحقق
                  </label>
                  <input
                    type="text"
                    value={smsCode}
                    onChange={(e) =>
                      setSmsCode(e.target.value.replace(/\D/g, ""))
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        smsCode.length === 6 &&
                        !authProcessing
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        handleVerifySmsCode();
                      }
                    }}
                    placeholder="أدخل الرمز المكون من 6 أرقام"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-purple-500 text-center text-lg tracking-widest"
                    maxLength={6}
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-500 mt-1 text-right">
                    تم إرسال رمز التحقق إلى +971{phoneInput}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setSmsStep("phone");
                      setSmsCode("");
                      setSmsError("");
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    تغيير الرقم
                  </Button>
                  <Button
                    onClick={handleVerifySmsCode}
                    disabled={authProcessing || smsCode.length !== 6}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {processingMethod === "code" ? (
                      <Loader2 className="w-5 h-5 animate-spin ml-2" />
                    ) : null}
                    تحقق
                  </Button>
                </div>
                <button
                  onClick={handleSendSmsCode}
                  disabled={authProcessing}
                  className="w-full text-sm text-purple-600 hover:text-purple-700 underline"
                >
                  إعادة إرسال الرمز
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Helper function to build genealogical name chain (follows paternal line)
  const getGenealogicalName = (person) => {
    const treePeople = people.filter((p) => p.treeId === currentTree?.id);
    const treeRels = relationships.filter((r) => r.treeId === currentTree?.id);

    let nameParts = [person.firstName];
    // Milk-siblings have no blood parent-child links; their father's name is
    // stored as text (milkFatherName). Use it as the father segment so the name
    // still reads e.g. "سعيد مساعد آل علي".
    if (person.milkFatherName && person.milkFatherName.trim()) {
      nameParts.push(person.milkFatherName.trim());
    }
    let current = person;
    let oldestAncestorInChain = person;

    while (true) {
      // Find ALL parent-child relationships where this person is the child
      const parentRels = treeRels.filter(
        (r) => r.type === "parent-child" && r.childId === current.id,
      );
      if (parentRels.length === 0) break;

      // Look for the male parent (father) among all parent relationships
      let fatherFound = null;
      for (const parentRel of parentRels) {
        const parent = treePeople.find(
          (p) => p.id === parentRel.parentId && p.gender === "male",
        );
        if (parent) {
          fatherFound = parent;
          break;
        }
      }

      if (fatherFound) {
        // Found father - continue tracing paternal line
        nameParts.push(fatherFound.firstName);
        current = fatherFound;
        oldestAncestorInChain = fatherFound;
      } else {
        // No male parent found - stop here (don't follow maternal line)
        break;
      }
    }

    // Use the oldest ancestor in THIS person's chain for the last name
    if (oldestAncestorInChain?.lastName) {
      nameParts.push(oldestAncestorInChain.lastName);
    } else if (person.lastName) {
      nameParts.push(person.lastName);
    }

    return nameParts.join(" ");
  };

  // Reusable person add/edit form panel — rendered in both the tree view and the
  // Family Members dashboard, so people who aren't placed on the tree (e.g. milk
  // siblings) can still be opened and edited from the dashboard.
  const renderPersonForm = () => {
    const treePeople = people.filter((p) => p.treeId === currentTree?.id);
    // Milk-parent names now live on the person record (milkFatherName /
    // milkMotherName). The form reads them directly; the fields show whenever the
    // person is a milk-sibling (isBreastfed), which is true on add and edit.
    return (
      showPersonForm && (
        <div
          data-person-form
          className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-white shadow-2xl border rounded-lg z-50"
          style={{
            width: "380px",
            maxHeight: "min(800px, 85vh)",
            overflow: "hidden",
          }}
        >
          <div className="flex flex-col h-full" style={{ maxHeight: "inherit" }}>
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
                key={editingPerson ? `edit-${editingPerson}` : `add-${formKey}`}
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
                  setPendingFatherId(null);
                  setPendingMotherId(null);
                  setChosenChildOtherParentId(null);
                }}
                relationshipType={relationshipType}
                defaultGender={defaultSpouseGender}
                pendingFatherId={pendingFatherId}
                pendingMotherId={pendingMotherId}
                selectedPersonName={
                  selectedPerson
                    ? (() => {
                        const selected = treePeople.find(
                          (p) => p.id === selectedPerson,
                        );
                        return (
                          selected?.firstName ||
                          selected?.lastName ||
                          `Person ${selectedPerson}`
                        );
                      })()
                    : ""
                }
                t={t}
              />
            </div>
          </div>
        </div>
      )
    );
  };

  if (currentView === "family-members") {
    // People involved in any milk-bond (breastfeeding sibling link) — both sides
    // of the bond get the «بالرضاعة» ribbon on their card.
    const milkPersonIds = new Set();
    relationships
      .filter(
        (r) =>
          r.treeId === currentTree?.id &&
          r.type === "sibling" &&
          r.isBreastfeeding,
      )
      .forEach((r) => {
        milkPersonIds.add(r.person1Id);
        milkPersonIds.add(r.person2Id);
      });

    // Cards to render = the same branch-independent set the dashboard count
    // uses (shared memo), so the count and the list can never disagree. The
    // milk-parent exclusion now lives in the visibleFamilyMembers memo.
    const visiblePeople = visibleFamilyMembers;

    return (
      <div
        className="min-h-screen bg-gray-50"
        onClick={(e) => {
          // Click empty space (not a card, not the form) closes the edit form,
          // matching the tree page's behavior.
          if (
            showPersonForm &&
            !e.target.closest("[data-person-form]") &&
            !e.target.closest("[data-person-card]")
          ) {
            setShowPersonForm(false);
            setEditingPerson(null);
          }
        }}
      >
        <div className="bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setCurrentView("dashboard")}
              variant="outline"
              size="sm"
            >
              <Home className="w-4 h-4 ml-2" />
              {t.backToDashboard}
            </Button>
            <h1 className="text-xl font-bold">{t.familyMembers}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleOpenProfile} variant="outline" size="sm">
              <User className="w-4 h-4 ml-2" />
              {t.profile}
            </Button>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 ml-2" />
              {t.logout}
            </Button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-8 py-8">
          {familyGroups.map((group, gi) => {
            const cards = group.cards || [...group.heads, ...(group.children || [])];
            return (
              <div
                key={group.key}
                className={gi > 0 ? "mt-4 pt-4 border-t border-dashed border-gray-300" : ""}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cards.map((person) => {
                    const isMilk = milkPersonIds.has(person.id);
                    const spouseLabel =
                      person._spouseIndex === 2
                        ? "الزوجة الثانية"
                        : person._spouseIndex === 3
                          ? "الزوجة الثالثة"
                          : person._spouseIndex === 4
                            ? "الزوجة الرابعة"
                            : null;
                    return (
                      <div
                        key={person.id}
                        data-person-card
                        style={
                          person._startsNewRow
                            ? { gridColumnStart: 1 }
                            : undefined
                        }
                        onClick={() => {
                          setEditingPerson(person.id);
                          setRelationshipType(null);
                          setFormKey((prev) => prev + 1);
                          setShowPersonForm(true);
                        }}
                        className={`relative overflow-hidden bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md hover:border-gray-300 border transition ${
                          isMilk ? "border-green-300" : "border-transparent"
                        }`}
                      >
                        <div dir="ltr" className="absolute bottom-2 left-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePerson(person.id);
                            }}
                            title={t.delete || "حذف"}
                            aria-label={t.delete || "حذف"}
                            className="p-1.5 rounded-md hover:bg-red-50 transition"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                          {isMilk && (
                            <span className="bg-green-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded tracking-wide">
                              بالرضاعة
                            </span>
                          )}
                          {spouseLabel && (
                            <span className="bg-gray-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded tracking-wide">
                              {spouseLabel}
                            </span>
                          )}
                        </div>
                        <div className="text-lg">{getGenealogicalName(person)}</div>
                        {person.identificationNumber && (
                          <div className="text-sm text-gray-500">
                            رقم الهوية: {person.identificationNumber}
                          </div>
                        )}
                        <div className="text-sm text-gray-500">
                          {person.gender === "male" ? "ذكر" : "أنثى"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {visiblePeople.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              لا يوجد أفراد في العائلة بعد
            </div>
          )}
        </div>
        {renderPersonForm()}
        {renderProfileDialog()}
      </div>
    );
  }

  if (currentView === "relationships-detail") {
    const treePeople = people.filter((p) => p.treeId === currentTree?.id);
    const treeRels = relationships.filter((r) => r.treeId === currentTree?.id);

    // Get married males (husbands who have wives, with or without children)
    const maleParents = treePeople.filter((person) => {
      if (person.gender !== "male") return false;

      const hasSpouse = treeRels.some(
        (r) =>
          r.type === "partner" &&
          (r.person1Id === person.id || r.person2Id === person.id),
      );

      return hasSpouse;
    });

    const getRelationshipCounts = (person) => {
      // Blood siblings are defined by shared parents (matches getSiblings, which the arrows use).
      // Direct "sibling" rows are only a fallback used when no parents exist yet.
      const myParentIds = treeRels
        .filter((r) => r.type === "parent-child" && r.childId === person.id)
        .map((r) => r.parentId);

      let siblingIds;
      if (myParentIds.length > 0) {
        siblingIds = [
          ...new Set(
            treeRels
              .filter(
                (r) =>
                  r.type === "parent-child" &&
                  myParentIds.includes(r.parentId) &&
                  r.childId !== person.id,
              )
              .map((r) => r.childId),
          ),
        ];
      } else {
        siblingIds = [
          ...new Set(
            treeRels
              .filter(
                (r) =>
                  r.type === "sibling" &&
                  !r.isBreastfeeding &&
                  (r.person1Id === person.id || r.person2Id === person.id),
              )
              .map((r) =>
                r.person1Id === person.id ? r.person2Id : r.person1Id,
              ),
          ),
        ];
      }
      const siblingPeople = treePeople.filter((p) => siblingIds.includes(p.id));

      const brothers = siblingPeople.filter((p) => p.gender === "male").length;
      const sisters = siblingPeople.filter((p) => p.gender === "female").length;

      // Breastfeeding (milk) siblings remain tracked via direct "sibling" rows flagged isBreastfeeding.
      const breastfeedingSiblings = treeRels.filter(
        (r) =>
          r.type === "sibling" &&
          r.isBreastfeeding &&
          (r.person1Id === person.id || r.person2Id === person.id),
      );
      const breastfeedingBrothers = breastfeedingSiblings.filter((r) => {
        const sibId = r.person1Id === person.id ? r.person2Id : r.person1Id;
        const sib = treePeople.find((p) => p.id === sibId);
        return sib?.gender === "male";
      }).length;
      const breastfeedingSisters = breastfeedingSiblings.filter((r) => {
        const sibId = r.person1Id === person.id ? r.person2Id : r.person1Id;
        const sib = treePeople.find((p) => p.id === sibId);
        return sib?.gender === "female";
      }).length;

      const spouseRels = treeRels.filter(
        (r) =>
          r.type === "partner" &&
          (r.person1Id === person.id || r.person2Id === person.id),
      );
      const wives = spouseRels.length;

      const children = treeRels.filter(
        (r) => r.type === "parent-child" && r.parentId === person.id,
      ).length;

      return {
        brothers,
        sisters,
        breastfeedingBrothers,
        breastfeedingSisters,
        wives,
        children,
      };
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setCurrentView("dashboard")}
              variant="outline"
              size="sm"
            >
              <Home className="w-4 h-4 ml-2" />
              {t.backToDashboard}
            </Button>
            <h1 className="text-xl font-bold">{t.relationships}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleOpenProfile} variant="outline" size="sm">
              <User className="w-4 h-4 ml-2" />
              {t.profile}
            </Button>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 ml-2" />
              {t.logout}
            </Button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {maleParents.map((person) => {
              const counts = getRelationshipCounts(person);
              return (
                <div key={person.id} className="bg-white rounded-lg shadow p-4">
                  <div className="text-lg font-bold mb-2">
                    الاسم: {getGenealogicalName(person)}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-green-600">
                      عدد الأخوة: {counts.brothers}
                    </div>
                    <div className="text-pink-600">
                      عدد الأخوات: {counts.sisters}
                    </div>
                    {counts.breastfeedingBrothers > 0 && (
                      <div className="text-green-400 border-t border-green-400 pt-1">
                        أخوة من الرضاعة: {counts.breastfeedingBrothers}
                      </div>
                    )}
                    {counts.breastfeedingSisters > 0 && (
                      <div className="text-pink-400">
                        أخوات من الرضاعة: {counts.breastfeedingSisters}
                      </div>
                    )}
                    <div className="text-purple-600">
                      عدد الزوجات: {counts.wives}
                    </div>
                    <div className="text-blue-600">
                      عدد الأبناء: {counts.children}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {maleParents.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              لا يوجد علاقات زوجية بعد
            </div>
          )}
        </div>
        {renderProfileDialog()}
      </div>
    );
  }

  if (currentView === "dashboard") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold">{t.dashboard}</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button onClick={handleOpenProfile} variant="outline" size="sm">
                <User className="w-4 h-4 ml-2" />
                {t.profile}
              </Button>
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="w-4 h-4 ml-2" />
                {t.logout}
              </Button>
            </div>
          </div>
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
          <div
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg"
            onClick={() => currentTree && setCurrentView("family-members")}
          >
            <h3 className="text-xl font-bold mb-4">{t.familyMembers}</h3>
            <div className="text-3xl font-bold text-blue-600">
              {visibleFamilyMembers.length}
            </div>
          </div>
          <div
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg"
            onClick={() =>
              currentTree && setCurrentView("relationships-detail")
            }
          >
            <h3 className="text-xl font-bold mb-4">{t.relationships}</h3>
            <div className="text-3xl font-bold text-green-600">
              {relationships.filter((r) => r.treeId === currentTree?.id).length}
            </div>
          </div>
        </div>
        {renderProfileDialog()}
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 overflow-hidden">
      <div className="bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setCurrentView("dashboard")}
            variant="outline"
            size="sm"
          >
            <Home className="w-4 h-4 ml-2" />
            {t.backToDashboard}
          </Button>
          <h1 className="text-xl font-bold">{t.familyTreeName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleOpenProfile} variant="outline" size="sm">
            <User className="w-4 h-4 ml-2" />
            {t.profile}
          </Button>
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="w-4 h-4 ml-2" />
            {t.logout}
          </Button>
        </div>
      </div>

      <div className="relative" style={{ height: "calc(100vh - 64px)" }}>
        <div
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          style={{
            backgroundColor: stylingOptions.backgroundColor,
            touchAction: "none",
          }}
          onMouseDown={handleMouseDown}
        >
          {/* TreeCanvas component renders the family tree layout */}
          {treeLayout && (
            <TreeCanvas
              layout={treeLayout.layout}
              familyData={treeLayout.familyData}
              people={treePeople}
              selectedPerson={selectedPerson}
              highlightedPerson={highlightedPerson}
              onPersonClick={(personId) => {
                setSelectedPerson(personId);
                setHighlightedPerson(personId);
                setEditingPerson(personId);
                setRelationshipType(null);
                setShowPersonForm(true);
                setShowActionMenu(true);
              }}
              onBackgroundClick={() => {
                setShowActionMenu(false);
                setHighlightedPerson(null);
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
              }px, ${panOffset.y + (effectiveAutoPan?.y || 0)}px)`,
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

                // Check if person has parents - required for adding siblings
                const hasParents = hasFather || hasMother;
                const canAddSibling = hasParents;
                const addSiblingTooltip = canAddSibling
                  ? t.addSibling
                  : "أضف الوالدين أولاً";

                // Check if person has siblings for reorder buttons
                const siblings = getSiblings(selectedPerson);
                const hasSiblings = siblings.length > 0;

                // Determine if can move older/younger based on current position
                let canMoveOlder = false;
                let canMoveYounger = false;
                if (hasSiblings) {
                  const currentPerson = treePeople.find(
                    (p) => p.id === selectedPerson,
                  );
                  const allSiblings = [currentPerson, ...siblings].sort(
                    (a, b) => {
                      const orderA = a.birthOrder ?? 9999;
                      const orderB = b.birthOrder ?? 9999;
                      return orderA - orderB;
                    },
                  );
                  const currentIndex = allSiblings.findIndex(
                    (s) => s.id === selectedPerson,
                  );
                  // "older" moves right/down in tree (swap with younger sibling at higher index)
                  canMoveOlder = currentIndex < allSiblings.length - 1;
                  // "younger" moves left/up in tree (swap with older sibling at lower index)
                  canMoveYounger = currentIndex > 0;
                }

                return (
                  <div
                    data-action-button
                    className="absolute bg-white border rounded-lg shadow-lg p-2 z-20 transition-opacity transition-transform duration-200"
                    style={{
                      left: (x - 90) * zoom,
                      top: (y + h / 2 + 10) * zoom,
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
                          if (!canAddSibling) {
                            window.alert("أضف الوالدين أولاً");
                            return;
                          }
                          handleQuickCreateSibling(selectedPerson);
                          setShowActionMenu(false);
                        }}
                        disabled={!canAddSibling}
                        size="sm"
                        variant="ghost"
                        className="w-8 h-8 p-0"
                        title={addSiblingTooltip}
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                      {hasSiblings && (
                        <>
                          <Button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const personToReorder = selectedPerson;
                              setShowActionMenu(false);
                              await handleReorderSibling(
                                personToReorder,
                                "older",
                              );
                              // Deselect and reselect to force tree update
                              setSelectedPerson(null);
                              setTimeout(
                                () => setSelectedPerson(personToReorder),
                                50,
                              );
                            }}
                            disabled={!canMoveOlder}
                            size="sm"
                            variant="ghost"
                            className="w-8 h-8 p-0"
                            title="أكبر"
                          >
                            <MoveRight className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const personToReorder = selectedPerson;
                              setShowActionMenu(false);
                              await handleReorderSibling(
                                personToReorder,
                                "younger",
                              );
                              // Deselect and reselect to force tree update
                              setSelectedPerson(null);
                              setTimeout(
                                () => setSelectedPerson(personToReorder),
                                50,
                              );
                            }}
                            disabled={!canMoveYounger}
                            size="sm"
                            variant="ghost"
                            className="w-8 h-8 p-0"
                            title="أصغر"
                          >
                            <MoveLeft className="w-4 h-4" />
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
              // Reset to centered view with zoom=1
              setZoom(1);

              // For single-entity layouts, autoPan handles centering, so reset panOffset to 0
              if (isSingleLayout) {
                setPanOffset({ x: 0, y: 0 });
              } else {
                // Calculate center offset without zoom factor since we're resetting to zoom=1
                if (treeLayout?.layout?.e) {
                  const BOX_WIDTH = stylingOptions?.boxWidth || CARD.w;
                  const BOX_HEIGHT = CARD.h;
                  const entities = Object.values(treeLayout.layout.e);

                  if (entities.length > 0) {
                    let minX = Infinity,
                      maxX = -Infinity;
                    let minY = Infinity,
                      maxY = -Infinity;

                    entities.forEach((entity) => {
                      const x = entity.x * BOX_WIDTH;
                      const y = entity.y * BOX_HEIGHT;
                      minX = Math.min(minX, x);
                      maxX = Math.max(maxX, x + BOX_WIDTH);
                      minY = Math.min(minY, y);
                      maxY = Math.max(maxY, y + BOX_HEIGHT);
                    });

                    const treeCenterX = (minX + maxX) / 2;
                    const treeCenterY = (minY + maxY) / 2;

                    const viewportCenterX = canvasDimensions.width / 2;
                    const viewportCenterY = canvasDimensions.height / 2;

                    setPanOffset({
                      x: viewportCenterX - treeCenterX,
                      y: viewportCenterY - treeCenterY,
                    });
                  }
                }
              }
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

        {motherPickerFor && (
          <Dialog
            open={true}
            onOpenChange={(open) => {
              if (!open) setMotherPickerFor(null);
            }}
          >
            <DialogContent className="sm:max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-right text-xl">
                  {motherPickerFor.pickLabel}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 text-right">
                  {motherPickerFor.helpText}
                </p>
                {motherPickerFor.candidates.map((c) => (
                  <Button
                    key={c.id}
                    onClick={() =>
                      proceedAddChild(motherPickerFor.parentId, c.id)
                    }
                    variant="outline"
                    className="w-full justify-end"
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {renderPersonForm()}

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
                          إظهار {displayOptionLabels[key] || key}
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
                      <label className="text-sm w-32">أخت بالرضاعة/أخ</label>
                      <input
                        type="color"
                        value={stylingOptions.breastfedBoxColor}
                        onChange={(e) =>
                          setStylingOptions((prev) => ({
                            ...prev,
                            breastfedBoxColor: e.target.value,
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
                    <div className="flex items-center gap-2">
                      <label className="text-sm w-32">لون النص للمتوفين</label>
                      <input
                        type="color"
                        value={stylingOptions.deceasedTextColor}
                        onChange={(e) =>
                          setStylingOptions((prev) => ({
                            ...prev,
                            deceasedTextColor: e.target.value,
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
              <div className="flex justify-between mt-4">
                <Button onClick={handleResetOptions} variant="outline">
                  إعادة تعيين
                </Button>
                <Button onClick={() => setShowOptions(false)}>{t.save}</Button>
              </div>
            </div>
          </div>
        )}
        {renderProfileDialog()}
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
  defaultFirstName,
  selectedPersonName,
  pendingFatherId,
  pendingMotherId,
}) {
  const getDefaultFirstName = () => {
    if (person?.firstName) return person.firstName;
    if (defaultFirstName) return defaultFirstName;
    if (relationshipType && selectedPersonName) {
      if (relationshipType === "spouse")
        return `${t.spouseOf} ${selectedPersonName}`;
      if (relationshipType === "child")
        return `${t.childOf} ${selectedPersonName}`;
      if (relationshipType === "parent") {
        // If we have pendingFatherId, we're adding mother (second parent)
        // If we have pendingMotherId, we're adding father (second parent)
        // Otherwise, check gender or default to father
        if (pendingFatherId) {
          return `${t.motherOf} ${selectedPersonName}`;
        } else if (pendingMotherId) {
          return `${t.fatherOf} ${selectedPersonName}`;
        } else if (defaultGender === "female") {
          return `${t.motherOf} ${selectedPersonName}`;
        } else {
          return `${t.fatherOf} ${selectedPersonName}`;
        }
      }
      if (relationshipType === "sibling")
        return `${t.siblingOf} ${selectedPersonName}`;
    }
    return "";
  };

  const getDefaultGender = () => {
    if (person?.gender) return person.gender;
    if (relationshipType === "parent") {
      if (pendingFatherId) return "female"; // Adding mother after father
      if (pendingMotherId) return "male"; // Adding father after mother
    }
    return defaultGender || "";
  };

  const [formData, setFormData] = useState({
    firstName: getDefaultFirstName(),
    lastName: person?.lastName || "",
    gender: getDefaultGender(),
    birthDate: person?.birthDate || "",
    birthPlace: person?.birthPlace || "",
    isLiving: person?.isLiving !== false,
    isBreastfed: person?.isBreastfed === true,
    milkFatherName: person?.milkFatherName || "",
    milkMotherName: person?.milkMotherName || "",
    deathDate: person?.deathDate || "",
    phone: person?.phone || "",
    email: person?.email || "",
    profession: person?.profession || "",
  });

  // Reset form when person prop changes
  useEffect(() => {
    // When adding a spouse, don't auto-fill lastName from the selected spouse
    // Only keep lastName when editing an existing person or when person has their own lastName
    const lastName =
      person?.lastName || (relationshipType === "spouse" ? "" : "");

    setFormData({
      firstName: getDefaultFirstName(),
      lastName: lastName,
      gender: getDefaultGender(),
      birthDate: person?.birthDate || "",
      birthPlace: person?.birthPlace || "",
      isLiving: person?.isLiving !== false,
      isBreastfed: person?.isBreastfed === true,
      deathDate: person?.deathDate || "",
      phone: person?.phone || "",
      email: person?.email || "",
      profession: person?.profession || "",
    });
  }, [
    person,
    defaultFirstName,
    relationshipType,
    selectedPersonName,
    pendingFatherId,
    pendingMotherId,
  ]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.firstName.trim()) {
      alert("يرجى إدخال الاسم الأول");
      return;
    }
    if (!formData.gender || formData.gender === "") {
      alert("يرجى اختيار الجنس");
      return;
    }
    console.log("Form data being submitted:", formData);
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

      <div className="flex items-center gap-6">
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

        {!person && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isBreastfed"
              checked={formData.isBreastfed}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  isBreastfed: e.target.checked,
                }))
              }
              className="rounded"
            />
            <label htmlFor="isBreastfed" className="text-sm font-bold">
              {t.breastfed}
            </label>
          </div>
        )}
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

      {formData.isBreastfed && (
        <>
          <div>
            <label className="block text-sm font-bold mb-1 text-green-700">
              اسم الأب (بالرضاعة){" "}
              <span className="font-normal text-green-600">— اختياري</span>
            </label>
            <input
              type="text"
              value={formData.milkFatherName}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  milkFatherName: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-green-300 bg-green-50 rounded-md"
              dir="rtl"
              placeholder="اسم الأب"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-green-700">
              اسم الأم / المرضعة (بالرضاعة){" "}
              <span className="font-normal text-green-600">— اختياري</span>
            </label>
            <input
              type="text"
              value={formData.milkMotherName}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  milkMotherName: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-green-300 bg-green-50 rounded-md"
              dir="rtl"
              placeholder="اسم الأم / المرضعة"
            />
          </div>
        </>
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
