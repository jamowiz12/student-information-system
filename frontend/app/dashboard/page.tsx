"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  ApiError,
  clearToken,
  formatStudentValue,
  getToken,
  Student,
  UserProfile,
} from "@/lib/api";

type DashboardResponse = {
  data: Student[];
  count: number;
};

type Source = "cloud" | "physical";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [count, setCount] = useState(0);
  const [source, setSource] = useState<Source>("cloud");
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [studentError, setStudentError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const columns = useMemo(
    () => Array.from(new Set(students.flatMap((student) => Object.keys(student)))),
    [students],
  );

  const redirectToLogin = useCallback(() => {
    clearToken();
    router.replace("/login");
  }, [router]);

  const loadStudents = useCallback(async (selectedSource: Source) => {
    try {
      const response = await apiRequest<DashboardResponse>(
        `/students?source=${selectedSource}`,
        { authenticated: true },
      );
      setStudents(response.data);
      setCount(response.count);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status !== 401) {
        setStudentError(requestError.message);
      } else if (!(requestError instanceof ApiError)) {
        setStudentError("Student records could not be loaded.");
      }
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => redirectToLogin();
    window.addEventListener("sis:unauthorized", handleUnauthorized);
    if (!getToken()) {
      redirectToLogin();
    } else {
      apiRequest<{ data: UserProfile }>("/me", { authenticated: true })
        .then((response) => setUser(response.data))
        .catch((requestError: unknown) => {
          if (!(requestError instanceof ApiError && requestError.status === 401)) {
            setProfileError("Your account could not be loaded. Please try again.");
          }
        })
        .finally(() => setIsLoadingUser(false));
    }

    return () => window.removeEventListener("sis:unauthorized", handleUnauthorized);
  }, [redirectToLogin]);

  useEffect(() => {
    if (getToken()) {
      const request = window.setTimeout(() => {
        void loadStudents(source);
      }, 0);

      return () => window.clearTimeout(request);
    }
  }, [loadStudents, source]);

  async function handleLogout() {
    setLogoutError("");
    setIsLoggingOut(true);
    try {
      await apiRequest("/logout", { method: "POST", authenticated: true });
    } catch {
      setLogoutError("The server could not confirm sign out. Your local session was cleared.");
    } finally {
      clearToken();
      router.replace("/login");
      setIsLoggingOut(false);
    }
  }

  function handleSourceChange(event: ChangeEvent<HTMLSelectElement>) {
    setStudentError("");
    setIsLoadingStudents(true);
    setSource(event.target.value as Source);
  }

  function refreshStudents() {
    setStudentError("");
    setIsLoadingStudents(true);
    void loadStudents(source);
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <Link className="brand" href="/dashboard">Student Information System</Link>
        <div className="topbar-user">
          <span className="user-name">{isLoadingUser ? "Loading profile..." : user?.name ?? "Account"}</span>
          <button className="button button-secondary" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <section className="dashboard-content">
        <div className="welcome-row">
          <div>
            <p className="eyebrow">Student records</p>
            <h1>Your dashboard</h1>
            <p className="muted">
              {isLoadingUser ? "Loading your profile..." : user?.email ?? ""}
            </p>
          </div>
          <label className="source-field">
            <span>Data source</span>
            <select value={source} onChange={handleSourceChange} aria-label="Student data source">
              <option value="cloud">Cloud (Supabase PostgreSQL)</option>
              <option value="physical">Physical (LAN MySQL)</option>
            </select>
          </label>
        </div>

        {profileError && <p className="notice" role="alert">{profileError}</p>}
        {logoutError && <p className="notice" role="status">{logoutError}</p>}
        <section className="summary-card" aria-label="Student record summary">
          <div>
            <p className="summary-label">Total student records</p>
            <p className="summary-count" aria-live="polite">
              {isLoadingStudents ? "…" : count}
            </p>
            <p className="summary-source">
              {source === "cloud" ? "Cloud database" : "Physical database"}
            </p>
          </div>
          <button
            className="button button-primary"
            onClick={refreshStudents}
            disabled={isLoadingStudents}
          >
            {isLoadingStudents ? "Refreshing..." : "Refresh records"}
          </button>
        </section>

        <section className="records-card" aria-labelledby="records-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Directory</p>
              <h2 id="records-heading">Students</h2>
            </div>
            {!isLoadingStudents && !studentError && (
              <span className="record-count">{count} {count === 1 ? "record" : "records"}</span>
            )}
          </div>
          {isLoadingStudents ? (
            <div className="empty-state" role="status">Loading student records...</div>
          ) : studentError ? (
            <div className="empty-state error-state" role="alert">
              <p>{studentError}</p>
              <button className="button button-secondary" onClick={refreshStudents}>
                Try again
              </button>
            </div>
          ) : students.length === 0 ? (
            <div className="empty-state">No student records were found for this source.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {columns.map((column) => <th key={column} scope="col">{column.replaceAll("_", " ")}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr key={String(student.id ?? index)}>
                      {columns.map((column) => (
                        <td key={column}>{formatStudentValue(student[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
