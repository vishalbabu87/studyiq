"use client";

import { useEffect } from "react";

export default function Index() {
  useEffect(() => {
    window.location.href = "/home";
  }, []);

  return null;
}
