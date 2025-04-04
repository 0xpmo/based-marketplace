import Link from "next/link";
import PepeButton from "@/components/ui/PepeButton";
import PepeConfetti from "@/components/effects/PepeConfetti";

export default function CTASection() {
  return (
    <section className="w-full py-16 px-4 bg-gradient-to-b from-blue-950 to-blue-900">
      <div className="container mx-auto">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-800 to-cyan-900 rounded-2xl p-8 md:p-12 shadow-xl shadow-blue-900/50 border border-blue-700/50">
          <div className="absolute right-0 bottom-0 w-64 h-64 opacity-20">
            <PepeConfetti trigger={true} />
          </div>

          <div className="relative z-10 md:w-2/3">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Ready to dive in?
            </h2>
            <p className="text-cyan-200 mb-8 text-lg">
              Start creating and collecting unique NFTs on BasedSea today
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/collections">
                <PepeButton
                  variant="primary"
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-cyan-700 shadow-lg shadow-blue-900/30"
                >
                  Explore Collections
                </PepeButton>
              </Link>
              <Link href="/my-nfts">
                <PepeButton
                  variant="outline"
                  className="border-cyan-300 text-cyan-300 hover:bg-cyan-900/30"
                >
                  View My NFTs
                </PepeButton>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
