import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { guideMimeType, isGuideFileName } from "@/lib/guides";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const fileName = pathname.split("/").pop() || pathname;
        if (!isGuideFileName(fileName)) {
          throw new Error(
            "Upload a Word document (.doc, .docx) or PowerPoint (.ppt, .pptx).",
          );
        }
        return {
          allowedContentTypes: [
            guideMimeType(fileName),
            "application/octet-stream",
          ],
          maximumSizeInBytes: 40 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: session.user.id,
        };
      },
      onUploadCompleted: async () => {
        // The Guides form saves the record after the browser upload finishes.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
