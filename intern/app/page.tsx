import React from "react";
import { AppProvider } from "../context/AppContext";

export default function Page() {
  return <AppProvider><div>Home</div></AppProvider>;
}
