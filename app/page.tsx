"use client";

import React from "react";
import { AppProvider } from "./src/context/AppContext";
import "./src/app/globals.css";

export default function Page() {
  return (
    <AppProvider>
      <RootLayout>
        <div>Home</div>
      </RootLayout>
    </AppProvider>
  );
}
