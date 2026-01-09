import { create } from "zustand"
import type { User, Locale } from "./types"

interface AppState {
  user: User | null
  locale: Locale
  setUser: (user: User | null) => void
  setLocale: (locale: Locale) => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  locale: "vi",
  setUser: (user) => set({ user }),
  setLocale: (locale) => set({ locale }),
}))
