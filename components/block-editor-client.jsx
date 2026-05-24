"use client";

import { useEffect, useMemo, useRef } from "react";
import { HpsgAdapter } from "@/lib/grammar/hpsg-adapter";
import { mvpLexemeSources } from "@/lib/grammar/sample-lexemes";
import { createStaticBlockViews } from "@/lib/blocks/static-block-view";
import { renderStaticBlockCanvas } from "@/lib/d3-block-ui/static-canvas-renderer";

export default function BlockEditorClient() {
  const svgRef = useRef(null);
  const blocks = useMemo(() => {
    const adapter = new HpsgAdapter();
    const definitions = adapter.createBlockDefinitions(mvpLexemeSources);
    return createStaticBlockViews(adapter, definitions);
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    renderStaticBlockCanvas(svgRef.current, blocks);
  }, [blocks]);

  return (
    <main className="min-h-dvh overflow-hidden bg-[#f7f8fa]">
      <svg
        ref={svgRef}
        data-testid="mvp1-block-canvas"
        className="block h-dvh w-full cursor-grab active:cursor-grabbing"
        role="img"
        aria-label="Static draggable canvas with English word blocks"
      />
    </main>
  );
}
