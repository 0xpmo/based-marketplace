import { notFound } from "next/navigation";
import Link from "next/link";
import { getCollection, getCollectionNFTs } from "../../../utils/collections";

export default async function CollectionPage({
  params,
}: {
  params: { id: string };
}) {
  const collection = await getCollection(params.id);

  if (!collection) {
    notFound();
  }

  const collectionNFTs = await getCollectionNFTs(collection.id);

  return (
    <main className="min-h-screen p-6 lg:p-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            href="/"
            className="text-blue-600 hover:underline mb-4 inline-block"
          >
            &larr; Back to Collections
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="aspect-square overflow-hidden rounded-lg border">
              {collection.image ? (
                <img
                  src={collection.image}
                  alt={collection.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <span className="text-gray-400 text-2xl">
                    {collection.symbol}
                  </span>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <h1 className="text-3xl font-bold mb-2">{collection.name}</h1>
              <p className="text-gray-500 mb-4">{collection.symbol}</p>
              <p className="mb-6">{collection.description}</p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded">
                  <p className="text-gray-500 text-sm">Items</p>
                  <p className="font-semibold">
                    {collection.items_count} / {collection.max_supply}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <p className="text-gray-500 text-sm">Mint Price</p>
                  <p className="font-semibold">{collection.mint_price} ETH</p>
                </div>
                {collection.contract_address && (
                  <div className="bg-gray-50 p-4 rounded col-span-2">
                    <p className="text-gray-500 text-sm">Contract Address</p>
                    <p className="font-mono text-sm truncate">
                      {collection.contract_address}
                    </p>
                  </div>
                )}
              </div>

              {collection.external_link && (
                <a
                  href={collection.external_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  View Website
                </a>
              )}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-6">NFTs in this Collection</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {collectionNFTs.map((nft) => (
              <Link
                key={nft.id}
                href={`/collections/${collection.id}/nfts/${nft.token_id}`}
                className="border rounded-lg hover:shadow-lg transition-shadow overflow-hidden bg-white"
              >
                <div className="aspect-square w-full overflow-hidden">
                  <img
                    src={nft.image}
                    alt={nft.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{nft.name}</h3>
                  <p className="text-sm text-gray-500">
                    Token ID: {nft.token_id}
                  </p>
                </div>
              </Link>
            ))}

            {collectionNFTs.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                No NFTs found in this collection
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
