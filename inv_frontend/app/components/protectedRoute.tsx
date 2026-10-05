// "use client";

// import { useEffect, type ReactNode } from "react";
// import { usePathname, useRouter } from "next/navigation";

// interface ProtectedRouteProps {
//   children: ReactNode;
// }

// function ProtectedRoute({ children }: ProtectedRouteProps) {
//   const router = useRouter();
//   const pathname = usePathname();

//   useEffect(() => {
//     // Don't check token on login page
//     if (pathname === "/loginpage") {
//       return;
//     }

//     const token = localStorage.getItem("token");
// console.log(pathname,token)


//     console.log("Token:", token);

//     if (!token) {
//       router.push("/loginpage");
//     }
//   }, [router, pathname]);

//   // Don't check token on login page
//   if (pathname === "/loginpage") {
//     return <>{children}</>;
//   }

//   const token =
//     typeof window !== "undefined"
//       ? localStorage.getItem("token")
//       : null;

//   if (!token) {
//     return null;
//   }
//   return <>{children}</>;
// }

// export default ProtectedRoute;
