export default function AccountDetailLoading() {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-8 animate-pulse">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-3 w-16 bg-gray-200 rounded" />
          <div className="h-3 w-3 bg-gray-100 rounded" />
          <div className="h-3 w-32 bg-gray-200 rounded" />
        </div>

        {/* Hero */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="h-7 w-56 bg-gray-200 rounded mb-3" />
          <div className="flex gap-2 mb-5">
            <div className="h-5 w-16 bg-gray-100 rounded" />
            <div className="h-5 w-24 bg-gray-100 rounded" />
          </div>
          <div className="grid grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <div className="h-3 w-20 bg-gray-100 rounded mb-2" />
                <div className="h-7 w-24 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Details card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="h-4 w-16 bg-gray-200 rounded mb-4" />
          <div className="grid grid-cols-3 gap-x-8 gap-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i}>
                <div className="h-3 w-16 bg-gray-100 rounded mb-1.5" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Related sections */}
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 mb-6">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="h-4 w-24 bg-gray-200 rounded" />
            </div>
            <div className="divide-y divide-gray-100">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex justify-between px-5 py-3">
                  <div>
                    <div className="h-4 w-40 bg-gray-200 rounded mb-1.5" />
                    <div className="h-3 w-28 bg-gray-100 rounded" />
                  </div>
                  <div className="h-4 w-16 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Chat panel skeleton */}
      <div className="w-96 min-w-[24rem] border-l border-gray-200 bg-white" />
    </div>
  );
}
