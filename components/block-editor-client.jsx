"use client";

import { useEffect, useMemo, useRef } from "react";
import { HpsgAdapter } from "@/lib/grammar/hpsg-adapter";
import { mvpLexemeSources } from "@/lib/grammar/sample-lexemes";
import { createEditorModel } from "@/lib/blocks/editor-model";
import { renderEditorCanvas } from "@/lib/d3-block-ui/editor-canvas-renderer";

export default function BlockEditorClient() {
  const svgRef = useRef(null);
  const model = useMemo(() => {
    const adapter = new HpsgAdapter();
    const definitions = adapter.createBlockDefinitions(mvpLexemeSources);
    return createEditorModel(adapter, definitions, { includeInitialBlocks: false });
  }, []);
  const sidebarDefinitions = useMemo(() => {
    const adapter = model.adapter;
    return adapter.createBlockDefinitions(mvpLexemeSources);
  }, [model]);

  useEffect(() => {
    if (!svgRef.current) return;
    renderEditorCanvas(svgRef.current, model, { sidebarDefinitions });
  }, [model, sidebarDefinitions]);

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
