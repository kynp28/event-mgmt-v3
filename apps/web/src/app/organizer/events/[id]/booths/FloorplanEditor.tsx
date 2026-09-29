"use client";

import { useEffect, useState, useRef } from "react";
import { Stage, Layer, Rect, Text, Group, Image as KonvaImage, Transformer } from "react-konva";
import useImage from "use-image";

const BoothShape = ({ 
  booth, 
  isSelected, 
  onSelect, 
  onChange 
}: { 
  booth: any, 
  isSelected: boolean, 
  onSelect: () => void, 
  onChange: (newAttrs: any) => void 
}) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Group
        ref={shapeRef}
        x={booth.x}
        y={booth.y}
        width={booth.width || 100}
        height={booth.height || 100}
        rotation={booth.rotation || 0}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          const snap = 20;
          const x = Math.round(e.target.x() / snap) * snap;
          const y = Math.round(e.target.y() / snap) * snap;
          e.target.position({ x, y });
          onChange({ ...booth, x, y });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          
          node.scaleX(1);
          node.scaleY(1);
          
          const snap = 20;
          const width = Math.round(Math.max(20, node.width() * scaleX) / snap) * snap;
          const height = Math.round(Math.max(20, node.height() * scaleY) / snap) * snap;
          const rotation = Math.round(node.rotation());

          onChange({ ...booth, x: node.x(), y: node.y(), width, height, rotation });
        }}
      >
        <Rect
          width={booth.width || 100}
          height={booth.height || 100}
          fill={booth.status === "AVAILABLE" ? "#10b981" : (booth.status === "DISABLED" ? "#9ca3af" : "#ef4444")}
          opacity={0.8}
          stroke={isSelected ? "#2563eb" : "#ffffff"}
          strokeWidth={isSelected ? 4 : 2}
        />
        <Text
          text={booth.code}
          width={booth.width || 100}
          height={booth.height || 100}
          align="center"
          verticalAlign="middle"
          fill="white"
          fontStyle="bold"
          fontSize={16}
        />
      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default function FloorplanEditor({ 
  event, 
  booths, 
  onBoothsChange 
}: { 
  event: any, 
  booths: any[], 
  onBoothsChange: (updatedBooths: any[]) => void 
}) {
  const [bgImage] = useImage(event.floorplanImage || "");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const unplacedBooths = booths.filter(b => b.x === null || b.y === null);
  const placedBooths = booths.filter(b => b.x !== null && b.y !== null);

  const placeBooth = (boothId: string) => {
    const updated = booths.map(b => {
      if (b.id === boothId) return { ...b, x: 20, y: 20, width: 100, height: 100, rotation: 0 };
      return b;
    });
    onBoothsChange(updated);
  };

  const checkDeselect = (e: any) => {
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === "bg";
    if (clickedOnEmpty) {
      setSelectedId(null);
    }
  };

  const handleBoothChange = (boothId: string, newAttrs: any) => {
    const updated = booths.map(b => {
      if (b.id === boothId) return newAttrs;
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
        <Stage 
          width={2000} 
          height={2000} 
          onMouseDown={checkDeselect}
          onTouchStart={checkDeselect}
          className="cursor-crosshair"
        >
          <Layer>
            {bgImage && (
              <KonvaImage image={bgImage} name="bg" />
            )}
            
            {placedBooths.map(b => (
              <BoothShape
                key={b.id}
                booth={b}
                isSelected={b.id === selectedId}
                onSelect={() => setSelectedId(b.id)}
                onChange={(newAttrs) => handleBoothChange(b.id, newAttrs)}
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
