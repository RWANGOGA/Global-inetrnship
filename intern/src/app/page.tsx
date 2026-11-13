"use client";

import React, { useEffect } from "react";
import { AppProvider, useApp } from "../context/AppContext";
import { SvgDefs } from "../components/icons/Icons";
import { PublicSite } from "../components/public/PublicSite";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { MobileMenu } from "../components/common/MobileMenu";
import { Modal } from "../components/common/Modal";
import { Toast } from "../components/common/Toast";

function MainApp() {
  const { route } = useApp();
  const isDash = route === "dashboard";

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.background = isDash ? "#FAF9F5" : "var(--paper)";
    }
  }, [isDash]);

  return (
    <>
      <SvgDefs />

      {/* Public Site */}
      <div id="site" className={!isDash ? "on" : ""}>
        <PublicSite />
      </div>

      {/* Dashboard Shell */}
      {isDash && <DashboardShell />}

      {/* Mobile Drawer Menu */}
      <MobileMenu />

      {/* Global Modals */}
      <Modal />

      {/* Toast Notifications */}
      <Toast />
    </>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
