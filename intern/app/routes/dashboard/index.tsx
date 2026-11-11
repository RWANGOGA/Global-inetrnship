import { DashboardShell } from "../components/dashboard/DashboardShell";
import { EmployerOverview } from "./employer/EmployerOverview";
import { EmployerPlacements } from "./employer/EmployerPlacements";
import { EmployerApplications } from "./employer/EmployerApplications";
import { EmployerJobs } from "./employer/EmployerJobs";
import { EmployerTalentSearch } from "./employer/EmployerTalentSearch";
import { EmployerProfile } from "./employer/EmployerProfile";
import { EmployerTestimonial } from "./employer/EmployerTestimonial";

export default function Dashboard() {
  return (
    <DashboardShell />
  );
}
