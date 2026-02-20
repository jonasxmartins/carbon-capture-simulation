"use client";

import React, { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Panel,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InfoIcon } from 'lucide-react';

type WeightedEdgeData = {
  weight?: number;
};

type FlowEdge = Edge<WeightedEdgeData>;

const initialNodes: Node[] = [
  {
    id: 'capture-1',
    type: 'default',
    data: { label: 'Steel Mill Capture 1', type: 'capture', params: { base_flow: 180, efficiency: 89, dropout_rate: 0.05 } },
    position: { x: 120, y: 60 },
    style: { background: '#fef08a', border: '1px solid #ca8a04', borderRadius: '8px', padding: '10px' }
  },
  {
    id: 'capture-2',
    type: 'default',
    data: { label: 'Refinery Capture 2', type: 'capture', params: { base_flow: 135, efficiency: 86, dropout_rate: 0.06 } },
    position: { x: 420, y: 60 },
    style: { background: '#fef08a', border: '1px solid #ca8a04', borderRadius: '8px', padding: '10px' }
  },
  {
    id: 'transport-1',
    type: 'default',
    data: { label: 'Gathering Header', type: 'transport', params: { base_leakage: 1.2, dropout_rate: 0.02 } },
    position: { x: 270, y: 150 },
    style: { background: '#bae6fd', border: '1px solid #0284c7', borderRadius: '8px', padding: '10px' }
  },
  {
    id: 'transport-2',
    type: 'default',
    data: { label: 'Trunk Pipeline West', type: 'transport', params: { base_leakage: 2.0, dropout_rate: 0.025 } },
    position: { x: 120, y: 260 },
    style: { background: '#bae6fd', border: '1px solid #0284c7', borderRadius: '8px', padding: '10px' }
  },
  {
    id: 'transport-3',
    type: 'default',
    data: { label: 'Trunk Pipeline East', type: 'transport', params: { base_leakage: 2.4, dropout_rate: 0.03 } },
    position: { x: 420, y: 260 },
    style: { background: '#bae6fd', border: '1px solid #0284c7', borderRadius: '8px', padding: '10px' }
  },
  {
    id: 'storage-1',
    type: 'default',
    data: { label: 'Saline Aquifer North', type: 'storage', params: { base_pressure: 105, dropout_rate: 0.01 } },
    position: { x: 80, y: 390 },
    style: { background: '#bbf7d0', border: '1px solid #16a34a', borderRadius: '8px', padding: '10px' }
  },
  {
    id: 'storage-2',
    type: 'default',
    data: { label: 'Depleted Gas Field South', type: 'storage', params: { base_pressure: 92, dropout_rate: 0.015 } },
    position: { x: 290, y: 390 },
    style: { background: '#bbf7d0', border: '1px solid #16a34a', borderRadius: '8px', padding: '10px' }
  },
  {
    id: 'utilization-1',
    type: 'default',
    data: { label: 'E-Fuels Conversion Plant', type: 'utilization', params: { conversion_rate: 93, dropout_rate: 0.02 } },
    position: { x: 500, y: 390 },
    style: { background: '#fbcfe8', border: '1px solid #db2777', borderRadius: '8px', padding: '10px' }
  }
];

const initialEdges: FlowEdge[] = [
  { id: 'e-c1-h', source: 'capture-1', target: 'transport-1', markerEnd: { type: MarkerType.ArrowClosed }, data: { weight: 100 } },
  { id: 'e-c2-h', source: 'capture-2', target: 'transport-1', markerEnd: { type: MarkerType.ArrowClosed }, data: { weight: 100 } },
  { id: 'e-h-w', source: 'transport-1', target: 'transport-2', markerEnd: { type: MarkerType.ArrowClosed }, data: { weight: 50 } },
  { id: 'e-h-e', source: 'transport-1', target: 'transport-3', markerEnd: { type: MarkerType.ArrowClosed }, data: { weight: 50 } },
  { id: 'e-w-s1', source: 'transport-2', target: 'storage-1', markerEnd: { type: MarkerType.ArrowClosed }, data: { weight: 50 } },
  { id: 'e-w-s2', source: 'transport-2', target: 'storage-2', markerEnd: { type: MarkerType.ArrowClosed }, data: { weight: 50 } },
  { id: 'e-e-s2', source: 'transport-3', target: 'storage-2', markerEnd: { type: MarkerType.ArrowClosed }, data: { weight: 50 } },
  { id: 'e-e-u1', source: 'transport-3', target: 'utilization-1', markerEnd: { type: MarkerType.ArrowClosed }, data: { weight: 50 } },
];

