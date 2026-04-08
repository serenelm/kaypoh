import { createContext, useContext, useState, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("kaypoh_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (username, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? "Login failed");
    }
    const data = await res.json();
    const userObj = { token: data.token, username: data.username, role: data.role };
    localStorage.setItem("kaypoh_user", JSON.stringify(userObj));
    setUser(userObj);
    return userObj;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("kaypoh_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Returns the Authorization header value, or empty object if not logged in */
export function authHeader(user) {
  return user?.token ? { Authorization: `Bearer ${user.token}` } : {};
}
