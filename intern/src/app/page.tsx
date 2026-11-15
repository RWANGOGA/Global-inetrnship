"use client";

import React from "react";
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

  // Both surfaces are painted by the stylesheet: body takes --paper, and the
  // dashboard shell paints its own white. The inline override used to set a
  // third colour (#FAF9F5) directly on body, which fought the header and footer.
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
