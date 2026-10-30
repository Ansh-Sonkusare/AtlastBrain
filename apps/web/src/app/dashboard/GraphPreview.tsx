'use client';

import { GraphCanvas } from './GraphView';
import type { ForceData } from './graph-model';

export function GraphPreview({ data }: { data: ForceData }) {
  return <GraphCanvas data={data} height={170} preview />;
}
