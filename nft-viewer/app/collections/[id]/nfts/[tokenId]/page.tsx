import { notFound } from "next/navigation";
import Link from "next/link";
import { getCollection, getNFT } from "../../../../../utils/collections";

export default async function NFTPage({
  params,
}: {
  params: { id: string; tokenId: string };
}) {
  const collection = await getCollection(params.id);

  if (!collection) {
    notFound();
  }

  const nft = await getNFT(collection.id, params.tokenId);

  if (!nft) {
    notFound();
  }

  return (
    <main className="min-h-screen p-6 lg:p-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            href={`/collections/${collection.id}`}
            className="text-blue-600 hover:underline mb-4 inline-block"
          >
            &larr; Back to {collection.name}
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="aspect-square overflow-hidden rounded-lg border">
              <img
                src={nft.image}
                alt={nft.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div>
              <h1 className="text-3xl font-bold mb-2">{nft.name}</h1>
              <p className="text-gray-500 mb-6">Token ID: {nft.token_id}</p>

              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-3">Description</h2>
                <p className="text-gray-700">{nft.description}</p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3">Attributes</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {nft.attributes.map((attr, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded">
                      <p className="text-xs text-gray-500">{attr.trait_type}</p>
                      <p className="font-medium">{attr.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {nft.external_url && (
                <div className="mt-8">
                  <a
                    href={nft.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    View External Link
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
