"use client";

import Link from "next/link";
import NotFound from "@/pages/not-found";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col gap-6 items-center">
      <NotFound />
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
