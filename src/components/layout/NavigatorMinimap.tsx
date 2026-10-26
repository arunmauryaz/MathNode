import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { MathNode, MathFrame } from '../../types';

interface NavigatorMinimapProps {
  zoom: number;
  pan: { x: number; y: number };
  containerWidth: number;
  containerHeight: number;
  nodes?: MathNode[];
  frames?: MathFrame[];
  onPanChange: (newPan: { x: number; y: number }) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

const MINI_WIDTH = 208;
const MINI_HEIGHT = 106;

export const NavigatorMinimap: React.FC<NavigatorMinimapProps> = ({
  zoom,
  pan,
  containerWidth,
  containerHeight,
  nodes = [],
  frames = [],
  onPanChange,
  onZoomIn,
  onZoomOut,
  onResetView
}) => {
  const miniCanvasRef = useRef<HTMLDivElement>(null);
  const [isNavDragging, setIsNavDragging] = useState(false);
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startCamX: number;
    startCamY: number;
    scale: number;
  } | null>(null);

  // Viewport dimensions on screen
  const sWidth = containerWidth > 0 ? containerWidth : 1200;
  const sHeight = containerHeight > 0 ? containerHeight : 800;

  // Camera center in world space: (screen_center - pan) / zoom
  const camCenterX = -pan.x / zoom;
  const camCenterY = -pan.y / zoom;

  // Visible dimensions in world space
  const viewWorldW = sWidth / zoom;
  const viewWorldH = sHeight / zoom;

  const camMinX = camCenterX - viewWorldW / 2;
  const camMinY = camCenterY - viewWorldH / 2;

  // Compute graph bounds from all nodes and frames (with comfortable workspace fallback)
  const graphBounds = useMemo(() => {
    let minX = -900;
    let maxX = 900;
    let minY = -550;
    let maxY = 550;

    const hasNodes = nodes.length > 0;
    const hasFrames = frames.length > 0;

    if (hasNodes || hasFrames) {
      let bMinX = Infinity;
      let bMaxX = -Infinity;
      let bMinY = Infinity;
      let bMaxY = -Infinity;

      if (hasNodes) {
        for (const n of nodes) {
          const nw = n.width || 180;
          const nh = n.height || 100;
          bMinX = Math.min(bMinX, n.x);
          bMaxX = Math.max(bMaxX, n.x + nw);
          bMinY = Math.min(bMinY, n.y);
          bMaxY = Math.max(bMaxY, n.y + nh);
        }
      }

      if (hasFrames) {
        for (const f of frames) {
          bMinX = Math.min(bMinX, f.x);
          bMaxX = Math.max(bMaxX, f.x + f.width);
          bMinY = Math.min(bMinY, f.y);
          bMaxY = Math.max(bMaxY, f.y + f.height);
        }
      }

      const paddingX = Math.max(280, (bMaxX - bMinX) * 0.18);
      const paddingY = Math.max(200, (bMaxY - bMinY) * 0.18);

      minX = bMinX - paddingX;
      maxX = bMaxX + paddingX;
      minY = bMinY - paddingY;
      maxY = bMaxY + paddingY;
    }

    return { minX, maxX, minY, maxY, spanX: maxX - minX, spanY: maxY - minY };
  }, [nodes, frames]);

  // Uniform scale to fit the graph bounds into the 208x106 minimap canvas without stretching
  const scaleX = MINI_WIDTH / graphBounds.spanX;
  const scaleY = MINI_HEIGHT / graphBounds.spanY;
  const scale = Math.min(scaleX, scaleY);

  const contentW = graphBounds.spanX * scale;
  const contentH = graphBounds.spanY * scale;

  // Center the graph content within the minimap viewport
  const offsetX = (MINI_WIDTH - contentW) / 2;
  const offsetY = (MINI_HEIGHT - contentH) / 2;

  // World to Minimap coordinates
  const worldToMiniX = (wx: number) => offsetX + (wx - graphBounds.minX) * scale;
  const worldToMiniY = (wy: number) => offsetY + (wy - graphBounds.minY) * scale;

  // Minimap to World coordinates
  const miniToWorldX = (mx: number) => graphBounds.minX + (mx - offsetX) / scale;
  const miniToWorldY = (my: number) => graphBounds.minY + (my - offsetY) / scale;

