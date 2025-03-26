import Link from "next/link";
import { getCollections } from "../utils/collections";

export default async function Home() {
  const collections = await getCollections();

  return (
    <main className="min-h-screen p-6 lg:p-12">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Based NFT Collections</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/collections/${collection.id}`}
              className="border rounded-lg hover:shadow-lg transition-shadow overflow-hidden bg-white"
            >
              <div className="aspect-square w-full overflow-hidden">
                {collection.image ? (
                  <img
                    src={collection.image}
                    alt={collection.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <span className="text-gray-400 text-xl">
                      {collection.symbol}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h2 className="text-xl font-semibold">{collection.name}</h2>
                <p className="text-gray-500 text-sm mb-2">
                  {collection.symbol}
                </p>
                <p className="text-sm text-gray-700 line-clamp-2">
                  {collection.description}
                </p>
                <div className="flex justify-between mt-3 text-sm text-gray-500">
                  <span>{collection.items_count} items</span>
                  <span>Max: {collection.max_supply}</span>
                </div>
              </div>
            </Link>
          ))}

          {collections.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              No collections found. Create one using the Based NFT Collection
              Tools.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
