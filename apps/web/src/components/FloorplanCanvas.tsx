"use client";

import { useEffect, useState, useRef } from "react";
import { Stage, Layer, Rect, Text, Group, Image as KonvaImage, Transformer } from "react-konva";
import useImage from "use-image";

const BoothShape = ({ 
  booth, 
  isSelected, 
  isMultiSelected,
  mode,
  onSelect, 
  onChange 
}: { 
  booth: any, 
  isSelected: boolean, 
  isMultiSelected: boolean,
  mode: "VIEW" | "EDIT",
  onSelect: () => void, 
  onChange?: (newAttrs: any) => void 
}) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (mode === "EDIT" && isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, mode]);

  const isAvailable = booth.status === "AVAILABLE";
  const isDisabled = booth.status === "DISABLED";
  const isBooked = booth.status === "BOOKED" || booth.status === "PAYMENT_PENDING";

  let fill = "#10b981"; // default available
  if (isDisabled) fill = "#9ca3af";
  if (isBooked) fill = "#ef4444";
  
  if (mode === "VIEW") {
    if (isAvailable && isMultiSelected) fill = "#3b82f6"; // Blue when selected by vendor
  }

  let stroke = "#ffffff";
  let strokeWidth = 2;
  if (mode === "EDIT" && isSelected) {
    stroke = "#2563eb";
    strokeWidth = 4;
  } else if (mode === "VIEW" && isMultiSelected) {
    stroke = "#1d4ed8";
    strokeWidth = 4;
  }

  return (
    <>
      <Group
        ref={shapeRef}
        x={booth.x}
        y={booth.y}
        width={booth.width || 100}
        height={booth.height || 100}
        rotation={booth.rotation || 0}
        draggable={mode === "EDIT"}
        onClick={() => {
          if (mode === "EDIT") onSelect();
          else if (mode === "VIEW" && isAvailable) onSelect();
        }}
        onTap={() => {
          if (mode === "EDIT") onSelect();
          else if (mode === "VIEW" && isAvailable) onSelect();
        }}
        onDragEnd={(e) => {
          if (mode !== "EDIT" || !onChange) return;
          const snap = 20;
          const x = Math.round(e.target.x() / snap) * snap;
          const y = Math.round(e.target.y() / snap) * snap;
          e.target.position({ x, y });
          onChange({ ...booth, x, y });
        }}
        onTransformEnd={(e) => {
          if (mode !== "EDIT" || !onChange) return;
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
          fill={fill}
          opacity={0.8}
          stroke={stroke}
          strokeWidth={strokeWidth}
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
      {mode === "EDIT" && isSelected && (
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

export default function FloorplanCanvas({ 
  event, 
  booths, 
  mode,
  onBoothsChange,
  selectedBoothIds = [],
  onBoothToggle
}: { 
  event: any, 
  booths: any[], 
  mode: "VIEW" | "EDIT",
  onBoothsChange?: (updatedBooths: any[]) => void,
  selectedBoothIds?: string[],
  onBoothToggle?: (boothId: string) => void
}) {
  const [bgImage] = useImage(event.floorplanImage || "");
  const [editSelectedId, setEditSelectedId] = useState<string | null>(null);

  const placedBooths = booths.filter(b => b.x !== null && b.y !== null);

  const checkDeselect = (e: any) => {
    if (mode !== "EDIT") return;
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === "bg";
    if (clickedOnEmpty) {
      setEditSelectedId(null);
    }
  };

  const handleBoothChange = (boothId: string, newAttrs: any) => {
    if (mode !== "EDIT" || !onBoothsChange) return;
    const updated = booths.map(b => b.id === boothId ? newAttrs : b);
    onBoothsChange(updated);
  };

  return (
    <Stage 
      width={2000} 
      height={2000} 
      onMouseDown={checkDeselect}
      onTouchStart={checkDeselect}
      className={mode === "EDIT" ? "cursor-crosshair" : "cursor-default"}
    >
      <Layer>
        {bgImage && (
          <KonvaImage image={bgImage} name="bg" />
        )}
        
        {placedBooths.map(b => (
          <BoothShape
            key={b.id}
            booth={b}
            mode={mode}
            isSelected={b.id === editSelectedId}
            isMultiSelected={selectedBoothIds.includes(b.id)}
            onSelect={() => {
              if (mode === "EDIT") setEditSelectedId(b.id);
              else if (mode === "VIEW" && onBoothToggle) onBoothToggle(b.id);
            }}
            onChange={(newAttrs) => handleBoothChange(b.id, newAttrs)}
          />
        ))}
      </Layer>
    </Stage>
  );
}