  // Viewport camera rect in minimap space (Unclamped: travels freely anywhere in world space)
  const viewX = worldToMiniX(camMinX);
  const viewY = worldToMiniY(camMinY);
  const viewW = Math.max(10, viewWorldW * scale);
  const viewH = Math.max(8, viewWorldH * scale);

  // Check if camera viewport is off-screen relative to minimap canvas
  const isOffScreen =
    viewX + viewW < 0 ||
    viewX > MINI_WIDTH ||
    viewY + viewH < 0 ||
    viewY > MINI_HEIGHT;

  // Clamped coordinates for edge radar indicator when camera is off-screen
  const miniCamCenterX = viewX + viewW / 2;
  const miniCamCenterY = viewY + viewH / 2;
  const edgeX = Math.max(8, Math.min(MINI_WIDTH - 8, miniCamCenterX));
  const edgeY = Math.max(8, Math.min(MINI_HEIGHT - 8, miniCamCenterY));

  // Origin (0, 0) crosshair position
  const originX = worldToMiniX(0);
  const originY = worldToMiniY(0);
  const isOriginVisible =
    originX >= 0 && originX <= MINI_WIDTH && originY >= 0 && originY <= MINI_HEIGHT;

  // Mouse wheel zooms in/out directly on minimap
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.deltaY < 0) {
      onZoomIn();
    } else {
      onZoomOut();
    }
  };

  // Mouse down: Direct 1:1 camera drag or instant jump & steer
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!miniCanvasRef.current) return;
    const rect = miniCanvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const isInsideCameraBox =
      mx >= viewX && mx <= viewX + viewW &&
      my >= viewY && my <= viewY + viewH;

    setIsNavDragging(true);

    if (isInsideCameraBox) {
      // Direct drag anchor from current camera position
      dragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startCamX: camCenterX,
        startCamY: camCenterY,
        scale
      };
    } else {
      // Instant jump & drag: center camera on clicked world coordinate and continue dragging smoothly
      const targetWorldX = miniToWorldX(mx);
      const targetWorldY = miniToWorldY(my);

      onPanChange({
        x: -targetWorldX * zoom,
        y: -targetWorldY * zoom
      });

      dragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startCamX: targetWorldX,
        startCamY: targetWorldY,
        scale
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isNavDragging || !dragRef.current) return;

      const dxMini = e.clientX - dragRef.current.startClientX;
      const dyMini = e.clientY - dragRef.current.startClientY;

      // 1:1 World delta without arbitrary boundary limits
      const dxWorld = dxMini / dragRef.current.scale;
      const dyWorld = dyMini / dragRef.current.scale;

      const nextCamX = dragRef.current.startCamX + dxWorld;
      const nextCamY = dragRef.current.startCamY + dyWorld;

      onPanChange({
        x: -nextCamX * zoom,
        y: -nextCamY * zoom
      });
    };

    const handleMouseUp = () => {
      setIsNavDragging(false);
      dragRef.current = null;
    };

    if (isNavDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isNavDragging, zoom, onPanChange]);

  return (
    <div className="absolute right-4 bottom-4 z-20 select-none">
      {/* Unified, Connected Tactile Navigation Pod */}
      <div className="w-[230px] bg-[#17171C] border border-[#2B2B34] rounded-[10px] p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] flex flex-col gap-2">
        {/* Full-width Expanded Controls Strip: Zoom Out, Readout, Zoom In, Center */}
        <div className="w-full flex items-center justify-between bg-[#121215] border border-[#26262F] rounded-[7px] p-1 px-1.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
          {/* Zoom Section: Out, Readout, In */}
          <div className="flex items-center gap-1">
            <button
              onClick={onZoomOut}
              className="btn-plastic-square w-[24px] h-[24px] text-[#8E8E96] hover:text-white"
              title="Zoom out (-)"
            >
              <ZoomOut size={12} />
            </button>

            <span 
              className="font-mono text-[11px] font-semibold text-[#EDEDED] min-w-[40px] text-center pointer-events-none"
              title="Current Zoom Level"
            >
              {Math.round(zoom * 100)}%
            </span>

            <button
              onClick={onZoomIn}
              className="btn-plastic-square w-[24px] h-[24px] text-[#8E8E96] hover:text-white"
              title="Zoom in (+)"
            >
              <ZoomIn size={12} />
            </button>
          </div>

          {/* Tactile Vertical Divider */}
          <div className="w-[1px] h-[14px] bg-[#2A2A33] mx-1" />

          {/* Center on Graph / Fullscreen Focus Button */}
          <button
            onClick={onResetView}
            className="btn-plastic-square h-[24px] px-2 text-[#8E8E96] hover:text-[#60A5FA] flex items-center gap-1.5 group/btn"
            title="Center on Graph / Focus (Home or 0)"
          >
            <Maximize2 size={11} className="shrink-0 text-[#8E8E96] group-hover/btn:text-[#60A5FA]" />
            <span className="text-[10px] font-semibold tracking-wider uppercase font-sans text-[#8E8E96] group-hover/btn:text-white">
              Center
            </span>
          </button>
        </div>

        {/* Directly Connected Open-Canvas Minimap Viewport */}
        <div
          ref={miniCanvasRef}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          className="relative w-[208px] h-[106px] mx-auto bg-[#101013] border border-[#222228] rounded-[6px] overflow-hidden cursor-crosshair group shadow-[inset_0_1px_4px_rgba(0,0,0,0.6)]"
          title="Click to jump, drag to pan canvas, scroll to zoom"
        >
          {/* Technical measured dot grid */}
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#4B4B5C_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

          {/* World Origin Reticle (0, 0) */}
          {isOriginVisible && (
            <div
              className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 w-3 h-3 opacity-25"
              style={{ left: `${originX}px`, top: `${originY}px` }}
            >
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-[1px] bg-[#60A5FA]" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-3 w-[1px] bg-[#60A5FA]" />
            </div>
          )}

          {/* Render Frames */}
          {frames.map((frame) => {
            const fx = worldToMiniX(frame.x);
            const fy = worldToMiniY(frame.y);
            const fw = Math.max(6, frame.width * scale);
            const fh = Math.max(5, frame.height * scale);
            return (
              <div
                key={frame.id}
                className="absolute border border-dashed rounded-[2px] pointer-events-none transition-all"
                style={{
                  left: `${fx}px`,
                  top: `${fy}px`,
                  width: `${fw}px`,
                  height: `${fh}px`,
                  borderColor: frame.color || '#4B5563',
                  backgroundColor: `${frame.color || '#4B5563'}12`
                }}
              />
            );
          })}

          {/* Render Nodes Silhouettes */}
          {nodes.map((node) => {
            const nx = worldToMiniX(node.x);
            const ny = worldToMiniY(node.y);
            const nw = Math.max(4, (node.width || 180) * scale);
            const nh = Math.max(3, (node.height || 100) * scale);
            return (
              <div
                key={node.id}
                className="absolute bg-[#32323D] border border-[#484857] rounded-[2px] pointer-events-none transition-colors"
                style={{
                  left: `${nx}px`,
                  top: `${ny}px`,
                  width: `${nw}px`,
                  height: `${nh}px`
                }}
              />
            );
          })}

          {/* Free-moving Blue Camera Viewport Indicator */}
          <div
            className={`absolute border border-[#3B82F6] rounded-[3px] pointer-events-none transition-colors ${
              isNavDragging
                ? 'bg-[#3B82F6]/30 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                : 'bg-[#3B82F6]/15 group-hover:bg-[#3B82F6]/25 shadow-[0_0_4px_rgba(59,130,246,0.25)]'
            }`}
            style={{
              left: `${viewX}px`,
              top: `${viewY}px`,
              width: `${viewW}px`,
              height: `${viewH}px`
            }}
          >
            {/* Tactile corner brackets */}
            <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-white/60 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-white/60 pointer-events-none" />
          </div>

          {/* Off-screen Radar Beacon if camera viewport travels out of minimap bounds */}
          {isOffScreen && (
            <div
              className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
              style={{ left: `${edgeX}px`, top: `${edgeY}px` }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#60A5FA] shadow-[0_0_8px_#3B82F6] animate-pulse" />
              <div className="absolute w-5 h-5 rounded-full border border-[#60A5FA]/50 animate-ping" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
