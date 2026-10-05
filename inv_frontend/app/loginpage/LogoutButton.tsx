// "use client";

// import { useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://127.0.0.1:8000/product";
// const TOKEN_KEY = "auth_token"; // same key the login page saves the token under

// // Drop this anywhere, e.g. in a page header:  <LogoutButton />
// export default function LogoutButton() {
//   const router = useRouter();
//   const [loading, setLoading] = useState(false);

//   const handleLogout = async () => {
//     setLoading(true);
//     try {
//       const token = localStorage.getItem(TOKEN_KEY);
//       if (token) {
//         await fetch(`${API}/logout_user/`, {
//           method: "POST",
//           headers: { Authorization: `Token ${token}` },
//         });
//       }
//     } catch {
//       /* even if the server can't be reached, still log out on this device */
//     } finally {
//       try {
//         localStorage.removeItem(TOKEN_KEY);
//       } catch {
//         /* storage unavailable */
//       }
//       router.replace("/login");
//       setLoading(false);
//     }
//   };

//   return (
//     <button
//       onClick={handleLogout}
//       disabled={loading}
//       className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:opacity-50"
//     >
//       {loading ? "Signing out…" : "Log out"}
//     </button>
//   );
// }