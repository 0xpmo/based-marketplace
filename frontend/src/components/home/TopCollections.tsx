import Link from "next/link";
import { Collection } from "@/types/contracts";
import CollectionCard from "@/components/collections/CollectionCard";
import PepeButton from "@/components/ui/PepeButton";

interface TopCollectionsProps {
  collections: Collection[];
  loading: boolean;
}

export default function TopCollections({
  collections,
  loading,
}: TopCollectionsProps) {
  return (
    <section className="w-full bg-gradient-to-b from-blue-950 to-blue-900 py-16 px-4">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-white">Top Collections</h2>
          <Link
            href="/collections"
            className="flex items-center text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            View All <span className="ml-2">→</span>
          </Link>
        </div>

        {collections.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <CollectionCard
                key={collection.address}
                collection={collection}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-blue-900/30 border border-blue-800/50 rounded-xl shadow-inner shadow-blue-900/30">
            <p className="text-cyan-200 mb-4">No collections available yet</p>
          </div>
        )}
      </div>
    </section>
  );
}
