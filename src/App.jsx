import { useState, useEffect } from "react";
import "./App.css";

const categories = [
  { name: "All Items", icon: "▦" },
  { name: "Personal", icon: "♙" },
  { name: "Development", icon: "⌘" },
  { name: "Social", icon: "◎" },
  { name: "Work", icon: "▣" },
  { name: "Finance", icon: "₹" },
];

const emptyForm = {
  name: "",
  username: "",
  password: "",
  category: "Personal",
};

// =========================
// PASSWORD STRENGTH CHECKER
// =========================

function getPasswordStrength(password) {
  if (!password) {
    return { score: 0, label: "" };
  }

  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 3) {
    return { score, label: "Weak" };
  }

  if (score <= 5) {
    return { score, label: "Medium" };
  }

  return { score, label: "Strong" };
}

// =========================
// APP
// =========================

function App() {
  // =========================
  // AUTHENTICATION STATE
  // =========================

  const [authMode, setAuthMode] = useState("checking");

  const [username, setUsername] = useState("");
  const [currentUsername, setCurrentUsername] = useState("");

  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // =========================
  // DASHBOARD STATE
  // =========================

  const [passwords, setPasswords] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("All Items");

  const [visible, setVisible] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editingPassword, setEditingPassword] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({ ...emptyForm });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // =========================
  // PASSWORD STRENGTH
  // =========================

  const passwordStrength = getPasswordStrength(
    formData.password
  );

  const strengthColor =
    passwordStrength.label === "Weak"
      ? "#ff6b81"
      : passwordStrength.label === "Medium"
      ? "#ffcc66"
      : "#55e6ad";

  const strengthBars =
    passwordStrength.label === "Weak"
      ? 1
      : passwordStrength.label === "Medium"
      ? 2
      : passwordStrength.label === "Strong"
      ? 4
      : 0;

  // =========================
  // CHECK ACCOUNT ON STARTUP
  // =========================

  useEffect(() => {
    checkVaultStatus();
  }, []);

  // =========================
  // AUTO-LOCK AFTER INACTIVITY
  // =========================

  useEffect(() => {
    if (authMode !== "dashboard") return;

    let inactivityTimer;

    const INACTIVITY_LIMIT = 5 * 60 * 1000;

    async function autoLockVault() {
      try {
        await window.vaultx.logout();

        setPasswords([]);
        setVisible([]);

        setSearch("");
        setSelectedCategory("All Items");

        setShowForm(false);
        setEditingPassword(null);
        setFormData({ ...emptyForm });
        setFormError("");

        setMasterPassword("");
        setConfirmPassword("");
        setUsername("");
        setCurrentUsername("");

        setAuthError("");
        setAuthMode("login");

        console.log("Vault automatically locked.");
      } catch (error) {
        console.error("Automatic vault lock failed:", error);
      }
    }

    function resetTimer() {
      clearTimeout(inactivityTimer);

      inactivityTimer = setTimeout(
        autoLockVault,
        INACTIVITY_LIMIT
      );
    }

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);

      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [authMode]);

  // =========================
  // CHECK ACCOUNT STATUS
  // =========================

  async function checkVaultStatus() {
    setAuthMode("checking");
    setAuthError("");

    try {
      const status = await window.vaultx.getVaultStatus();

      if (status.accounts.length === 0) {
        setAuthMode("register");
      } else {
        setAuthMode("login");
      }
    } catch (error) {
      console.error("Account status check failed:", error);

      setAuthError(
        "Unable to check account status. Please restart the application."
      );

      setAuthMode("error");
    }
  }

  // =========================
  // REGISTER ACCOUNT
  // =========================

  async function handleRegisterAccount(event) {
    event.preventDefault();
    setAuthError("");

    const cleanUsername = username.trim();

    if (cleanUsername.length < 3) {
      setAuthError(
        "Username must be at least 3 characters long."
      );
      return;
    }

    if (cleanUsername.length > 30) {
      setAuthError(
        "Username cannot exceed 30 characters."
      );
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setAuthError(
        "Username can only contain letters, numbers, and underscores."
      );
      return;
    }

    if (masterPassword.length < 12) {
      setAuthError(
        "Master password must be at least 12 characters long."
      );
      return;
    }

    if (masterPassword !== confirmPassword) {
      setAuthError("Master passwords do not match.");
      return;
    }

    setAuthLoading(true);

    try {
      const result = await window.vaultx.registerAccount(
        cleanUsername,
        masterPassword
      );

      const entries =
        await window.vaultx.getVaultEntries();

      setPasswords(entries);
      setVisible([]);

      setCurrentUsername(
        result.username || cleanUsername.toLowerCase()
      );

      setMasterPassword("");
      setConfirmPassword("");
      setUsername("");

      setSearch("");
      setSelectedCategory("All Items");

      setAuthMode("dashboard");
    } catch (error) {
      console.error("Account registration failed:", error);

      setAuthError(
        error.message || "Unable to create account."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  // =========================
  // LOGIN
  // =========================

  async function handleLogin(event) {
    event.preventDefault();
    setAuthError("");

    if (!username.trim() || !masterPassword) {
      setAuthError(
        "Please enter your username and master password."
      );
      return;
    }

    setAuthLoading(true);

    try {
      await window.vaultx.login(
        username.trim(),
        masterPassword
      );

      const entries =
        await window.vaultx.getVaultEntries();

      setPasswords(entries);
      setVisible([]);

      setCurrentUsername(username.trim().toLowerCase());

      setMasterPassword("");
      setConfirmPassword("");
      setUsername("");

      setSearch("");
      setSelectedCategory("All Items");

      setAuthMode("dashboard");
    } catch (error) {
      console.error("Login failed:", error);

      setAuthError(
        "Invalid username or master password."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  // =========================
  // LOGOUT / LOCK VAULT
  // =========================

  async function handleLockVault() {
    try {
      await window.vaultx.logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }

    setPasswords([]);
    setVisible([]);

    setCurrentUsername("");
    setMasterPassword("");
    setConfirmPassword("");
    setUsername("");

    setAuthError("");

    setSearch("");
    setSelectedCategory("All Items");

    setShowForm(false);
    setEditingPassword(null);
    setShowPassword(false);

    setFormData({ ...emptyForm });
    setFormError("");

    setAuthMode("login");
  }

  // =========================
  // SEARCH + CATEGORY FILTER
  // =========================

  const filtered = passwords.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.username.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === "All Items" ||
      item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // =========================
  // UPDATE FORM FIELDS
  // =========================

  function updateField(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFormError("");
  }

  // =========================
  // OPEN ADD PASSWORD FORM
  // =========================

  function openForm() {
    setEditingPassword(null);
    setFormData({ ...emptyForm });
    setFormError("");
    setShowPassword(false);
    setShowForm(true);
  }

  // =========================
  // CLOSE PASSWORD FORM
  // =========================

  function closeForm() {
    setShowForm(false);
    setShowPassword(false);
    setFormError("");
    setFormData({ ...emptyForm });
    setEditingPassword(null);
  }

  // =========================
  // GENERATE RANDOM PASSWORD
  // =========================

  function generatePassword() {
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

    const randomValues = new Uint32Array(18);

    window.crypto.getRandomValues(randomValues);

    const generated = Array.from(randomValues, (value) =>
      characters[value % characters.length]
    ).join("");

    setFormData((previous) => ({
      ...previous,
      password: generated,
    }));

    setShowPassword(true);
    setFormError("");
  }

  // =========================
  // SAVE PASSWORD
  // =========================

  async function savePassword(event) {
    event.preventDefault();

    setFormError("");

    const name = formData.name.trim();
    const entryUsername = formData.username.trim();
    const password = formData.password;

    if (!name || !entryUsername || !password.trim()) {
      setFormError("Please fill in all fields.");
      return;
    }

    const newPassword = {
      id: window.crypto.randomUUID(),
      name,
      username: entryUsername,
      password,
      category: formData.category,
      icon: name.charAt(0).toUpperCase(),
    };

    const updatedPasswords = [
      newPassword,
      ...passwords,
    ];

    setSaving(true);

    try {
      const result =
        await window.vaultx.saveVault(updatedPasswords);

      if (result && result.success === false) {
        setFormError(
          result.message || "Failed to save password."
        );
        return;
      }

      setPasswords(updatedPasswords);

      closeForm();
    } catch (error) {
      console.error("Password save error:", error);

      setFormError(
        error.message || "Unable to save password securely."
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================
  // DELETE PASSWORD
  // =========================

  async function deletePassword(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this password?"
    );

    if (!confirmed) return;

    const updatedPasswords = passwords.filter(
      (item) => item.id !== id
    );

    try {
      const result =
        await window.vaultx.saveVault(updatedPasswords);

      if (result && result.success === false) {
        window.alert(
          result.message || "Failed to delete password."
        );
        return;
      }

      setPasswords(updatedPasswords);

      setVisible((previous) =>
        previous.filter((itemId) => itemId !== id)
      );
    } catch (error) {
      console.error("Password deletion error:", error);

      window.alert(
        "Unable to delete password from encrypted vault."
      );
    }
  }

  // =========================
  // SHOW / HIDE PASSWORD
  // =========================

  function toggleVisibility(id) {
    setVisible((previous) =>
      previous.includes(id)
        ? previous.filter((itemId) => itemId !== id)
        : [...previous, id]
    );
  }

  // =========================
  // AUTHENTICATION SCREENS
  // =========================

  if (authMode !== "dashboard") {
    return (
      <div className="auth-screen">
        <div className="auth-card">

          <h1 className="brand">
            Vault<span>X</span>
          </h1>

          {authMode === "checking" && (
            <>
              <h2>Checking your vault...</h2>

              <p>
                Please wait while VaultX checks your local
                encrypted storage.
              </p>
            </>
          )}

          {authMode === "error" && (
            <>
              <h2>Something went wrong</h2>

              <p>{authError}</p>

              <button
                type="button"
                className="save-button"
                onClick={checkVaultStatus}
              >
                Try again
              </button>
            </>
          )}

          {/* REGISTER */}
          {authMode === "register" && (
            <>
              <h2>Create your account</h2>

              <p>
                Create a VaultX account and secure your
                passwords with a master password.
              </p>

              <form onSubmit={handleRegisterAccount}>

                <label htmlFor="register-username">
                  Username
                </label>

                <input
                  id="register-username"
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value)
                  }
                  placeholder="Choose a username"
                  autoComplete="username"
                  minLength={3}
                  maxLength={30}
                  required
                />

                <label htmlFor="register-password">
                  Master password
                </label>

                <input
                  id="register-password"
                  type="password"
                  value={masterPassword}
                  onChange={(event) =>
                    setMasterPassword(event.target.value)
                  }
                  placeholder="Create a master password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />

                <label htmlFor="confirm-password">
                  Confirm master password
                </label>

                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Confirm your master password"
                  autoComplete="new-password"
                  required
                />

                <p className="auth-hint">
                  Username: 3–30 letters, numbers, or underscores.
                  Master password: at least 12 characters.
                  Your master password cannot be recovered.
                </p>

                {authError && (
                  <p className="form-error">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  className="save-button"
                  disabled={authLoading}
                >
                  {authLoading
                    ? "Creating account..."
                    : "Create account"}
                </button>

              </form>

              <p className="auth-switch">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthError("");
                    setMasterPassword("");
                    setConfirmPassword("");
                    setUsername("");
                    setAuthMode("login");
                  }}
                >
                  Login
                </button>
              </p>
            </>
          )}

          {/* LOGIN */}
          {authMode === "login" && (
            <>
              <h2>Welcome back</h2>

              <p>
                Log in to access your encrypted password vault.
              </p>

              <form onSubmit={handleLogin}>

                <label htmlFor="login-username">
                  Username
                </label>

                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value)
                  }
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoFocus
                  required
                />

                <label htmlFor="login-password">
                  Master password
                </label>

                <input
                  id="login-password"
                  type="password"
                  value={masterPassword}
                  onChange={(event) =>
                    setMasterPassword(event.target.value)
                  }
                  placeholder="Enter your master password"
                  autoComplete="current-password"
                  required
                />

                {authError && (
                  <p className="form-error">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  className="save-button"
                  disabled={authLoading}
                >
                  {authLoading
                    ? "Logging in..."
                    : "Login"}
                </button>

              </form>

              <p className="auth-switch">
                New to VaultX?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthError("");
                    setMasterPassword("");
                    setConfirmPassword("");
                    setUsername("");
                    setAuthMode("register");
                  }}
                >
                  Create account
                </button>
              </p>
            </>
          )}

        </div>
      </div>
    );
  }

  // =========================
  // MAIN DASHBOARD
  // =========================

  return (
    <div className="app-shell">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <h2 className="brand">
          Vault<span>X</span>
        </h2>

        <p className="nav-label">WORKSPACE</p>

        {categories.map((category) => (
          <button
            key={category.name}
            className={`nav-item ${
              selectedCategory === category.name
                ? "active"
                : ""
            }`}
            onClick={() =>
              setSelectedCategory(category.name)
            }
          >
            {category.icon} &nbsp; {category.name}
          </button>
        ))}

        <div className="sidebar-bottom">

          <div className="security-card">
            <h4>✦ Your vault is private</h4>

            <p>
              Your credentials are encrypted and stored
              locally on your device.
            </p>
          </div>

          <p className="profile">
            ◉ &nbsp; {currentUsername || "VaultX User"}
          </p>

        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">

        <header className="topbar">

          <span>
            Workspace / Vault
          </span>

          <div className="topbar-actions">

            <span className="local-status">
              ● Vault unlocked
            </span>

            <button
              type="button"
              className="lock-button"
              onClick={handleLockVault}
            >
              🔒 Logout
            </button>

          </div>

        </header>

        {/* WELCOME SECTION */}
        <section className="welcome">

          <div>
            <p className="eyebrow">
              YOUR SECURE SPACE
            </p>

            <h1>
              Welcome, {currentUsername || "User"}<span>.</span>
            </h1>

            <p className="subtitle">
              Everything important, in one place.
            </p>
          </div>

          <div className="welcome-symbol">
            ✳
          </div>

        </section>

        {/* STATISTICS */}
        <section className="stats-grid">

          <div className="stat-card">
            <p>Total passwords</p>

            <h2>{passwords.length}</h2>

            <small>Saved entries</small>
          </div>

          <div className="stat-card">
            <p>Vault status</p>

            <h2 className="status-text">
              Unlocked
            </h2>

            <small>Encrypted vault active</small>
          </div>

          <div className="stat-card">
            <p>Storage</p>

            <h2>Local</h2>

            <small>Offline-first design</small>
          </div>

        </section>

        {/* PASSWORD SECTION */}
        <section className="vault-section">

          <div className="section-heading">

            <div>
              <h2>Your passwords</h2>

              <p>
                Manage your saved credentials.
              </p>
            </div>

            <button
              className="add-button"
              onClick={openForm}
            >
              + Add password
            </button>

          </div>

          {/* SEARCH */}
          <div className="search-box">

            <span>⌕</span>

            <input
              type="text"
              placeholder="Search websites or usernames..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

          </div>

          {/* PASSWORD LIST */}
          <div className="password-list">

            {filtered.map((item) => (
              <div
                className="password-row"
                key={item.id}
              >

                <div className="site-icon">
                  {item.icon || item.name.charAt(0)}
                </div>

                <div className="site-details">
                  <strong>{item.name}</strong>

                  <small>{item.username}</small>
                </div>

                <div className="password-value">
                  {visible.includes(item.id)
                    ? item.password
                    : "••••••••••"}
                </div>

                {/* SHOW / HIDE */}
                <button
                  className="visibility-button"
                  onClick={() =>
                    toggleVisibility(item.id)
                  }
                >
                  {visible.includes(item.id)
                    ? "Hide"
                    : "Show"}
                </button>

                {/* CATEGORY */}
                <span className="category-tag">
                  {item.category}
                </span>

                {/* DELETE */}
                <button
                  type="button"
                  className="delete-button"
                  onClick={() =>
                    deletePassword(item.id)
                  }
                  title="Delete password"
                >
                  Delete
                </button>

              </div>
            ))}

            {filtered.length === 0 && (
              <p className="empty-state">
                {passwords.length === 0
                  ? "Your vault is empty. Add your first password to get started."
                  : "No matching passwords found."}
              </p>
            )}

          </div>

          <p className="demo-note">
            Your entries are encrypted and saved locally
            in your VaultX storage.
          </p>

        </section>

      </main>

      {/* ADD PASSWORD MODAL */}
      {showForm && (

        <div
          className="modal-overlay"
          onClick={closeForm}
        >

          <div
            className="password-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-heading">

              <div>
                <h2>Add a password</h2>

                <p>
                  Save a new account to your vault.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={closeForm}
                type="button"
              >
                ×
              </button>

            </div>

            <form onSubmit={savePassword}>

              {/* WEBSITE NAME */}
              <label htmlFor="website-name">
                Website or service
              </label>

              <input
                id="website-name"
                name="name"
                value={formData.name}
                onChange={updateField}
                placeholder="e.g. GitHub"
                autoFocus
                required
              />

              {/* USERNAME */}
              <label htmlFor="entry-username">
                Username or email
              </label>

              <input
                id="entry-username"
                name="username"
                value={formData.username}
                onChange={updateField}
                placeholder="Enter username or email"
                required
              />

              {/* PASSWORD */}
              <label htmlFor="entry-password">
                Password
              </label>

              <div className="password-input-group">

                <input
                  id="entry-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={updateField}
                  placeholder="Enter password"
                  required
                />

                <button
                  type="button"
                  className="field-action"
                  onClick={() =>
                    setShowPassword((previous) => !previous)
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>

              </div>

              {/* PASSWORD STRENGTH */}
              {formData.password.length > 0 && (
                <div
                  style={{
                    marginTop: "10px",
                    marginBottom: "12px",
                    width: "100%",
                  }}
                >

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                      fontSize: "13px",
                    }}
                  >
                    <span style={{ color: "#aa9cbd" }}>
                      Password strength
                    </span>

                    <span
                      style={{
                        fontWeight: "bold",
                        color: strengthColor,
                      }}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "5px",
                      width: "100%",
                    }}
                  >

                    {[1, 2, 3, 4].map((bar) => (
                      <div
                        key={bar}
                        style={{
                          flex: 1,
                          height: "5px",
                          borderRadius: "10px",
                          background:
                            bar <= strengthBars
                              ? strengthColor
                              : "#352b43",
                          transition: "background 0.2s ease",
                        }}
                      />
                    ))}

                  </div>

                </div>
              )}

              {/* PASSWORD GENERATOR */}
              <button
                type="button"
                className="generate-button"
                onClick={generatePassword}
              >
                ✦ Generate password
              </button>

              {/* CATEGORY */}
              <label htmlFor="category">
                Category
              </label>

              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={updateField}
              >
                <option value="Personal">Personal</option>
                <option value="Development">Development</option>
                <option value="Social">Social</option>
                <option value="Work">Work</option>
                <option value="Finance">Finance</option>
              </select>

              {formError && (
                <p className="form-error">
                  {formError}
                </p>
              )}

              {/* FORM ACTIONS */}
              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Save password"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

export default App;