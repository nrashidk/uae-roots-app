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
  Link2,
  Trash2,
  Pencil,
  X,
  Settings,
  Home,
  ChevronDown,
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
import LandingPage from "./pages/LandingPage.jsx";
import PublicLayout from "./pages/PublicLayout.jsx";
import {
  DirectoryTiles,
  DirectoryFamilies,
} from "./pages/Directory.jsx";
import PublicTree from "./pages/PublicTree.jsx";
import { PrivacyPolicy } from "./pages/PrivacyPolicy.jsx";
import FamilyTreeLayout from "./lib/family-tree-layout.js";
import {
  convertToAlgorithmFormat,
  findRootPerson,
} from "./lib/dataTransform.js";
import TreeCanvas from "./components/FamilyTree/TreeCanvas.jsx";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { formatAge } from "@/lib/utils";
import {
  api,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
  beginAction,
  endAction,
  onSessionEnded,
  resetSessionEndedNotice,
  isSessionEnded,
} from "./lib/api.js";

// Verbose tracing. Several of these print whole person/user objects — names,
// phone, email — so they are OFF in production and gated rather than deleted.
// Flip to true when debugging. console.error/warn are left alone: they only
// fire on real failures and carry no form data.
const DEBUG = false;

// URL <-> view mapping. The app still drives itself through `currentView`;
// routing is layered on top so every screen has an address, the back button
// works, and a reload lands where you were. Views keep their internal names so
// nothing downstream had to change.
const VIEW_BY_PATH = {
  "/dashboard": "dashboard",
  "/tree": "tree-builder",
  "/members": "family-members",
  "/relationships": "relationships-detail",
};
const PATH_BY_VIEW = {
  dashboard: "/dashboard",
  "tree-builder": "/tree",
  "family-members": "/members",
  "relationships-detail": "/relationships",
};
const PUBLIC_PATHS = ["/", "/privacy"];

// Public paths that carry a parameter, so an exact-match list cannot express
// them. Without this the route guard bounces a signed-out visitor to "/" and a
// signed-in one to "/tree", and the page is unreachable by anyone.
const PUBLIC_PATH_PATTERNS = [
  /^\/directory\/[A-Za-z]+$/,
  /^\/family\/\d+$/,
];

const isPublicPath = (path) =>
  PUBLIC_PATHS.includes(path) ||
  PUBLIC_PATH_PATTERNS.some((re) => re.test(path));

// Tree display preferences survive a reload. They lived only in component state,
// so «حفظ» closed the panel and nothing else — colours, box width and text size
// were back to default on the next visit, while the button claimed otherwise.
//
// localStorage, not the server: these are colours, sizes and booleans. No PII,
// nothing another device needs, and no migration. Per-browser is the right
// scope for a display preference.
//
// Module scope on purpose. A helper declared inside the component and called
// from a useState initialiser above its own declaration throws at render (const
// temporal dead zone) — the exact fault that crashed #6. Up here it cannot.
const OPTIONS_STORAGE_KEY = "uaeroots:treeOptions";

