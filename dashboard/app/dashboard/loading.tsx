export default function DashboardLoading() {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-8 animate-pulse">
        {/* Header */}
        <div className="mb-8">
          <div className="h-8 w-48 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-72 bg-gray-100 rounded" />
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
              <div className="h-8 w-20 bg-gray-200 rounded" />
            </div>
          ))}
        </div>

        {/* Chart + top accounts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
            <div className="h-[220px] bg-gray-100 rounded-lg" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="h-4 w-28 bg-gray-200 rounded mb-4" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-28 bg-gray-100 rounded" />
                  <div className="h-4 w-16 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="h-4 w-32 bg-gray-200 rounded" />
          </div>
          <div className="divide-y divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gray-100" />
                  <div>
                    <div className="h-3.5 w-40 bg-gray-200 rounded mb-1.5" />
                    <div className="h-3 w-24 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="h-3 w-16 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat panel skeleton */}
      <div className="w-96 min-w-[24rem] border-l border-gray-200 bg-white" />
    </div>
  );
}
