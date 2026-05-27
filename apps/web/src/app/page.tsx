import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/BrandMark";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="cf-shell flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="max-w-2xl">
        <BrandMark size="lg" className="mx-auto mb-6" />
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">CourseFlow</h1>
        <p className="mt-5 text-lg leading-relaxed text-zinc-400">
        整合「Web Video Presentation」方法論與「HyperFrames」技術，從教學文件開始，一條龍製作出16:9教學影片。
        </p>
      </div>
      <Link href="/login" className="cf-btn cf-btn-primary px-8 py-3 text-base">
        登入 / 註冊
      </Link>
    </div>
  );
}
