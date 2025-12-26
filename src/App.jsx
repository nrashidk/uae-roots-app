import { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { Button } from "@/components/ui/button.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.jsx";
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

  const { user, isAuthenticated, isLoading: authLoading, error: authError, loginWithGoogle, loginWithMicrosoft, loginWithEmail, signUpWithEmail, logout, deleteAccount } = useAuth();
  const [authMode, setAuthMode] = useState('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authProcessing, setAuthProcessing] = useState(false);
  const [showSmsLogin, setShowSmsLogin] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsStep, setSmsStep] = useState('phone');
  const [smsError, setSmsError] = useState('');
  const [currentView, setCurrentView] = useState("auth");
  const [currentTree, setCurrentTree] = useState(null);
  const [people, setPeople] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [relationshipType, setRelationshipType] = useState(null);
  const [formKey, setFormKey] = useState(0); // Key to force form remount
  const [pendingFatherId, setPendingFatherId] = useState(null);
  const [pendingMotherId, setPendingMotherId] = useState(null);
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
  const [showProfile, setShowProfile] = useState(false);
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [userProfile, setUserProfile] = useState(null);

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

  const displayOptionLabels = {
    showName: "الاسم",
    showSurname: "اسم العائلة",
    showBirthDate: "تاريخ الميلاد",
    showBirthPlace: "مكان الميلاد",
    showAge: "العمر",
    showDeathDate: "تاريخ الوفاة",
    showProfession: "المهنة",
    showCompany: "جهة العمل",
    showEmail: "البريد الإلكتروني",
    showTelephone: "الهاتف",
    showAddress: "العنوان",
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
    newEmail: "البريد الإلكتروني الجديد",
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
        console.log('[Cookie Restore] Skipping - Firebase session exists');
        return;
      }
      
      // Wait for Firebase auth to finish loading first
      if (authLoading) {
        console.log('[Cookie Restore] Waiting for Firebase auth to finish...');
        return;
      }
      
      // Skip if tree already loaded
      if (currentTree) {
        console.log('[Cookie Restore] Skipping - tree already loaded');
        return;
      }
      
      // Skip if not on auth view (user navigated elsewhere)
      if (currentView !== 'auth') {
        console.log('[Cookie Restore] Skipping - not on auth view');
        return;
      }
      
      // Skip if an interactive login is in progress
      if (interactiveLoginInProgressRef.current) {
        console.log('[Cookie Restore] Skipping - interactive login in progress');
        return;
      }
      
      // Prevent multiple restoration attempts
      if (restorationAttemptedRef.current) {
        console.log('[Cookie Restore] Already attempted');
        return;
      }
      
      console.log('[Cookie Restore] Starting cookie-based restoration (non-Firebase user)...');
      restorationAttemptedRef.current = true;
      setSessionRestoreLoading(true);
      setSessionRestoreError(null);
      
      try {
        // Check if backend cookie is still valid
        const backendAuth = await api.auth.check();
        console.log('[Cookie Restore] Backend auth check:', backendAuth);
        
        if (!backendAuth?.authenticated || !backendAuth?.userId) {
          console.log('[Cookie Restore] No valid backend session found');
          setSessionRestoreLoading(false);
          // Keep restorationAttemptedRef = true to prevent infinite loop
          // It will be reset on logout or when user successfully logs in
          return;
        }
        
        const resolvedUserId = backendAuth.userId;
        console.log('[Cookie Restore] Found valid session for userId:', resolvedUserId);
        
        // Store the resolved userId in sessionStorage
        setAuthToken(null, resolvedUserId);
        
        // Load user profile
        try {
          const savedUser = await api.users.get(resolvedUserId);
          console.log('[Cookie Restore] User profile loaded:', savedUser?.id);
          setUserProfile(savedUser);
        } catch (userError) {
          console.log('[Cookie Restore] Could not load user profile:', userError.message);
          // Continue anyway - user profile is optional for tree loading
        }
        
        // Load user's trees using the consolidated helper
        await loadUserTreeData(resolvedUserId);
        
        console.log('[Cookie Restore] Session restored successfully from cookie!');
        setSessionRestoreLoading(false);
      } catch (error) {
        console.error('[Cookie Restore] Failed to restore session:', error);
        setSessionRestoreError('فشل استعادة الجلسة. يرجى تسجيل الدخول مرة أخرى.');
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
      console.log('[Session Restore] Starting restoration for user:', user.uid || user.phoneNumber);

      try {
        // Fallback userId from Firebase user
        const fallbackUserId = user.uid || user.phoneNumber || user.id;
        let resolvedUserId = fallbackUserId;

        // STEP 1: Check if backend cookie is still valid
        let backendAuth = null;
        try {
          backendAuth = await api.auth.check();
          console.log('[Session Restore] Backend auth check:', backendAuth);
        } catch (e) {
          console.log('[Session Restore] Backend auth check failed:', e.message);
        }

        // STEP 2: If backend cookie is valid, use that userId
        if (backendAuth?.authenticated && backendAuth?.userId) {
          resolvedUserId = backendAuth.userId;
          console.log('[Session Restore] Using backend userId:', resolvedUserId);
          setAuthToken(null, resolvedUserId);
        } else {
          // STEP 3: Backend cookie expired/missing - need to re-authenticate
          console.log('[Session Restore] Backend cookie invalid, re-authenticating...');
          
          // Check sessionStorage for cached resolvedUserId first
          const cachedAuth = getAuthToken();
          if (cachedAuth?.resolvedUserId) {
            resolvedUserId = cachedAuth.resolvedUserId;
            console.log('[Session Restore] Using cached userId:', resolvedUserId);
          }
          
          // Get fresh Firebase ID token (force refresh to avoid expired token)
          let firebaseIdToken = null;
          try {
            if (user.getIdToken) {
              firebaseIdToken = await user.getIdToken(true);  // force refresh = true
              console.log('[Session Restore] Got fresh Firebase ID token');
            }
          } catch (tokenError) {
            console.error('[Session Restore] Failed to get Firebase token:', tokenError);
            // Continue with fallback userId - user may need to re-login
          }

          if (firebaseIdToken) {
            // Get backend JWT and resolved userId
            const provider = user.providerData?.[0]?.providerId || 
                            (user.phoneNumber ? 'phone' : 'email');
            
            try {
              const tokenResponse = await api.auth.getToken(
                fallbackUserId, 
                provider, 
                firebaseIdToken, 
                user.email
              );
              
              if (tokenResponse.userId) {
                resolvedUserId = tokenResponse.userId;
              }
              console.log('[Session Restore] Got new backend token, userId:', resolvedUserId);
              
              // Store the resolved userId (not the JWT - that's in httpOnly cookie)
              setAuthToken(null, resolvedUserId);
            } catch (tokenErr) {
              console.error('[Session Restore] Backend token request failed:', tokenErr);
              // Continue with fallback/cached userId
            }
          }
        }

        // STEP 4: Create/update user record
        const provider = user.providerData?.[0]?.providerId || 
                        (user.phoneNumber ? 'phone' : 'email');
        const savedUser = await api.users.createOrUpdate({
          id: resolvedUserId,
          email: user.email || null,
          displayName: user.displayName || null,
          phoneNumber: user.phoneNumber || null,
          provider: provider
        });
        console.log('[Session Restore] User record updated:', savedUser);
        setUserProfile(savedUser);

        // STEP 5: Load user's trees using the RESOLVED userId (inline to avoid hoisting issues)
        console.log('[Session Restore] Fetching trees for userId:', resolvedUserId);
        const userTrees = await api.trees.getAll(resolvedUserId);
        console.log('[Session Restore] Found trees:', userTrees.length);

        if (userTrees.length > 0) {
          setCurrentTree(userTrees[0]);
          const treePeopleData = await api.people.getAll(userTrees[0].id);
          const treeRelData = await api.relationships.getAll(userTrees[0].id);
          setPeople(treePeopleData);
          setRelationships(treeRelData);
          console.log('[Session Restore] Loaded tree:', userTrees[0].name, 
                     'with', treePeopleData.length, 'people');
        } else {
          console.log('[Session Restore] No trees found, creating default tree');
          const newTree = await api.trees.create({
            name: "شجرة عائلتي",
            description: "شجرة العائلة الأولى",
            createdBy: resolvedUserId
          });
          setCurrentTree(newTree);
          setPeople([]);
          setRelationships([]);
        }
        
        setCurrentView("tree-builder");
        console.log('[Session Restore] Session restored successfully');
        setSessionRestoreLoading(false);
      } catch (error) {
        console.error('[Session Restore] Failed to restore session:', error);
        setSessionRestoreLoading(false);
        setSessionRestoreError(error.message || 'فشل في استعادة الجلسة');
        // Clear auth state and log out so user can try again
        clearAuthToken();
        try {
          await logout();
        } catch (logoutErr) {
          console.error('[Session Restore] Logout failed:', logoutErr);
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

  // Reusable helper to load user's trees and navigate to tree-builder
  const loadUserTreeData = async (resolvedUserId) => {
    console.log('[loadUserTreeData] Loading trees for userId:', resolvedUserId);
    const userTrees = await api.trees.getAll(resolvedUserId);
    console.log('[loadUserTreeData] Found trees:', userTrees.length);
    
    if (userTrees.length > 0) {
      setCurrentTree(userTrees[0]);
      const treePeopleData = await api.people.getAll(userTrees[0].id);
      const treeRelData = await api.relationships.getAll(userTrees[0].id);
      setPeople(treePeopleData);
      setRelationships(treeRelData);
      console.log('[loadUserTreeData] Loaded tree:', userTrees[0].name, 'with', treePeopleData.length, 'people');
    } else {
      console.log('[loadUserTreeData] No trees found, creating default tree');
      const newTree = await api.trees.create({
        name: "شجرة عائلتي",
        description: "شجرة العائلة الأولى",
        createdBy: resolvedUserId
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
      console.log('handleAuthSuccess called with user:', currentUser);
      if (!currentUser) {
        console.error('No user found after auth success');
        return;
      }

      const userId = currentUser.uid || currentUser.phoneNumber || currentUser.id;
      console.log('Creating/updating user with ID:', userId);
      const provider = currentUser.providerData?.[0]?.providerId || 
                       (currentUser.phoneNumber ? 'phone' : 'email');
      
      let resolvedUserId = userId;
      
      if (authToken) {
        // Phone login already has token - store with userId
        setAuthToken(authToken, userId);
      } else {
        // Firebase login - get fresh token with force refresh
        let firebaseIdToken = null;
        if (currentUser.getIdToken) {
          firebaseIdToken = await currentUser.getIdToken(true);  // force refresh
        }
        const tokenResponse = await api.auth.getToken(userId, provider, firebaseIdToken, currentUser.email);
        if (tokenResponse.userId) {
          resolvedUserId = tokenResponse.userId;
          console.log('Resolved to linked account:', resolvedUserId);
        }
        // Store token with resolved userId
        setAuthToken(tokenResponse.token, resolvedUserId);
      }
      
      const savedUser = await api.users.createOrUpdate({
        id: resolvedUserId,
        email: currentUser.email || null,
        displayName: currentUser.displayName || null,
        phoneNumber: currentUser.phoneNumber || null,
        provider: provider
      });
      console.log('User saved:', savedUser);
      setUserProfile(savedUser);

      await loadUserTreeData(resolvedUserId);
    } catch (err) {
      console.error('Error in handleAuthSuccess:', err);
      alert('خطأ أثناء تسجيل الدخول: ' + err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      interactiveLoginInProgressRef.current = true;
      restorationAttemptedRef.current = true;
      setAuthProcessing(true);
      const loggedInUser = await loginWithGoogle();
      await handleAuthSuccess(loggedInUser);
    } catch (err) {
      console.error('Google login failed:', err);
    } finally {
      setAuthProcessing(false);
      interactiveLoginInProgressRef.current = false;
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      interactiveLoginInProgressRef.current = true;
      restorationAttemptedRef.current = true;
      setAuthProcessing(true);
      const loggedInUser = await loginWithMicrosoft();
      await handleAuthSuccess(loggedInUser);
    } catch (err) {
      console.error('Microsoft login failed:', err);
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
      setAuthProcessing(true);
      let loggedInUser;
      if (authMode === 'login') {
        loggedInUser = await loginWithEmail(emailInput, passwordInput);
      } else {
        loggedInUser = await signUpWithEmail(emailInput, passwordInput);
      }
      await handleAuthSuccess(loggedInUser);
    } catch (err) {
      console.error('Email auth failed:', err);
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
        console.error('Backend logout failed:', apiErr);
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
      console.error('Logout failed:', err);
    }
  };

  const handleOpenProfile = () => {
    setProfileEmail(userProfile?.email || user?.email || '');
    setProfilePhone(userProfile?.phoneNumber || '');
    setShowProfile(true);
    setShowDeleteConfirm(false);
    setDeleteConfirmText('');
    setProfileMessage('');
  };

  const handleSaveProfile = async () => {
    const userId = userProfile?.id || user?.uid;
    if (!userId) return;
    try {
      setProfileSaving(true);
      setProfileMessage('');
      const updatedUser = await api.users.update(userId, {
        email: profileEmail || null,
        phoneNumber: profilePhone || null,
        displayName: userProfile?.displayName || user?.displayName || null
      });
      setUserProfile(updatedUser);
      setProfileMessage('تم حفظ التغييرات بنجاح');
      setTimeout(() => {
        setShowProfile(false);
        setProfileMessage('');
      }, 1500);
    } catch (err) {
      console.error('Profile save error:', err);
      setProfileMessage('فشل في حفظ التغييرات');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const userId = userProfile?.id || user?.uid;
    if (!userId || deleteConfirmText !== 'حذف') return;
    try {
      setProfileSaving(true);
      await api.users.delete(userId);
      try {
        await deleteAccount();
      } catch (authErr) {
        if (authErr.code === 'auth/requires-recent-login') {
          alert('يرجى تسجيل الخروج وإعادة تسجيل الدخول ثم المحاولة مرة أخرى لحذف حساب Firebase');
        }
        console.error('Firebase delete error (non-blocking):', authErr);
      }
      setCurrentTree(null);
      setPeople([]);
      setRelationships([]);
      setUserProfile(null);
      setCurrentView("auth");
      setShowProfile(false);
    } catch (err) {
      console.error('Account delete error:', err);
      setProfileMessage('فشل في حذف الحساب');
    } finally {
      setProfileSaving(false);
    }
  };

  const renderProfileDialog = () => {
    const isPhoneUser = userProfile?.provider === 'phone';
    
    return (
    <Dialog open={showProfile} onOpenChange={setShowProfile}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">{t.profileSettings}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4" dir="rtl">
          {isPhoneUser ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium">{t.currentPhone}</label>
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
              <label className="block text-sm font-medium">{t.currentEmail}</label>
              <input
                type="email"
                value={profileEmail}
                readOnly
                className="w-full px-3 py-2 border rounded-lg text-right bg-gray-100"
              />
            </div>
          )}
          
          {profileMessage && (
            <div className={`p-3 rounded-lg text-center text-sm ${profileMessage.includes('نجاح') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {profileMessage}
            </div>
          )}
          
          <div className="flex justify-center">
            <Button 
              onClick={() => setShowProfile(false)} 
              variant="outline"
            >
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
                  <p className="text-red-600 text-sm">{t.deleteAccountWarning}</p>
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
                      disabled={deleteConfirmText !== 'حذف' || profileSaving}
                      variant="destructive"
                      className="flex-1"
                    >
                      {t.confirmDelete}
                    </Button>
                    <Button 
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText('');
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
      setSmsError('الرجاء إدخال رقم الهاتف');
      return;
    }
    
    try {
      setAuthProcessing(true);
      setSmsError('');
      
      const response = await fetch('/api/sms/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phoneNumber: phoneInput })
      });
      
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || 'خطأ غير متوقع من الخادم' };
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'فشل إرسال رمز التحقق');
      }
      
      setSmsStep('code');
    } catch (err) {
      setSmsError(err.message);
    } finally {
      setAuthProcessing(false);
    }
  };

  const handleVerifySmsCode = async () => {
    if (!smsCode) {
      setSmsError('الرجاء إدخال رمز التحقق');
      return;
    }
    
    try {
      interactiveLoginInProgressRef.current = true;
      restorationAttemptedRef.current = true;
      setAuthProcessing(true);
      setSmsError('');
      
      const response = await fetch('/api/sms/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phoneNumber: phoneInput, code: smsCode })
      });
      
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text || 'خطأ غير متوقع من الخادم' };
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'رمز التحقق غير صحيح');
      }
      
      if (data.verified) {
        const normalizePhoneClient = (phone) => {
          if (!phone) return null;
          let formatted = phone.trim();
          if (formatted.startsWith('00971')) {
            return '+971' + formatted.slice(5);
          } else if (formatted.startsWith('971') && !formatted.startsWith('+')) {
            return '+' + formatted;
          } else if (!formatted.startsWith('+')) {
            return '+971' + formatted.replace(/^0/, '');
          }
          return formatted;
        };
        const formattedPhone = normalizePhoneClient(phoneInput);
        const resolvedUserId = data.userId || formattedPhone;
        const phoneUser = {
          uid: resolvedUserId,
          phoneNumber: formattedPhone,
          displayName: null,
          email: null
        };
        setShowSmsLogin(false);
        setSmsStep('phone');
        setPhoneInput('');
        setSmsCode('');
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
      const newPerson = await api.people.create({
        ...personData,
        treeId: currentTree?.id,
      });

      // If there's a relationship, create it
      if (relationshipType && selectedPerson) {
        if (relationshipType === "sibling") {
          // Prefer linking the new sibling to the same parents (parent-child relations)
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
          } else if (relationshipType === "child") {
            relData.parentId = selectedPerson;
            relData.childId = newPerson.id;
          } else if (relationshipType === "parent") {
            relData.parentId = newPerson.id;
            relData.childId = selectedPerson;
          }

          const newRel = await api.relationships.create(relData);
          setRelationships((prev) => [...prev, newRel]);
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
        const allParents = people.filter((p) => allParentIds.includes(p.id)).concat([newPerson]);
        
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
    } catch (error) {
      console.error('Failed to add person:', error);
      alert('فشل في إضافة الشخص: ' + error.message);
    }
  };

  const updatePerson = async (personData) => {
    try {
      // Update person via API
      const updatedPerson = await api.people.update(editingPerson, personData);
      
      // Update local state
      setPeople((prev) =>
        prev.map((p) => (p.id === editingPerson ? updatedPerson : p)),
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
      console.error('Failed to update person:', error);
      alert('فشل في تحديث الشخص: ' + error.message);
    }
  };

  const deletePerson = async (personId) => {
    if (window.confirm(t.deleteConfirm)) {
      try {
        // Delete person via API (this will also delete related relationships on backend)
        await api.people.delete(personId);
        
        // Update local state
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
      } catch (error) {
        console.error('Failed to delete person:', error);
        alert('فشل في حذف الشخص: ' + error.message);
      }
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

    // Just open the form for adding a parent
    setSelectedPerson(childId);
    setRelationshipType("parent");
    setEditingPerson(null);
    setFormKey((prev) => prev + 1);
    setShowPersonForm(true);
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

  const handleQuickCreateChild = (personId) => {
    const selected = people.find((p) => p.id === personId);
    if (!selected) return;

    // Open form for adding child
    setSelectedPerson(personId);
    setRelationshipType("child");
    setEditingPerson(null);
    setFormKey((prev) => prev + 1);
    setShowPersonForm(true);
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
    console.log('[getSiblings] parentRels for personId', personId, ':', parentRels);
    const parentIds = parentRels.map((r) => r.parentId);
    if (parentIds.length > 0) {
      console.log('[getSiblings] parentIds for personId', personId, ':', parentIds);
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
    const directSiblingIds = [...new Set(
      directSiblingRels.map((r) => (r.person1Id === personId ? r.person2Id : r.person1Id)),
    )];
    return people.filter((p) => directSiblingIds.includes(p.id));
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-right pr-12"
                dir="rtl"
                disabled={authProcessing}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <Button
              type="submit"
              disabled={authProcessing || !emailInput || !passwordInput}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3"
            >
              {authProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : authMode === 'login' ? (
                'تسجيل الدخول'
              ) : (
                'إنشاء حساب'
              )}
            </Button>
          </form>
          
          <div className="text-center mb-6">
            <button
              type="button"
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="text-purple-600 hover:text-purple-800 text-sm"
            >
              {authMode === 'login' ? 'ليس لديك حساب؟ إنشاء حساب جديد' : 'لديك حساب؟ تسجيل الدخول'}
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
              {authProcessing ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : (
                <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              تسجيل الدخول عبر Google
            </Button>
            <Button
              onClick={handleMicrosoftLogin}
              disabled={authProcessing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
            >
              {authProcessing ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <User className="w-5 h-5 ml-2" />}
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

        <Dialog open={showSmsLogin} onOpenChange={(open) => {
          setShowSmsLogin(open);
          if (!open) {
            setSmsStep('phone');
            setPhoneInput('');
            setSmsCode('');
            setSmsError('');
          }
        }}>
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
            
            {smsStep === 'phone' ? (
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
                      onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
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
                  {authProcessing ? (
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
                    onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ''))}
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
                      setSmsStep('phone');
                      setSmsCode('');
                      setSmsError('');
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
                    {authProcessing ? (
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

  // Helper function to build genealogical name chain
  const getGenealogicalName = (person) => {
    const treePeople = people.filter(p => p.treeId === currentTree?.id);
    const treeRels = relationships.filter(r => r.treeId === currentTree?.id);
    
    let nameParts = [person.firstName];
    let current = person;
    
    while (true) {
      // Find parent-child relationship where this person is the child
      const parentRel = treeRels.find(r => 
        r.type === "parent-child" && r.childId === current.id
      );
      if (!parentRel) break;
      
      // Look for male parent first
      const parent = treePeople.find(p => p.id === parentRel.parentId && p.gender === "male");
      if (!parent) {
        // If parent is female, try to find her male parent
        const femaleParent = treePeople.find(p => p.id === parentRel.parentId && p.gender === "female");
        if (femaleParent) {
          const femaleParentRel = treeRels.find(r => 
            r.type === "parent-child" && r.childId === femaleParent.id
          );
          if (femaleParentRel) {
            const grandparent = treePeople.find(p => p.id === femaleParentRel.parentId && p.gender === "male");
            if (grandparent) {
              current = grandparent;
              nameParts.push(grandparent.firstName);
              continue;
            }
          }
        }
        break;
      }
      nameParts.push(parent.firstName);
      current = parent;
    }
    
    // Find oldest ancestor's last name
    const oldestAncestor = treePeople.find(p => {
      const hasParent = treeRels.some(r => r.type === "parent-child" && r.childId === p.id);
      return !hasParent && p.lastName;
    });
    
    if (oldestAncestor?.lastName) {
      nameParts.push(oldestAncestor.lastName);
    } else if (person.lastName) {
      nameParts.push(person.lastName);
    }
    
    return nameParts.join(" ");
  };

  if (currentView === "family-members") {
    const treePeople = people.filter(p => p.treeId === currentTree?.id);
    
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button onClick={() => setCurrentView("dashboard")} variant="outline">
              <Home className="w-4 h-4 ml-2" />
              {t.backToDashboard}
            </Button>
            <h1 className="text-3xl font-bold">{t.familyMembers}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleOpenProfile} variant="outline">
              <User className="w-4 h-4 ml-2" />
              {t.profile}
            </Button>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="w-4 h-4 ml-2" />
              {t.logout}
            </Button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {treePeople.map(person => (
              <div key={person.id} className="bg-white rounded-lg shadow p-4">
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
            ))}
          </div>
          {treePeople.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              لا يوجد أفراد في العائلة بعد
            </div>
          )}
        </div>
        {renderProfileDialog()}
      </div>
    );
  }

  if (currentView === "relationships-detail") {
    const treePeople = people.filter(p => p.treeId === currentTree?.id);
    const treeRels = relationships.filter(r => r.treeId === currentTree?.id);
    
    // Get male parents (husbands who have wives and children)
    const maleParents = treePeople.filter(person => {
      if (person.gender !== "male") return false;
      
      const hasSpouse = treeRels.some(r => 
        r.type === "partner" && (r.person1Id === person.id || r.person2Id === person.id)
      );
      const hasChildren = treeRels.some(r => 
        r.type === "parent-child" && r.parentId === person.id
      );
      
      return hasSpouse && hasChildren;
    });

    const getRelationshipCounts = (person) => {
      const siblings = treeRels.filter(r => 
        r.type === "sibling" && (r.person1Id === person.id || r.person2Id === person.id)
      );
      const siblingIds = siblings.map(r => r.person1Id === person.id ? r.person2Id : r.person1Id);
      const siblingPeople = treePeople.filter(p => siblingIds.includes(p.id));
      
      const brothers = siblingPeople.filter(p => p.gender === "male").length;
      const sisters = siblingPeople.filter(p => p.gender === "female").length;
      
      const breastfeedingSiblings = siblings.filter(r => r.isBreastfeeding);
      const breastfeedingBrothers = breastfeedingSiblings.filter(r => {
        const sibId = r.person1Id === person.id ? r.person2Id : r.person1Id;
        const sib = treePeople.find(p => p.id === sibId);
        return sib?.gender === "male";
      }).length;
      const breastfeedingSisters = breastfeedingSiblings.filter(r => {
        const sibId = r.person1Id === person.id ? r.person2Id : r.person1Id;
        const sib = treePeople.find(p => p.id === sibId);
        return sib?.gender === "female";
      }).length;

      const spouseRels = treeRels.filter(r => 
        r.type === "partner" && (r.person1Id === person.id || r.person2Id === person.id)
      );
      const wives = spouseRels.length;

      const children = treeRels.filter(r => 
        r.type === "parent-child" && r.parentId === person.id
      ).length;

      return { brothers, sisters, breastfeedingBrothers, breastfeedingSisters, wives, children };
    };
    
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button onClick={() => setCurrentView("dashboard")} variant="outline">
              <Home className="w-4 h-4 ml-2" />
              {t.backToDashboard}
            </Button>
            <h1 className="text-3xl font-bold">{t.relationships}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleOpenProfile} variant="outline">
              <User className="w-4 h-4 ml-2" />
              {t.profile}
            </Button>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="w-4 h-4 ml-2" />
              {t.logout}
            </Button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {maleParents.map(person => {
              const counts = getRelationshipCounts(person);
              return (
                <div key={person.id} className="bg-white rounded-lg shadow p-4">
                  <div className="text-lg font-bold mb-2">
                    الاسم: {getGenealogicalName(person)}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-green-600">عدد الأخوة: {counts.brothers}</div>
                    <div className="text-pink-600">عدد الأخوات: {counts.sisters}</div>
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
                    <div className="text-purple-600">عدد الزوجات: {counts.wives}</div>
                    <div className="text-blue-600">عدد الأبناء: {counts.children}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {maleParents.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              لا يوجد علاقات زوجية مع أبناء بعد
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
        <div className="bg-white shadow-sm border-b px-8 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold">{t.dashboard}</h1>
          <div className="flex items-center gap-4">
            {(userProfile?.email || user?.email) && <span className="text-sm text-gray-600">{userProfile?.email || user?.email}</span>}
            <Button onClick={handleOpenProfile} variant="outline">
              <User className="w-4 h-4 ml-2" />
              {t.profile}
            </Button>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="w-4 h-4 ml-2" />
              {t.logout}
            </Button>
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
              {people.filter((p) => p.treeId === currentTree?.id).length}
            </div>
          </div>
          <div 
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg"
            onClick={() => currentTree && setCurrentView("relationships-detail")}
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
          <h1 className="text-2xl font-bold">{t.familyTreeName}</h1>
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
                console.log("Siblings for", selectedPerson, siblings);
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
                            onClick={async (e) => {
                              e.stopPropagation();
                              const personToReorder = selectedPerson;
                              setShowActionMenu(false);
                              await handleReorderSibling(personToReorder, "older");
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
                              await handleReorderSibling(personToReorder, "younger");
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
            style={{ width: "380px", maxHeight: "min(800px, 85vh)", overflow: "hidden" }}
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
                    setPendingFatherId(null);
                    setPendingMotherId(null);
                  }}
                  relationshipType={relationshipType}
                  defaultGender={defaultSpouseGender}
                  pendingFatherId={pendingFatherId}
                  pendingMotherId={pendingMotherId}
                  selectedPersonName={
                    selectedPerson
                      ? (() => {
                          const selected = treePeople.find((p) => p.id === selectedPerson);
                          return selected?.firstName || selected?.lastName || `Person ${selectedPerson}`;
                        })()
                      : ""
                  }
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
      if (relationshipType === 'spouse') return `${t.spouseOf} ${selectedPersonName}`;
      if (relationshipType === 'child') return `${t.childOf} ${selectedPersonName}`;
      if (relationshipType === 'parent') {
        // If we have pendingFatherId, we're adding mother (second parent)
        // If we have pendingMotherId, we're adding father (second parent)
        // Otherwise, check gender or default to father
        if (pendingFatherId) {
          return `${t.motherOf} ${selectedPersonName}`;
        } else if (pendingMotherId) {
          return `${t.fatherOf} ${selectedPersonName}`;
        } else if (defaultGender === 'female') {
          return `${t.motherOf} ${selectedPersonName}`;
        } else {
          return `${t.fatherOf} ${selectedPersonName}`;
        }
      }
      if (relationshipType === 'sibling') return `${t.siblingOf} ${selectedPersonName}`;
    }
    return "";
  };

  const getDefaultGender = () => {
    if (person?.gender) return person.gender;
    if (relationshipType === 'parent') {
      if (pendingFatherId) return 'female'; // Adding mother after father
      if (pendingMotherId) return 'male'; // Adding father after mother
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
      firstName: getDefaultFirstName(),
      lastName: person?.lastName || "",
      gender: getDefaultGender(),
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
  }, [person, defaultFirstName, relationshipType, selectedPersonName, pendingFatherId, pendingMotherId]);

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