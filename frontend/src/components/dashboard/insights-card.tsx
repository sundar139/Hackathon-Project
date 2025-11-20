"use client"

export function InsightsCard() {
    return (
        <div className="bg-white rounded-2xl p-4 shadow-sm h-full flex flex-col overflow-hidden">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Insights</h2>

            <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Task Completion */}
                <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-600 mb-1">Task Completion</p>
                    <p className="text-2xl font-bold text-green-600">85%</p>
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 w-[85%]"></div>
                    </div>
                </div>

                {/* Focus Time */}
                <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-600 mb-1">Focus Time</p>
                    <p className="text-2xl font-bold text-blue-600">6.2 <span className="text-sm">hrs</span></p>
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 w-[62%]"></div>
                    </div>
                </div>
            </div>

            {/* Mood Correlation */}
            <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">Mood Correlation</p>
                <div className="flex items-center gap-2">
                    <span className="text-green-600">📈</span>
                    <p className="text-xs text-gray-700">Productivity is higher on sunny days.</p>
                </div>
            </div>
        </div>
    )
}
