"use client";

import FloorplanCanvas from "@/components/FloorplanCanvas";

export default function FloorplanEditor({ 
  event, 
  booths, 
  onBoothsChange 
}: { 
  event: any, 
  booths: any[], 
  onBoothsChange: (updatedBooths: any[]) => void 
}) {
  const unplacedBooths = booths.filter(b => b.x === null || b.y === null);

  const placeBooth = (boothId: string) => {
    const updated = booths.map(b => {
      if (b.id === boothId) return { ...b, x: 20, y: 20, width: 100, height: 100, rotation: 0 };
      return b;
    });
    onBoothsChange(updated);
  };

  return (
    <div className="flex h-full border bg-gray-50 rounded overflow-hidden">
      <div className="w-64 bg-white border-r p-4 overflow-y-auto">
        <h3 className="font-bold mb-4">Unplaced Booths</h3>
        {unplacedBooths.length === 0 ? (
          <p className="text-gray-500 text-sm">All booths placed on map.</p>
        ) : (
          <ul className="space-y-2">
            {unplacedBooths.map(b => (
              <li key={b.id} className="border p-2 rounded flex justify-between items-center bg-gray-50 hover:bg-gray-100">
                <span>{b.code}</span>
                <button 
                  onClick={() => placeBooth(b.id)}
                  className="bg-blue-600 text-white px-2 py-1 text-xs rounded"
                >
                  Place
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex-1 overflow-auto relative bg-gray-200">
        <FloorplanCanvas event={event} booths={booths} mode="EDIT" onBoothsChange={onBoothsChange} />
      </div>
    </div>
  );
}
