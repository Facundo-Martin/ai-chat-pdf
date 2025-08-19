import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { FileUpload } from "@/components/file-upload";

export default async function Home() {
  const { isAuthenticated } = await auth();

  return (
    <div className="min-h-screen w-screen bg-gradient-to-r from-rose-100 to-teal-100">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center">
            <h1 className="mr-3 text-5xl font-semibold">Chat with any PDF</h1>
            <UserButton afterSignOutUrl="/" />
          </div>

          {isAuthenticated && (
            <div className="mt-2 flex gap-3">
              <Link href="/chat">
                <Button>
                  Go to Chats <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <div>Subscription button</div>
            </div>
          )}

          <p className="mt-3 max-w-xl text-lg text-slate-600">
            Join millions of students, researchers and professionals to
            instantly answer questions and understand research with AI
          </p>

          <div className="mt-4 w-full">
            {isAuthenticated ? (
              <FileUpload />
            ) : (
              <Link href="/sign-in">
                <Button>
                  Login to get Started!
                  <LogIn className="ml-2 size-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
