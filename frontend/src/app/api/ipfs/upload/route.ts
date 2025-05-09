import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join, extname } from "path";
import { randomUUID } from "crypto";
import { uploadToIPFS } from "@/services/ipfs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Get the file from form data
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json(
        { error: "No file found in request" },
        { status: 400 }
      );
    }

    // Create a buffer from the file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get the file extension
    const extension = extname(file.name);
    const fileName = `${randomUUID()}${extension}`;

    // Save to temporary storage
    const filePath = join("/tmp", fileName);
    await writeFile(filePath, buffer);

    // Upload the file to IPFS directly
    const imageUri = await uploadToIPFS(filePath);

    // Just return the image URI
    return NextResponse.json({ uri: imageUri });
  } catch (error) {
    console.error("Error in IPFS upload route:", error);
    return NextResponse.json(
      { error: "Failed to upload to IPFS" },
      { status: 500 }
    );
  }
}
