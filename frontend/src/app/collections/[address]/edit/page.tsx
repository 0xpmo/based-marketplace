"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Image from "next/image";
import Link from "next/link";
import PepeButton from "@/components/ui/PepeButton";
import { useCollection, useUpdateCollection } from "@/hooks/useContracts";
import { getIPFSGatewayURL } from "@/services/ipfs";

export default function EditCollectionPage() {
  // For now, redirect to the home page
  const params = useParams();
  const router = useRouter();
  router.push("/");
  const { address: userAddress, isConnected } = useAccount();
  const collectionAddress = params.address as string;

  // Collection data
  const { collection, loading, error } = useCollection(collectionAddress);
  const {
    updateCollection,
    setCollectionPublic,
    isLoading: isUpdating,
  } = useUpdateCollection(collectionAddress);

  // States for the form
  const [activeTab, setActiveTab] = useState<"details" | "items" | "settings">(
    "details"
  );
  const [nftFiles, setNftFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState(
    "/images/placeholder-collection.svg"
  );
  // const [isImageLoading, setIsImageLoading] = useState(true);

  // Form data for collection details
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image: null as File | null,
    imagePreview: "",
    royaltyFee: 10,
    mintPrice: 0.001,
    isPublic: false,
  });

  // Update form when collection data is loaded
  useEffect(() => {
    if (collection) {
      setFormData({
        name: collection.name || "",
        description: collection.metadata?.description || "",
        image: null,
        imagePreview: collection.metadata?.image || "",
        royaltyFee: collection.royaltyFee / 100 || 10, // Convert from basis points to percentage
        mintPrice: parseFloat(collection.mintPrice) || 0.001,
        isPublic: true, // This would come from your backend/contract
      });
    }
  }, [collection]);

  // Check ownership
  useEffect(() => {
    if (collection && userAddress && collection.owner !== userAddress) {
      alert("You don't have permission to edit this collection");
      router.push(`/collections/${collectionAddress}`);
    }
  }, [collection, userAddress, collectionAddress, router]);

  useEffect(() => {
    if (formData.imagePreview && formData.imagePreview.startsWith("ipfs://")) {
      try {
        const url = getIPFSGatewayURL(formData.imagePreview);
        setProcessedImageUrl(url);
      } catch (error) {
        console.error("Error getting image URL:", error);
        setProcessedImageUrl("/images/placeholder-collection.svg");
      }
    } else {
      // If it's already a data URL or HTTP URL, use it directly
      setProcessedImageUrl(
        formData.imagePreview || "/images/placeholder-collection.svg"
      );
    }
  }, [formData.imagePreview]);

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto my-8" />
        <p>Loading collection data...</p>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <h1 className="text-3xl font-bold mb-6">Error</h1>
        <p className="text-red-400 mb-4">{error || "Collection not found"}</p>
        <Link href="/profile/collections">
          <PepeButton variant="outline">Back to Collections</PepeButton>
        </Link>
      </div>
    );
  }

  // Handle image upload for collection
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
        name === "royaltyFee" || name === "mintPrice"
          ? parseFloat(value)
          : value,
    });
  };

  // Handle NFT file selection
  const handleNftFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      setNftFiles(fileArray);
    }
  };

  // Handle CSV file selection
  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
    }
  };

  // Handle form submission for collection details
  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !userAddress) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      // Upload new image if provided
      let imageUri = collection.metadata?.image || "";

      if (formData.image) {
        const imageFormData = new FormData();
        imageFormData.append("file", formData.image);

        const imageUploadResponse = await fetch("/api/ipfs/upload", {
          method: "POST",
          body: imageFormData,
        });

        const imageData = await imageUploadResponse.json();
        imageUri = imageData.uri;
      }

      // Create updated metadata
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
      const contractURI = metadataData.uri;

      // Update the collection on-chain
      await updateCollection(
        formData.name,
        contractURI,
        formData.mintPrice,
        formData.royaltyFee * 100 // Convert percentage to basis points
      );

      alert("Collection updated successfully!");
    } catch (err) {
      console.error("Error updating collection:", err);
      alert("Failed to update collection. Please try again.");
    }
  };

  // Handle NFT upload
  const handleUploadNfts = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nftFiles.length === 0) {
      alert("Please select files to upload");
      return;
    }

    if (nftFiles.length > collection.maxSupply - collection.totalMinted) {
      alert(
        `You can only upload ${
          collection.maxSupply - collection.totalMinted
        } more NFTs`
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Process each file
      const totalFiles = nftFiles.length;
      const uploadedMetadata = [];

      for (let i = 0; i < totalFiles; i++) {
        // Upload image to IPFS
        const file = nftFiles[i];
        const fileFormData = new FormData();
        fileFormData.append("file", file);

        const fileUploadResponse = await fetch("/api/ipfs/upload", {
          method: "POST",
          body: fileFormData,
        });

        const fileData = await fileUploadResponse.json();
        const imageUri = fileData.uri;

        // Create metadata for this NFT
        const nftMetadata = {
          name: `${collection.name} #${collection.totalMinted + i + 1}`,
          description: collection.metadata?.description || "",
          image: imageUri,
          attributes: [],
        };

        // Upload metadata to IPFS
        const metadataResponse = await fetch("/api/ipfs/uploadJson", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(nftMetadata),
        });

        const metadataData = await metadataResponse.json();
        uploadedMetadata.push(metadataData.uri);

        // Update progress
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      // Store the metadata URIs in your database or contract
      // This depends on your backend implementation
      const uploadResult = await fetch(
        `/api/collections/${collectionAddress}/items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            metadataUris: uploadedMetadata,
          }),
        }
      );

      if (!uploadResult.ok) {
        throw new Error("Failed to save metadata to the server");
      }

      setIsUploading(false);
      setNftFiles([]);
      alert("NFTs uploaded successfully!");

      // Refresh the collection data
      // This depends on your useCollection hook implementation
      // refreshCollection();
    } catch (err) {
      console.error("Error uploading NFTs:", err);
      setIsUploading(false);
      alert("Failed to upload NFTs. Please try again.");
    }
  };

  // Handle CSV upload
  const handleUploadCsv = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!csvFile) {
      alert("Please select a CSV file");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", csvFile);
      formData.append("collectionAddress", collectionAddress);

      const response = await fetch(
        `/api/collections/${collectionAddress}/csv-upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Failed to process CSV file");
      }

      setIsUploading(false);
      setCsvFile(null);
      alert("CSV processed successfully!");

      // Refresh the collection data
      // refreshCollection();
    } catch (err) {
      console.error("Error processing CSV:", err);
      setIsUploading(false);
      alert("Failed to process CSV. Please try again.");
    }
  };

  // Handle publishing collection
  const handlePublishCollection = async () => {
    try {
      await setCollectionPublic(true);
      alert("Collection published successfully!");
      setFormData({
        ...formData,
        isPublic: true,
      });
    } catch (err) {
      console.error("Error publishing collection:", err);
      alert("Failed to publish collection. Please try again.");
    }
  };

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{collection.name}</h1>
          <p className="text-gray-400">
            {collection.totalMinted} / {collection.maxSupply} items minted
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={`/collections/${collectionAddress}`}>
            <PepeButton variant="outline">View Collection</PepeButton>
          </Link>
          {!formData.isPublic && (
            <PepeButton
              variant="primary"
              onClick={handlePublishCollection}
              disabled={isUpdating}
            >
              {isUpdating ? "Publishing..." : "Publish Collection"}
            </PepeButton>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab("details")}
          className={`py-3 px-6 font-medium ${
            activeTab === "details"
              ? "border-b-2 border-primary text-white"
              : "text-gray-400"
          }`}
        >
          Collection Details
        </button>
        <button
          onClick={() => setActiveTab("items")}
          className={`py-3 px-6 font-medium ${
            activeTab === "items"
              ? "border-b-2 border-primary text-white"
              : "text-gray-400"
          }`}
        >
          Items
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`py-3 px-6 font-medium ${
            activeTab === "settings"
              ? "border-b-2 border-primary text-white"
              : "text-gray-400"
          }`}
        >
          Settings
        </button>
      </div>

      {/* Details Tab */}
      {activeTab === "details" && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          <form onSubmit={handleUpdateDetails} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Collection Image
              </label>
              <div className="flex items-center space-x-6">
                <div
                  className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center overflow-hidden"
                  onClick={() =>
                    document.getElementById("collection-image")?.click()
                  }
                >
                  {formData.imagePreview ? (
                    <Image
                      src={processedImageUrl}
                      alt="Collection preview"
                      width={128}
                      height={128}
                      className="object-cover"
                      onError={() => {
                        setProcessedImageUrl(
                          "/images/placeholder-collection.svg"
                        );
                      }}
                      // onLoad={() => setIsImageLoading(false)}
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
                  id="collection-image"
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

            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Collection Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-input border border-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
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
                rows={4}
                className="w-full px-4 py-2 bg-input border border-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  min="0"
                  max="10"
                  step="0.1"
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum 10%. BasedSea takes a 10% fee on primary sales.
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
                  min="0"
                  step="0.001"
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
                disabled={isUpdating}
              >
                {isUpdating ? "Updating..." : "Save Changes"}
              </PepeButton>
            </div>
          </form>
        </div>
      )}

      {/* Items Tab */}
      {activeTab === "items" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold mb-4">Upload NFT Media</h3>
            <p className="text-gray-400 mb-6">
              Upload up to {collection.maxSupply - collection.totalMinted}{" "}
              images to mint as NFTs in this collection. Supports JPG, PNG, SVG,
              and GIF files up to 100MB each.
            </p>

            <form onSubmit={handleUploadNfts} className="space-y-6">
              <div>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 mx-auto mb-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-lg mb-2">Drag and drop files here</p>
                  <p className="text-sm text-gray-400 mb-4">
                    or click to browse from your computer
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*"
                    onChange={handleNftFilesChange}
                    className="hidden"
                  />
                  {nftFiles.length > 0 && (
                    <p className="text-primary font-medium">
                      {nftFiles.length} file{nftFiles.length > 1 ? "s" : ""}{" "}
                      selected
                    </p>
                  )}
                </div>
              </div>

              {isUploading && (
                <div className="mt-4">
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-primary h-2.5 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-center mt-2">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              <div>
                <PepeButton
                  variant="primary"
                  type="submit"
                  className="w-full md:w-auto"
                  disabled={isUploading || nftFiles.length === 0}
                >
                  {isUploading ? "Uploading..." : "Upload and Create NFTs"}
                </PepeButton>
              </div>
            </form>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold mb-4">Upload Metadata (CSV)</h3>
            <p className="text-gray-400 mb-6">
              Upload a CSV file with metadata for your NFTs.
              <a
                href="/examples/metadata-template.csv"
                download
                className="text-primary ml-2"
              >
                Download template
              </a>
            </p>

            <form onSubmit={handleUploadCsv} className="space-y-6">
              <div>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer"
                  onClick={() => csvInputRef.current?.click()}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 mx-auto mb-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-lg mb-2">Drag and drop CSV file here</p>
                  <p className="text-sm text-gray-400 mb-4">
                    or click to browse from your computer
                  </p>
                  <input
                    type="file"
                    ref={csvInputRef}
                    accept=".csv"
                    onChange={handleCsvChange}
                    className="hidden"
                  />
                  {csvFile && (
                    <p className="text-primary font-medium">{csvFile.name}</p>
                  )}
                </div>
              </div>

              <div>
                <PepeButton
                  variant="outline"
                  type="submit"
                  className="w-full md:w-auto"
                  disabled={isUploading || !csvFile}
                >
                  {isUploading ? "Processing..." : "Upload CSV"}
                </PepeButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold mb-4">Collection Settings</h3>

          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-2">Collection Visibility</h4>
              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                  <p className="font-medium">
                    Collection is {formData.isPublic ? "public" : "hidden"}
                  </p>
                  <p className="text-sm text-gray-400">
                    {formData.isPublic
                      ? "Your collection is visible to everyone and can be minted."
                      : "Your collection is hidden and can't be minted yet."}
                  </p>
                </div>
                <PepeButton
                  variant={formData.isPublic ? "outline" : "primary"}
                  onClick={handlePublishCollection}
                  disabled={isUpdating || formData.isPublic}
                >
                  {formData.isPublic ? "Published" : "Publish"}
                </PepeButton>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Contract Information</h4>
              <div className="p-4 border border-border rounded-lg space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Contract Address</span>
                  <span className="font-mono">
                    {collectionAddress.slice(0, 6)}...
                    {collectionAddress.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Token Standard</span>
                  <span>ERC-721</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Chain</span>
                  <span>Base</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Creator Earnings</span>
                  <span>{collection.royaltyFee / 100}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
