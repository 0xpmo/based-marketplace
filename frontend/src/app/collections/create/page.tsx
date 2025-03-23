"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Image from "next/image";
import PepeButton from "@/components/ui/PepeButton";
import { useCreateCollection } from "@/hooks/useContracts";

export default function CreateCollectionPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<"details" | "deploying" | "success">(
    "details"
  );

  // Collection details form state
  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    description: "",
    image: null as File | null,
    imagePreview: "",
    royaltyFee: 10, // 10% default
    mintPrice: 0.001, // Default mint price in ETH
    maxSupply: 100, // Default max supply
  });

  // Contract creation hook
  const { createCollection, isLoading, error } = useCreateCollection();

  // Handle image upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormData({
            ...formData,
            image: file,
            imagePreview: event.target.result as string,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle form field changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]:
        name === "royaltyFee" || name === "mintPrice" || name === "maxSupply"
          ? parseFloat(value)
          : value,
    });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !address) {
      alert("Please connect your wallet first");
      return;
    }

    if (!formData.image) {
      alert("Please upload a collection image");
      return;
    }

    try {
      setStep("deploying");

      // First, upload the image to IPFS
      const imageFormData = new FormData();
      imageFormData.append("file", formData.image);

      const imageUploadResponse = await fetch("/api/ipfs/upload", {
        method: "POST",
        body: imageFormData,
      });

      const imageData = await imageUploadResponse.json();
      const imageUri = imageData.uri;

      // Create metadata for the collection
      const metadata = {
        name: formData.name,
        description: formData.description,
        image: imageUri,
      };

      // Upload metadata to IPFS
      const metadataResponse = await fetch("/api/ipfs/uploadJson", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
      });

      const metadataData = await metadataResponse.json();
      const collectionUri = metadataData.uri;

      // Deploy the collection contract
      const collectionAddress = await createCollection(
        formData.name,
        formData.symbol,
        collectionUri,
        formData.mintPrice,
        formData.maxSupply,
        formData.royaltyFee * 100 // Convert percentage to basis points
      );

      setStep("success");

      // Redirect to the newly created collection
      setTimeout(() => {
        router.push(`/collections/${collectionAddress}`);
      }, 3000);
    } catch (err) {
      console.error("Error creating collection:", err);
      setStep("details");
      alert("Failed to create collection. Please try again.");
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Create a New Collection</h1>

      {step === "details" && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">
            Let&apos;s create a smart contract for your drop
          </h2>
          <p className="text-gray-400 mb-6">
            This will deploy a smart contract for your NFT collection on the
            Base network.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Collection Image
              </label>
              <div className="flex items-center space-x-6">
                <div
                  className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center overflow-hidden"
                  onClick={() =>
                    document.getElementById("image-upload")?.click()
                  }
                >
                  {formData.imagePreview ? (
                    <Image
                      src={formData.imagePreview}
                      alt="Collection preview"
                      width={128}
                      height={128}
                      className="object-cover"
                    />
                  ) : (
                    <div className="text-center text-gray-400 cursor-pointer">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8 mx-auto mb-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      <span className="text-xs">Click to upload</span>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-400">
                    This image will be used for your collection&apos;s logo
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Recommended: 350x350px. JPG, PNG, or GIF.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium mb-2"
                >
                  Collection Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Based Bored Apes"
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="symbol"
                  className="block text-sm font-medium mb-2"
                >
                  Symbol
                </label>
                <input
                  type="text"
                  id="symbol"
                  name="symbol"
                  value={formData.symbol}
                  onChange={handleChange}
                  placeholder="BBA"
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium mb-2"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell the world about your collection..."
                rows={4}
                className="w-full px-4 py-2 bg-input border border-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label
                  htmlFor="royaltyFee"
                  className="block text-sm font-medium mb-2"
                >
                  Creator Earnings (%)
                </label>
                <input
                  type="number"
                  id="royaltyFee"
                  name="royaltyFee"
                  value={formData.royaltyFee}
                  onChange={handleChange}
                  placeholder="5"
                  min="0"
                  max="11"
                  step="0.1"
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum 11%. BasedSea takes a 10% fee on primary sales.
                </p>
              </div>

              <div>
                <label
                  htmlFor="mintPrice"
                  className="block text-sm font-medium mb-2"
                >
                  Mint Price (ETH)
                </label>
                <input
                  type="number"
                  id="mintPrice"
                  name="mintPrice"
                  value={formData.mintPrice}
                  onChange={handleChange}
                  placeholder="0.001"
                  min="0"
                  step="0.001"
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="maxSupply"
                  className="block text-sm font-medium mb-2"
                >
                  Max Supply
                </label>
                <input
                  type="number"
                  id="maxSupply"
                  name="maxSupply"
                  value={formData.maxSupply}
                  onChange={handleChange}
                  placeholder="100"
                  min="1"
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                />
              </div>
            </div>

            <div className="pt-4">
              <PepeButton
                variant="primary"
                type="submit"
                className="w-full md:w-auto"
                disabled={isLoading}
              >
                {isLoading ? "Creating..." : "Create Collection"}
              </PepeButton>

              {error && (
                <p className="mt-2 text-red-400 text-sm">
                  {error.message || "Failed to create collection"}
                </p>
              )}
            </div>
          </form>
        </div>
      )}

      {step === "deploying" && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-lg text-center">
          <h2 className="text-2xl font-bold mb-4">Deploying Your Collection</h2>
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto my-8" />
          <p className="text-gray-400">
            Please confirm the transaction in your wallet and wait while we
            deploy your collection...
          </p>
        </div>
      )}

      {step === "success" && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-lg text-center">
          <div className="bg-green-900/30 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">Collection Created!</h2>
          <p className="text-gray-400 mb-6">
            Your NFT collection has been successfully deployed to the
            blockchain!
          </p>
          <p className="text-gray-400 mb-6">
            Redirecting you to your collection page...
          </p>
        </div>
      )}
    </div>
  );
}