const frameworkInfo: Record<string, { label: string; description: string }> = {
  epa: {
    label: 'EPA Subpart RR',
    description: 'U.S. geologic sequestration focus; emphasizes documented substitutions and reporting transparency.'
  },
  alberta: {
    label: 'Alberta TIER',
    description: 'Tiered approach; stricter treatment for direct measurement gaps and deviation handling.'
  },
  lcfs: {
    label: 'California LCFS',
    description: 'Crediting-oriented framework; missing periods are generally treated conservatively.'
  },
  puro: {
    label: 'Puro Biochar',
    description: 'Biochar methodology; short-gap interpolation with conservative fallback for longer gaps.'
  }
};

export default function OperationsMap({ onSimulate }: { onSimulate: (data: any, options: { durationMinutes: number }) => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<FlowEdge | null>(null);
  const [jurisdiction, setJurisdiction] = useState('epa');
  const [durationMinutes, setDurationMinutes] = useState('12');

  const displayEdges = useMemo(
    () => {
      const getEdgeWeight = (edge: FlowEdge) => {
        const rawWeight = Number((edge.data as WeightedEdgeData | undefined)?.weight ?? 100);
        return Number.isFinite(rawWeight) && rawWeight >= 0 ? rawWeight : 0;
      };

      return edges.map((edge) => {
        const siblingEdges = edges.filter((e) => e.source === edge.source);
        const totalWeight = siblingEdges.reduce((sum, e) => sum + getEdgeWeight(e), 0);
        const edgeWeight = getEdgeWeight(edge);
        const sharePct = totalWeight > 0 ? (edgeWeight / totalWeight) * 100 : (siblingEdges.length > 0 ? 100 / siblingEdges.length : 100);

        return {
        ...edge,
        label: `${sharePct.toFixed(0)}%`,
        labelStyle: { fill: '#334155', fontSize: 11, fontWeight: 600 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 3,
        };
      });
    },
    [edges]
  );

  // Validate connections between nodes to ensure physical constraints
  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);
    
    if (!sourceNode || !targetNode) return false;

    // Rules:
    // - Capture can go to Transport, Storage, or Utilization
    // - Transport can go to Transport, Storage, or Utilization
    // - Storage is a terminal node, cannot be a source
    // - Utilization is a terminal node, cannot be a source
    if (sourceNode.data.type === 'storage' || sourceNode.data.type === 'utilization') {
      return false; // Terminal nodes cannot output to anything
    }
    
    if (targetNode.data.type === 'capture') {
      return false; // Capture is a root node, cannot receive input
    }

    return true;
  }, [nodes]);

  const onConnect = useCallback((params: Connection | Edge) => {
    setEdges((eds) => {
      if (!params.source) {
        return addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed }, data: { weight: 100 } }, eds) as FlowEdge[];
      }

      const outgoingFromSource = eds.filter((edge) => edge.source === params.source);
      let nextEdges = eds;
      let newEdgeWeight = 100;

      // First branching connection: default to an intuitive 50/50 split.
      if (outgoingFromSource.length === 1) {
        nextEdges = eds.map((edge) =>
          edge.id === outgoingFromSource[0].id
            ? { ...edge, data: { ...(edge.data || {}), weight: 50 } }
            : edge
        );
        newEdgeWeight = 50;
      }

      return addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed }, data: { weight: newEdgeWeight } }, nextEdges) as FlowEdge[];
    });
  }, [setEdges]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const onEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge as FlowEdge);
    setSelectedNode(null);
  };

  const onPaneClick = () => {
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const addNode = (type: string) => {
    const newNodeId = `${type}-${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      type: 'default',
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: { label: `New ${type}`, type, params: {} },
      style: { 
        background: type === 'capture' ? '#fef08a' : type === 'transport' ? '#bae6fd' : type === 'storage' ? '#bbf7d0' : '#fbcfe8',
        border: '1px solid #666',
        borderRadius: '8px',
        padding: '10px'
      }
    };
    
    // Set default params based on type
    if (type === 'capture') newNode.data.params = { base_flow: 100, efficiency: 90, dropout_rate: 0.05 };
    if (type === 'transport') newNode.data.params = { base_leakage: 2, dropout_rate: 0.02 };
    if (type === 'storage') newNode.data.params = { base_pressure: 50, dropout_rate: 0.01 };
    if (type === 'utilization') newNode.data.params = { conversion_rate: 95, dropout_rate: 0.01 };

    setNodes((nds) => nds.concat(newNode));
  };

  const updateNodeData = (key: string, value: any, isParam: boolean = false) => {
    if (!selectedNode) return;
    
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          const newData = { ...node.data };
          if (isParam) {
            newData.params = { ...(newData.params as Record<string, any>), [key]: Number(value) };
          } else {
            newData[key] = value;
          }
          const updatedNode = { ...node, data: newData };
          setSelectedNode(updatedNode); // update local state so panel updates
          return updatedNode;
        }
        return node;
      })
    );
  };

  const updateEdgeWeight = (value: string) => {
    if (!selectedEdge) return;

    const parsed = Number(value);
    const clampedWeight = Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;

    setEdges((eds) => {
      const sameSourceEdges = eds.filter((edge) => edge.source === selectedEdge.source);
      const shouldAutoBalancePair = sameSourceEdges.length === 2;

      return eds.map((edge) => {
        if (edge.id === selectedEdge.id) {
          const updatedSelected: FlowEdge = { ...edge, data: { ...(edge.data || {}), weight: clampedWeight } };
          setSelectedEdge(updatedSelected);
          return updatedSelected;
        }

        if (shouldAutoBalancePair && edge.source === selectedEdge.source) {
          return { ...edge, data: { ...(edge.data || {}), weight: 100 - clampedWeight } };
        }

        return edge;
      });
    });
  };

  const handleSimulate = () => {
    const graphData = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.data.type,
        name: n.data.label,
        params: n.data.params,
        metadata: {}
      })),
      edges: edges.map(e => ({
        source: e.source,
        target: e.target,
        weight: (e.data as WeightedEdgeData | undefined)?.weight ?? 100
      })),
      jurisdiction
    };
    onSimulate(graphData, { durationMinutes: Number(durationMinutes) || 12 });
  };

  return (
    <div className="flex h-[600px] w-full border rounded-lg overflow-hidden bg-slate-50">
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          isValidConnection={isValidConnection}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
          <Panel position="top-left" className="bg-white/90 p-2 rounded shadow-sm flex gap-2">
            <Button size="sm" variant="outline" onClick={() => addNode('capture')} className="border-yellow-500 text-yellow-700 hover:bg-yellow-50">+ Capture</Button>
            <Button size="sm" variant="outline" onClick={() => addNode('transport')} className="border-blue-500 text-blue-700 hover:bg-blue-50">+ Transport</Button>
            <Button size="sm" variant="outline" onClick={() => addNode('storage')} className="border-green-500 text-green-700 hover:bg-green-50">+ Storage</Button>
            <Button size="sm" variant="outline" onClick={() => addNode('utilization')} className="border-pink-500 text-pink-700 hover:bg-pink-50">+ Utilization</Button>
          </Panel>
          <Panel position="top-right" className="bg-white/90 p-2 rounded shadow-md border w-[180px] flex flex-col gap-2">
            <div>
              <Label className="mb-1 block text-xs font-bold">Framework</Label>
              <Select value={jurisdiction} onValueChange={setJurisdiction}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Select framework" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(frameworkInfo).map(([key, info]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-600 mt-1 leading-snug">
                {frameworkInfo[jurisdiction]?.description}
              </p>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-bold">Duration</Label>
              <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5" className="text-xs">5 minutes</SelectItem>
                  <SelectItem value="12" className="text-xs">12 minutes</SelectItem>
                  <SelectItem value="30" className="text-xs">30 minutes</SelectItem>
                  <SelectItem value="60" className="text-xs">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSimulate} className="w-full font-bold">
              Run Simulation
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Side Panel for Node Editing and Guidance */}
      <div className="w-80 bg-white border-l p-4 flex flex-col gap-4 overflow-y-auto">
        {selectedNode ? (
          <>
            <h3 className="font-bold text-lg border-b pb-2">Properties: {selectedNode.data.label as string}</h3>
            
            <div className="bg-slate-50 border rounded-md p-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <InfoIcon className="h-4 w-4" />
                <span>Component Guide</span>
              </div>
              <p className="text-xs mt-1 text-slate-600">
                {selectedNode.data.type === 'capture' && "Source of CO2. Generates gross flow based on base flow & efficiency. No inputs."}
                {selectedNode.data.type === 'transport' && "Moves CO2. Deducts leakage from incoming flows."}
                {selectedNode.data.type === 'storage' && "Permanent injection endpoints. No outputs."}
                {selectedNode.data.type === 'utilization' && "Conversion endpoints (e.g. synfuels, concrete). Deducts unused CO2."}
              </p>
            </div>

            <div className="flex flex-col gap-4 mt-2">
              <div>
                <Label>Node Name</Label>
                <Input 
                  value={selectedNode.data.label as string} 
                  onChange={(e) => updateNodeData('label', e.target.value)}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Input value={selectedNode.data.type as string} disabled className="capitalize bg-slate-100" />
              </div>
              
              <h4 className="font-semibold mt-4 border-b pb-1">Simulation Parameters</h4>
              
              {selectedNode.data.type === 'capture' && (
                <>
                  <div>
                    <Label>Base Flow (kg/hr)</Label>
                    <Input type="number" min="0" value={(selectedNode.data.params as any)?.base_flow || 0} onChange={(e) => updateNodeData('base_flow', e.target.value, true)} />
                    <p className="text-[10px] text-muted-foreground mt-1">Simulated raw CO2 gas entering the unit.</p>
                  </div>
                  <div>
                    <Label>Efficiency (%)</Label>
                    <Input type="number" min="0" max="100" value={(selectedNode.data.params as any)?.efficiency || 0} onChange={(e) => updateNodeData('efficiency', e.target.value, true)} />
                    <p className="text-[10px] text-muted-foreground mt-1">Percentage of gas successfully captured.</p>
                  </div>
                </>
              )}

              {selectedNode.data.type === 'transport' && (
                <div>
                  <Label>Base Leakage (kg/hr)</Label>
                  <Input type="number" min="0" value={(selectedNode.data.params as any)?.base_leakage || 0} onChange={(e) => updateNodeData('base_leakage', e.target.value, true)} />
                  <p className="text-[10px] text-muted-foreground mt-1">Amount of CO2 lost during transport.</p>
                </div>
              )}

              {selectedNode.data.type === 'storage' && (
                <div>
                  <Label>Base Pressure (bar)</Label>
                  <Input type="number" min="0" value={(selectedNode.data.params as any)?.base_pressure || 0} onChange={(e) => updateNodeData('base_pressure', e.target.value, true)} />
                  <p className="text-[10px] text-muted-foreground mt-1">Injection pressure (currently informational).</p>
                </div>
              )}

              {selectedNode.data.type === 'utilization' && (
                <div>
                  <Label>Conversion Rate (%)</Label>
                  <Input type="number" min="0" max="100" value={(selectedNode.data.params as any)?.conversion_rate || 0} onChange={(e) => updateNodeData('conversion_rate', e.target.value, true)} />
                  <p className="text-[10px] text-muted-foreground mt-1">Percentage of incoming CO2 successfully converted.</p>
                </div>
              )}

              <div className="pt-2">
                <Label>Sensor Dropout Rate (0-1)</Label>
                <Input type="number" step="0.01" min="0" max="1" value={(selectedNode.data.params as any)?.dropout_rate || 0} onChange={(e) => updateNodeData('dropout_rate', e.target.value, true)} />
                <p className="text-[10px] text-muted-foreground mt-1">Probability of sensor failure per reading (generates missing data for gap-filling algorithms).</p>
              </div>
            </div>
          </>
        ) : selectedEdge ? (
          <>
            <h3 className="font-bold text-lg border-b pb-2">Edge Properties</h3>
            <div className="text-sm text-slate-600">
              <p><strong>From:</strong> {selectedEdge.source}</p>
              <p><strong>To:</strong> {selectedEdge.target}</p>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <Label>Routing Percentage (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={(selectedEdge.data as WeightedEdgeData | undefined)?.weight ?? 100}
                onChange={(e) => updateEdgeWeight(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Set routing percentage for this edge (0-100). If this source has exactly two outgoing edges,
                the other edge is auto-set to keep total at 100%.
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-col h-full">
            <h3 className="font-bold text-lg border-b pb-2">Guide</h3>
            <div className="text-sm text-slate-600 mt-4 space-y-4">
              <p>Design a carbon value chain and simulate gap-filling strategies for missing sensor data.</p>
              
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Add</strong> components using top-left buttons.</li>
                <li><strong>Connect</strong> nodes by dragging between handles.</li>
                <li><strong>Configure</strong> parameters by clicking any node.</li>
                <li><strong>Capture</strong> = source, <strong>Storage</strong> = endpoint.</li>
              </ul>

              <div className="p-3 bg-blue-50 text-blue-800 rounded-md mt-4 border border-blue-100 text-xs">
                <strong>Tip:</strong> Increase "Sensor Dropout Rate" to test gap-filling strategies.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
