import "./LandingPage.css";

/**
 * The shell every public (signed-out) page sits inside: top banner, the page's
 * own content, footer. Any page added later gets the chrome by wrapping itself
 * in this rather than repeating the nav — which is what went wrong when the
 * privacy page carried a bare back button instead.
 *
 * All navigation arrives as callbacks so this works before URL routing exists.
 * When routing lands, this becomes the layout route and only the callbacks
 * change into route pushes.
 *
 * @param onHome     return to the landing page (also the brand mark)
 * @param onClaims   go to the comparison section on the landing page
 * @param onSignIn   open the auth dialog in sign-in mode
 * @param onSignUp   open the auth dialog in registration mode
 * @param onPrivacy  open the full privacy policy
 */
export default function PublicLayout({
  children,
  onHome,
  onClaims,
  onSignIn,
  onSignUp,
  onPrivacy,
}) {
  return (
    <div className="lp">
      <nav className="lp-nav">
        <div className="lp-wrap lp-nav-in">
          <button
            type="button"
            className="lp-brand lp-brand-btn"
            onClick={onHome}
            aria-label="الصفحة الرئيسية"
          >
            <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true">
              <path d="M13 24V9" stroke="#16233D" strokeWidth="1.6" />
              <path d="M13 15L5 10M13 15l8-5" stroke="#16233D" strokeWidth="1.6" />
              <circle cx="13" cy="6.5" r="2.6" fill="#A5813F" />
              <circle cx="4" cy="9" r="2.2" fill="#16233D" />
              <circle cx="22" cy="9" r="2.2" fill="#16233D" />
            </svg>
            جذور الإمارات
          </button>
          <div className="lp-nav-links">
            <button type="button" className="lp-plain" onClick={onClaims}>
              لماذا نحن
            </button>
            <button type="button" className="lp-btn lp-btn-line" onClick={onSignIn}>
              تسجيل الدخول
            </button>
            <button type="button" className="lp-btn lp-btn-solid" onClick={onSignUp}>
              إنشاء حساب
            </button>
          </div>
        </div>
      </nav>

      {children}

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-in">
          <span>© ٢٠٢٦ جذور الإمارات</span>
          <span style={{ display: "flex", gap: "20px" }}>
            <button type="button" onClick={onPrivacy}>
              سياسة الخصوصية
            </button>
            <a href="mailto:support@uaeroots.com">support@uaeroots.com</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