// Storage can throw, not just return null: Safari private mode and disabled
// site data both raise on access. A display preference must never take the app
// down, so every path returns/continues rather than propagating.
const readStoredOptions = () => {
  try {
    const raw = window.localStorage.getItem(OPTIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
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
    getGoogleIdTokenForLink,
    reauthenticateGoogle,
    loginWithMicrosoft,
    loginWithEmail,
    signUpWithEmail,
    logout,
    deleteAccount,
  } = useAuth();
  // Public screen shown to signed-out visitors: the landing page first, the
  // login form only once they ask for it. Becomes a route when routing lands.
  // The tree does not work on a phone. Tested on iOS 3 Aug: the zoom BUTTONS
  // work and nothing else does — you cannot pan to reach the rest of the tree,
  // tapping a person never opens the action menu, and the header buttons run off
  // the edge.
  //
  // Note the trap: TreeCanvas defines handleTouchStart/Move/End and sets
  // `touchAction: "none"`, so reading the source suggests touch is supported. It
  // is not, on a real device. This notice exists because the live test said so
  // and the code said otherwise.
  //
  // 768px matches the landing page's own breakpoint in LandingPage.css.
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  const [narrowNoticeDismissed, setNarrowNoticeDismissed] = useState(false);

  // The canvas below used `calc(100vh - 64px)`, a hardcoded guess at the header
  // height. Anything else stacked above it — the narrow-screen notice — pushed
  // the canvas off the bottom by exactly its own height. Measuring the chrome
  // instead means the canvas fits whatever is above it, and a second banner
  // later needs no arithmetic.
  const shellChromeRef = useRef(null);
  const [chromeHeight, setChromeHeight] = useState(64);

  useEffect(() => {
    const el = shellChromeRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setChromeHeight(el.offsetHeight));
    ro.observe(el);
    setChromeHeight(el.offsetHeight);
    return () => ro.disconnect();
    // Mount only. The observed wrapper is always rendered — the notice appears
    // and disappears INSIDE it — so the element never changes and re-subscribing
    // on every render would only churn observers.
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e) => setIsNarrow(e.matches);
    setIsNarrow(mq.matches);
    // addEventListener on MediaQueryList is not in older Safari, which still
    // ships addListener. Both are cheap to attach.
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  // Which family card is open on العائلات. ONE at a time: an expanded card takes
  // the full width of the grid, and several open at once would push the rest of
  // the page far enough down that the list stops being a list.
  const [expandedFamilyId, setExpandedFamilyId] = useState(null);

  const [publicScreen, setPublicScreen] = useState("landing");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
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
  // Confirmation shown after a successful (re)send — the resend button used to
  // fire with no visible change, so a user could not tell the click registered.
  const [smsInfo, setSmsInfo] = useState("");
  // Seconds until resend is allowed again. Without a cooldown, repeated clicks
  // pile more sends onto a number Twilio Verify rate-limits, which is how a
  // "nothing arrived" state gets worse the more you press.
  const [resendCooldown, setResendCooldown] = useState(0);

  // Tick the login resend cooldown down to zero, one second at a time. Must live AFTER
  // the state it reads — a hook placed above the useState hits the temporal dead
  // zone and throws at render.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);
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
  // Marrying two people who are ALREADY in the tree. No new person is created —
  // only a partner row. The tree is a rooted view, so each side is drawn when
  // that person is the root; no connector ever has to span the whole tree.
  const [spouseSourceFor, setSpouseSourceFor] = useState(null); // personId
  const [existingSpouseFor, setExistingSpouseFor] = useState(null); // personId
  const [linkChildrenFor, setLinkChildrenFor] = useState(null); // personId
  const [linkChildrenSelected, setLinkChildrenSelected] = useState(new Set());
  const [existingSpouseSearch, setExistingSpouseSearch] = useState("");
  // The picker fills the same panel as the edit form, so it pages rather than
  // scrolls — a scrollbar inside a fixed side panel is easy to miss.
  const [existingSpousePage, setExistingSpousePage] = useState(0);
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
  const [profileSaving, setProfileSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  // A phone account proves it is still present with an SMS code; a Google account
  // with a fresh popup. Deleting is the one irreversible action in the app.
  const [deleteCodeSent, setDeleteCodeSent] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  // Seconds until the delete-code resend is allowed again. Its own counter,
  // separate from the login resend, so the two flows never interfere.
  const [deleteResendCooldown, setDeleteResendCooldown] = useState(0);

  // Tick the delete-code resend cooldown down. Placed directly after its state so
  // it never reads the variable before initialization (the temporal dead zone).
  useEffect(() => {
    if (deleteResendCooldown <= 0) return;
    const id = setTimeout(() => setDeleteResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [deleteResendCooldown]);
  const [profileMessage, setProfileMessage] = useState("");
  // Tone is set explicitly rather than inferred from the text. It used to be
  // `message.includes("نجاح") ? green : red`, so anything that was neither a
  // success nor a failure — "code sent" — came out red and read as an error.
  const [profileMessageTone, setProfileMessageTone] = useState("error");
  // Login methods for the current account. One person can reach the same tree
  // by phone or by Google; these are the rows that make that true.
  const [identities, setIdentities] = useState([]);
  const [identitiesLoading, setIdentitiesLoading] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  // An account is NOT created until this is confirmed. The server has already
  // issued a session cookie by then, but no `users` row exists — so cancelling
  // leaves nothing behind.
  const [pendingSignup, setPendingSignup] = useState(null);

  // الأفراد: which card is expanded to its record, and which is in edit mode.
  // editingMemberId is DELIBERATELY separate from showPersonForm/editingPerson,
  // which drive the floating form over the tree. Sharing those flags would mount
  // both forms at once — the floating panel and the in-card one — bound to the
  // same formData.
  const [treeSettings, setTreeSettings] = useState({
    emirate: "",
    isPublished: false,
    familyName: "",
    femaleDisplay: "hidden",
    publicFields: ["name"],
  });
  const [editingFamilyName, setEditingFamilyName] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [expandedMemberId, setExpandedMemberId] = useState(null);
  const [editingMemberId, setEditingMemberId] = useState(null);

  // Set when a signed-in account has no recorded consent. Distinct from
  // pendingSignup: that one means "no account exists yet", this one means "the
  // account exists and predates the sign-up gate". They need different copy and
  // different actions — confirmSignup CREATES a row, which is wrong here.
  const [needsConsent, setNeedsConsent] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  // "phone" or a provider name, straight from the JWT — see /api/auth/check.
  const [sessionType, setSessionType] = useState(null);
  // Set when the server says the session is gone, so the login screen can explain
  // why rather than just appearing.
  const [sessionEndedMessage, setSessionEndedMessage] = useState(null);
  // Linking a phone is two steps — send a code, then check it — so the profile
  // needs a small amount of its own state. Google needs none: the popup returns
  // a token in one go.
  const [linkPhoneOpen, setLinkPhoneOpen] = useState(false);
  const [linkPhoneNumber, setLinkPhoneNumber] = useState("");
  const [linkPhoneCode, setLinkPhoneCode] = useState("");
  const [linkPhoneSent, setLinkPhoneSent] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  // The most recent deletion that has not been undone yet, if any. Drives the
  // «تراجع» button in the header. Restores must run newest-first, so
  // there is only ever one candidate — which is exactly what one button offers.
  const [restorableDeletion, setRestorableDeletion] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // Default values for options
  const DEFAULT_DISPLAY_OPTIONS = {
    // showName: true,
    showSurname: true,
    showBirthDate: false,
    showBirthPlace: false,
    showAge: false,
    showDeathDate: false,
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

  // Stored values are spread OVER the defaults, never used in place of them.
  // A preferences object written by an older build is missing any option added
  // since; replacing wholesale would leave those keys undefined and render
  // colours as `undefined`. Merging means a new option simply takes its default.
  // Lazy initialisers, so storage is read once on mount rather than every render.
  const [displayOptions, setDisplayOptions] = useState(() => ({
    ...DEFAULT_DISPLAY_OPTIONS,
    ...(readStoredOptions()?.display || {}),
  }));
  const [stylingOptions, setStylingOptions] = useState(() => ({
    ...DEFAULT_STYLING_OPTIONS,
    ...(readStoredOptions()?.styling || {}),
  }));


  // Grid cell size. WIDTH fixed; HEIGHT is the ROW PITCH and has to cover the
  // tallest box the current options can produce, or boxes collide.
  //
  // Boxes are centred on their grid point and rows sit CARD.h apart, so this
  // number is the whole vertical budget for a box plus the gap to the next row.
  // It was a constant 90 while box height grows with both the number of fields
  // shown AND the text-size slider — at 90 a full box already overflowed its
  // row and drew through its neighbours.
  //
  // Boxes are still sized PER PERSON in TreeCanvas; this only sets how far
  // apart the rows are. The arithmetic below mirrors the height calculation
  // there — if one changes, change the other.
  const CARD = useMemo(() => {
    const textSize = stylingOptions?.textSize || 14;
    const lineHeight = Math.round((textSize - 2) * 1.35);
    const nameLineHeight = Math.round(textSize * 1.45);
    const padding = 10;

    // Worst case: every enabled option. showAge and showDeathDate cannot share
    // a box — a person is living or not — so counting both would pad every row
    // for a line that can never appear.
    const opt = (k) => (displayOptions?.[k] ? 1 : 0);
    const detailLines =
      opt("showBirthPlace") +
      // Birth year, death year and age share ONE line: both years render as
      // "١٩٦٥ – ٢٠٠٠" together, and age only ever shows for a living person,
      // who by definition has no death year. Counting them separately reserved
      // rows that can never all appear.
      Math.max(
        opt("showBirthDate"),
        opt("showDeathDate"),
        opt("showAge"),
      );

    const tallestBox = padding * 2 + nameLineHeight + detailLines * lineHeight;
    const ROW_GAP = 24;
    return { w: 140, h: Math.max(90, tallestBox + ROW_GAP) };
  }, [
    stylingOptions?.textSize,
    displayOptions?.showBirthDate,
    displayOptions?.showBirthPlace,
    displayOptions?.showDeathDate,
    displayOptions?.showAge,
  ]);

  // Reset options to default.
  // Reset CLEARS THE STORE as well as the state. Setting state alone would look
  // right until the next reload, when the old saved values came back and the
  // reset appeared to have been ignored. Clearing here means reset holds even if
  // the user closes the panel without pressing حفظ.
  const handleResetOptions = () => {
    setDisplayOptions(DEFAULT_DISPLAY_OPTIONS);
    setStylingOptions(DEFAULT_STYLING_OPTIONS);
    try {
      window.localStorage.removeItem(OPTIONS_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear stored display options:", error);
    }
  };

  // What «حفظ» now does. Both option groups go in one key: they are saved and
  // cleared together, so splitting them only creates the possibility of half a
  // preference surviving.
  const handleSaveOptions = () => {
    try {
      window.localStorage.setItem(
        OPTIONS_STORAGE_KEY,
        JSON.stringify({ display: displayOptions, styling: stylingOptions }),
      );
    } catch (error) {
      // Storage full or blocked. The panel still closes and the choices still
      // apply for this visit — failing to persist is not a reason to trap the
      // user in a dialog.
      console.error("Failed to save display options:", error);
    }
    setShowOptions(false);
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
    // The picker blocks the person form from rendering, so leaving it set while
    // navigating away meant no form would open anywhere — including Family
    // Members, which has its own copy of the panel.
    setExistingSpouseFor(null);
    setExistingSpouseSearch("");
    setExistingSpousePage(0);
    setSpouseSourceFor(null);
    setLinkChildrenFor(null);
    setLinkChildrenSelected(new Set());
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
    // YEAR, not date. The tree prints ١٩٦٥ not 1965-10-10 — a full ISO date is
    // record detail, and the record lives on الأفراد now.
    showBirthDate: "سنة الميلاد",
    showBirthPlace: "مكان الميلاد",
    showAge: "العمر",
    showDeathDate: "سنة الوفاة",
  };

  const t = {
    uaeMobile: "الدخول عبر الهاتف الإماراتي",
    dashboard: "لوحة التحكم",
    myFamilyTrees: "أشجار عائلتي",
    familyMembers: "أفراد العائلة",
    // "العائلات", not "العلاقات". Each card is one man with his wives and
    // children, so the page shows families rather than every relationship.
    // العائلات over الأسر for CONSISTENCY: the neighbouring labels are already
    // أشجار عائلتي and أفراد العائلة, and a third word for the same family would
    // read as three different things.
    relationships: "العائلات",
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
    profession: "المهنة",
    summary: "الملخّص",
    save: "حفظ",
    cancel: "إلغاء",
    update: "تحديث",
    addSpouse: "إضافة زوج/زوجة",
    addParent: "إضافة والد",
    addChild: "إضافة طفل",
    addSibling: "إضافة شقيق",
    backToDashboard: "العودة إلى لوحة التحكم",
    narrowScreen:
      "لا يمكن تصفح الشجرة من خلال الهاتف، يرجى استخدام جهاز الكمبيوتر.",
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
    deleteAccount: "حذف الحساب",
    deleteAccountWarning: "تحذير: سيتم حذف جميع بياناتك وأشجار العائلة نهائياً",
    deleteAccountConfirm: "اكتب 'حذف' لتأكيد حذف الحساب",
    deleteSendCode: "إرسال رمز التحقق",
    deleteEnterCode: "أدخل رمز التحقق المرسل إليك",
    deleteReauthNote: "للتأكيد، سنتحقق من هويتك مرة أخرى قبل الحذف",
    confirmDelete: "تأكيد الحذف",
    back: "رجوع",
    loginMethods: "طرق تسجيل الدخول",
    methodPhone: "الهاتف",
    methodGoogle: "Google",
    linkAction: "ربط الحساب",
    unlinkAction: "إزالة",
    lastMethodLocked: "طريقة الدخول الوحيدة",
    linkedOk: "تم الربط بنجاح",
    willRestore: "سيُستعاد",
    willDelete: "سيُحذف",
    willRevert: "سيُعاد",
    // Arabic number agreement, not a single template. One takes the singular,
    // two the dual, 3-10 the plural, and 11 upward the singular again.
    linkOne: "ورابط واحد",
    linkTwo: "ورابطان",
    linkFew: "و {n} روابط",
    linkMany: "و {n} رابط",
    otherTwo: "وآخران",
    otherFew: "و {n} آخرين",
    otherMany: "و {n} آخر",
    signupTitle: "إنشاء حساب جديد",
    signupBody: "لا يوجد حساب مرتبط بـ",
    signupTerms: "بالمتابعة أنت توافق على سياسة الخصوصية",
    signupPrivacy: "سياسة الخصوصية",
    signupConfirm: "إنشاء الحساب",
    signupCancel: "إلغاء",
    currentSession: "الجلسة الحالية",
    enterPhone: "أدخل رقم الهاتف",
    sendCode: "إرسال الرمز",
    enterCode: "أدخل رمز التحقق",
    confirmCode: "تأكيد",
    codeSent: "تم إرسال الرمز",
    unlinkedOk: "تمت الإزالة بنجاح",
    divorcedM: "مطلق",
    divorcedF: "مطلقة",
    addSpouseChoice: "إضافة زوج/زوجة",
    spouseNewPerson: "شخص جديد",
    spouseExisting: "شخص موجود في الشجرة",
    pickExistingSpouse: "اختر من الشجرة",
    searchPlaceholder: "ابحث بالاسم",
    noEligible: "لا يوجد أشخاص مؤهلون في الشجرة",
    next: "التالي",
    previous: "السابق",
    removeMarriage: "حذف الزواج",
    removeMarriageConfirm:
      "سيتم حذف هذا الزواج فقط. يبقى الشخصان في الشجرة، ويبقى الأبناء مرتبطين بوالديهم. هل تريد المتابعة؟",
    removeMarriageOrphan:
      "سيتم حذف هذا الزواج، ومعه الأشخاص التالية أسماؤهم لأن هذا الزواج هو ارتباطهم الوحيد بالشجرة:",
    reviveBlocked:
      "لا يمكن إرجاع هذا الشخص على قيد الحياة: سيتجاوز شريكه الحد المسموح من الأزواج الأحياء.",
    genderBlockedMale:
      "لا يمكن تغيير الجنس إلى ذكر: يوجد زواج مسجّل مع ذكر. احذف الزواج أولاً ثم غيّر الجنس.",
    genderBlockedFemale:
      "لا يمكن تغيير الجنس إلى أنثى: يوجد زواج مسجّل مع أنثى. احذف الزواج أولاً ثم غيّر الجنس.",
    signInTitle: "تسجيل الدخول",
    signUpTitle: "إنشاء حساب جديد",
    // Just "undo". It said "undo the delete" when deletes were the only thing
    // the stack held; it now reverses creates, edits and reorders too.
    undoDelete: "تراجع",
    nothingToUndo: "لا يوجد عملية للتراجع عنها",
    mahramLineal: "لا يجوز الزواج: قرابة مباشرة (أصل أو فرع).",
    mahramSibling: "لا يجوز الزواج: أخ أو أخت.",
    mahramMilkSibling: "لا يجوز الزواج: أخ أو أخت بالرضاعة.",
    mahramNieceNephew: "لا يجوز الزواج: ابن الأخ أو بنت الأخ أو ابن الأخت أو بنت الأخت.",
    mahramAuntUncle: "لا يجوز الزواج: عمّ أو عمّة أو خال أو خالة.",
    mahramInLawLineal: "لا يجوز الزواج: أم الزوجة أو بنت الزوجة (الربيبة).",
    mahramSpouseOfLineal: "لا يجوز الزواج: زوجة الأب أو زوجة الابن.",
    mahramTwoSisters: "لا يجوز الجمع بين الأختين في وقت واحد.",
    mahramWomanAndAunt:
      "لا يجوز الجمع بين المرأة وعمتها أو خالتها في وقت واحد.",
    linkChildren: "ربط الأبناء",
    linkChildrenHintMother: "أبناء الزوج المسجّلون بدون أم",
    linkChildrenHintFather: "أبناء الزوجة المسجّلون بدون أب",
    linkChildrenNone: "لا يوجد أبناء بحاجة إلى ربط",
    linkChildrenSelected: "محدَّد",
    linkChildrenOf: "أبناء",
    genAbove: "جيل أعلى",
    genBelow: "جيل أدنى",
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
  // Has the cookie restore RUN yet — separate from whether it is running.
  // The route guard needs "we have finished deciding", and sessionRestoreLoading
  // only covers the in-flight window. A phone user has no Firebase, so
  // authLoading resolves false immediately while the restore has not started:
  // the guard saw signed-out on a private path and bounced to "/" before the
  // cookie was ever checked. Set on EVERY exit of that effect, early returns
  // included, or the guard waits forever.
  const [sessionChecked, setSessionChecked] = useState(false);
  // Only show a loader if the wait is long enough to notice.
  const [loaderVisible, setLoaderVisible] = useState(false);
  const [sessionRestoreError, setSessionRestoreError] = useState(null);

  // Cookie-based session restoration (for Phone SMS users who don't have Firebase sessions)
  // This runs when Firebase says NOT authenticated but a valid JWT cookie exists
  useEffect(() => {
    const restoreFromCookie = async () => {
      // Skip if Firebase says authenticated (Firebase-based restoration will handle it)
      if (isAuthenticated) {
        DEBUG && console.log("[Cookie Restore] Skipping - Firebase session exists");
        setSessionChecked(true);
        return;
      }

      // Wait for Firebase auth to finish loading first
      if (authLoading) {
        DEBUG && console.log("[Cookie Restore] Waiting for Firebase auth to finish...");
        return;
      }

      // Skip if tree already loaded
      if (currentTree) {
        DEBUG && console.log("[Cookie Restore] Skipping - tree already loaded");
        setSessionChecked(true);
        return;
      }

      // NO currentView guard. It used to be `if (currentView !== "auth") return`,
      // which was harmless when the app always started on the auth view — that
      // was the same as "restore on load". Once URL routing made /tree and
      // /dashboard real entry points, it became "never restore if you arrive
      // anywhere useful": a hard refresh on /tree set currentView to the tree,
      // this returned early, and the perfectly valid cookie was never checked.
      // Phone users were logged out on every refresh; Google users were not,
      // because Firebase restores from its own storage and never reaches here.
      //
      // Removing it is safe — isAuthenticated, authLoading, currentTree and
      // restorationAttemptedRef already prevent double-runs and loops. The only
      // cost is one auth check for an anonymous visitor on a public page, which
      // returns unauthenticated and stops.

      // Same reason as the Firebase effect: this path calls loadUserTreeData,
      // which creates a default TREE — for a user that does not exist yet.
      if (pendingSignup) return;

      // Skip if an interactive login is in progress
      if (interactiveLoginInProgressRef.current) {
        DEBUG && console.log(
          "[Cookie Restore] Skipping - interactive login in progress",
        );
        return;
      }

      // Prevent multiple restoration attempts
      if (restorationAttemptedRef.current) {
        DEBUG && console.log("[Cookie Restore] Already attempted");
        setSessionChecked(true);
        return;
      }

      DEBUG && console.log(
        "[Cookie Restore] Starting cookie-based restoration (non-Firebase user)...",
      );
      restorationAttemptedRef.current = true;
      setSessionRestoreLoading(true);
      setSessionRestoreError(null);

      try {
        // Check if backend cookie is still valid
        const backendAuth = await api.auth.check();
        DEBUG && console.log("[Cookie Restore] Backend auth check:", backendAuth);

        if (!backendAuth?.authenticated || !backendAuth?.userId) {
          DEBUG && console.log("[Cookie Restore] No valid backend session found");
          setSessionRestoreLoading(false);
          setSessionChecked(true);
          // Keep restorationAttemptedRef = true to prevent infinite loop
          // It will be reset on logout or when user successfully logs in
          return;
        }

        // A valid session whose id has no account: the sign-up gate was open and
        // the page reloaded. Reopen it rather than restoring — restoring would
        // create the account the person never agreed to.
        if (backendAuth.hasAccount === false) {
          setPendingSignup({
            resolvedUserId: backendAuth.userId,
            email: null,
            displayName: null,
            phoneNumber: null,
            provider: backendAuth.sessionType || "unknown",
          });
          setSessionRestoreLoading(false);
          setSessionChecked(true);
          return;
        }

        const resolvedUserId = backendAuth.userId;
        DEBUG && console.log(
          "[Cookie Restore] Found valid session for userId:",
          resolvedUserId,
        );

        // Store the resolved userId in sessionStorage
        setAuthToken(null, resolvedUserId);

        // Load user profile
        try {
          const savedUser = await api.users.get(resolvedUserId);
          DEBUG && console.log("[Cookie Restore] User profile loaded:", savedUser?.id);
          setUserProfile(savedUser);
        } catch (userError) {
          DEBUG && console.log(
            "[Cookie Restore] Could not load user profile:",
            userError.message,
          );
          // Continue anyway - user profile is optional for tree loading
        }

        // Load user's trees using the consolidated helper
        await loadUserTreeData(resolvedUserId);

        DEBUG && console.log(
          "[Cookie Restore] Session restored successfully from cookie!",
        );
        setSessionRestoreLoading(false);
        setSessionChecked(true);
      } catch (error) {
        console.error("[Cookie Restore] Failed to restore session:", error);
        setSessionRestoreError(
          "فشل استعادة الجلسة. يرجى تسجيل الدخول مرة أخرى.",
        );
        setSessionRestoreLoading(false);
        setSessionChecked(true);
        clearAuthToken();
        // Keep restorationAttemptedRef = true to prevent infinite loop
        // User will need to click login button to try again
      }
    };

    restoreFromCookie();
    // currentView is no longer a dependency — the effect does not read it, and
    // leaving it in would re-run this on every navigation for no reason.
  }, [authLoading, isAuthenticated, currentTree, pendingSignup]);

  // Robust session restoration when Firebase restores authentication
  useEffect(() => {
    const restoreSession = async () => {
      // Prevent multiple restoration attempts
      if (restorationAttemptedRef.current) return;

      // Skip if an interactive login is happening (handleAuthSuccess will handle it)
      if (interactiveLoginInProgressRef.current) return;

      // A signup decision is pending: no account exists and nobody has agreed to
      // anything yet. This effect creates a user record of its own, so without
      // this it performs exactly the silent creation the gate exists to stop —
      // handleGoogleLogin clears interactiveLoginInProgress in its finally, which
      // runs the moment the gate returns, so that guard is already down.
      if (pendingSignup) return;

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
      DEBUG && console.log(
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
          DEBUG && console.log("[Session Restore] Backend auth check:", backendAuth);
        } catch (e) {
          DEBUG && console.log(
            "[Session Restore] Backend auth check failed:",
            e.message,
          );
        }

        // Same as the cookie path: a valid session with no account means the
        // gate was open when the page reloaded.
        if (backendAuth?.authenticated && backendAuth?.hasAccount === false) {
          setPendingSignup({
            resolvedUserId: backendAuth.userId,
            email: user?.email || null,
            displayName: user?.displayName || null,
            phoneNumber: user?.phoneNumber || null,
            provider:
              user?.providerData?.[0]?.providerId ||
              backendAuth.sessionType ||
              "unknown",
          });
          setSessionRestoreLoading(false);
          return;
        }

        // STEP 2: If backend cookie is valid, use that userId
        if (backendAuth?.authenticated && backendAuth?.userId) {
          resolvedUserId = backendAuth.userId;
          DEBUG && console.log(
            "[Session Restore] Using backend userId:",
            resolvedUserId,
          );
          setAuthToken(null, resolvedUserId);
        } else {
          // STEP 3: Backend cookie expired/missing - need to re-authenticate
          DEBUG && console.log(
            "[Session Restore] Backend cookie invalid, re-authenticating...",
          );

          // Check sessionStorage for cached resolvedUserId first
          const cachedAuth = getAuthToken();
          if (cachedAuth?.resolvedUserId) {
            resolvedUserId = cachedAuth.resolvedUserId;
            DEBUG && console.log(
              "[Session Restore] Using cached userId:",
              resolvedUserId,
            );
          }

          // Get fresh Firebase ID token (force refresh to avoid expired token)
          let firebaseIdToken = null;
          try {
            if (user.getIdToken) {
              firebaseIdToken = await user.getIdToken(true); // force refresh = true
              DEBUG && console.log("[Session Restore] Got fresh Firebase ID token");
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
              );

              if (tokenResponse.userId) {
                resolvedUserId = tokenResponse.userId;
              }
              DEBUG && console.log(
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
        DEBUG && console.log("[Session Restore] User record updated:", savedUser);
        setUserProfile(savedUser);

        // STEP 5: Load user's trees using the RESOLVED userId (inline to avoid hoisting issues)
        DEBUG && console.log(
          "[Session Restore] Fetching trees for userId:",
          resolvedUserId,
        );
        const userTrees = await api.trees.getAll(resolvedUserId);
        DEBUG && console.log("[Session Restore] Found trees:", userTrees.length);

        if (userTrees.length > 0) {
          setCurrentTree(userTrees[0]);
          const treePeopleData = await api.people.getAll(userTrees[0].id);
          const treeRelData = await api.relationships.getAll(userTrees[0].id);
          setPeople(treePeopleData);
          setRelationships(treeRelData);
          DEBUG && console.log(
            "[Session Restore] Loaded tree:",
            userTrees[0].name,
            "with",
            treePeopleData.length,
            "people",
          );
        } else {
          DEBUG && console.log(
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

        setCurrentView((prev) => (prev === "auth" ? "tree-builder" : prev));
        DEBUG && console.log("[Session Restore] Session restored successfully");
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
  }, [authLoading, isAuthenticated, user, currentTree, logout, pendingSignup]);

  // Reset restoration flag when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      restorationAttemptedRef.current = false;
      clearAuthToken();
      // Return the public view to its starting state whenever auth flips to
      // signed-out, regardless of WHICH path got us here (logout button,
      // account deletion, expired session, failed session restore). Resetting
      // inside each handler was fragile — one missed path and the sign-in
      // dialog reappears already-open over the landing page.
      setAuthDialogOpen(false);
      setPublicScreen("landing");
      // Deliberately NO navigate here. This effect fires on mount for every
      // signed-out visitor, whatever path they arrived on — navigating would
      // bounce someone off /privacy before they ever saw it. Where a signed-out
      // visitor is ALLOWED to be is the guard effect's job; leaving is
      // handleLogout's job.
      setEmailInput("");
      setPasswordInput("");
      setShowSmsLogin(false);
      setSmsStep("phone");
      setPhoneInput("");
      setSmsCode("");
      setSmsError("");
    }
  }, [isAuthenticated]);

  // Every navigation starts at the top. The privacy link sits in the footer, so
  // the document is already scrolled down when it's followed. Keyed to the path
  // rather than to view state, so it covers back/forward and pasted links too.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // URL -> state. The address bar is the source of truth on load, on back/forward,
  // and on a pasted link.
  useEffect(() => {
    const path = location.pathname;

    if (path === "/privacy") {
      setPublicScreen("privacy");
      return;
    }
    if (path === "/") {
      setPublicScreen("landing");
      return;
    }

    // /tree/:personId roots the tree on that person, so a branch view survives a
    // reload and can be shared.
    const rooted = path.match(/^\/tree\/(\d+)$/);
    if (rooted) {
      const id = Number(rooted[1]);
      setCurrentView("tree-builder");
      setSelectedPerson((prev) => (prev === id ? prev : id));
      setHighlightedPerson((prev) => (prev === id ? prev : id));
      return;
    }

    const view = VIEW_BY_PATH[path];
    if (view) setCurrentView(view);
  }, [location.pathname]);

  // state -> URL. Only once signed in; the public screens are driven the other
  // way. Re-rooting uses `replace` because clicking through ten relatives
  // shouldn't leave ten entries in the back button.
  useEffect(() => {
    if (!isAuthenticated && !userProfile) return;
    if (currentView === "auth") return;
    // Public pages are reachable signed in or out; don't drag the user off them.
    // This exempted ONLY /privacy, so a signed-in visitor opening /directory/SH
    // or /family/65 was pulled straight back to their own view — which also made
    // it impossible to look at your own published tree without logging out.
    if (isPublicPath(location.pathname)) return;

    const want =
      currentView === "tree-builder"
        ? selectedPerson
          ? `/tree/${selectedPerson}`
          : "/tree"
        : PATH_BY_VIEW[currentView];
    if (!want || location.pathname === want) return;

    const rerooting =
      currentView === "tree-builder" && location.pathname.startsWith("/tree");
    navigate(want, { replace: rerooting });
  }, [currentView, selectedPerson, isAuthenticated, userProfile]);

  // Guards. Signed-out visitors can only see the public paths; signed-in users
  // don't need the marketing page, and land on their tree — which shows the
  // "start your tree" prompt when it's empty, so first-time users get the right
  // screen without a separate route.
  useEffect(() => {
    // Wait until the session question has actually been ANSWERED. authLoading
    // covers Firebase and sessionRestoreLoading covers the in-flight cookie
    // check, but neither covers "the cookie check has not started yet" — which
    // is where a phone user sits on first paint, since there is no Firebase to
    // wait for. Without sessionChecked the guard read signed-out on a private
    // path and bounced to "/", then the restore pulled the user back: the URL
    // flicker. Ordering, not logic, was making it come out right.
    if (authLoading || sessionRestoreLoading || !sessionChecked) return;
    const signedIn = isAuthenticated || !!userProfile;
    const path = location.pathname;
    const isPublic = isPublicPath(path);

    if (!signedIn && !isPublic) {
      navigate("/", { replace: true });
      return;
    }
    if (signedIn && path === "/") {
      navigate("/tree", { replace: true });
      return;
    }
    // Unknown path for a signed-in user -> their tree.
    if (
      signedIn &&
      !isPublic &&
      !VIEW_BY_PATH[path] &&
      !/^\/tree\/\d+$/.test(path)
    ) {
      navigate("/tree", { replace: true });
    }
  }, [
    authLoading,
    sessionRestoreLoading,
    sessionChecked,
    isAuthenticated,
    userProfile,
    location.pathname,
  ]);

  useEffect(() => {
    if (!authLoading && !sessionRestoreLoading) {
      setLoaderVisible(false);
      return;
    }
    const t = setTimeout(() => setLoaderVisible(true), 300);
    return () => clearTimeout(t);
  }, [authLoading, sessionRestoreLoading]);

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

  const treeRels = useMemo(() => {
    return relationships.filter((r) => r.treeId === currentTree?.id);
  }, [relationships, currentTree?.id]);

  const peopleById = useMemo(
    () => new Map(treePeople.map((p) => [p.id, p])),
    [treePeople],
  );

  // Relationship lookups, hoisted to component scope.
  //
  // These lived inside the العائلات render, closing over ITS local treePeople /
  // treeRels, so الأفراد could not call them. Rebuilding them there would have
  // been a seventh copy of parent traversal in this file — parentsOf alone is
  // already rebuilt in six places — and the next fix would have to be applied
  // twice. العائلات now calls these same functions; its local copies are gone.
  const fatherOf = (id) => {
    const parentIds = treeRels
      .filter((r) => r.type === "parent-child" && r.childId === id)
      .map((r) => r.parentId);
    return (
      parentIds.map((pid) => peopleById.get(pid)).find((p) => p?.gender === "male") ||
      null
    );
  };

  const getRelationshipCounts = (person) => {
    const spouseRels = treeRels.filter(
      (r) =>
        r.type === "partner" &&
        (r.person1Id === person.id || r.person2Id === person.id),
    );
    // Wives the man has RIGHT NOW: not divorced, and living. Deliberately the
    // same test the spouse limit uses, so the collapsed card can never show a
    // number that appears to break the four-wife rule.
    //
    // Counting every partner row ever written showed a man with one wife, one
    // divorce and one deceased wife as having three, while every RULE in the
    // app treated him as having one. Counting divorces separately fixed half of
    // it and left the other half: خالد showed SIX against a limit of four,
    // because two of his wives had died.
    //
    // Nothing is hidden — divorced and deceased wives both appear in the
    // expanded card, badged, with their children under them. The collapsed
    // card answers "how many wives does he have"; the expanded one answers
    // "who are they".
    const wives = spouseRels.filter((r) => {
      if (r.status === "divorced") return false;
      const wifeId = r.person1Id === person.id ? r.person2Id : r.person1Id;
      const wife = treePeople.find((p) => p.id === wifeId);
      return wife ? wife.isLiving !== false : false;
    }).length;

    const children = treeRels.filter(
      (r) => r.type === "parent-child" && r.parentId === person.id,
    ).length;

    return { wives, children };
  };

  const motherOf = (id) => {
    const parentIds = treeRels
      .filter((r) => r.type === "parent-child" && r.childId === id)
      .map((r) => r.parentId);
    return (
      parentIds
        .map((pid) => peopleById.get(pid))
        .find((p) => p?.gender === "female") || null
    );
  };

  // CODES, never Arabic text — the stored value must survive a change of
  // wording, and an English directory has to stay possible.
  const EMIRATES = [
    { code: "AZ", label: "أبوظبي" },
    { code: "DU", label: "دبي" },
    { code: "SH", label: "الشارقة" },
    { code: "AJ", label: "عجمان" },
    { code: "UQ", label: "أم القيوين" },
    { code: "RK", label: "رأس الخيمة" },
    { code: "FU", label: "الفجيرة" },
  ];
  const emirateLabel = (code) =>
    EMIRATES.find((e) => e.code === code)?.label || null;

  // Mirror the tree's stored settings into local state whenever it loads or
  // changes. familyName stays "" when NULL — empty means "derive", and the
  // input shows the derived name as its starting point.
  useEffect(() => {
    if (!currentTree) return;
    setTreeSettings({
      emirate: currentTree.emirate || "",
      isPublished: currentTree.isPublished === true,
      familyName: currentTree.familyName || "",
      femaleDisplay: currentTree.femaleDisplay || "hidden",
      publicFields: (currentTree.publicFields || "name").split(","),
    });
    setEditingFamilyName(false);
  }, [currentTree]);

  const saveTreeSettings = async (patch) => {
    if (!currentTree || settingsBusy) return;
    setSettingsBusy(true);
    try {
      const updated = await api.trees.updateSettings(currentTree.id, patch);
      // Take the SERVER's row, not the local guess — the value shown must be
      // the value stored.
      setCurrentTree(updated);
      setTreeSettings({
        emirate: updated.emirate || "",
        isPublished: updated.isPublished === true,
        familyName: updated.familyName || "",
        femaleDisplay: updated.femaleDisplay || "hidden",
        publicFields: (updated.publicFields || "name").split(","),
      });
      setEditingFamilyName(false);
      // Brief confirmation. The dropdown and the toggle save on change with no
      // button to press, so without this a change gives no sign it landed.
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save tree settings:", error);
      window.alert("تعذّر حفظ الإعدادات: " + error.message);
    } finally {
      setSettingsBusy(false);
    }
  };

  const milkSiblingsOf = (id) =>
    treeRels
      .filter(
        (r) =>
          r.type === "sibling" &&
          r.isBreastfeeding &&
          (r.person1Id === id || r.person2Id === id),
      )
      .map((r) => peopleById.get(r.person1Id === id ? r.person2Id : r.person1Id))
      .filter(Boolean);

  // Everything the record card on الأفراد shows, in one place, so the compact
  // line and the expanded body can never disagree.
  const memberRecord = (person) => {
    const yr = (d) => (d ? String(d).slice(0, 4) : null);
    const born = yr(person.birthDate);
    const died = yr(person.deathDate);
    const isLiving = person.isLiving !== false;

    // Death date is ignored for a living person: the form hides that field
    // rather than clearing it on older rows, so a stale value can survive.
    // Living: the AGE is the useful figure and the birth year is in the record
    // below, so the compact line does not repeat it. Deceased: the span is what
    // identifies them, and there is no age to show.
    const lifespan = !isLiving && born && died ? `${born} – ${died}` : null;

    const age =
      isLiving && born ? new Date().getFullYear() - parseInt(born, 10) : null;

    const counts = getRelationshipCounts(person);
    return {
      lifespan,
      ageLabel: age != null && age >= 0 ? formatAge(age) : null,
      father: fatherOf(person.id),
      mother: motherOf(person.id),
      spouseLabel: person.gender === "female" ? "الزوج" : "الزوجات",
      counts,
      milk: milkSiblingsOf(person.id),
      isLiving,
    };
  };

  // Which display toggles can actually change anything on THIS tree.
  //
  // Every line in TreeCanvas is already guarded per person — showDeathDate only
  // draws when person.deathDate exists, showAge only when there is a birthDate
  // AND the person is living. So on a tree where nobody has died, تاريخ الوفاة
  // is a switch that does nothing when flipped, with no explanation.
  //
  // The conditions below MIRROR the ones in TreeCanvas. If a draw condition
  // changes there, change it here too, or the panel will promise a line that
  // never appears.
  const displayOptionHasData = useMemo(() => {
    const any = (fn) => treePeople.some(fn);
    return {
      showSurname: any((p) => p.lastName),
      showBirthDate: any((p) => p.birthDate),
      showBirthPlace: any((p) => p.birthPlace),
      showAge: any((p) => p.birthDate && p.isLiving !== false),
      showDeathDate: any((p) => p.deathDate && p.isLiving === false),
    };
  }, [treePeople]);


  // The people actually shown as Family Members cards — tree people minus
  // legacy names-only milk-parent records (real people rows created before the
  // text-field pivot). Computed once here so the dashboard count and the
  // Family Members list can never disagree: both read this same set.
  const visibleFamilyMembers = useMemo(() => {
    // Milk-siblings are now ORDINARY people: they have real parent-child links
    // like anyone else, added through the normal flow. The old rule here hid the
    // "parents of a milk-relative" because they used to be names-only stub
    // records created by the milk form. That form is gone, so those parents are
    // now legitimate family members and must NOT be hidden.
    return treePeople;
  }, [treePeople]);

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

      const hasMultipleWives = otherSpouseIds.length > 1;
      otherSpouseIds.forEach((sid, idx) => {
        if (!byId.has(sid)) return;
        const sp = byId.get(sid);
        // Wife-order labels appear ONLY when there is more than one wife —
        // a single-wife family stays clean. Wives from the second onward also
        // start a new row so each wife heads her own group.
        cards.push(
          hasMultipleWives
            ? {
                ...sp,
                _spouseIndex: idx + 1,
                _startsNewRow: idx > 0,
              }
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
    DEBUG && console.log("[loadUserTreeData] Loading trees for userId:", resolvedUserId);
    const userTrees = await api.trees.getAll(resolvedUserId);
    DEBUG && console.log("[loadUserTreeData] Found trees:", userTrees.length);

    if (userTrees.length > 0) {
      setCurrentTree(userTrees[0]);
      const treePeopleData = await api.people.getAll(userTrees[0].id);
      const treeRelData = await api.relationships.getAll(userTrees[0].id);
      setPeople(treePeopleData);
      setRelationships(treeRelData);
      DEBUG && console.log(
        "[loadUserTreeData] Loaded tree:",
        userTrees[0].name,
        "with",
        treePeopleData.length,
        "people",
      );
    } else {
      DEBUG && console.log("[loadUserTreeData] No trees found, creating default tree");
      const newTree = await api.trees.create({
        name: "شجرة عائلتي",
        description: "شجرة العائلة الأولى",
        createdBy: resolvedUserId,
      });
      setCurrentTree(newTree);
      setPeople([]);
      setRelationships([]);
    }

    // Default to the tree ONLY if no view has been chosen yet. URL routing runs
    // first and may already have selected /members or /relationships from the
    // path; forcing tree-builder here overwrote it, so a hard refresh on those
    // pages bounced to the tree. "auth" means nothing else claimed the view.
    setCurrentView((prev) => (prev === "auth" ? "tree-builder" : prev));
  };

  const confirmSignup = async () => {
    if (!pendingSignup || linkBusy) return;
    setLinkBusy(true);
    try {
      // The server no longer trusts `email` from this body — it writes an email
      // identity only against a Firebase token it verifies itself. A phone
      // signup needs nothing here: the server already knows the number, because
      // Twilio approved it and it IS this session's user id.
      let firebaseIdToken = null;
      if (pendingSignup.provider !== "phone" && user?.getIdToken) {
        try {
          firebaseIdToken = await user.getIdToken(true);
        } catch (tokenError) {
          console.error("Signup: could not get Firebase token:", tokenError);
        }
      }

      const saved = await api.users.createOrUpdate({
        id: pendingSignup.resolvedUserId,
        email: pendingSignup.email,
        displayName: pendingSignup.displayName,
        phoneNumber: pendingSignup.phoneNumber,
        provider: pendingSignup.provider,
        firebaseIdToken,
      });
      setUserProfile(saved);
      setAuthDialogOpen(false);
      setPendingSignup(null);
      await loadUserTreeData(pendingSignup.resolvedUserId);
    } catch (error) {
      console.error("Signup failed:", error);
      window.alert("تعذّر إنشاء الحساب: " + error.message);
    } finally {
      setLinkBusy(false);
    }
  };

  // Cancel leaves nothing behind: the server issued a session cookie, but no
  // `users` row was ever written, so clearing the session is a full undo.
  const cancelSignup = async () => {
    setPendingSignup(null);
    try {
      await api.auth.logout();
    } catch (error) {
      console.error("Signup cancel: logout failed:", error);
    }
    try {
      await logout();
    } catch (error) {
      console.error("Signup cancel: firebase logout failed:", error);
    }
    clearAuthToken();
    setUserProfile(null);
    setCurrentTree(null);
    setPeople([]);
    setRelationships([]);
    setIdentities([]);
    restorationAttemptedRef.current = false;
  };

  // `hasSession` replaces what used to be an `authToken` argument. The phone path
  // already holds a session by the time it calls this — SMS verification set the
  // cookie — so it must NOT go on to call /auth/token, which is the FIREBASE
  // exchange and refuses a phone user for having no Firebase token. That routing
  // decision was made by whether a token STRING had been passed in, which is the
  // only reason the JSON body still returned the JWT. A boolean carries the same
  // signal without handing the token to anything that can read the page.
  const handleAuthSuccess = async (phoneUser = null, hasSession = false) => {
    try {
      setSessionEndedMessage(null);
      resetSessionEndedNotice();
      const currentUser = phoneUser || user;
      DEBUG && console.log("handleAuthSuccess called with user:", currentUser);
      if (!currentUser) {
        console.error("No user found after auth success");
        return;
      }

      // Set by whichever path issued the session. The phone path attaches it to
      // the user object it builds; the Firebase path reads it off the token
      // response below.
      let isNewUser = !!currentUser.__isNewUser;

      const userId =
        currentUser.uid || currentUser.phoneNumber || currentUser.id;
      DEBUG && console.log("Creating/updating user with ID:", userId);
      const provider =
        currentUser.providerData?.[0]?.providerId ||
        (currentUser.phoneNumber ? "phone" : "email");

      let resolvedUserId = userId;

      if (hasSession) {
        // Phone login: the cookie is already set, so just record the id.
        setAuthToken(null, userId);
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
        );
        if (tokenResponse.userId) {
          resolvedUserId = tokenResponse.userId;
          DEBUG && console.log("Resolved to linked account:", resolvedUserId);
        }
        isNewUser = !!tokenResponse.isNewUser;
        // Only the id is kept. The JWT lives in an httpOnly cookie the browser
        // attaches by itself — nothing in JS should ever hold it.
        setAuthToken(null, resolvedUserId);
      }

      // No account for this identity yet — ask before making one. Pressing
      // "login" with an unrecognised Google address used to create an account
      // silently, with no confirmation and no terms.
      if (isNewUser) {
        setPendingSignup({
          resolvedUserId,
          email: currentUser.email || null,
          displayName: currentUser.displayName || null,
          phoneNumber: currentUser.phoneNumber || null,
          provider,
        });
        return;
      }

      DEBUG && console.log("[handleAuthSuccess] Calling createOrUpdate with:", { id: resolvedUserId, provider });
      const savedUser = await api.users.createOrUpdate({
        id: resolvedUserId,
        email: currentUser.email || null,
        displayName: currentUser.displayName || null,
        phoneNumber: currentUser.phoneNumber || null,
        provider: provider,
      });
      DEBUG && console.log("[handleAuthSuccess] User saved:", savedUser);
      setUserProfile(savedUser);

      // Close the auth dialog now that we're in; leaving it true means it
      // reappears already-open the moment the user signs out.
      setAuthDialogOpen(false);
      setEmailInput("");
      setPasswordInput("");

      DEBUG && console.log("[handleAuthSuccess] Loading tree data...");
      await loadUserTreeData(resolvedUserId);
      DEBUG && console.log("[handleAuthSuccess] Complete!");
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
      // Login methods belong to the account that just left. Without this the
      // next user sees the previous one's methods until a full reload — which
      // made a phone-only account show an إزالة button it should not have.
      setIdentities([]);
      setCurrentView("auth");

      // Return the public view to its starting state. Without this the auth
      // dialog is still flagged open from before sign-in and pops straight back
      // up on logout, and the previous user's email stays in the field.
      setAuthDialogOpen(false);
      setPublicScreen("landing");
      setEmailInput("");
      setPasswordInput("");
      setShowSmsLogin(false);
      setSmsStep("phone");
      setPhoneInput("");
      setSmsCode("");
      setSmsError("");

      navigate("/", { replace: true });

      // Reset restoration flag so it can run again on next login
      restorationAttemptedRef.current = false;
      setSessionRestoreError(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleOpenProfile = () => {
    setShowProfile(true);
    setShowDeleteConfirm(false);
    setDeleteConfirmText("");
    setProfileMessageTone("error");
    setProfileMessage("");
  };

  // handleSaveProfile REMOVED. It was defined here and never called — no
  // email/phone edit UI exists — and setProfileEmail/setProfilePhone were never
  // called either, so the state it read was permanently empty. Running it would
  // have nulled the user's email, phone and display name. PUT /api/users/:id went
  // with it; POST /api/users already handles the update case.

  const handleSendDeleteCode = async () => {
    const phone = identities.find((i) => i.identityType === "phone");
    if (!phone) return;
    setProfileSaving(true);
    try {
      await api.auth.sendReauthCode(phone.identityValue);
      setDeleteCodeSent(true);
      setDeleteResendCooldown(30);
      setProfileMessageTone("info");
      setProfileMessage(t.codeSent);
    } catch (error) {
      setProfileMessageTone("error");
      setProfileMessage(error.message || "تعذّر إرسال الرمز");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const userId = userProfile?.id || user?.uid;
    if (!userId || deleteConfirmText !== "حذف") return;
    try {
      setProfileSaving(true);

      // Prove presence before anything is destroyed. The proof matches how this
      // session was created — a phone account sends the code it just received, a
      // Google account re-runs the popup so auth_time is now rather than whenever
      // the stored credential was first granted.
      let proof = {};
      if (sessionType === "phone") {
        const phone = identities.find((i) => i.identityType === "phone");
        proof = { phoneNumber: phone?.identityValue, code: deleteCode.trim() };
      } else {
        proof = { firebaseIdToken: await reauthenticateGoogle() };
      }

      await api.users.delete(userId, proof);
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
      // Login methods belong to the account that just left. Without this the
      // next user sees the previous one's methods until a full reload — which
      // made a phone-only account show an إزالة button it should not have.
      setIdentities([]);
      setCurrentView("auth");
      setShowProfile(false);
      setAuthDialogOpen(false);
      setPublicScreen("landing");
      setEmailInput("");
      setPasswordInput("");
    } catch (err) {
      console.error("Account delete error:", err);
      setProfileMessageTone("error");
      setProfileMessage("فشل في حذف الحساب");
    } finally {
      setProfileSaving(false);
    }
  };

  // The app learns its session ended from ONE place. Previously each caller
  // handled its own 401: a write alerted, the profile emptied, the undo button
  // greyed out — and the user stayed on a screen that looked signed in while
  // nothing worked.
  useEffect(() => {
    onSessionEnded((message) => {
      setSessionEndedMessage(message || null);
      clearAuthToken();
      setUserProfile(null);
      setCurrentTree(null);
      setPeople([]);
      setRelationships([]);
      setIdentities([]);
      setSessionType(null);
      setShowProfile(false);
      // BLOCK restoration, do not re-arm it. This handler nulls currentTree,
      // which is a dependency of the Firebase restore effect — so that effect
      // re-runs immediately, while the Firebase credential is still live because
      // logout() below has not resolved yet. Re-armed, it took the "backend
      // cookie invalid, re-authenticate" branch and called /auth/token, the same
      // endpoint a deliberate login calls, which bumps token_version again. The
      // terminated browser signed itself back in and evicted the device that had
      // just replaced it — sessions ping-ponging, neither one staying dead.
      //
      // Leaving it true is safe: handleAuthSuccess and handleLogout both reset it,
      // so a deliberate sign-in still restores normally.
      restorationAttemptedRef.current = true;
      // Drop the Firebase credential too, or it silently mints a new token and
      // signs the user straight back in — which is how the terminated session
      // went unnoticed before.
      logout().catch(() => {});
    });
  }, [logout]);

  // Report a failure UNLESS the session ended — in which case the user is already
  // being returned to the login screen with a banner explaining why, and telling
  // them the add failed as well is just noise on the way out.
  const failAlert = (message) => {
    if (isSessionEnded()) return;
    window.alert(message);
  };

  const loadIdentities = async () => {
    setIdentitiesLoading(true);
    try {
      setIdentities(await api.identities.list());
      const check = await api.auth.check();
      setSessionType(check?.sessionType || null);
    } catch (error) {
      console.error("Failed to load identities:", error);
      setIdentities([]);
    } finally {
      setIdentitiesLoading(false);
    }
  };

  useEffect(() => {
    if (showProfile) {
      loadIdentities();
    } else {
      // Reset the phone form so reopening the dialog does not resume a
      // half-finished verification against a number the user has forgotten.
      setLinkPhoneOpen(false);
      setLinkPhoneSent(false);
      setLinkPhoneNumber("");
      setLinkPhoneCode("");
      setProfileMessageTone("error");
    setProfileMessage("");
    }
  }, [showProfile]);

  const handleLinkGoogle = async () => {
    if (linkBusy) return;
    setLinkBusy(true);
    setProfileMessageTone("error");
    setProfileMessage("");
    // Stop the app's restore effects reacting to the brief Firebase session the
    // popup creates — we are linking, not switching accounts.
    interactiveLoginInProgressRef.current = true;
    try {
      const idToken = await getGoogleIdTokenForLink();
      await api.identities.linkGoogle(idToken);
      await loadIdentities();
      setProfileMessageTone("success");
      setProfileMessage(t.linkedOk);
    } catch (error) {
      console.error("Link Google failed:", error);
      setProfileMessageTone("error");
      setProfileMessage(error.message || "تعذّر الربط");
    } finally {
      interactiveLoginInProgressRef.current = false;
      setLinkBusy(false);
    }
  };

  const handleSendLinkCode = async () => {
    if (linkBusy || !linkPhoneNumber.trim()) return;
    setLinkBusy(true);
    setProfileMessageTone("error");
    setProfileMessage("");
    try {
      // NOT api.auth.sendSmsCode — that is the login path, which sends first
      // and asks questions later. This one refuses a taken number before Twilio.
      await api.identities.sendPhoneCode(linkPhoneNumber.trim());
      setLinkPhoneSent(true);
      setProfileMessageTone("info");
      setProfileMessage(t.codeSent);
    } catch (error) {
      console.error("Send link code failed:", error);
      setProfileMessageTone("error");
      setProfileMessage(error.message || "تعذّر إرسال الرمز");
    } finally {
      setLinkBusy(false);
    }
  };

  const handleLinkPhone = async () => {
    if (linkBusy || !linkPhoneCode.trim()) return;
    setLinkBusy(true);
    setProfileMessageTone("error");
    setProfileMessage("");
    try {
      await api.identities.linkPhone(linkPhoneNumber.trim(), linkPhoneCode.trim());
      await loadIdentities();
      setLinkPhoneOpen(false);
      setLinkPhoneSent(false);
      setLinkPhoneNumber("");
      setLinkPhoneCode("");
      setProfileMessageTone("success");
      setProfileMessage(t.linkedOk);
    } catch (error) {
      console.error("Link phone failed:", error);
      setProfileMessageTone("error");
      setProfileMessage(error.message || "تعذّر الربط");
    } finally {
      setLinkBusy(false);
    }
  };

  const handleUnlinkIdentity = async (id) => {
    if (linkBusy) return;
    setLinkBusy(true);
    setProfileMessageTone("error");
    setProfileMessage("");

    // Is this the method the current session came in through? The server ends
    // those sessions; the client has to follow, or the app stays on screen making
    // requests that all fail.
    const removed = identities.find((i) => i.id === id);
    const removingOwnMethod =
      removed &&
      (removed.identityType === "phone") === (sessionType === "phone");

    try {
      await api.identities.unlink(id);

      if (removingOwnMethod) {
        // Firebase MUST be signed out too. Its credential lives in browser
        // storage, so without this the app immediately mints a fresh token from
        // it and the user is silently signed back in — the server correctly
        // invalidated the session and nobody could tell.
        await handleLogout();
        return;
      }

      await loadIdentities();
      setProfileMessageTone("success");
      setProfileMessage(t.unlinkedOk);
    } catch (error) {
      console.error("Unlink failed:", error);
      setProfileMessageTone("error");
      setProfileMessage(error.message || "تعذّرت الإزالة");
    } finally {
      setLinkBusy(false);
    }
  };

  // Consent for an account that already exists.
  //
  // termsAcceptedAt is written only when a users row is INSERTED, so six
  // production accounts created before the sign-up gate hold NULL and no amount
  // of signing in would ever record their agreement. This asks them once.
  //
  // BLOCKING on purpose. A dismissible notice leaves the account exactly where
  // it started — no consent recorded — with a dialog added. There is no ×, and
  // clicking outside does nothing: agree, or sign out.
  //
  // Watched on userProfile rather than fired once at login, so it also catches a
  // reload. The server call is idempotent and never overwrites, so a spurious
  // extra call costs nothing.
  useEffect(() => {
    if (!userProfile) {
      setNeedsConsent(false);
      return;
    }
    setNeedsConsent(!userProfile.termsAcceptedAt);
  }, [userProfile]);

  const acceptConsent = async () => {
    if (consentBusy) return;
    setConsentBusy(true);
    try {
      const result = await api.auth.recordConsent();
      // Update the profile from the SERVER's timestamp, not a locally invented
      // one — the value shown must be the value stored.
      setUserProfile((prev) =>
        prev ? { ...prev, termsAcceptedAt: result.termsAcceptedAt } : prev,
      );
      setNeedsConsent(false);
    } catch (error) {
      console.error("Failed to record consent:", error);
      window.alert("تعذّر حفظ الموافقة: " + error.message);
    } finally {
      setConsentBusy(false);
    }
  };

  const renderConsentGate = () => {
    if (!needsConsent) return null;
    const identity =
      userProfile?.email || userProfile?.phoneNumber || userProfile?.id;
    return (
      // No onOpenChange handler: the dialog cannot be closed by the overlay or
      // Escape. The only two ways out are the two buttons below.
      <Dialog open={true}>
        <DialogContent
          className="sm:max-w-sm"
          dir="rtl"
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          showClose={false}
        >
          <DialogHeader>
            <DialogTitle className="text-right text-xl">
              الموافقة على الشروط
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-right">
              حسابك أُنشئ قبل إضافة شاشة الموافقة، ولم تُسجَّل موافقتك بعد. يرجى
              الاطلاع والموافقة للمتابعة.
            </p>
            <p className="text-sm text-right">
              الحساب:{" "}
              <span className="font-medium" dir="ltr">
                {identity}
              </span>
            </p>
            {/* The link IS the phrase. The signup gate's shape —
                «بالمتابعة أنت توافق على سياسة الخصوصية — سياسة الخصوصية» —
                prints the same words twice, once as text and once as the link.
                Inline Arabic rather than new t. keys, matching the neighbouring
                convention in this dialog. */}
            <p className="text-xs text-gray-500 text-right">
              بالضغط على موافق، أنت توافق على{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-[#A5813F] underline"
              >
                سياسة الخصوصية
              </a>
            </p>
            <div className="flex gap-2 justify-end pt-2" dir="ltr">
              <Button onClick={handleLogout} variant="outline" size="sm">
                {t.logout}
              </Button>
              <Button onClick={acceptConsent} disabled={consentBusy} size="sm">
                {consentBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "موافق"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Shown INSTEAD of creating an account. Minimum content: what will be created,
  // under which identity, a link to the policy, and a way out.
  const renderSignupGate = () => {
    if (!pendingSignup) return null;
    const identity =
      pendingSignup.email || pendingSignup.phoneNumber || pendingSignup.resolvedUserId;
    return (
      <Dialog open={true} onOpenChange={(open) => !open && cancelSignup()}>
        <DialogContent className="sm:max-w-sm" dir="rtl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-right text-xl">
              {t.signupTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-right">
              {t.signupBody}{" "}
              <span className="font-medium" dir="ltr">
                {identity}
              </span>
            </p>
            <p className="text-xs text-gray-500 text-right">
              {t.signupTerms} —{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-[#A5813F] underline"
              >
                {t.signupPrivacy}
              </a>
            </p>
            <div className="flex gap-2 justify-end pt-2" dir="ltr">
              <Button onClick={cancelSignup} variant="outline" size="sm">
                {t.signupCancel}
              </Button>
              <Button onClick={confirmSignup} disabled={linkBusy} size="sm">
                {linkBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t.signupConfirm
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const renderProfileDialog = () => {
    // One login method can write several identity rows — a Google link writes
    // both `email` and `google.com`. Collapse to methods so the screen shows what
    // a person actually has, not the storage behind it.

    const phoneIdentity = identities.find((i) => i.identityType === "phone");
    // Anything that is not the phone IS the other login method. Matching on
    // "google.com" exactly was too narrow: a row written by hand, or a
    // microsoft.com row, left the screen saying "not linked" while login worked
    // perfectly — because resolution reads the `email` row, not the provider one.
    const googleIdentity = identities.find((i) => i.identityType !== "phone");
    const methodCount = new Set(identities.map((i) => i.identityValue)).size;
    // Which method is this session actually using? A Firebase session means the
    // user came in through Google; a cookie-only session means phone. Worth
    // showing, because otherwise it is possible to remove the very method you
    // are signed in with and only find out at the next login.
    // null until /api/auth/check answers. Falling through to "google" while
    // unknown put the "current session" label on the Gmail row for a moment on
    // every load, then moved it — showing a default as though it were an answer.
    const activeMethod =
      sessionType === null ? null : sessionType === "phone" ? "phone" : "google";

    return (
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-right">
              {t.profileSettings}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4" dir="rtl">
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                {t.loginMethods}
              </label>

              <div className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  {phoneIdentity && methodCount > 1 ? (
                    <Button
                      onClick={() => handleUnlinkIdentity(phoneIdentity.id)}
                      disabled={linkBusy}
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      {t.unlinkAction}
                    </Button>
                  ) : phoneIdentity ? (
                    <span className="text-xs text-gray-400">
                      {t.lastMethodLocked}
                    </span>
                  ) : (
                    <Button
                      onClick={() => setLinkPhoneOpen(true)}
                      disabled={linkBusy || identitiesLoading}
                      variant="outline"
                      size="sm"
                      className="border-[#A5813F] text-[#A5813F] hover:bg-[#F4EFE3]"
                    >
                      {t.linkAction}
                    </Button>
                  )}
                </div>
                <div className="text-right">
                  <div
                    className="text-sm font-medium flex items-center gap-3"
                    dir="ltr"
                  >
                    <span>
                      {phoneIdentity
                        ? phoneIdentity.identityValue
                        : t.methodPhone}
                    </span>
                    {phoneIdentity && activeMethod === "phone" && (
                      <span className="text-xs text-[#A5813F]">
                        {t.currentSession}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  {googleIdentity ? (
                    methodCount > 1 ? (
                      <Button
                        onClick={() => handleUnlinkIdentity(googleIdentity.id)}
                        disabled={linkBusy}
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        {t.unlinkAction}
                      </Button>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {t.lastMethodLocked}
                      </span>
                    )
                  ) : (
                    <Button
                      onClick={handleLinkGoogle}
                      disabled={linkBusy || identitiesLoading}
                      variant="outline"
                      size="sm"
                      className="border-[#A5813F] text-[#A5813F] hover:bg-[#F4EFE3]"
                    >
                      {linkBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        t.linkAction
                      )}
                    </Button>
                  )}
                </div>
                <div className="text-right">
                  <div
                    className="text-sm font-medium flex items-center gap-3"
                    dir="ltr"
                  >
                    <span>
                      {googleIdentity
                        ? googleIdentity.identityValue
                        : t.methodGoogle}
                    </span>
                    {googleIdentity && activeMethod === "google" && (
                      <span className="text-xs text-[#A5813F]">
                        {t.currentSession}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {linkPhoneOpen && !phoneIdentity && (
              <div className="space-y-2 border rounded-lg p-3">
                <input
                  type="tel"
                  value={linkPhoneNumber}
                  onChange={(e) => setLinkPhoneNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSendLinkCode();
                    }
                  }}
                  placeholder={t.enterPhone}
                  dir="ltr"
                  className="w-full px-3 py-2 border rounded-lg text-right"
                />
                {!linkPhoneSent ? (
                  <Button
                    onClick={handleSendLinkCode}
                    disabled={linkBusy || !linkPhoneNumber.trim()}
                    className="w-full"
                    size="sm"
                  >
                    {linkBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t.sendCode
                    )}
                  </Button>
                ) : (
                  <>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={linkPhoneCode}
                      onChange={(e) => setLinkPhoneCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleLinkPhone();
                        }
                      }}
                      placeholder={t.enterCode}
                      dir="ltr"
                      className="w-full px-3 py-2 border rounded-lg text-right"
                      autoFocus
                    />
                    <Button
                      onClick={handleLinkPhone}
                      disabled={linkBusy || !linkPhoneCode.trim()}
                      className="w-full"
                      size="sm"
                    >
                      {linkBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        t.confirmCode
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}

            {profileMessage && (
              <div
                className={`p-3 rounded-lg text-center text-sm ${
                  profileMessageTone === "success"
                    ? "bg-green-100 text-green-700"
                    : profileMessageTone === "info"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-red-100 text-red-700"
                }`}
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
                    <p className="text-xs text-gray-600">
                      {t.deleteReauthNote}
                    </p>

                    {/* A phone account confirms with an SMS code. A Google account
                        needs no field here — pressing delete re-runs the popup. */}
                    {sessionType === "phone" &&
                      (deleteCodeSent ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={deleteCode}
                            onChange={(e) => setDeleteCode(e.target.value)}
                            placeholder={t.deleteEnterCode}
                            dir="ltr"
                            className="w-full px-3 py-2 border border-red-300 rounded-lg text-right"
                          />
                          <button
                            type="button"
                            onClick={handleSendDeleteCode}
                            disabled={
                              profileSaving || deleteResendCooldown > 0
                            }
                            className="w-full text-sm text-[#A5813F] hover:text-[#8A6A2F] underline disabled:opacity-50 disabled:no-underline"
                          >
                            {deleteResendCooldown > 0
                              ? `إعادة الإرسال خلال ${deleteResendCooldown} ثانية`
                              : "إعادة إرسال الرمز"}
                          </button>
                        </div>
                      ) : (
                        <Button
                          onClick={handleSendDeleteCode}
                          disabled={deleteConfirmText !== "حذف" || profileSaving}
                          variant="outline"
                          className="w-full"
                          size="sm"
                        >
                          {t.deleteSendCode}
                        </Button>
                      ))}

                    <div className="flex gap-2">
                      <Button
                        onClick={handleDeleteAccount}
                        disabled={
                          deleteConfirmText !== "حذف" ||
                          profileSaving ||
                          (sessionType === "phone" &&
                            (!deleteCodeSent || !deleteCode.trim()))
                        }
                        variant="destructive"
                        className="flex-1"
                      >
                        {t.confirmDelete}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText("");
                          setDeleteCodeSent(false);
                          setDeleteCode("");
                          setDeleteResendCooldown(0);
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
      // Visible confirmation — pressing resend on the code step used to change
      // nothing on screen. Also start a cooldown so repeated presses do not pile
      // sends onto a rate-limited number.
      setSmsInfo("تم إرسال الرمز");
      setResendCooldown(30);
    } catch (err) {
      setSmsInfo("");
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
          // The phone path issues its own session, so the flag travels with the
          // user object rather than through the token response.
          __isNewUser: !!data.isNewUser,
        };
        setShowSmsLogin(false);
        setSmsStep("phone");
        setPhoneInput("");
        setSmsCode("");
        await handleAuthSuccess(phoneUser, true);
      }
    } catch (err) {
      setSmsError(err.message);
    } finally {
      setAuthProcessing(false);
      interactiveLoginInProgressRef.current = false;
    }
  };

  // A marriage occupies a slot only while it is BOTH current and the spouse is
  // alive. A divorced spouse frees the slot: a man who divorces one of four
  // wives may marry again, and a divorced woman may remarry — exactly as
  // widowhood already frees her. Until `status` existed the app could only see
  // death, so a divorce left the slot occupied forever, and reviving a dead
  // husband silently revived the marriage.
  // One helper, used everywhere the limit is checked — it was previously
  // computed in three places with three slightly different implementations.
  const countActiveSpouses = (personId) =>
    relationships
      .filter(
        (r) =>
          r.treeId === currentTree?.id &&
          r.type === "partner" &&
          r.status !== "divorced" &&
          (r.person1Id === personId || r.person2Id === personId),
      )
      .reduce((count, r) => {
        const sid = r.person1Id === personId ? r.person2Id : r.person1Id;
        const sp = people.find((pp) => pp.id === sid);
        return sp && sp.isLiving !== false ? count + 1 : count;
      }, 0);

  const spouseLimitFor = (person) => (person?.gender === "male" ? 4 : 1);

  // The marriage the «مطلق/ة» tick refers to: a person's MOST RECENT one.
  // Binding to the most recent (rather than to "the single active one") keeps
  // the tick visible after it is ticked, so an accidental divorce can be undone,
  // and it clears itself on remarriage because the new marriage becomes the most
  // recent and is not divorced.
  // Hidden when someone has more than one ACTIVE marriage — a man with four
  // wives would otherwise see a tick bound only to the newest, which is
  // misleading. Those are ended from the wife's record instead, where her most
  // recent marriage is the one to him.
  const latestMarriageOf = (personId) => {
    if (personId == null) return null;
    const mine = relationships
      .filter(
        (r) =>
          r.treeId === currentTree?.id &&
          r.type === "partner" &&
          (r.person1Id === personId || r.person2Id === personId),
      )
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    if (mine.length === 0) return null;
    if (countActiveSpouses(personId) > 1) return null;
    return mine[0];
  };

  const spouseLimitMessage = (limit) =>
    limit === 1
      ? "لا يمكن إضافة أكثر من زوج واحد"
      : "لا يمكن إضافة أكثر من ٤ زوجات على قيد الحياة";

  // Add person using the data transformation utility
  const addPerson = async (personData) => {
    // Remember which person we're adding relative to, so after adding we keep the
    // tree rooted on that branch instead of jumping back to the natural root.
    const anchorPerson = selectedPerson;
    // Enforce living spouse limit when adding a spouse
    if (relationshipType === "spouse" && selectedPerson) {
      const selected = people.find((p) => p.id === selectedPerson);
      const spouseLimit = spouseLimitFor(selected);
      if (
        countActiveSpouses(selectedPerson) >= spouseLimit &&
        personData.isLiving !== false
      ) {
        window.alert(spouseLimitMessage(spouseLimit));
        return;
      }

      // Same-gender pairing, refused here rather than by the server. Both genders
      // are known in the browser, and this function writes the PERSON before it
      // posts the relationship — so letting the server refuse meant creating a
      // row, being refused, and deleting the row again: 326 ms, two audit entries
      // and a create/delete pair in the undo stack for an action the user never
      // completed. Same reason the maḥram rules block client-side.
      //
      // The server keeps its own copy of this rule (validatePartner). This is a
      // convenience gate, not the enforcement point.
      if (
        selected?.gender &&
        personData.gender &&
        selected.gender === personData.gender
      ) {
        window.alert("لا يمكن تسجيل زواج بين شخصين من نفس الجنس");
        return;
      }
    }

    let createdPersonId = null;
    // One user action, several calls — tag them so undo reverses the lot in one
    // press instead of one press per row.
    beginAction();
    try {
      // Create person via API
      DEBUG && console.log("=== ADDING PERSON ===");
      DEBUG && console.log("Person data:", personData);
      DEBUG && console.log("Relationship type:", relationshipType);
      DEBUG && console.log("Selected person:", selectedPerson);
      DEBUG && console.log("Tree ID:", currentTree?.id);

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

      const newPerson = await api.people.create({
        ...personData,
        treeId: currentTree?.id,
        ...(childBirthOrder != null ? { birthOrder: childBirthOrder } : {}),
      });

      createdPersonId = newPerson.id;
      DEBUG && console.log("New person created:", newPerson);

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
      // The person row is written BEFORE its relationship. When the server
      // refuses the relationship — same-gender marriage, spouse limit, mahram —
      // the person is already saved and would be left in the tree unconnected.
      // Remove it so a refused action leaves nothing behind.
      if (createdPersonId != null) {
        try {
          await api.people.delete(createdPersonId);
          setPeople((prev) => prev.filter((p) => p.id !== createdPersonId));
        } catch (cleanupError) {
          console.error("Failed to remove orphan after refusal:", cleanupError);
        }
      }
      failAlert("فشل في إضافة الشخص: " + error.message);
    } finally {
      endAction();
    }
  };

  const updatePerson = async (personData) => {
    // ONE undo entry for one save. This function can write twice — the divorce
    // tick sets a relationship status, then the person's own fields are updated —
    // and without a group the two land as separate entries, so undoing a single
    // edit takes two presses and the first press leaves the record half-reverted.
    // Every other mutating handler already brackets its writes this way.
    beginAction();
    try {
      const editingId = editingPerson;

      // The divorce tick lives on the form but belongs to a relationship row,
      // so it is saved separately from the person's own fields.
      if (personData.__marriageId != null) {
        const wanted = personData.__isDivorced ? "divorced" : "married";
        await api.relationships.setStatus(personData.__marriageId, wanted);
        setRelationships((prev) =>
          prev.map((r) =>
            r.id === personData.__marriageId ? { ...r, status: wanted } : r,
          ),
        );
      }
      delete personData.__marriageId;
      delete personData.__isDivorced;

      const before = people.find((p) => p.id === editingId);

      // Bringing someone back from the dead re-occupies a marriage slot. The
      // limit was only ever checked when ADDING a spouse, so marking a dead
      // husband alive again could silently leave his wife with two living
      // husbands. The limit that breaks is the SPOUSE's, not this person's.
      const beingRevived = before?.isLiving === false && personData.isLiving !== false;
      if (beingRevived) {
        const activeSpouseIds = relationships
          .filter(
            (r) =>
              r.treeId === currentTree?.id &&
              r.type === "partner" &&
              r.status !== "divorced" &&
              (r.person1Id === editingId || r.person2Id === editingId),
          )
          .map((r) => (r.person1Id === editingId ? r.person2Id : r.person1Id));

        const wouldExceed = activeSpouseIds.some((sid) => {
          const spouse = people.find((p) => p.id === sid);
          // countActiveSpouses counts the living ones; this person is about to
          // become living, so their slot has to be added on.
          return countActiveSpouses(sid) + 1 > spouseLimitFor(spouse);
        });
        if (wouldExceed) {
          window.alert(t.reviveBlocked);
          return;
        }
      }

      // A marriage must be between a man and a woman — and this deliberately
      // checks EVERY marriage, ended ones included. A gender is almost always
      // changed to correct a data-entry error, and if the spouse's gender makes
      // the marriage invalid then it was never valid; divorcing doesn't fix the
      // record, it just turns a currently-invalid marriage into a historically
      // invalid one. Blocking forces the honest sequence: remove the marriage,
      // then correct the gender.
      // The partner is never silently flipped instead — that would rewrite
      // another person's record, and rewrite the full name of every descendant,
      // since the name chain follows the male line.
      const genderChanged =
        personData.gender && before && personData.gender !== before.gender;
      if (genderChanged) {
        const spouseIds = relationships
          .filter(
            (r) =>
              r.treeId === currentTree?.id &&
              r.type === "partner" &&
              (r.person1Id === editingId || r.person2Id === editingId),
          )
          .map((r) => (r.person1Id === editingId ? r.person2Id : r.person1Id));

        const clash = spouseIds.some((sid) => {
          const spouse = people.find((p) => p.id === sid);
          return spouse && spouse.gender === personData.gender;
        });
        if (clash) {
          window.alert(
            personData.gender === "male"
              ? t.genderBlockedMale
              : t.genderBlockedFemale,
          );
          return;
        }
      }
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
      failAlert("فشل في تحديث الشخص: " + error.message);
    } finally {
      // In `finally`, not at the end of `try`: the revive-limit and gender-clash
      // checks return EARLY, and the divorce status may already have been written
      // by then. Closing the group only on the happy path would leave it open and
      // silently swallow the next unrelated action into this one.
      endAction();
    }
  };

  // Find the newest deletion that hasn't been undone, so the header can offer it.
  const loadRestorableDeletion = async () => {
    if (!currentTree?.id) {
      setRestorableDeletion(null);
      return;
    }
    try {
      const rows = await api.deletions.list(currentTree.id);
      const pending = (rows || []).filter((d) => !d.restoredAt);
      const newest = pending[0] || null;
      // What the button would actually do. Every row already carries the full
      // before/after arrays, so this is a read, not extra data: people by NAME
      // because that is what a person recognises, relationships as a COUNT
      // because nobody needs to read "نسب: عبير — بدر".
      // Arabic counted nouns: 1 singular, 2 dual, 3-10 plural, 11+ singular.
      // A single "{n} روابط" template is wrong for every case except 3-10.
      const countedLinks = (n) => {
        if (n === 1) return t.linkOne;
        if (n === 2) return t.linkTwo;
        if (n <= 10) return t.linkFew.replace("{n}", n);
        return t.linkMany.replace("{n}", n);
      };
      const countedOthers = (n) => {
        if (n === 2) return t.otherTwo;
        if (n <= 10) return t.otherFew.replace("{n}", n);
        return t.otherMany.replace("{n}", n);
      };

      // Reads the fields /api/deletions/:treeId actually sends — names and ids
      // extracted server-side, not the full jsonb rows. Getting this wrong is
      // what made the preview silently empty: it read `r.people`, which the
      // endpoint never returned.
      const summarise = (rows) => {
        const arr = (v) => (Array.isArray(v) ? v : []);
        const zip = (names, ids) =>
          arr(names).map((firstName, i) => ({
            firstName,
            id: arr(ids)[i],
          }));

        const before = rows.flatMap((r) => zip(r.peopleNames, r.peopleIds));
        const after = rows.flatMap((r) =>
          zip(r.peopleAfterNames, r.peopleAfterIds),
        );
        // An UPDATE (e.g. a divorce tick) writes the SAME relationship row into
        // both the before and after snapshot — reverting values, not adding a
        // second row — so summing the two counts reports one link as two
        // ("رابطان" for a single divorce undo). Delete puts rows in before only,
        // restore in after only, update in both-but-identical; max is correct for
        // all three where sum double-counts the update. Mirrors the people logic
        // above, which already dedupes ids across the two snapshots.
        const relCount = rows.reduce(
          (n, r) =>
            n +
            Math.max(
              r.relationshipsCount || 0,
              r.relationshipsAfterCount || 0,
            ),
          0,
        );

        // Ids in BOTH are an update — the row stays, its values revert.
        const beforeIds = new Set(before.map((p) => String(p.id)));
        const afterIds = new Set(after.map((p) => String(p.id)));
        const removed = after.filter((p) => !beforeIds.has(String(p.id)));
        const restored = before.filter((p) => !afterIds.has(String(p.id)));
        const reverted = before.filter((p) => afterIds.has(String(p.id)));

        // Cap the list. Deleting a bridge person on the real tree takes 28
        // people, and 28 names is neither readable nor a panel that fits on
        // screen. Recognition is the point, not enumeration.
        const NAME_CAP = 4;
        const names = (list) => {
          const all = list.map((p) => p.firstName).filter(Boolean);
          // Show everything when hiding would save only one name — both because
          // it is pointless and because "و 1 آخرين" puts a plural on a single
          // item. The remainder is therefore always 2 or more.
          if (all.length <= NAME_CAP + 1) return all.join("، ");
          return (
            all.slice(0, NAME_CAP).join("، ") +
            "، " +
            countedOthers(all.length - NAME_CAP)
          );
        };

        // The counted-noun form belongs here, where the number is known — the
        // render used a `t.andLinks` string that no longer exists, so that line
        // produced undefined.
        const linksText = relCount > 0 ? countedLinks(relCount) : "";

        if (removed.length)
          return {
            verb: t.willDelete,
            names: names(removed),
            relCount,
            linksText,
          };
        if (restored.length)
          return {
            verb: t.willRestore,
            names: names(restored),
            relCount,
            linksText,
          };
        if (reverted.length)
          return {
            verb: t.willRevert,
            names: names(reverted),
            relCount: 0,
            linksText: "",
          };
        return { verb: t.willRestore, names: "", relCount, linksText };
      };

      if (newest?.groupId) {
        // Same action, several rows. Label from the FIRST row of the group —
        // "عبد الله" rather than "نسب: هند — عبد الله".
        const group = pending.filter((d) => d.groupId === newest.groupId);
        const primary = group.reduce((a, b) => (a.id < b.id ? a : b), group[0]);
        setRestorableDeletion({
          ...newest,
          label: primary.label,
          preview: summarise(group),
        });
      } else if (newest) {
        setRestorableDeletion({ ...newest, preview: summarise([newest]) });
      } else {
        setRestorableDeletion(null);
      }
    } catch (error) {
      console.error("Failed to load deletions:", error);
      setRestorableDeletion(null);
    }
  };

  // Follow the data rather than listing call sites. setPeople/setRelationships
  // hand back a NEW array on every mutation, so this fires after creates,
  // updates, deletes and undos alike — including any path added later.
  //
  // Listing sites individually is what broke it: only delete refreshed the
  // pointer, so adding anything left the button aimed at an older entry, and the
  // server correctly refused it as not-newest. The stack was fine; the button
  // was stale.
  useEffect(() => {
    loadRestorableDeletion();
  }, [currentTree?.id, people, relationships]);

  // Undo the most recent deletion. Only ever the newest one: if two related
  // people were deleted in separate actions, the link between them lives only in
  // the OLDER snapshot, so undoing out of order would bring them back
  // unconnected. The server enforces the same rule.
  const handleUndoDelete = async () => {
    if (!restorableDeletion) return;
    try {
      setRestoring(true);
      const result = await api.deletions.restore(restorableDeletion.id);

      if (currentTree?.id) {
        const [freshPeople, freshRels] = await Promise.all([
          api.people.getAll(currentTree.id),
          api.relationships.getAll(currentTree.id),
        ]);
        setPeople(freshPeople);
        setRelationships(freshRels);
      }

      // Root the tree on someone who just came back, otherwise they can be
      // restored into a branch that isn't currently drawn and it looks like
      // nothing happened.
      //
      // ONLY when already in the tree. Undoing from the members dashboard used
      // to throw the user into the tree view — they were reading a list, pressed
      // undo, and the page changed under them. The list refreshes on its own from
      // the setPeople above.
      const firstId = result?.restoredPeopleIds?.[0];
      if (firstId != null && currentView === "tree-builder") {
        setSelectedPerson(firstId);
        setHighlightedPerson(firstId);
      }
      await loadRestorableDeletion();
    } catch (error) {
      console.error("Restore failed:", error);
      // failAlert, not alert: it returns early when the session has ended, so a
      // failed undo during an eviction shows the amber banner alone instead of a
      // native dialog on top of it saying the same thing twice.
      failAlert(error.message);
    } finally {
      setRestoring(false);
    }
  };

  // Header button offering the undo. ALWAYS rendered — disabled when there is
  // nothing to undo — so the header never reflows. A button that appears and
  // disappears shifts the buttons next to it, which invites a misclick on
  // profile or logout.
  // The preview lives in a panel below the button, not in a `title` tooltip. A
  // native tooltip appears after a delay, renders newlines inconsistently, and
  // vanishes on any movement — it was easy to miss entirely, which defeats the
  // point of a confirmation. Two lines at most: people by NAME, relationships as
  // a COUNT.
  // min-w on the button: "تراجع" is shorter than its neighbours, so without a
  // floor it sat noticeably narrower than الملف الشخصي and تسجيل الخروج.
  const renderUndoButton = () => (
    <div className="relative group">
      <Button
        onClick={handleUndoDelete}
        disabled={restoring || !restorableDeletion}
        variant="outline"
        size="sm"
        className="min-w-[120px] justify-center"
        title={restorableDeletion ? undefined : t.nothingToUndo}
      >
        {restoring ? (
          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
        ) : (
          <RotateCcw className="w-4 h-4 ml-2" />
        )}
        {t.undoDelete}
      </Button>

      {/* Anchored under the button. It was briefly `fixed` on a guess that
          `overflow-hidden` was clipping it — the real reason it never appeared is
          that the list endpoint returned counts, not names, so there was nothing
          to render. `fixed` put it on the far side of the screen.

          Render when there is EITHER a name or a count. A relationship-only entry
          — "نسب: عمر — طفل عمر" — has no people in it, so keying the whole panel
          off `names` hid it exactly when the label was least informative. */}
      {(restorableDeletion?.preview?.names ||
        restorableDeletion?.preview?.relCount > 0) && (
        <div
          dir="rtl"
          className="absolute top-full mt-1 left-0 z-[60] hidden group-hover:block bg-white border rounded-lg shadow-lg px-3 py-2 whitespace-nowrap text-right"
        >
          {restorableDeletion.preview.names && (
            <div className="text-xs">
              <span className="text-gray-500">
                {restorableDeletion.preview.verb}:
              </span>{" "}
              <span className="text-[#16233D]">
                {restorableDeletion.preview.names}
              </span>
            </div>
          )}
          {restorableDeletion.preview.relCount > 0 && (
            <div className="text-xs text-gray-500">
              {restorableDeletion.preview.names
                ? restorableDeletion.preview.linksText
                : `${restorableDeletion.preview.verb}: ${restorableDeletion.preview.linksText.replace(
                    /^و\s?/,
                    "",
                  )}`}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const deletePerson = async (personId) => {
    const treeRels = relationships.filter((r) => r.treeId === currentTree?.id);
    const nameOf = (id) => {
      const p = people.find((pp) => pp.id === id);
      return p ? p.firstName : "";
    };

    // --- DELETE A PERSON AND WHOEVER ONLY REACHED THE FAMILY THROUGH THEM -----
    // The family hangs from an ANCHOR — the founding ancestor (the parentless
    // person with the most descendants). The anchor is always kept, so deleting
    // someone never removes the line above them.
    // Everyone else is judged by one question: after this person is removed, can
    // they still reach the anchor? If yes they stay; if their only route ran
    // through the deleted person, they go too. That means:
    //   • a married daughter's husband and descendants are removed with her,
    //     while her parents and siblings stay (they still reach the anchor);
    //   • the auto-generated «والد فلان» placeholder parents of a removed person
    //     are removed, since nothing else holds them;
    //   • a رضاعة (milk) bond counts as a connection like any other — a
    //     milk-sibling attached to the family only through this person is removed
    //     together with their own household, and a milk-sibling who also reaches
    //     the anchor another way is kept;
    //   • a cousin-marriage spouse stays, because their own branch reaches the
    //     anchor independently.
    // Separate families that were never linked to this person are untouched.
    const kidsOfMap = new Map();
    const parentsOfMap = new Map();
    const adjacency = new Map();
    const joinPair = (a, b) => {
      if (a == null || b == null) return;
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      if (!adjacency.has(b)) adjacency.set(b, new Set());
      adjacency.get(a).add(b);
      adjacency.get(b).add(a);
    };
    treeRels.forEach((r) => {
      if (r.type === "parent-child") {
        if (!kidsOfMap.has(r.parentId)) kidsOfMap.set(r.parentId, new Set());
        kidsOfMap.get(r.parentId).add(r.childId);
        if (!parentsOfMap.has(r.childId))
          parentsOfMap.set(r.childId, new Set());
        parentsOfMap.get(r.childId).add(r.parentId);
        joinPair(r.parentId, r.childId);
      } else {
        joinPair(r.person1Id, r.person2Id);
      }
    });
    const kidsOf = (id) => kidsOfMap.get(id) || new Set();
    const parentsOf = (id) => parentsOfMap.get(id) || new Set();

    // Everyone reachable from `start`, optionally treating `skip` as removed.
    const reachableFrom = (start, skip) => {
      const seen = new Set();
      if (start == null || start === skip) return seen;
      seen.add(start);
      const stack = [start];
      while (stack.length) {
        const cur = stack.pop();
        for (const nb of adjacency.get(cur) || []) {
          if (nb !== skip && !seen.has(nb)) {
            seen.add(nb);
            stack.push(nb);
          }
        }
      }
      return seen;
    };
    const descendantCount = (id, skip) => {
      const seen = new Set([id]);
      const stack = [id];
      let n = 0;
      while (stack.length) {
        const cur = stack.pop();
        for (const k of kidsOf(cur)) {
          if (k !== skip && !seen.has(k)) {
            seen.add(k);
            stack.push(k);
            n++;
          }
        }
      }
      return n;
    };
    const degreeOf = (id) => (adjacency.get(id) || new Set()).size;

    // This person's whole family as it stands now.
    const familyIds = reachableFrom(personId, null);
    // The anchor: parentless person with the most descendants (then most
    // connections, then lowest id so it is deterministic).
    const pickAnchor = (skip) => {
      const cands = [...familyIds].filter(
        (id) =>
          id !== skip && ![...parentsOf(id)].some((p) => p !== skip),
      );
      if (cands.length === 0) return null;
      return cands.sort(
        (a, b) =>
          descendantCount(b, skip) - descendantCount(a, skip) ||
          degreeOf(b) - degreeOf(a) ||
          a - b,
      )[0];
    };
    let anchor = pickAnchor(null);
    // Deleting the founder itself: re-anchor on the next founder so the family
    // is never wiped out by removing the person at the top.
    if (anchor === personId || anchor == null) anchor = pickAnchor(personId);

    const keptIds = reachableFrom(anchor, personId);
    const deleteIds = [...familyIds].filter(
      (id) => id === personId || !keptIds.has(id),
    );
    const deletedSet = new Set(deleteIds);

    // Re-root the view on a surviving relative — a kept parent if there is one,
    // otherwise the anchor — so the tree never lands on nothing.
    let neighbour =
      [...parentsOf(personId)].find((p) => keptIds.has(p)) ?? null;
    if (neighbour == null && anchor != null && keptIds.has(anchor))
      neighbour = anchor;

    // --- Confirmation: name EVERYONE that will be permanently deleted. --------
    const buildDeleteMessage = () => {
      if (deleteIds.length === 1) return t.deleteConfirm;
      const names = deleteIds.map(nameOf).filter(Boolean);
      return (
        `سيتم حذف الأشخاص التالية أسماؤهم نهائياً ` +
        `(العدد: ${deleteIds.length}):\n` +
        names.join("، ") +
        `\n\nهؤلاء مرتبطون بالعائلة من خلال هذا الشخص فقط.` +
        `\n\nهل تريد المتابعة؟`
      );
    };

    if (window.confirm(buildDeleteMessage())) {
      try {
        // One batched call: the server snapshots every person and every
        // relationship touching them BEFORE removing anything, so the whole
        // deletion can be undone as a single action.
        await api.people.batchDelete(
          currentTree?.id,
          deleteIds,
          deleteIds.map(nameOf).filter(Boolean).join("، ").slice(0, 300),
        );

        setPeople((prev) => {
          const updated = prev.filter((p) => !deletedSet.has(p.id));
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
              !deletedSet.has(r.person1Id) &&
              !deletedSet.has(r.person2Id) &&
              !deletedSet.has(r.parentId) &&
              !deletedSet.has(r.childId),
          ),
        );
        setSelectedPerson((prev) => (deletedSet.has(prev) ? neighbour : prev));
        setHighlightedPerson((prev) => (deletedSet.has(prev) ? null : prev));
        setShowActionMenu(false);
        // Surface the undo for what was just removed.
        loadRestorableDeletion();
      } catch (error) {
        console.error("Failed to delete person:", error);
        failAlert("فشل في حذف الشخص: " + error.message);
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
      window.alert("الوالدان مسجلان بالفعل لهذا الشخص");
      return;
    }

    // Create only what is MISSING. With neither parent recorded this still makes
    // the pair in one action; with a father already there it adds the mother and
    // marries her to him, instead of inventing a second father — which is how
    // one child ended up with two.
    const existingFather = parentPeople.find((p) => p?.gender === "male");
    const existingMother = parentPeople.find((p) => p?.gender === "female");

    if (writeInFlight.current) return;
    writeInFlight.current = true;
    beginAction();
    try {
      const created = [];
      const newRels = [];

      const father =
        existingFather ||
        (await api.people.create({
          treeId: currentTree?.id,
          firstName: `والد ${child.firstName}`,
          lastName: child.lastName || "",
          gender: "male",
          isLiving: true,
        }));
      if (!existingFather) created.push(father);

      const mother =
        existingMother ||
        (await api.people.create({
          treeId: currentTree?.id,
          firstName: `والدة ${child.firstName}`,
          lastName: child.lastName || "",
          gender: "female",
          isLiving: true,
        }));
      if (!existingMother) created.push(mother);

      // Only link a parent that was just created — the existing one already is.
      if (!existingFather) {
        newRels.push(
          await api.relationships.create({
            treeId: currentTree?.id,
            type: "parent-child",
            parentId: father.id,
            childId: childId,
          }),
        );
      }
      if (!existingMother) {
        newRels.push(
          await api.relationships.create({
            treeId: currentTree?.id,
            type: "parent-child",
            parentId: mother.id,
            childId: childId,
          }),
        );
      }

      // Marry them, unless they already are.
      const alreadyMarried = relationships.some(
        (r) =>
          r.treeId === currentTree?.id &&
          r.type === "partner" &&
          ((r.person1Id === father.id && r.person2Id === mother.id) ||
            (r.person1Id === mother.id && r.person2Id === father.id)),
      );
      if (!alreadyMarried) {
        newRels.push(
          await api.relationships.create({
            treeId: currentTree?.id,
            type: "partner",
            person1Id: father.id,
            person2Id: mother.id,
          }),
        );
      }

      if (created.length) setPeople((prev) => [...prev, ...created]);
      if (newRels.length) setRelationships((prev) => [...prev, ...newRels]);
    } catch (error) {
      console.error("Failed to create parents:", error);
      failAlert("فشل في إضافة الوالدين: " + error.message);
    } finally {
      endAction();
      writeInFlight.current = false;
    }
  };

  // Quick-create relationship helpers (open form for adding related person)
  const handleQuickCreateSpouse = (personId) => {
    const selected = people.find((p) => p.id === personId);
    if (!selected) return;

    // Enforce living spouse limit per gender
    const spouseLimit = spouseLimitFor(selected);
    if (countActiveSpouses(personId) >= spouseLimit) {
      window.alert(spouseLimitMessage(spouseLimit));
      return;
    }

    // Ask whether this is a new person or someone already in the tree.
    setSpouseSourceFor(personId);
  };

  const openNewSpouseForm = (personId) => {
    setSpouseSourceFor(null);
    setExistingSpouseFor(null);
    setSelectedPerson(personId);
    setRelationshipType("spouse");
    setEditingPerson(null);
    setFormKey((prev) => prev + 1);
    setShowPersonForm(true);
  };

  // Who may be married to `personId`, out of the people already in the tree.
  // Excluded: the person themselves, the same gender, anyone already married to
  // them, direct ancestors and descendants, and anyone already at their own
  // spouse limit. Wider maḥram rules — siblings, aunts and uncles, milk
  // relatives — are a separate piece; parent and child are blocked here because
  // that isn't a refinement.
  // مَحرم — permanently forbidden marriage. Returns null when the pair MAY marry,
  // or an Arabic reason when they may not. Mirrors sql/mahram_audit.sql, which is
  // validated against the staging fixture.
  //
  //   1 ancestors, any depth              2 descendants, any depth
  //   3 descendants of a parent           4 children of an ancestor
  //
  // Rule 4 stops at CHILDREN, which is what keeps cousins permitted: an aunt is a
  // child of a grandparent and is caught; her daughter is a grandchild and is not.
  // Rule 3 has no such stop, so grand-nieces stay forbidden. That asymmetry is
  // deliberate — confirmed against An-Nisa 23.
  //
  // رضاعة carries the same weight as blood, but only DIRECT milk-siblings exist in
  // the data today. The derived milk relations (milk-mother, milk-aunt) need a
  // column naming which woman nursed; until then they cannot be computed.
  //
  // Musaharah: ONLY the four relations named in the verse. General in-law
  // connection is permitted and must never be blocked.
  //
  // الجمع بين الأختين is the one TEMPORAL rule — it lifts when the first marriage
  // ends by divorce or death, so it reads status and isLiving. Everything above is
  // permanent and ignores both.
  // extraRels lets a caller ask "would this pair become mahram IF these rows
  // existed?" — used before creating a parent-child link, since that is the
  // mutation which can retroactively make an already-recorded marriage forbidden.
  const mahramReason = (aId, bId, extraRels = []) => {
    if (!aId || !bId || aId === bId) return null;
    const rels = [
      ...relationships.filter((r) => r.treeId === currentTree?.id),
      ...extraRels,
    ];

    const bloodParentsOf = (id) =>
      rels
        .filter((r) => r.type === "parent-child" && r.childId === id)
        .map((r) => r.parentId);
    const bloodChildrenOf = (id) =>
      rels
        .filter((r) => r.type === "parent-child" && r.parentId === id)
        .map((r) => r.childId);

    const milkRows = rels.filter(
      (r) => r.type === "sibling" && r.isBreastfeeding,
    );

    // DIRECTION MATTERS, and it is already recorded: addPerson writes
    // person1Id = the existing anchor, person2Id = the newly added milk-sibling.
    // So person2 nursed from person1's MOTHER, making person1's parents the
    // milk-mother and the milk-father (صاحب اللبن) of person2 — never the reverse.
    // Modelling that as a parent edge lets every nasab rule below produce the full
    // رضاعة mirror on its own, with no separate milk rules needed:
    //   - milk-father and milk-mother blocked as أصول
    //   - ALL the wet-nurse's children become milk-siblings, and so do the
    //     milk-father's children by his other wives
    //   - the milk-father's siblings become milk-aunts and milk-uncles
    // The asymmetry is the point: the nursed child joins the wet-nurse's family,
    // while that family gains nothing from the nursed child's own blood relatives.
    const milkParentsOf = (id) =>
      milkRows
        .filter((r) => r.person2Id === id)
        .flatMap((r) => bloodParentsOf(r.person1Id));
    const milkChildrenOf = (id) =>
      milkRows
        .filter((r) => bloodParentsOf(r.person1Id).includes(id))
        .map((r) => r.person2Id);

    const parentsOf = (id) => [...bloodParentsOf(id), ...milkParentsOf(id)];
    const childrenOf = (id) => [...bloodChildrenOf(id), ...milkChildrenOf(id)];

    const walk = (startId, step) => {
      const seen = new Set();
      const stack = [startId];
      while (stack.length) {
        const cur = stack.pop();
        for (const next of step(cur)) {
          if (next != null && !seen.has(next)) {
            seen.add(next);
            stack.push(next);
          }
        }
      }
      return seen;
    };
    const ancestorsOf = (id) => walk(id, parentsOf);
    const descendantsOf = (id) => walk(id, childrenOf);

    const bloodSiblingsOf = (id) => {
      const out = new Set();
      for (const par of bloodParentsOf(id))
        for (const c of bloodChildrenOf(par)) if (c !== id) out.add(c);
      return out;
    };
    const milkSiblingsOf = (id) =>
      new Set(
        rels
          .filter(
            (r) =>
              r.type === "sibling" &&
              r.isBreastfeeding &&
              (r.person1Id === id || r.person2Id === id),
          )
          .map((r) => (r.person1Id === id ? r.person2Id : r.person1Id)),
      );
    const marriagesOf = (id) =>
      rels
        .filter(
          (r) =>
            r.type === "partner" &&
            (r.person1Id === id || r.person2Id === id),
        )
        .map((r) => ({
          other: r.person1Id === id ? r.person2Id : r.person1Id,
          status: r.status,
        }));

    // 1 + 2 — the vertical line, any depth
    if (ancestorsOf(aId).has(bId) || descendantsOf(aId).has(bId))
      return t.mahramLineal;

    // 3 — siblings: full, paternal or maternal (any shared parent)
    if (bloodSiblingsOf(aId).has(bId)) return t.mahramSibling;

    // رضاعة, identical weight to blood
    if (milkSiblingsOf(aId).has(bId)) return t.mahramMilkSibling;

    // Both directions are checked for every rule below, but the LABEL is chosen
    // from b's relation to a, since that is what the user is being told. The same
    // pair seen from the other side has a different name: a's aunt is the woman
    // whose nephew he is.
    const nieceLine = (x, y) =>
      parentsOf(x).some((par) => descendantsOf(par).has(y));
    const auntLine = (x, y) =>
      [...ancestorsOf(x)].some((anc) => childrenOf(anc).includes(y));

    // b is a's niece/nephew (or below)
    if (nieceLine(aId, bId) || auntLine(bId, aId)) return t.mahramNieceNephew;
    // b is a's aunt/uncle (at any level)
    if (auntLine(aId, bId) || nieceLine(bId, aId)) return t.mahramAuntUncle;

    // b is an ancestor or descendant of someone a married — أم الزوجة / الربيبة
    const inLawLineal = (x, y) =>
      marriagesOf(x).some(
        (m) => ancestorsOf(m.other).has(y) || descendantsOf(m.other).has(y),
      );
    if (inLawLineal(aId, bId)) return t.mahramInLawLineal;
    // the same check reversed — b married a's ancestor or descendant:
    // زوجة الأب / زوجة الابن
    if (inLawLineal(bId, aId)) return t.mahramSpouseOfLineal;

    // الجمع بين الأختين — temporal; only while the other marriage is ongoing
    const ongoing = (m) => {
      if (m.status === "divorced") return false;
      const sp = people.find((pp) => pp.id === m.other);
      return !sp || sp.isLiving !== false;
    };
    const sibsOf = (id) =>
      new Set([...bloodSiblingsOf(id), ...milkSiblingsOf(id)]);
    const bSibs = sibsOf(bId);
    if (marriagesOf(aId).filter(ongoing).some((m) => bSibs.has(m.other)))
      return t.mahramTwoSisters;
    const aSibs = sibsOf(aId);
    if (marriagesOf(bId).filter(ongoing).some((m) => aSibs.has(m.other)))
      return t.mahramTwoSisters;

    // الجمع بين المرأة وعمتها أو خالتها — temporal like the rule above, and from
    // the hadith rather than An-Nisa 23: «لا يُجمع بين المرأة وعمتها، ولا بين
    // المرأة وخالتها». Either direction counts; the aunt may be full, paternal
    // or maternal, which auntLine already covers.
    const auntPair = (x, y) => auntLine(x, y) || auntLine(y, x);
    if (
      marriagesOf(aId)
        .filter(ongoing)
        .some((m) => m.other !== bId && auntPair(bId, m.other))
    )
      return t.mahramWomanAndAunt;
    if (
      marriagesOf(bId)
        .filter(ongoing)
        .some((m) => m.other !== aId && auntPair(aId, m.other))
    )
      return t.mahramWomanAndAunt;

    return null;
  };

  // Generation depth for every person in the tree. Used to ORDER the spouse
  // picker, never to filter it — marrying across a generation is permitted and
  // does happen, so hiding those candidates would make real marriages
  // unrecordable. It only decides what appears first.
  //
  // Two passes, because lineage alone is not enough: someone who married INTO
  // the tree has no parents recorded, so counting ancestors puts them at
  // generation 0 no matter whose generation they actually joined. The second
  // pass gives them their spouse's depth.
  const generationDepths = useMemo(() => {
    const rels = relationships.filter((r) => r.treeId === currentTree?.id);
    const parentsOf = (id) =>
      rels
        .filter((r) => r.type === "parent-child" && r.childId === id)
        .map((r) => r.parentId);
    const spousesOf = (id) =>
      rels
        .filter(
          (r) =>
            r.type === "partner" &&
            (r.person1Id === id || r.person2Id === id),
        )
        .map((r) => (r.person1Id === id ? r.person2Id : r.person1Id));

    const gen = {};
    treePeople.forEach((p) => {
      gen[p.id] = 0;
    });

    // depth = 1 + deepest parent, relaxed until stable
    for (let pass = 0; pass < treePeople.length; pass++) {
      let changed = false;
      for (const p of treePeople) {
        const ps = parentsOf(p.id);
        if (!ps.length) continue;
        const d = Math.max(...ps.map((x) => gen[x] ?? 0)) + 1;
        if (d > gen[p.id]) {
          gen[p.id] = d;
          changed = true;
        }
      }
      if (!changed) break;
    }

    // A milk-sibling joined the ANCHOR's family, so they belong at the anchor's
    // level — not at whatever depth their own blood parents happen to sit. Same
    // direction rule as everywhere else: person1 is the anchor, person2 nursed
    // from person1's mother. Without this, a milk-sibling whose own parents are
    // roots shows a generation ABOVE the person they nursed with.
    const milkRows = rels.filter(
      (r) => r.type === "sibling" && r.isBreastfeeding,
    );
    for (const r of milkRows) {
      if (gen[r.person1Id] !== undefined && r.person2Id != null) {
        gen[r.person2Id] = gen[r.person1Id];
      }
    }

    // married-in people inherit their spouse's generation
    for (let pass = 0; pass < 3; pass++) {
      for (const p of treePeople) {
        if (parentsOf(p.id).length) continue;
        const vals = spousesOf(p.id)
          .map((sid) => gen[sid])
          .filter((v) => v !== undefined);
        if (vals.length) gen[p.id] = Math.max(...vals);
      }
    }
    return gen;
  }, [relationships, treePeople, currentTree?.id]);

  // Children already recorded for this person's SPOUSE but missing a parent of
  // this person's gender. That single filter carries the safety: it cannot offer
  // a child who already has a mother (no two-mother rows), cannot offer another
  // wife's children, and cannot offer strangers. Grouped by spouse so a person
  // with several marriages stays unambiguous.
  const linkableChildrenFor = (personId) => {
    const person = treePeople.find((p) => p.id === personId);
    if (!person || !person.gender) return [];
    const rels = relationships.filter((r) => r.treeId === currentTree?.id);

    const spouseIds = rels
      .filter(
        (r) =>
          r.type === "partner" &&
          (r.person1Id === personId || r.person2Id === personId),
      )
      .map((r) => (r.person1Id === personId ? r.person2Id : r.person1Id));

    return spouseIds
      .map((sid) => {
        const spouse = treePeople.find((p) => p.id === sid);
        const children = rels
          .filter((r) => r.type === "parent-child" && r.parentId === sid)
          .map((r) => treePeople.find((p) => p.id === r.childId))
          .filter(Boolean)
          .filter((c) => {
            const alreadyMine = rels.some(
              (r) =>
                r.type === "parent-child" &&
                r.parentId === personId &&
                r.childId === c.id,
            );
            if (alreadyMine) return false;
            const hasSameGenderParent = rels
              .filter((r) => r.type === "parent-child" && r.childId === c.id)
              .some((r) => {
                const par = treePeople.find((p) => p.id === r.parentId);
                return par && par.gender === person.gender;
              });
            return !hasSameGenderParent;
          });
        return { spouse, children };
      })
      .filter((g) => g.spouse && g.children.length > 0);
  };

  // Linking a child can make two ALREADY-married people siblings. Simulate the
  // new row and re-check every marriage of everyone whose parentage would change.
  const linkChildBlockedBy = (personId, childId) => {
    const hypothetical = [
      {
        id: -1,
        treeId: currentTree?.id,
        type: "parent-child",
        parentId: personId,
        childId,
      },
    ];
    const rels = relationships.filter((r) => r.treeId === currentTree?.id);
    const affected = new Set([
      childId,
      ...rels
        .filter((r) => r.type === "parent-child" && r.parentId === personId)
        .map((r) => r.childId),
    ]);
    for (const pid of affected) {
      const spouses = rels
        .filter(
          (r) =>
            r.type === "partner" &&
            (r.person1Id === pid || r.person2Id === pid),
        )
        .map((r) => (r.person1Id === pid ? r.person2Id : r.person1Id));
      for (const sp of spouses) {
        const reason = mahramReason(pid, sp, hypothetical);
        if (reason) return reason;
      }
    }
    return null;
  };

  const saveLinkedChildren = async () => {
    const ids = [...linkChildrenSelected];
    if (ids.length === 0) {
      setLinkChildrenFor(null);
      return;
    }
    if (writeInFlight.current) return;
    writeInFlight.current = true;
    beginAction();
    try {
      const created = await Promise.all(
        ids.map((childId) =>
          api.relationships.create({
            treeId: currentTree?.id,
            type: "parent-child",
            parentId: linkChildrenFor,
            childId,
          }),
        ),
      );
      setRelationships((prev) => [...prev, ...created]);
      setLinkChildrenFor(null);
      setLinkChildrenSelected(new Set());
    } catch (error) {
      console.error("Failed to link children:", error);
      failAlert("فشل في ربط الأبناء: " + error.message);
    } finally {
      endAction();
      writeInFlight.current = false;
    }
  };

  const eligibleSpousesFor = (personId) => {
    const person = treePeople.find((p) => p.id === personId);
    if (!person) return [];

    const rels = relationships.filter((r) => r.treeId === currentTree?.id);
    const parentsOf = (id) =>
      rels
        .filter((r) => r.type === "parent-child" && r.childId === id)
        .map((r) => r.parentId);
    const childrenOf = (id) =>
      rels
        .filter((r) => r.type === "parent-child" && r.parentId === id)
        .map((r) => r.childId);

    const walk = (startId, step) => {
      const seen = new Set();
      const stack = [startId];
      while (stack.length) {
        const cur = stack.pop();
        for (const next of step(cur)) {
          if (!seen.has(next)) {
            seen.add(next);
            stack.push(next);
          }
        }
      }
      return seen;
    };
    const bloodline = new Set([
      ...walk(personId, parentsOf),
      ...walk(personId, childrenOf),
    ]);

    const alreadyMarried = new Set(
      rels
        .filter(
          (r) =>
            r.type === "partner" &&
            (r.person1Id === personId || r.person2Id === personId),
        )
        .map((r) => (r.person1Id === personId ? r.person2Id : r.person1Id)),
    );

    return treePeople.filter((c) => {
      if (c.id === personId) return false;
      if (!c.gender || c.gender === person.gender) return false;
      if (alreadyMarried.has(c.id)) return false;
      if (bloodline.has(c.id)) return false;
      if (mahramReason(personId, c.id)) return false;
      if (countActiveSpouses(c.id) >= spouseLimitFor(c)) return false;
      return true;
    });
  };

  // Remove a marriage without touching either person. Needed because a
  // mistaken link could otherwise only be undone by DELETING one of them, which
  // is wrong when the person is real and only the marriage was wrong.
  // Children keep their parent-child rows and stay exactly where they are.
  const removeMarriage = async (relId) => {
    const removed = relationships.find((r) => r.id === relId);
    if (!removed) return;
    const remaining = relationships.filter((r) => r.id !== relId);

    const stillLinked = (id) =>
      remaining.some(
        (r) =>
          r.treeId === currentTree?.id &&
          (r.person1Id === id ||
            r.person2Id === id ||
            r.parentId === id ||
            r.childId === id),
      );

    // A spouse whose ONLY link was this marriage would survive in the database
    // but could never be drawn again — the invisible-record state. The app's
    // delete rule already removes anyone left unconnected, so removing a
    // marriage does the same rather than quietly creating an orphan.
    const orphaned = [removed.person1Id, removed.person2Id].filter(
      (id) => id != null && !stillLinked(id),
    );
    const nameOf = (id) => people.find((p) => p.id === id)?.firstName || "";

    const message =
      orphaned.length > 0
        ? `${t.removeMarriageOrphan}\n${orphaned.map(nameOf).filter(Boolean).join("، ")}\n\nهل تريد المتابعة؟`
        : t.removeMarriageConfirm;
    if (!window.confirm(message)) return;

    // One label for the undo list. A marriage removal often deletes nobody, so
    // the couple's names are the only thing that identifies it later.
    const marriageLabel = [
      `زواج: ${[nameOf(removed.person1Id), nameOf(removed.person2Id)]
        .filter(Boolean)
        .join(" — ")}`,
      ...(orphaned.length > 0
        ? [orphaned.map(nameOf).filter(Boolean).join("، ")]
        : []),
    ]
      .join(" | ")
      .slice(0, 300);

    try {
      // ONE batched call. The server snapshots the partner row AND any orphaned
      // people (with every relationship touching them) BEFORE removing
      // anything, so the whole action is a single undo entry. The old shape —
      // DELETE the relationship, then fire N person DELETEs — wrote no snapshot
      // at all, and destroyed the partner row before the people were even read.
      await api.people.batchDelete(currentTree?.id, orphaned, marriageLabel, [
        relId,
      ]);
      if (orphaned.length > 0) {
        setPeople((prev) => prev.filter((p) => !orphaned.includes(p.id)));
      }
      setRelationships(remaining);
      setShowPersonForm(false);
      setEditingPerson(null);

      // If the tree is rooted on someone whose ONLY link was this marriage —
      // a married-in spouse with no parents or children — they now connect to
      // nothing, and the tree would render them alone as a single box. Fall
      // back to the natural root, or to their former partner if that partner is
      // still connected.
      if (removed) {
        const partnerOf = (id) =>
          removed.person1Id === id ? removed.person2Id : removed.person1Id;
        setSelectedPerson((prev) => {
          if (prev == null || stillLinked(prev)) return prev;
          const other = partnerOf(prev);
          return stillLinked(other) ? other : null;
        });
        setHighlightedPerson((prev) =>
          prev != null && !stillLinked(prev) ? null : prev,
        );
      }

      // Surface the undo for what was just removed. Without this the snapshot
      // exists in the database but the header button stays disabled until the
      // next tree load, so the deletion looks unrecoverable when it is not.
      loadRestorableDeletion();
    } catch (error) {
      console.error("Failed to remove marriage:", error);
      failAlert("فشل في حذف الزواج: " + error.message);
    }
  };

  // Marry two people already in the tree: one partner row, nothing else.
  // A ref, not state: a second click can land before a state update re-renders,
  // which is how two identical partner rows appeared 185ms apart.
  const writeInFlight = useRef(false);

  const linkExistingSpouse = async (personId, spouseId) => {
    if (writeInFlight.current) return;
    writeInFlight.current = true;
    beginAction();
    try {
      const newRel = await api.relationships.create({
        treeId: currentTree?.id,
        type: "partner",
        person1Id: personId,
        person2Id: spouseId,
      });
      setRelationships((prev) => [...prev, newRel]);
      setExistingSpouseFor(null);
      setExistingSpouseSearch("");
      setSelectedPerson(personId);
      setHighlightedPerson(personId);
    } catch (error) {
      console.error("Failed to link spouse:", error);
      failAlert("فشل في إضافة الزواج: " + error.message);
    } finally {
      endAction();
      writeInFlight.current = false;
    }
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
        return { id: sid, name: sp?.firstName || `فرد ${sid}` };
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

    // OLDEST FIRST, the same order sortByBirth and the tree produce: null is the
    // original eldest, then descending, ties broken by id so the sequence is
    // deterministic. The previous version sorted `?? 9999` ASCENDING — youngest
    // first — while its comment claimed oldest first, and the direction logic was
    // inverted to compensate.
    const allSiblings = [person, ...siblings].sort((a, b) => {
      const an = a.birthOrder == null;
      const bn = b.birthOrder == null;
      if (an !== bn) return an ? -1 : 1;
      if (!an && a.birthOrder !== b.birthOrder) return b.birthOrder - a.birthOrder;
      return a.id - b.id;
    });

    const currentIndex = allSiblings.findIndex((s) => s.id === personId);
    if (currentIndex === -1) return;

    // A swap trades two birthOrder VALUES, which only moves anybody when the two
    // values differ and every position is distinct. Neither is guaranteed:
    //
    //   DUPLICATES — two siblings can hold the same number (جمال and حميد both
    //   sit at -4 in the live tree). Swapping -4 for -4 writes two rows, adds an
    //   undo entry and moves nothing. The arrow looks broken.
    //
    //   NULLS — null has no position to trade, so the old code invented one from
    //   the array index. In an all-null group that gave real numbers to exactly
    //   the two people involved while their siblings stayed null; null is the
    //   ELDEST, so both jumped from mid-group to the youngest end.
    //
    // Normalising first assigns dense, unique values in the order above, so the
    // swap afterwards is a plain exchange of two different numbers. It happens
    // once per group — the next press finds it clean and writes only two rows.
    const needsNormalise =
      allSiblings.some((s) => s.birthOrder == null) ||
      new Set(allSiblings.map((s) => s.birthOrder)).size < allSiblings.length;

    // LARGER means older, so the eldest takes the highest value.
    const working = needsNormalise
      ? allSiblings.map((s, i) => ({
          ...s,
          birthOrder: allSiblings.length - 1 - i,
        }))
      : allSiblings;

    // The array is oldest first, so "older" steps toward index 0.
    const targetIndex =
      direction === "older" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= working.length) return;

    const targetPerson = working[targetIndex];
    // Read positions from `working`. After normalising, the stored birthOrder is
    // stale, and `?? index` is the invention that caused the displacement above.
    const currentOrder = working[currentIndex].birthOrder;
    const targetOrder = targetPerson.birthOrder;

    // Every row this press writes: the normalised values where the group needed
    // them, with the two swap partners exchanged.
    const finalOrders = new Map(
      needsNormalise ? working.map((s) => [s.id, s.birthOrder]) : [],
    );
    finalOrders.set(personId, targetOrder);
    finalOrders.set(targetPerson.id, currentOrder);

    // Rollback needs the values as they stood before any of this.
    const previousOrders = new Map(
      allSiblings.map((s) => [s.id, s.birthOrder ?? null]),
    );

    // Guard against overlapping presses. The other write handlers use this same
    // ref; the reorder arrow lacked it, so a fast double-press (or a press while
    // the Promise.all below was still landing) started a second normalise+swap
    // over the same group, racing writes against each other. Set AFTER the
    // validation returns above (those bail without touching anything) and BEFORE
    // the optimistic update, so a blocked second press changes no state at all.
    if (writeInFlight.current) return;
    writeInFlight.current = true;

    // Optimistically update UI
    setPeople((prev) =>
      prev.map((p) =>
        finalOrders.has(p.id) ? { ...p, birthOrder: finalOrders.get(p.id) } : p,
      ),
    );

    // Persist to database via API. One swap writes TWO rows — both siblings
    // change — so they share an action group and undo reverses the swap in a
    // single press rather than leaving it half-applied after one.
    beginAction();
    try {
      await Promise.all(
        [...finalOrders].map(([id, order]) =>
          api.people.updateBirthOrder(id, order),
        ),
      );
      // Refresh the undo pointer HERE, not just from the effect on `people`.
      // This handler updates the UI optimistically BEFORE calling the API, so
      // the effect fires while the stack rows do not exist yet — the pointer
      // then lands on the previous entry and the server rejects it as
      // not-newest. Any optimistic update has this race.
      await loadRestorableDeletion();
    } catch (error) {
      console.error("Failed to persist birthOrder swap:", error);
      // Rollback on error — every row this touched, not just the two partners,
      // since a normalising press writes the whole group.
      setPeople((prev) =>
        prev.map((p) =>
          previousOrders.has(p.id)
            ? { ...p, birthOrder: previousOrders.get(p.id) }
            : p,
        ),
      );
    } finally {
      writeInFlight.current = false;
      endAction();
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
      // The picker occupies the same panel and carries the same
      // data-person-form marker, so it should dismiss the same way — closing
      // only via the × was inconsistent with every other panel.
      if (existingSpouseFor) {
        setExistingSpouseFor(null);
        setExistingSpouseSearch("");
        setExistingSpousePage(0);
      }
      if (linkChildrenFor) {
        setLinkChildrenFor(null);
        setLinkChildrenSelected(new Set());
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
        if (existingSpouseFor) {
          setExistingSpouseFor(null);
          setExistingSpouseSearch("");
          setExistingSpousePage(0);
        }
        if (linkChildrenFor) {
          setLinkChildrenFor(null);
          setLinkChildrenSelected(new Set());
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

  if (authLoading || sessionRestoreLoading) {
    return (
      <div className="auth-shell min-h-screen bg-[#F4EFE3] flex items-center justify-center p-4">
        {loaderVisible && (
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#16233D]" />
            <p className="mt-4 text-sm text-[#6B6555]">
              {sessionRestoreLoading
                ? "جاري استعادة بيانات العائلة..."
                : "جاري التحميل..."}
            </p>
          </div>
        )}
      </div>
    );
  }

  // /directory/:code — the public families list. A real path, not a query
  // parameter, because these pages are meant to be shared and indexed, and
  // /family/:id will need a permanent address too.
  const familyMatch = location.pathname.match(/^\/family\/(\d+)$/);
  if (familyMatch) {
    const signedIn = isAuthenticated || !!userProfile;
    return (
      <PublicLayout
        signedIn={signedIn}
        onBackToApp={() => navigate("/tree")}
        onHome={() => navigate("/")}
        onClaims={() => navigate("/")}
        onSignIn={() => navigate("/")}
        onSignUp={() => navigate("/")}
        onPrivacy={() => navigate("/privacy")}
      >
        <PublicTree
          treeId={familyMatch[1]}
          onBack={() => navigate("/directory/all")}
        />
      </PublicLayout>
    );
  }

  const directoryMatch = location.pathname.match(/^\/directory\/([A-Za-z]+)$/);
  if (directoryMatch) {
    const code = directoryMatch[1];
    const signedIn = isAuthenticated || !!userProfile;
    return (
      <PublicLayout
        signedIn={signedIn}
        onBackToApp={() => navigate("/tree")}
        onHome={() => navigate("/")}
        onClaims={() => navigate("/")}
        onSignIn={() => navigate("/")}
        onSignUp={() => navigate("/")}
        onPrivacy={() => navigate("/privacy")}
      >
        <DirectoryFamilies
          emirate={code}
          onBack={() => navigate("/")}
          onOpenFamily={(id) => navigate(`/family/${id}`)}
        />
      </PublicLayout>
    );
  }

  if (location.pathname === "/privacy") {
    const signedIn = isAuthenticated || !!userProfile;
    return (
      <PublicLayout
        signedIn={signedIn}
        onBackToApp={() => navigate("/tree")}
        onHome={() => navigate("/")}
        onClaims={() => navigate("/")}
        onSignIn={() => {
          // The auth dialog is rendered in the landing branch below, which this
          // return never reaches — so opening it from here set state that
          // nothing displayed, and the buttons appeared dead. Send the user to
          // the landing page with the dialog already open instead.
          setAuthMode("login");
          setAuthDialogOpen(true);
          navigate("/");
        }}
        onSignUp={() => {
          setAuthMode("signup");
          setAuthDialogOpen(true);
          navigate("/");
        }}
        onPrivacy={() => navigate("/privacy")}
      >
        <PrivacyPolicy />
      </PublicLayout>
    );
  }

  if (!isAuthenticated && !userProfile) {
    return (
      <>
          {/* Why the user is looking at this screen. Without it a session ended
              by a sign-in elsewhere just returns them to login with no
              explanation.

              In normal flow, NOT fixed. .lp-nav is static, so a fixed bar sat on
              top of it and half-covered the very تسجيل الدخول button this notice
              is telling the user to press. As the first block in the document it
              pushes the nav down instead, and needs no knowledge of nav height. */}
          {sessionEndedMessage && (
            <div
              dir="rtl"
              role="alert"
              className="w-full bg-amber-100 border-b-2 border-amber-400 text-amber-900 shadow-sm"
            >
              <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
                <span aria-hidden="true" className="text-lg leading-none">
                  &#9888;
                </span>
                <span className="flex-1 text-center text-base font-medium">
                  {sessionEndedMessage}
                </span>
                {/* Dismissable: the notice explains a state, it does not need an
                    answer, and leaving it pinned until the next sign-in means it
                    sits over the page while someone reads it or heads for the
                    login button. Clearing the state is enough — nothing else
                    reads sessionEndedMessage, and api.js keeps its own
                    once-per-session guard, so dismissing cannot suppress a
                    LATER termination. */}
                <button
                  type="button"
                  onClick={() => setSessionEndedMessage(null)}
                  aria-label="إغلاق"
                  className="shrink-0 rounded px-2 text-xl leading-none text-amber-900/70 hover:text-amber-900 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  &times;
                </button>
              </div>
            </div>
          )}

          <LandingPage
            onSignIn={() => {
              setAuthMode("login");
              setAuthDialogOpen(true);
            }}
            onSignUp={() => {
              setAuthMode("signup");
              setAuthDialogOpen(true);
            }}
            onPrivacy={() => navigate("/privacy")}
            directory={
              <DirectoryTiles
                onOpenEmirate={(code) => navigate(`/directory/${code}`)}
              />
            }
          />

        {/* A new PHONE user sits here: no Firebase session and no profile yet,
            so this branch renders rather than the app shell. Google users have a
            Firebase session and fall through to the shell, where the gate is
            already rendered alongside the profile dialog. */}
        {renderSignupGate()}
        {renderConsentGate()}

        {/* Sign in / register happens in a dialog over the landing page rather
            than on a separate screen: no page switch, and the two entry points
            differ only by which mode the form opens in. */}
        <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
          <DialogContent className="auth-shell sm:max-w-md" dir="rtl" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="kufi text-right text-2xl font-medium text-[#16233D]">
                {authMode === "login" ? t.signInTitle : t.signUpTitle}
              </DialogTitle>
            </DialogHeader>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A5813F] focus:border-transparent text-right"
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
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A5813F] focus:border-transparent text-right"
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
              className="w-full bg-[#16233D] hover:bg-[#A5813F] text-white py-3 rounded-[3px]"
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
              className="text-[#A5813F] hover:text-[#8A6A2F] text-sm"
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
              className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 py-3 rounded-[3px]"
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
            {/* Microsoft sign-in is hidden, not removed. The provider has never
                been enabled in the Firebase project (only Google is), so every
                attempt returned auth/operation-not-allowed — a button offering a
                login that cannot succeed. Enabling it needs an Azure app
                registration with a client id and a secret that expires, and no
                user can have a Microsoft identity because nobody could ever
                complete the flow. handleMicrosoftLogin and the 'microsoft'
                identityType are left in place, so re-enabling is this block plus
                the Azure setup. */}
            <Button
              onClick={() => setShowSmsLogin(true)}
              disabled={authProcessing}
              className="w-full bg-transparent hover:bg-[#A5813F]/8 text-[#16233D] border border-[#A5813F] py-3 rounded-[3px]"
            >
              <Smartphone className="w-5 h-5 ml-2" />
              {t.uaeMobile}
            </Button>
          </div>
          </DialogContent>
        </Dialog>

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
          <DialogContent className="sm:max-w-md" dir="rtl" aria-describedby={undefined}>
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

            {smsInfo && !smsError && (
              <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm text-right">
                {smsInfo}
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
                      className="flex-1 block w-full rounded-r-md border border-gray-300 px-3 py-2 focus:border-[#A5813F] focus:ring-[#A5813F]"
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
                  className="w-full bg-[#16233D] hover:bg-[#A5813F] text-white rounded-[3px]"
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
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#A5813F] focus:ring-[#A5813F] text-center text-lg tracking-widest"
                    maxLength={6}
                    dir="ltr"
                  />
                  {/* The number needs its OWN direction. In this RTL paragraph
                      the leading "+" is a neutral character, so the bidi
                      algorithm pushes it to the right of the digits and the
                      number reads 971503000223+. An inline-block with dir="ltr"
                      isolates it: the sign stays on the left where it belongs,
                      and the surrounding Arabic is unaffected. Every other place
                      a phone or email is shown already does this — only this
                      line was missed. */}
                  <p className="text-xs text-gray-500 mt-1 text-right">
                    تم إرسال رمز التحقق إلى{" "}
                    <span dir="ltr" className="inline-block">
                      +971{phoneInput}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setSmsStep("phone");
                      setSmsCode("");
                      setSmsError("");
                      setSmsInfo("");
                      setResendCooldown(0);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    تغيير الرقم
                  </Button>
                  <Button
                    onClick={handleVerifySmsCode}
                    disabled={authProcessing || smsCode.length !== 6}
                    className="flex-1 bg-[#16233D] hover:bg-[#A5813F] text-white rounded-[3px]"
                  >
                    {processingMethod === "code" ? (
                      <Loader2 className="w-5 h-5 animate-spin ml-2" />
                    ) : null}
                    تحقق
                  </Button>
                </div>
                {/* Delivery is not reliable, and the user should know that
                    before they conclude the app is broken. Measured from the
                    Twilio Verify logs on 4 Aug: several verifications needed two
                    or three sends before one arrived, and two expired without
                    ever being delivered — while others succeeded first time.
                    Twilio accepted every send; the carrier dropped some.
                    Re-sending is the correct remedy, not a workaround, so the
                    button is presented as the expected next step rather than a
                    last resort. */}
                <p className="text-xs text-gray-500 text-center">
                  لم يصلك الرمز؟
                </p>
                <button
                  onClick={handleSendSmsCode}
                  disabled={authProcessing || resendCooldown > 0}
                  className="w-full text-sm text-[#A5813F] hover:text-[#8A6A2F] underline disabled:opacity-50 disabled:no-underline"
                >
                  {resendCooldown > 0
                    ? `إعادة الإرسال خلال ${resendCooldown} ثانية`
                    : "إعادة إرسال الرمز"}
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Helper function to build genealogical name chain (follows paternal line)
  const getGenealogicalName = (person) => {
    const treePeople = people.filter((p) => p.treeId === currentTree?.id);
    const treeRels = relationships.filter((r) => r.treeId === currentTree?.id);

    let nameParts = [person.firstName];
    // The chain follows the BLOOD paternal line and nothing else. It used to fall
    // back to milkFatherName — a text column from when a milk-sibling could not
    // have real parents — which put a رضاعة name into a lineage. رضاعة is not
    // lineage and must never appear here. Milk-siblings are ordinary people with
    // real parent-child links now, so the fallback had no purpose either.
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

  // The name the directory shows when the owner has not overridden it.
  // Taken from the FIRST family group's head — the same root detection العائلات
  // uses — rather than a second implementation that could pick a different
  // person and produce a different name for the same tree.
  // The NAME only, without «عائلة». The word is a fixed prefix in the UI, not
  // part of the value: storing it would mean every override had to repeat it,
  // and a user who cleared the field would lose the word too.
  const derivedFamilyName = (() => {
    const head = familyGroups?.[0]?.heads?.[0];
    return head ? getGenealogicalName(head) : "";
  })();

  // The settings page unlocks one step at a time: name, then emirate, then
  // publish, then how visitors see women.
  //
  // This is not decoration. The PUBLIC directory has to print a family name,
  // and the derived one exists only in this browser — familyGroups, root
  // detection and getGenealogicalName are all client-side. Requiring the name to
  // be SAVED before an emirate can be chosen, and an emirate before publishing,
  // means a published tree always carries a literal string the server can serve
  // without reimplementing lineage logic that would drift from this one.
  const settingsHasName = Boolean(treeSettings.familyName);
  const settingsHasEmirate = Boolean(treeSettings.emirate);
  const settingsCanPublish = settingsHasName && settingsHasEmirate;


  // Reusable person add/edit form panel — rendered in both the tree view and the
  // Family Members dashboard, so people who aren't placed on the tree (e.g. milk
  // siblings) can still be opened and edited from the dashboard.
  // The picker occupies the SAME panel as the edit form — same position, width
  // and height — rather than floating over it as a second box. It pages instead
  // of scrolling: a page is sized to the panel, and the rest is reached with
  // next/previous.
  // Sized so a full page fits without clipping: header ~57, search ~54, pager
  // ~58, padding ~32, and each row ~48. Ten rows overflowed and cut the last;
  // nine fit once the panel is 680.
  const PICKER_PAGE_SIZE = 9;

  // Same right-hand panel as the spouse picker — fixed position, 380px, capped
  // height — so every "pick something" surface in the app sits in one place and
  // the click-away handler treats them identically via data-person-form.
  const renderLinkChildrenPanel = () => {
    const person = treePeople.find((p) => p.id === linkChildrenFor);
    const groups = linkableChildrenFor(linkChildrenFor);
    const close = () => {
      setLinkChildrenFor(null);
      setLinkChildrenSelected(new Set());
    };

    return (
      <div
        data-person-form
        className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-white shadow-2xl border rounded-lg z-50"
        style={{
          width: "380px",
          height: "min(680px, 85vh)",
          overflow: "hidden",
        }}
      >
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center p-4 border-b shrink-0">
            <h2 className="text-xl font-bold">{t.linkChildren}</h2>
            <Button onClick={close} variant="ghost" size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-4 flex flex-col gap-3 flex-1 min-h-0" dir="rtl">
            {groups.length === 0 ? (
              <p className="text-sm text-gray-500 text-right py-6 flex-1">
                {t.linkChildrenNone}
              </p>
            ) : (
              <>
                <div className="text-right shrink-0">
                  {person && (
                    <p className="text-base font-medium">{person.firstName}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    {person?.gender === "female"
                      ? t.linkChildrenHintMother
                      : t.linkChildrenHintFather}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3">
                  {groups.map((g) => (
                    <div key={g.spouse.id} className="space-y-2">
                      <p className="text-xs text-gray-400 text-right">
                        {t.linkChildrenOf} {g.spouse.firstName}
                      </p>
                      {g.children.map((c) => {
                        const blocked = linkChildBlockedBy(
                          linkChildrenFor,
                          c.id,
                        );
                        return (
                          <label
                            key={c.id}
                            className={
                              "flex items-center gap-2 w-full border rounded-md px-3 py-2 " +
                              (blocked
                                ? "opacity-60 cursor-not-allowed"
                                : "cursor-pointer")
                            }
                          >
                            <input
                              type="checkbox"
                              disabled={!!blocked}
                              checked={linkChildrenSelected.has(c.id)}
                              onChange={() => {
                                setLinkChildrenSelected((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(c.id)) next.delete(c.id);
                                  else next.add(c.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="flex-1 text-right text-sm">
                              {c.firstName}
                            </span>
                            {blocked && (
                              <span className="text-xs text-red-600">
                                {blocked}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t shrink-0">
                  <span className="text-sm text-gray-500">
                    {linkChildrenSelected.size} {t.linkChildrenSelected}
                  </span>
                  <div className="flex gap-2">
                    <Button onClick={close} variant="outline" size="sm">
                      {t.cancel}
                    </Button>
                    <Button
                      onClick={saveLinkedChildren}
                      disabled={linkChildrenSelected.size === 0}
                      size="sm"
                    >
                      {t.save}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSpousePicker = () => {
    const q = existingSpouseSearch.trim();
    const selfGen = generationDepths[existingSpouseFor] ?? 0;
    const all = eligibleSpousesFor(existingSpouseFor)
      .filter((c) => !q || getGenealogicalName(c).includes(q))
      // Nearest generation first. Everyone eligible is still listed — this only
      // stops the one person you probably want being buried under forty you
      // do not.
      .sort((a, b) => {
        const da = Math.abs((generationDepths[a.id] ?? 0) - selfGen);
        const db = Math.abs((generationDepths[b.id] ?? 0) - selfGen);
        if (da !== db) return da - db;
        return getGenealogicalName(a).localeCompare(getGenealogicalName(b), "ar");
      });
    const pages = Math.max(1, Math.ceil(all.length / PICKER_PAGE_SIZE));
    const page = Math.min(existingSpousePage, pages - 1);
    const slice = all.slice(
      page * PICKER_PAGE_SIZE,
      page * PICKER_PAGE_SIZE + PICKER_PAGE_SIZE,
    );

    return (
      <div
        data-person-form
        className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-white shadow-2xl border rounded-lg z-50"
        style={{
          width: "380px",
          height: "min(680px, 85vh)",
          overflow: "hidden",
        }}
      >
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center p-4 border-b shrink-0">
            <h2 className="text-xl font-bold">{t.pickExistingSpouse}</h2>
            <Button
              onClick={() => {
                setExistingSpouseFor(null);
                setExistingSpouseSearch("");
                setExistingSpousePage(0);
              }}
              variant="ghost"
              size="sm"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-4 flex flex-col gap-3 flex-1 min-h-0" dir="rtl">
            <input
              type="text"
              value={existingSpouseSearch}
              onChange={(e) => {
                setExistingSpouseSearch(e.target.value);
                setExistingSpousePage(0);
              }}
              placeholder={t.searchPlaceholder}
              className="w-full px-3 py-2 border rounded-md"
              dir="rtl"
            />

            {all.length === 0 ? (
              <p className="text-sm text-gray-500 text-right py-6 flex-1">
                {t.noEligible}
              </p>
            ) : (
              <div className="space-y-2 flex-1 overflow-hidden">
                {slice.map((c) => {
                  const diff = (generationDepths[c.id] ?? 0) - selfGen;
                  return (
                    <Button
                      key={c.id}
                      onClick={() => linkExistingSpouse(existingSpouseFor, c.id)}
                      variant="outline"
                      className="w-full justify-between text-right whitespace-normal h-auto py-2"
                    >
                      {diff !== 0 && (
                        <span className="text-xs text-gray-400">
                          {diff < 0 ? t.genAbove : t.genBelow}
                        </span>
                      )}
                      <span className="flex-1 text-right">
                        {getGenealogicalName(c)}
                      </span>
                    </Button>
                  );
                })}
              </div>
            )}

            {pages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t shrink-0">
                <Button
                  onClick={() => setExistingSpousePage((n) => Math.max(0, n - 1))}
                  disabled={page === 0}
                  variant="outline"
                  size="sm"
                >
                  {t.previous}
                </Button>
                <span className="text-sm text-gray-500">
                  {page + 1} / {pages}
                </span>
                <Button
                  onClick={() =>
                    setExistingSpousePage((n) => Math.min(pages - 1, n + 1))
                  }
                  disabled={page >= pages - 1}
                  variant="outline"
                  size="sm"
                >
                  {t.next}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPersonForm = () => {
    const treePeople = people.filter((p) => p.treeId === currentTree?.id);
    // The picker uses this same panel position, and renders BEFORE this in the
    // markup — so without this guard the form sits invisibly on top of it and
    // swallows every click.
    return (
      showPersonForm &&
      !existingSpouseFor &&
      !spouseSourceFor && (
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
                marriage={editingPerson ? latestMarriageOf(editingPerson) : null}
                onRemoveMarriage={removeMarriage}
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
                          `فرد ${selectedPerson}`
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

  if (currentView === "tree-settings") {
    const nameInUse = treeSettings.familyName || derivedFamilyName;
    // "Overridden" now means DIFFERENT from the lineage, not merely non-null —
    // every published tree stores a literal name, including the derived one.
    const isOverridden =
      Boolean(treeSettings.familyName) &&
      treeSettings.familyName !== derivedFamilyName;

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-20 bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setCurrentView("dashboard")}
              variant="outline"
              size="sm"
            >
              <Home className="w-4 h-4 ml-2" />
              {t.backToDashboard}
            </Button>
            <h1 className="text-xl font-bold">الإعدادات</h1>
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

        <div className="max-w-xl mx-auto px-6 py-8">
          <div className="bg-white rounded-lg shadow p-6 space-y-7 relative">
            <span
              className={`absolute top-4 left-6 text-[11px] text-green-700 transition-opacity ${
                settingsSaved ? "opacity-100" : "opacity-0"
              }`}
            >
              ✓ تم الحفظ
            </span>

            {/* اسم العائلة — derived unless overridden */}
            <div>
              <label className="block text-sm font-bold mb-1">اسم العائلة</label>
              {!editingFamilyName ? (
                <>
                  <div
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 ${
                      isOverridden
                        ? "border border-gray-300 bg-white"
                        : "border border-dashed border-gray-300 bg-gray-50"
                    }`}
                  >
                    <span className="flex-1 text-[15px] text-[#16233D]">
                      <span className="text-gray-400">عائلة</span>{" "}
                      {nameInUse || "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingFamilyName(true)}
                      title="تعديل"
                      aria-label="تعديل"
                      className="p-1.5 rounded-md border hover:bg-gray-100 transition"
                    >
                      <Pencil className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  {!settingsHasName ? (
                    // Nothing is stored yet. The box shows the derived name, but
                    // it has to be SAVED before anything below unlocks — the
                    // directory needs a literal string, not a value that only
                    // exists in this browser.
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={settingsBusy || !derivedFamilyName}
                        onClick={() =>
                          saveTreeSettings({ familyName: derivedFamilyName })
                        }
                      >
                        تأكيد الاسم
                      </Button>
                      <span className="text-[11px] text-gray-400">
                        {derivedFamilyName
                          ? "أكّد الاسم أو عدّله للمتابعة"
                          : "أضف أفراداً إلى شجرتك أولاً"}
                      </span>
                    </div>
                  ) : isOverridden ? (
                    // Rewrites the stored name from the CURRENT lineage rather
                    // than clearing it. Clearing would re-lock the page, and this
                    // also picks up a corrected ancestor name — which is what the
                    // label promises.
                    <button
                      type="button"
                      disabled={settingsBusy}
                      onClick={() =>
                        saveTreeSettings({ familyName: derivedFamilyName })
                      }
                      className="text-[11px] text-[#A5813F] mt-1.5 hover:underline"
                    >
                      ↺ العودة إلى الاسم التلقائي
                    </button>
                  ) : (
                    <div className="text-[11px] text-gray-400 mt-1.5">
                      مطابق للاسم التلقائي — من سلسلة النسب
                    </div>
                  )}
                </>
              ) : (
                <div className="border-2 border-[#A5813F] rounded-md p-3">
                  <div className="flex items-center gap-2">
                    {/* Fixed, outside the input — only the name is editable. */}
                    <span className="text-[15px] text-gray-400 shrink-0">
                      عائلة
                    </span>
                    <input
                      type="text"
                      autoFocus
                      maxLength={80}
                      value={treeSettings.familyName}
                      placeholder={derivedFamilyName}
                      onChange={(e) =>
                        setTreeSettings((prev) => ({
                          ...prev,
                          familyName: e.target.value,
                        }))
                      }
                      className="flex-1 px-3 py-2 border rounded-md text-[15px]"
                      dir="rtl"
                    />
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1.5">
                    التلقائي: عائلة {derivedFamilyName || "—"}
                  </div>
                  {/* No dir="ltr": in this RTL panel the first child sits on
                      the RIGHT, so حفظ reads before إلغاء. */}
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      disabled={settingsBusy}
                      onClick={() =>
                        saveTreeSettings({
                          familyName: treeSettings.familyName.trim(),
                        })
                      }
                    >
                      حفظ
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTreeSettings((prev) => ({
                          ...prev,
                          familyName: currentTree?.familyName || "",
                        }));
                        setEditingFamilyName(false);
                      }}
                    >
                      {t.cancel}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* الإمارة — locked until the name is saved */}
            <div className={settingsHasName ? "" : "opacity-40"}>
              <label className="block text-sm font-bold mb-1">الإمارة</label>
              <div className="text-[11px] text-gray-400 mb-2 leading-relaxed">
                {settingsHasName
                  ? "الإمارة التي صدرت منها خلاصة القيد — وليست مكان السكن الحالي"
                  : "أكّد اسم العائلة أولاً"}
              </div>
              <select
                value={treeSettings.emirate}
                disabled={settingsBusy || !settingsHasName}
                // The «غير محدّدة» option carries "", which is neither a valid
                // code nor null — send null so the server reads it as "clear".
                onChange={(e) =>
                  saveTreeSettings({ emirate: e.target.value || null })
                }
                className="w-full px-3 py-2 border rounded-md disabled:bg-gray-50"
              >
                <option value="">غير محدّدة</option>
                {EMIRATES.map((em) => (
                  <option key={em.code} value={em.code}>
                    {em.label}
                  </option>
                ))}
              </select>
            </div>

            {/* النشر — locked until both the name and the emirate are set */}
            <div className={settingsCanPublish ? "" : "opacity-40"}>
              <label className="block text-sm font-bold mb-1">النشر</label>
              <div className="text-[11px] text-gray-400 mb-2 leading-relaxed">
                {settingsCanPublish
                  ? "عند التفعيل تظهر عائلتك في دليل الإمارة ويمكن لأي زائر عرض الشجرة"
                  : "أكّد اسم العائلة واختر الإمارة أولاً"}
              </div>
              <label className="flex items-center gap-3 border rounded-md p-3 bg-gray-50">
                <input
                  type="checkbox"
                  checked={treeSettings.isPublished}
                  disabled={settingsBusy || !settingsCanPublish}
                  onChange={(e) =>
                    saveTreeSettings({ isPublished: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="text-sm">
                  نشر الشجرة للعموم
                  <span className="block text-[11px] text-gray-400 mt-0.5">
                    {treeSettings.isPublished
                      ? "منشورة — يمكن لأي زائر عرضها"
                      : "غير منشورة — الشجرة خاصة بك وحدك"}
                  </span>
                </span>
              </label>
            </div>

            {/* Greyed, not hidden, while النشر is off — a control that
                disappears takes its setting with it and leaves the user
                wondering where it went. */}
            <div className={treeSettings.isPublished ? "" : "opacity-40"}>
                <label className="block text-sm font-bold mb-1">
                  ظهور النساء في العرض العام
                </label>
                <div className="text-[11px] text-gray-400 mb-2 leading-relaxed">
                  {treeSettings.isPublished
                    ? "لا يؤثّر هذا على شجرتك — أنت ترى دائماً الشجرة كاملة. الاختيار هنا يقرّر ما يراه الزائر فقط."
                    : "فعّل النشر أولاً"}
                </div>
                <select
                  value={treeSettings.femaleDisplay}
                  disabled={settingsBusy || !treeSettings.isPublished}
                  onChange={(e) =>
                    saveTreeSettings({ femaleDisplay: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md disabled:bg-gray-50"
                >
                  <option value="hidden">بدون النساء</option>
                  <option value="anonymous">النساء بدون أسماء</option>
                  <option value="full">الشجرة كاملة بالأسماء</option>
                </select>
                <div className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                  {treeSettings.femaleDisplay === "hidden" &&
                    "الرجال وأبناؤهم الذكور فقط."}
                  {treeSettings.femaleDisplay === "anonymous" &&
                    "تظهر النساء في مواضعهنّ بصفتهنّ — «ابنة راشد»، «زوجة سالم» — بلا أسماء حقيقية."}
                  {treeSettings.femaleDisplay === "full" &&
                    "يرى الزائر الشجرة كما تراها أنت، بأسماء النساء كاملة."}
                </div>
            </div>

            {/* Which fields the public box carries. Same reasoning as
                femaleDisplay: what a stranger sees is a STORED decision, not a
                side effect of a display preference living in localStorage. */}
            <div className={treeSettings.isPublished ? "" : "opacity-40"}>
              <label className="block text-sm font-bold mb-1">
                الحقول الظاهرة للزائر
              </label>
              <div className="text-[11px] text-gray-400 mb-2 leading-relaxed">
                {treeSettings.isPublished
                  ? "الاسم يظهر دائماً. اختر ما يُضاف إليه في صندوق كل فرد."
                  : "فعّل النشر أولاً"}
              </div>

              <label className="flex items-center gap-2.5 border rounded-md px-3 py-2 mb-1.5 bg-gray-50">
                <input type="checkbox" checked readOnly className="rounded" />
                <span className="text-sm text-gray-400">الاسم</span>
                <span className="text-[11px] text-gray-400 mr-auto">دائماً</span>
              </label>

              {[
                ["birthYear", "سنة الميلاد"],
                ["deathYear", "سنة الوفاة"],
                ["age", "العمر"],
                ["birthPlace", "مكان الميلاد"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 border rounded-md px-3 py-2 mb-1.5"
                >
                  <input
                    type="checkbox"
                    checked={treeSettings.publicFields.includes(key)}
                    disabled={settingsBusy || !treeSettings.isPublished}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...treeSettings.publicFields, key]
                        : treeSettings.publicFields.filter((k) => k !== key);
                      // Send the whole set; the server re-adds "name" and
                      // filters anything it does not recognise.
                      saveTreeSettings({ publicFields: next });
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>

          </div>
        </div>
        {renderProfileDialog()}
        {renderSignupGate()}
        {renderConsentGate()}
      </div>
    );
  }

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
        <div className="sticky top-0 z-20 bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center">
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
            {renderUndoButton()}
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
                      person._spouseIndex === 1
                        ? "الزوجة الأولى"
                        : person._spouseIndex === 2
                          ? "الزوجة الثانية"
                          : person._spouseIndex === 3
                            ? "الزوجة الثالثة"
                            : person._spouseIndex === 4
                              ? "الزوجة الرابعة"
                              : null;
                    const rec = memberRecord(person);
                    const isOpen = expandedMemberId === person.id;
                    const isEditing = editingMemberId === person.id;
                    return (
                      <div
                        key={person.id}
                        data-person-card
                        style={
                          person._startsNewRow && !isOpen
                            ? { gridColumnStart: 1 }
                            : undefined
                        }
                        onClick={() => {
                          // Card click READS. Editing is the pencil, so the only
                          // way to see someone's record is no longer to open a
                          // writable form and look at it.
                          if (isEditing) return;
                          setExpandedMemberId(isOpen ? null : person.id);
                        }}
                        className={`relative bg-white rounded-lg shadow border transition ${
                          isOpen ? "md:col-span-2" : ""
                        } ${
                          isEditing
                            ? "ring-2 ring-[#A5813F] border-transparent"
                            : isOpen
                              ? "ring-1 ring-[#A5813F] border-transparent cursor-pointer"
                              : `cursor-pointer hover:shadow-md ${
                                  isMilk ? "border-green-300" : "border-transparent"
                                }`
                        }`}
                      >
                        <div className="p-4 flex items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-bold leading-relaxed">
                              {getGenealogicalName(person)}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {person.gender === "male" ? "ذكر" : "أنثى"}
                              {rec.lifespan && (
                                <>
                                  <span className="text-gray-300 mx-2">·</span>
                                  {rec.lifespan}
                                </>
                              )}
                              {rec.ageLabel && (
                                <>
                                  <span className="text-gray-300 mx-2">·</span>
                                  {rec.ageLabel}
                                </>
                              )}
                            </div>
                          </div>
                          <span className="text-gray-400 text-xs pt-1">
                            {isOpen ? "⌃" : "⌄"}
                          </span>
                        </div>

                        {isOpen && !isEditing && (
                          <div className="border-t px-4 pb-2 grid grid-cols-1 md:grid-cols-2 gap-x-8">
                            <div>
                              <div className="text-[15px] font-bold text-[#A5813F] tracking-wide mt-4 mb-1.5">
                                السجل
                              </div>
                              {[
                                ["تاريخ الميلاد", person.birthDate],
                                ["مكان الميلاد", person.birthPlace],
                                [
                                  "تاريخ الوفاة",
                                  rec.isLiving ? null : person.deathDate,
                                ],
                                ["الهاتف", person.phone],
                                ["البريد", person.email],
                              ]
                                // EVERY row renders, absent or not. Filtering
                                // empties made each card a different height and
                                // shape, so two people could not be compared by
                                // eye — one card showed five rows, the next two.
                                .map(([k, v]) => (
                                  <div
                                    key={k}
                                    className="flex justify-between py-1.5 border-b border-gray-50"
                                  >
                                    <span className="text-sm font-bold text-gray-500">{k}</span>
                                    <span
                                      dir="ltr"
                                      className={`text-sm ${
                                        v ? "text-gray-700" : "text-gray-300"
                                      }`}
                                    >
                                      {v || "—"}
                                    </span>
                                  </div>
                                ))}
                            </div>
                            <div>
                              <div className="text-[15px] font-bold text-[#A5813F] tracking-wide mt-4 mb-1.5">
                                الروابط
                              </div>
                              {[
                                [
                                  "الأب",
                                  rec.father ? getGenealogicalName(rec.father) : null,
                                ],
                                [
                                  "الأم",
                                  rec.mother ? getGenealogicalName(rec.mother) : null,
                                ],
                                [
                                  rec.spouseLabel,
                                  rec.counts.wives || null,
                                ],
                                ["الأبناء", rec.counts.children || null],
                                [
                                  "إخوة الرضاعة",
                                  rec.milk.length
                                    ? rec.milk
                                        .map((m) => getGenealogicalName(m))
                                        .join("، ")
                                    : null,
                                ],
                              ]
                                .map(([k, v]) => (
                                  <div
                                    key={k}
                                    className="flex justify-between py-1.5 border-b border-gray-50"
                                  >
                                    <span className="text-sm font-bold text-gray-500">{k}</span>
                                    <span
                                      className={`text-sm ${
                                        v ? "text-gray-700" : "text-gray-300"
                                      }`}
                                    >
                                      {v || "—"}
                                    </span>
                                  </div>
                                ))}
                            </div>

                            <div className="md:col-span-2">
                              <div className="text-[15px] font-bold text-[#A5813F] tracking-wide mt-4 mb-1.5">
                                الملخّص
                              </div>
                              <p
                                className={`text-sm leading-loose m-0 ${
                                  person.summary ? "text-gray-700" : "text-gray-300"
                                }`}
                              >
                                {person.summary || "—"}
                              </p>
                            </div>

                            <div className="md:col-span-2 border-t mt-3 pt-2 pb-1 flex items-center justify-between flex-row-reverse">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Reuses the centring that already exists:
                                  // selectedPerson drives a pan to that person's
                                  // layout coordinates, highlightedPerson draws
                                  // the green border.
                                  setSelectedPerson(person.id);
                                  setHighlightedPerson(person.id);
                                  setCurrentView("tree-builder");
                                }}
                              >
                                عرض في الشجرة
                              </Button>
                              <div dir="ltr" className="flex items-center gap-2">
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
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingMemberId(person.id);
                                    setEditingPerson(person.id);
                                  }}
                                  title="تعديل"
                                  aria-label="تعديل"
                                  className="p-1.5 rounded-md hover:bg-gray-100 transition"
                                >
                                  <Pencil className="w-4 h-4 text-gray-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {isEditing && (
                          // The SAME PersonForm the tree opens, rendered in the
                          // card instead of a floating panel — so nothing is
                          // being edited behind an overlay. One component, one
                          // set of validation rules.
                          <div
                            className="border-t px-4 py-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="max-w-[420px]">
                              <PersonForm
                                key={`card-edit-${person.id}`}
                                person={person}
                                onSave={async (data) => {
                                  await updatePerson(data);
                                  setEditingMemberId(null);
                                  setEditingPerson(null);
                                }}
                                onCancel={() => {
                                  setEditingMemberId(null);
                                  setEditingPerson(null);
                                }}
                                relationshipType={null}
                                marriage={latestMarriageOf(person.id)}
                                onRemoveMarriage={removeMarriage}
                                t={t}
                              />
                            </div>
                          </div>
                        )}

                        {!isOpen && (
                          <div
                            dir="ltr"
                            className="absolute bottom-2 left-2 flex items-center gap-2"
                          >
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
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedMemberId(person.id);
                                setEditingMemberId(person.id);
                                // updatePerson resolves WHICH person from the
                                // editingPerson state, not from the data it is
                                // handed, so this must be set or the save writes
                                // to null and silently does nothing.
                                setEditingPerson(person.id);
                              }}
                              title="تعديل"
                              aria-label="تعديل"
                              className="p-1.5 rounded-md hover:bg-gray-100 transition"
                            >
                              <Pencil className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        )}

                        {!isOpen && (isMilk || spouseLabel) && (
                          <div className="absolute bottom-2 right-4 flex gap-1.5">
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
                        )}

                        {!isOpen && <div className="h-8" />}
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
        {renderSignupGate()}
        {renderConsentGate()}
      </div>
    );
  }

  if (currentView === "relationships-detail") {
    const treePeople = people.filter((p) => p.treeId === currentTree?.id);
    const treeRels = relationships.filter((r) => r.treeId === currentTree?.id);

    // Get married males (husbands who have wives, with or without children)
    const unsortedHeads = treePeople.filter((person) => {
      if (person.gender !== "male") return false;

      const hasSpouse = treeRels.some(
        (r) =>
          r.type === "partner" &&
          (r.person1Id === person.id || r.person2Id === person.id),
      );

      return hasSpouse;
    });

    // ORDER: oldest generation first, and within a generation the ELDER LINE
    // first, applied recursively.
    //
    // The tie-break question was "my brothers or my uncle's children?" and the
    // answer is neither in the abstract — it depends which of the two fathers is
    // the elder brother. Each person carries a path of birth positions from the
    // founding ancestor down, so [1,1,1] sorts before [1,2,1]: your children come
    // before your brother's children when your father is the elder.
    //
    // The alternative — closeness to whoever is viewing — was rejected because the
    // page would reorder depending on whose card you opened, so two people looking
    // at the same family would see different orders.
    // ELDEST is the smallest number here, so a path sorts ascending.
    //
    // null means the ORIGINAL ELDEST — older than every numbered sibling,
    // including positive ones. This used to map null to 0 and everything else to
    // -birthOrder, which placed null BETWEEN a positive order and a negative one:
    // a child carrying birthOrder 1 outranked a null sibling who is genuinely
    // older. Because lineagePath is recursive, one wrong position near the top
    // reordered every family beneath it. Positive values are not rare — addPerson
    // assigns 1 to the first child added to a parent whose children all have null.
    //
    // ELDEST now puts null ahead of every number, matching what the tree engine
    // (comparePeople), the reorder arrows and the members list already produce:
    //   null, 1, -1, -2   (oldest -> youngest)
    // Comparison-only; never stored, never displayed.
    const ELDEST = Number.NEGATIVE_INFINITY;
    const birthPosition = (person) => {
      if (person?.birthOrder == null) return ELDEST;
      return -person.birthOrder;
    };

    const lineagePathCache = new Map();
    const lineagePath = (person, guard = 0) => {
      if (!person) return [];
      if (lineagePathCache.has(person.id)) return lineagePathCache.get(person.id);
      // guard: a malformed cycle in parent-child would otherwise recurse forever.
      if (guard > 60) return [];
      const father = fatherOf(person.id);
      const path = [...lineagePath(father, guard + 1), birthPosition(person)];
      lineagePathCache.set(person.id, path);
      return path;
    };

    const comparePaths = (a, b) => {
      const len = Math.max(a.length, b.length);
      for (let i = 0; i < len; i++) {
        // A missing segment means no ancestor is recorded at that depth — which
        // carries no younger-sibling offset, exactly like a null birthOrder. It
        // has to be ELDEST and not a literal -1: -1 is a real position (the value
        // birthPosition returns for birthOrder 1), so the two would be compared
        // as if they meant the same thing.
        const av = a[i] ?? ELDEST;
        const bv = b[i] ?? ELDEST;
        // Subtraction is unusable once ELDEST is -Infinity: -Inf - -Inf is NaN,
        // and a NaN comparator silently scrambles the sort.
        if (av !== bv) return av < bv ? -1 : 1;
      }
      return 0;
    };

    const maleParents = [...unsortedHeads].sort((a, b) => {
      const ga = generationDepths[a.id] ?? 0;
      const gb = generationDepths[b.id] ?? 0;
      if (ga !== gb) return ga - gb;
      const byLine = comparePaths(lineagePath(a), lineagePath(b));
      if (byLine !== 0) return byLine;
      // Same generation, same line: fall back to id so the order is at least
      // stable between renders.
      return a.id - b.id;
    });

    // A household: wives and children. The sibling derivation that used to live
    // here went with the counts it fed — sibling links are reciprocal, so each one
    // appeared on two cards of the same page.

    // Arabic counts a noun differently at 1, at 2, at 3–10 and again from 11 up.
    // A single `n === 1 ? "ابن" : "أبناء"` gets three of those four wrong: it
    // produced "و2 أبناء" where the dual form ابنان is required, and "و14 أبناء"
    // where 11 and above take the singular تمييز — ابن.
    const marriedChildrenLabel = (n) => {
      if (n === 1) return "وابن واحد له عائلته";
      if (n === 2) return "وابنان اثنان لهم عائلاتهم";
      if (n <= 10) return `و${n} أبناء لهم عائلاتهم`;
      return `و${n} ابن لهم عائلاتهم`;
    };

    // Who belongs to whom. The counts above say HOW MANY; this says WHICH — and
    // in a polygamous tree that is the question the page exists to answer.
    //
    // Children are grouped by their MOTHER, not listed flat, because "these are
    // راشد's children" is not useful when he has two wives and twenty-eight
    // children. A flat list makes the reader guess.
    const familyDetail = (person) => {
      const isMarried = (id) =>
        treeRels.some(
          (r) =>
            r.type === "partner" && (r.person1Id === id || r.person2Id === id),
        );

      const childrenOfHead = treeRels
        .filter((r) => r.type === "parent-child" && r.parentId === person.id)
        .map((r) => treePeople.find((p) => p.id === r.childId))
        .filter(Boolean);

      // A child's mother is their female parent. Absent for anyone entered
      // through a path that only ever recorded a father.
      const motherIdOf = (childId) => {
        const rel = treeRels.find(
          (r) =>
            r.type === "parent-child" &&
            r.childId === childId &&
            treePeople.some(
              (p) => p.id === r.parentId && p.gender === "female",
            ),
        );
        return rel ? rel.parentId : null;
      };

      const split = (kids) => ({
        // Married children are COUNTED, not listed: a married son has his own
        // card on this page and a married daughter appears under her husband's.
        // Listing them here would show the same person in two places.
        unmarried: kids.filter((k) => !isMarried(k.id)),
        marriedCount: kids.filter((k) => isMarried(k.id)).length,
      });

      const groups = [];
      // Every child must land in exactly one group. Tracking it here rather than
      // deducing it afterwards keeps the two loops honest with each other.
      const placed = new Set();
      const spouseRels = treeRels.filter(
        (r) =>
          r.type === "partner" &&
          (r.person1Id === person.id || r.person2Id === person.id),
      );

      for (const rel of spouseRels) {
        const wifeId =
          rel.person1Id === person.id ? rel.person2Id : rel.person1Id;
        const wife = treePeople.find((p) => p.id === wifeId);
        if (!wife) continue;
        const kids = childrenOfHead.filter((c) => motherIdOf(c.id) === wifeId);
        const isDivorced = rel.status === "divorced";

        // A divorce with no children leaves nothing to attribute, so the row
        // would be noise. A CURRENT wife with no children is still part of the
        // family and appears by name alone.
        if (isDivorced && kids.length === 0) continue;

        for (const c of kids) placed.add(c.id);
        groups.push({
          key: `w${wifeId}`,
          name: getGenealogicalName(wife),
          divorced: isDivorced,
          // She stays in the list whether or not she is alive — she may have
          // children by him, and dropping her would separate them from their
          // mother. Marked, though, because عدد الزوجات counts her while the
          // four-wife limit does not: without this the card shows six wives
          // against a limit of four and looks like a rule was broken.
          deceased: wife.isLiving === false,
          ...split(kids),
        });
      }

      // Everyone the loop above did not place. Two cases reach here:
      //
      //   no mother recorded at all  -> غير محدد
      //   a mother who is NOT a wife -> her own group, by name
      //
      // The second is not hypothetical. Production tree 62 has مريم, آيه and يسر
      // recorded with father 503 and mother حنان, while حنان is married to 682 —
      // the duplicate record of the same man. Placing children only under WIVES
      // dropped all three from the card while عدد الأبناء still counted them, so
      // the groups did not add up to the total printed directly above. That is
      // the exact contradiction غير محدد was added to avoid.
      //
      // Naming her is also the more honest answer: the parent-child link IS
      // recorded, it is the marriage that is missing, and hiding her would hide
      // the evidence of that.
      const byMother = new Map();
      for (const c of childrenOfHead) {
        if (placed.has(c.id)) continue;
        const mid = motherIdOf(c.id);
        if (!byMother.has(mid)) byMother.set(mid, []);
        byMother.get(mid).push(c);
      }

      for (const [mid, kids] of byMother) {
        const mother = mid ? treePeople.find((p) => p.id === mid) : null;
        groups.push({
          key: mother ? `m${mid}` : "unknown",
          name: mother ? getGenealogicalName(mother) : "غير محدد",
          // Not a wife: no heart, muted rule. She is the mother of his children
          // with no recorded marriage, and the card must not imply one.
          unknownMother: !mother,
          notAWife: Boolean(mother),
          divorced: false,
          ...split(kids),
        });
      }

      return groups;
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-20 bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center">
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
              const isOpen = expandedFamilyId === person.id;
              const groups = isOpen ? familyDetail(person) : null;
              return (
                <div
                  key={person.id}
                  /* An open card spans BOTH columns. The mother groups need the
                     width, and letting one cell in a two-column grid grow taller
                     shoves its neighbour around for no reason. */
                  className={`bg-white rounded-lg shadow ${
                    isOpen ? "md:col-span-2 ring-1 ring-[#A5813F]" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedFamilyId(isOpen ? null : person.id)
                    }
                    aria-expanded={isOpen}
                    className="w-full text-right p-4 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="text-lg font-bold mb-2">
                        عائلة {getGenealogicalName(person)}
                      </div>
                      <div className="space-y-1 text-sm">
                        {/* Siblings are gone, blood and milk alike. They are
                            RECIPROCAL: my brother's card lists me and mine lists
                            him, so the same fact appeared twice on one page. They
                            also belong to a man's father's household, not his own.
                            رضاعة stays visible in the tree and on the members
                            cards. */}
                        <div className="text-[#A5813F]">
                          عدد الزوجات: {counts.wives}
                        </div>
                        <div className="text-blue-600">
                          عدد الأبناء: {counts.children}
                        </div>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 shrink-0 mt-1 text-gray-400 transition-transform ${
                        isOpen ? "rotate-180 text-[#A5813F]" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="border-t px-4 py-4 space-y-4">
                      {groups.length === 0 && (
                        <p className="text-sm text-gray-500">
                          لا توجد تفاصيل لعرضها.
                        </p>
                      )}
                      {groups.map((g) => (
                        <div
                          key={g.key}
                          /* The rule ties a mother to her children. Solid brass
                             for a current wife, muted for a divorced one or for
                             the unrecorded group — present, but not the same
                             thing. */
                          className={`border-r-2 pr-3 ${
                            g.divorced || g.deceased || g.unknownMother ||
                            g.notAWife
                              ? "border-gray-300"
                              : "border-[#A5813F]"
                          }`}
                        >
                          <div className="font-medium mb-2 flex items-center gap-2 flex-wrap">
                            {/* Marks the row as a WIFE rather than a heading.
                                Omitted for غير محدد — that group is the absence
                                of a mother, not a person, and giving it the same
                                mark would claim someone is there. */}
                            {!g.unknownMother && !g.notAWife && (
                              <Heart
                                className={`w-4 h-4 shrink-0 ${
                                  g.divorced || g.deceased
                                    ? "text-gray-400"
                                    : "text-[#A5813F]"
                                }`}
                              />
                            )}
                            <span
                              className={
                                g.unknownMother ? "text-gray-500" : ""
                              }
                            >
                              {g.name}
                            </span>
                            {g.divorced && (
                              <span className="text-xs font-normal text-[#99694b] bg-[#f5e3d8] px-2 py-0.5 rounded">
                                مطلقة
                              </span>
                            )}
                            {g.deceased && (
                              <span className="text-xs font-normal text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                متوفاة
                              </span>
                            )}
                          </div>

                          {g.unmarried.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {g.unmarried.map((c) => (
                                <span
                                  key={c.id}
                                  className="text-sm border rounded px-2.5 py-1"
                                >
                                  {c.firstName}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Why the list is shorter than the count above. Without
                              this the card looks like it is hiding children. */}
                          {g.marriedCount > 0 && (
                            <p className="text-xs text-gray-500 mt-2">
                              {marriedChildrenLabel(g.marriedCount)}
                            </p>
                          )}

                          {g.unmarried.length === 0 && g.marriedCount === 0 && (
                            <p className="text-xs text-gray-500">لا أبناء</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {maleParents.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              لا توجد عائلات بعد
            </div>
          )}
        </div>
        {renderProfileDialog()}
        {renderSignupGate()}
        {renderConsentGate()}
      </div>
    );
  }

  if (currentView === "dashboard") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-20 bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center">
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
        <div className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg"
            onClick={() => currentTree && setCurrentView("tree-builder")}
          >
            <h3 className="text-xl font-bold mb-4">{t.myFamilyTrees}</h3>
            <div className="text-3xl font-bold text-[#A5813F]">
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
              {/* The number the card leads to: married men, one card each. It
                  used to count RELATIONSHIP ROWS — every partner, parent-child
                  and sibling edge — which read 204 on a tree whose العائلات page
                  lists 24. That was correct for the old العلاقات page; the label
                  was renamed and the number underneath was not. Same filter the
                  detail view uses, so the two can no longer disagree. */}
              {
                people.filter(
                  (p) =>
                    p.treeId === currentTree?.id &&
                    p.gender === "male" &&
                    relationships.some(
                      (r) =>
                        r.treeId === currentTree?.id &&
                        r.type === "partner" &&
                        (r.person1Id === p.id || r.person2Id === p.id),
                    ),
                ).length
              }
            </div>
          </div>
          <div
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg relative"
            onClick={() => currentTree && setCurrentView("tree-settings")}
          >
            {/* The pill is the reason this card carries no number: whether the
                tree is public is the one thing that should never need opening a
                screen to discover. */}
            <span
              className={`absolute top-5 left-6 text-[10px] px-2 py-0.5 rounded-full border ${
                treeSettings.isPublished
                  ? "text-green-700 border-green-200 bg-green-50"
                  : "text-gray-500 border-gray-200 bg-gray-50"
              }`}
            >
              {treeSettings.isPublished ? "منشورة" : "غير منشورة"}
            </span>
            <h3 className="text-xl font-bold mb-4">الإعدادات</h3>
            <div
              className={`text-2xl font-bold ${
                treeSettings.emirate ? "text-[#A5813F]" : "text-gray-300"
              }`}
            >
              {emirateLabel(treeSettings.emirate) || "غير محدّدة"}
            </div>
          </div>

        </div>
        {renderProfileDialog()}
        {renderSignupGate()}
        {renderConsentGate()}
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 overflow-hidden">
      {/* In normal flow, not fixed: it pushes the header down instead of covering
          the controls it is talking about. Dismissible, because someone who knows
          and is browsing anyway should not be nagged on every screen. Dismissal
          lives in component state — it returns on a reload, which is the right
          side to err on for a notice nobody is forced to read.
          Hidden while the sign-up gate is open: that gate is a modal over this
          shell, so the bar showed BEHIND it, advising someone to use a computer
          to build a tree they have not agreed to create yet. */}
      <div ref={shellChromeRef}>
      {isNarrow && !narrowNoticeDismissed && !pendingSignup && (
        <div
          dir="rtl"
          role="status"
          className="w-full bg-amber-100 border-b-2 border-amber-400 text-amber-900"
        >
          <div className="flex items-start gap-2 px-4 py-2">
            <span aria-hidden="true" className="text-base leading-none pt-0.5">
              &#9888;
            </span>
            <span className="flex-1 text-sm leading-snug">{t.narrowScreen}</span>
            <button
              type="button"
              onClick={() => setNarrowNoticeDismissed(true)}
              aria-label="إغلاق"
              className="shrink-0 rounded px-2 text-lg leading-none text-amber-900/70 hover:text-amber-900 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              &times;
            </button>
          </div>
        </div>
      )}
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
          {renderUndoButton()}
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
      <div
        className="relative"
        style={{ height: `calc(100vh - ${chromeHeight}px)` }}
      >
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
                const selected = treePeople.find(
                  (p) => p.id === selectedPerson,
                );
                const spouseLimit = spouseLimitFor(selected);
                const limitMessage = spouseLimitMessage(spouseLimit);
                const canAddSpouse =
                  countActiveSpouses(selectedPerson) < spouseLimit;
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
                  : "الوالدان مسجلان بالفعل";

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
                  // Must match handleReorderSibling exactly, or a button greys
                  // out at the wrong end of the row. OLDEST FIRST: null is the
                  // original eldest, then descending, ties by id.
                  const allSiblings = [currentPerson, ...siblings].sort(
                    (a, b) => {
                      const an = a.birthOrder == null;
                      const bn = b.birthOrder == null;
                      if (an !== bn) return an ? -1 : 1;
                      if (!an && a.birthOrder !== b.birthOrder)
                        return b.birthOrder - a.birthOrder;
                      return a.id - b.id;
                    },
                  );
                  const currentIndex = allSiblings.findIndex(
                    (s) => s.id === selectedPerson,
                  );
                  // Oldest sits at index 0, so the eldest cannot move older and
                  // the youngest cannot move younger.
                  canMoveOlder = currentIndex > 0;
                  canMoveYounger = currentIndex < allSiblings.length - 1;
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
                        size="sm"
                        variant="ghost"
                        className={`w-8 h-8 p-0${
                          !canAddSpouse ? " opacity-40" : ""
                        }`}
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
                      {linkableChildrenFor(selectedPerson).length > 0 && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPersonForm(false);
                            setEditingPerson(null);
                            setLinkChildrenSelected(new Set());
                            setLinkChildrenFor(selectedPerson);
                            setShowActionMenu(false);
                          }}
                          size="sm"
                          variant="ghost"
                          className="w-8 h-8 p-0"
                          title={t.linkChildren}
                        >
                          <Link2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canAddParents) {
                            window.alert("الوالدان مسجلان بالفعل");
                            return;
                          }
                          // Add both parents at once and open father's form
                          handleAddBothParents(selectedPerson);
                          setShowActionMenu(false);
                        }}
                        size="sm"
                        variant="ghost"
                        className={`w-8 h-8 p-0${
                          !canAddParents ? " opacity-40" : ""
                        }`}
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
                        size="sm"
                        variant="ghost"
                        className={`w-8 h-8 p-0${
                          !canAddSibling ? " opacity-40" : ""
                        }`}
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

        {spouseSourceFor && (
          <Dialog
            open={true}
            onOpenChange={(open) => {
              if (!open) setSpouseSourceFor(null);
            }}
          >
            <DialogContent className="sm:max-w-md" dir="rtl" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle className="text-right text-xl">
                  {t.addSpouseChoice}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Button
                  onClick={() => openNewSpouseForm(spouseSourceFor)}
                  variant="outline"
                  className="w-full justify-end"
                >
                  {t.spouseNewPerson}
                </Button>
                <Button
                  onClick={() => {
                    setShowPersonForm(false);
                    setEditingPerson(null);
                    setExistingSpouseFor(spouseSourceFor);
                    setExistingSpouseSearch("");
                    setExistingSpousePage(0);
                    setSpouseSourceFor(null);
                  }}
                  variant="outline"
                  className="w-full justify-end"
                >
                  {t.spouseExisting}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {existingSpouseFor && renderSpousePicker()}

        {linkChildrenFor && renderLinkChildrenPanel()}

        {motherPickerFor && (
          <Dialog
            open={true}
            onOpenChange={(open) => {
              if (!open) setMotherPickerFor(null);
            }}
          >
            <DialogContent className="sm:max-w-md" dir="rtl" aria-describedby={undefined}>
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
                    {Object.keys(displayOptions).map((key) => {
                      // Greyed, NOT hidden. A list that changes length as data
                      // changes loses the user's place, and a toggle that
                      // vanishes takes its setting with it.
                      const hasData = displayOptionHasData[key] !== false;
                      return (
                      <label
                        key={key}
                        className={`flex items-center gap-2 ${
                          hasData ? "cursor-pointer" : "cursor-default"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={displayOptions[key]}
                          disabled={!hasData}
                          onChange={(e) =>
                            setDisplayOptions((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                          className="rounded"
                        />
                        <span
                          className={`text-sm ${hasData ? "" : "text-gray-400"}`}
                        >
                          إظهار {displayOptionLabels[key] || key}
                        </span>
                      </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-3">الألوان</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm w-36">لون الذكور</label>
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
                      <label className="text-sm w-36">لون الإناث</label>
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
                      <label className="text-sm w-36">أخ أو أخت بالرضاعة</label>
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
                      <label className="text-sm w-36">لون الخلفية</label>
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
                      <label className="text-sm w-36">لون النص للأحياء</label>
                      <input
                        type="color"
                        value={stylingOptions.livingTextColor}
                        onChange={(e) =>
                          setStylingOptions((prev) => ({
                            ...prev,
                            livingTextColor: e.target.value,
                          }))
                        }
                        className="w-12 h-8 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm w-36">لون النص للمتوفين</label>
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
                <Button onClick={handleSaveOptions}>{t.save}</Button>
              </div>
            </div>
          </div>
        )}
        {renderProfileDialog()}
        {renderSignupGate()}
        {renderConsentGate()}
      </div>
    </div>
  );
}

function PersonForm({
  person,
  onSave,
  onCancel,
  relationshipType,
  marriage,
  onRemoveMarriage,
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

  // NULL status means married, so anything other than "divorced" is married.
  const [isDivorced, setIsDivorced] = useState(
    marriage?.status === "divorced",
  );

  const [formData, setFormData] = useState({
    firstName: getDefaultFirstName(),
    lastName: person?.lastName || "",
    gender: getDefaultGender(),
    birthDate: person?.birthDate || "",
    birthPlace: person?.birthPlace || "",
    isLiving: person?.isLiving !== false,
    isBreastfed: person?.isBreastfed === true,
    deathDate: person?.deathDate || "",
    phone: person?.phone || "",
    email: person?.email || "",
    profession: person?.profession || "",
    summary: person?.summary || "",
  });

  useEffect(() => {
    setIsDivorced(marriage?.status === "divorced");
  }, [marriage?.id, marriage?.status]);

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
    summary: person?.summary || "",
    });
  }, [
    person,
    defaultFirstName,
    relationshipType,
    selectedPersonName,
    pendingFatherId,
    pendingMotherId,
  ]);

  const [submitting, setSubmitting] = useState(false);

  // onSave is async but was never awaited, so a second click landed while the
  // first request was still in flight and the whole action ran twice — person
  // AND marriage. Confirmed in the undo stack: two creates, milliseconds apart.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!formData.firstName.trim()) {
      alert("يرجى إدخال الاسم الأول");
      return;
    }
    if (!formData.gender || formData.gender === "") {
      alert("يرجى اختيار الجنس");
      return;
    }
    // Phone, when given, must be a 10-digit UAE number starting with 0
    // (e.g. 05XXXXXXXX). Validated on save, the same way the browser validates
    // the email field, so a malformed number can't be stored silently.
    const phoneValue = (formData.phone || "").trim();
    if (phoneValue && !/^0\d{9}$/.test(phoneValue)) {
      alert("يجب أن يكون رقم الهاتف 10 أرقام ويبدأ بصفر (مثال: 05XXXXXXXX)");
      return;
    }
    DEBUG && console.log("Form data being submitted:", formData);
    setSubmitting(true);
    try {
      await onSave(
        marriage
          ? { ...formData, __marriageId: marriage.id, __isDivorced: isDivorced }
          : formData,
      );
    } finally {
      // Released on failure too, so a refused save leaves the form usable.
      setSubmitting(false);
    }
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
              setFormData((prev) => ({
                ...prev,
                isLiving: e.target.checked,
                // Marking someone living again CLEARS the death date. The field
                // below is merely hidden when isLiving is true (`!formData.isLiving &&`),
                // so without this the old value stayed in formData, was saved,
                // and kept drawing on the tree for a person marked alive — with
                // no visible field to remove it from.
                deathDate: e.target.checked ? "" : prev.deathDate,
              }))
            }
            className="rounded"
          />
          <label htmlFor="isLiving" className="text-sm font-bold">
            {t.isLiving}
          </label>
        </div>

        {marriage && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDivorced"
              checked={isDivorced}
              onChange={(e) => setIsDivorced(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="isDivorced" className="text-sm font-bold">
              {person?.gender === "male" ? t.divorcedM : t.divorcedF}
            </label>
          </div>
        )}

        {marriage && onRemoveMarriage && (
          <button
            type="button"
            onClick={() => onRemoveMarriage(marriage.id)}
            className="text-sm text-red-600 hover:text-red-700 underline"
          >
            {t.removeMarriage}
          </button>
        )}

        {/* Milk-sibling (رضاعة) only. addPerson acts on isBreastfed ONLY under
            relationshipType === "sibling"; shown on any other add flow (spouse,
            child) it was a live control the save path ignored — a tick that
            could paint a green milk box on a pair with no milk bond. Gated to
            match where it is actually read. */}
        {!person && relationshipType === "sibling" && (
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-bold mb-1">{t.phone}</label>
          <input
            type="tel"
            inputMode="numeric"
            value={formData.phone}
            maxLength={10}
            onChange={(e) =>
              // Digits only, hard-capped at 10 — a UAE number is 10 digits
              // starting with 0. maxLength alone doesn't stop a paste, so the
              // value is sliced here too.
              setFormData((prev) => ({
                ...prev,
                phone: e.target.value.replace(/\D/g, "").slice(0, 10),
              }))
            }
            className="w-full px-3 py-2 border rounded-md"
            dir="ltr"
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
        <label className="block text-sm font-bold mb-1">{t.summary}</label>
        <textarea
          value={formData.summary}
          maxLength={520}
          rows={4}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, summary: e.target.value }))
          }
          className="w-full px-3 py-2 border rounded-md resize-none"
          dir="rtl"
        />
        {/* resize-none, fixed at rows={4}. `resize-y` let the user drag the box
            down to a single-line sliver or up to an arbitrary height, neither of
            which the layout expects; long text scrolls inside instead.
            Capped at 520 to match the Zod limit server-side — chosen so the
            paragraph wraps to about two lines in the record card at full width.
            It is an approximation, not a guarantee: the card is responsive, so
            the same text runs longer on a narrow screen — this text appears
            in the record card and in the public tree view, and unbounded prose
            breaks both.
            dir="ltr" on the counter: in RTL "0 / 600" renders as "600 / 0". */}
        <div
          className="text-xs text-gray-400 text-left mt-1"
          dir="ltr"
        >
          {(formData.summary || "").length} / 520
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t mt-4">
        <Button type="submit" disabled={submitting}>
          {person ? t.update : t.save}
        </Button>
        <Button type="button" onClick={onCancel} variant="outline">
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

export default App;
