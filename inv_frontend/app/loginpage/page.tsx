// "use client";

// import { FormEvent, useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://127.0.0.1:8000/product";
// const REDIRECT_AFTER_LOGIN = "/dashboard"; // change to wherever users should land after logging in
// const TOKEN_KEY = "auth_token"; // localStorage key; LogoutButton.tsx uses the same one

// export default function LoginPage() {
//   const router = useRouter();
//   const [username, setUsername] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   // Already logged in? Skip the form.
//   useEffect(() => {
//     try {
//       if (localStorage.getItem(TOKEN_KEY)) router.replace(REDIRECT_AFTER_LOGIN);
//     } catch {
//       /* storage unavailable: just show the form */
//     }
//   }, [router]);

//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();
//     if (!username.trim() || !password) {
//       setError("Enter your username and password.");
//       return;
//     }

//     setLoading(true);
//     setError(null);
//     try {
//       const res = await fetch(`${API}/login_user/`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ username: username.trim(), password }),
//       });

//       let body: { token?: string; error?: string } = {};
//       try {
//         body = await res.json();
//       } catch {
//         /* response wasn't JSON */
//       }

//       if (!res.ok || !body.token) {
//         setError(
//           body.error ??
//             (res.status === 401
//               ? "Invalid username or password."
//               : `Server responded with ${res.status}`)
//         );
//         return;
//       }

//       localStorage.setItem(TOKEN_KEY, body.token);
//       router.replace(REDIRECT_AFTER_LOGIN);
//     } catch {
//       setError("Couldn't reach the server. Check that the backend is running.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     // fixed + inset-0 + high z-index makes this page cover the whole screen,
//     // so the sidebar from the root layout is hidden behind it.
//     <main className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-50 px-4 py-10">
//       <div className="w-full max-w-sm">
//         {/* Logo */}
//         <div className="mb-6 flex flex-col items-center text-center">
//           <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm">
//             <svg
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth={1.6}
//               strokeLinecap="round"
//               strokeLinejoin="round"
//               className="h-8 w-8"
//               aria-hidden="true"
//             >
//               <path d="M21 8l-9-5-9 5 9 5 9-5z" />
//               <path d="M3 8v8l9 5 9-5V8" />
//               <path d="M12 13v8" />
//             </svg>
//           </div>
//           <h1 className="mt-4 text-2xl font-semibold text-slate-900">Inventory Management</h1>
//           <p className="mt-1 text-sm text-slate-600">Sign in to continue</p>
//         </div>

//         {/* Form */}
//         <form
//           onSubmit={handleSubmit}
//           noValidate
//           className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
//         >
//           <div className="space-y-4">
//             <label className="block text-sm">
//               <span className="mb-1 block font-medium text-slate-800">Username</span>
//               <input
//                 type="text"
//                 value={username}
//                 onChange={(e) => setUsername(e.target.value)}
//                 autoComplete="username"
//                 autoFocus
//                 disabled={loading}
//                 className={inputCls}
//               />
//             </label>

//             <label className="block text-sm">
//               <span className="mb-1 block font-medium text-slate-800">Password</span>
//               <div className="relative">
//                 <input
//                   type={showPassword ? "text" : "password"}
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   autoComplete="current-password"
//                   disabled={loading}
//                   className={`${inputCls} pr-16`}
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowPassword((v) => !v)}
//                   aria-label={showPassword ? "Hide password" : "Show password"}
//                   className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-teal-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
//                 >
//                   {showPassword ? "Hide" : "Show"}
//                 </button>
//               </div>
//             </label>
//           </div>

//           {error && (
//             <p
//               role="alert"
//               className="mt-4 break-words rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
//             >
//               {error}
//             </p>
//           )}

//           <button
//             type="submit"
//             disabled={loading}
//             className="mt-6 w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:opacity-50"
//           >
//             {loading ? "Signing in…" : "Sign in"}
//           </button>
//         </form>
//       </div>
//     </main>
//   );
// }

// const inputCls =
//   "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700 disabled:bg-slate-100 disabled:text-slate-500";