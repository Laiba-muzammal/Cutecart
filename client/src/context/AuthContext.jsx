import React, { createContext, useContext, useState } from "react"
import { toast } from "sonner"

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  const login = async (email, password) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (email && password.length >= 6) {
      setUser({
        id: "1",
        name: email.split("@")[0],
        email,
      })
      toast.success("Welcome back! 💖")
      return true
    }

    toast.error("Invalid credentials")
    return false
  }

  const signup = async (name, email, password) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (name && email && password.length >= 6) {
      setUser({
        id: "1",
        name,
        email,
      })
      toast.success("Account created! Welcome to CuteCart! 🎀")
      return true
    }

    toast.error("Please fill all fields correctly")
    return false
  }

  const logout = () => {
    setUser(null)
    toast.info("Logged out successfully")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
