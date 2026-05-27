"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "user.title";
const DEFAULT_TITLE = "Account Manager";

interface UserProfile {
  title: string;
}

export function useUserProfile(): { profile: UserProfile; updateTitle: (title: string) => void } {
  const [title, setTitle] = useState<string>(DEFAULT_TITLE);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setTitle(stored);
  }, []);

  function updateTitle(next: string) {
    setTitle(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return { profile: { title }, updateTitle };
}
