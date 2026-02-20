"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SimulationResults({ results }: { results: any }) {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);

  const nodes = results
    ? Object.entries(results.nodes || {}).map(([id, data]: [string, any]) => ({
        id,
        ...data
      }))
    : [];

  const totalPoints = nodes.length > 0 ? nodes[0].timeseries?.length || 0 : 0;
  const timestepSeconds = Number(results?.simulation_timestep_seconds || 5);
  const simulationDurationMinutes =
    Number(results?.simulation_duration_minutes) ||
    (totalPoints > 0 ? (totalPoints * timestepSeconds) / 60 : 0);

  useEffect(() => {
    if (totalPoints <= 0) {
      setPlaybackIndex(0);
      return;
    }

    setPlaybackIndex(1);
    const maxFrames = 140;
    const pointsPerTick = Math.max(1, Math.ceil(totalPoints / maxFrames));
    const intervalMs = 90;

    const timer = setInterval(() => {
      setPlaybackIndex((prev) => {
        const next = prev + pointsPerTick;
        if (next >= totalPoints) {
          clearInterval(timer);
          return totalPoints;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [totalPoints, results]);

  if (!results) {
    return (
      <Card className="h-[400px] flex items-center justify-center text-muted-foreground">
        Run a simulation to view results.
      </Card>
    );
  }

  const visibleNodes = nodes.map((node: any) => ({
    ...node,
    timeseries: (node.timeseries || []).slice(0, playbackIndex),
  }));

  const chartData = visibleNodes.length > 0 ? visibleNodes[0].timeseries.map((_: any, i: number) => {
    const point: any = { time: new Date(visibleNodes[0].timeseries[i].timestamp).toLocaleTimeString() };
    
    // Total CO2 captured
    let captured = 0;
    // Total CO2 permanently stored
    let stored = 0;
    
    visibleNodes.forEach(node => {
      // Safely access flow_kg_min (might be null if gap filling failed or no data)
      const flow = node.timeseries[i].flow_kg_min || 0;
      point[node.id] = flow;
      
      if (node.type === 'capture') {
        captured += flow;
      } else if (node.type === 'storage' || node.type === 'utilization') {
        stored += flow;
      }
    });
    
    point['Captured'] = captured;
    point['Stored'] = stored;
    
    return point;
  }) : [];

  const barChartData = visibleNodes.map((node: any) => ({
    name: node.name || node.id,
    type: node.type,
    total: (node.timeseries || []).reduce(
      (sum: number, point: any) => sum + (((point.flow_kg_min || 0) * (timestepSeconds / 60)) / 1000),
      0,
    ),
  }));

  const capturedTonnes =
    chartData.reduce((sum: number, p: any) => sum + ((p.Captured || 0) * (timestepSeconds / 60)) / 1000, 0);
  const storedTonnes =
    chartData.reduce((sum: number, p: any) => sum + ((p.Stored || 0) * (timestepSeconds / 60)) / 1000, 0);
  const retentionPct = capturedTonnes > 0 ? (storedTonnes / capturedTonnes) * 100 : 0;

  const cumulativeData = chartData.reduce((acc: any[], curr: any, i: number) => {
    const prevStored = i > 0 ? acc[i - 1].cumulativeStored : 0;
    const prevCaptured = i > 0 ? acc[i - 1].cumulativeCaptured : 0;
    acc.push({
      time: curr.time,
      cumulativeStored: prevStored + (curr.Stored * (timestepSeconds / 60)),
      cumulativeCaptured: prevCaptured + (curr.Captured * (timestepSeconds / 60)),
    });
    return acc;
  }, []);

  const performanceData =
    visibleNodes.length > 0
      ? visibleNodes[0].timeseries.map((_: any, i: number) => {
          const point: any = {
            time: new Date(visibleNodes[0].timeseries[i].timestamp).toLocaleTimeString(),
          };
          visibleNodes.forEach(node => {
            if (node.type === 'capture' && node.timeseries[i].EFFICIENCY !== undefined) {
              point[`${node.id} Efficiency (%)`] = node.timeseries[i].EFFICIENCY;
            }
            if (node.type === 'transport' && node.timeseries[i].LEAKAGE !== undefined) {
              point[`${node.id} Leakage (kg/hr)`] = node.timeseries[i].LEAKAGE;
            }
          });
          return point;
        })
      : [];

  const hasPerformanceSeries = performanceData.some((point: any) => Object.keys(point).length > 1);
  const progressPct = totalPoints > 0 ? Math.min(100, (playbackIndex / totalPoints) * 100) : 0;
  const elapsedMinutes = (playbackIndex * timestepSeconds) / 60;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Simulation Results</CardTitle>
        <CardDescription>
          Jurisdiction Framework: <Badge variant="secondary" className="uppercase">{results.jurisdiction_used}</Badge>
          <span className="ml-2 text-xs text-muted-foreground">
            Simulated: {elapsedMinutes.toFixed(1)} / {simulationDurationMinutes.toFixed(1)} min • Resolution: {timestepSeconds}s • Progress: {progressPct.toFixed(0)}%
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <div className="h-2 w-full rounded bg-slate-200 overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-100" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="charts">Flow Charts</TabsTrigger>
            <TabsTrigger value="per-component">Per Component</TabsTrigger>
            <TabsTrigger value="cumulative">Cumulative Stored</TabsTrigger>
            <TabsTrigger value="efficiency">Efficiency & Leakage</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Captured CO2</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">{capturedTonnes.toFixed(2)} t</div>
                  <p className="text-xs text-muted-foreground mt-1">Total CO2 entering the chain.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Stored / Utilized CO2</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{storedTonnes.toFixed(2)} t</div>
                  <p className="text-xs text-muted-foreground mt-1">CO2 kept out of atmosphere.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Retention Efficiency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{retentionPct.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Share of captured CO2 retained.</p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">How to read this</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600 space-y-1">
                  <p>• <strong>Captured</strong>: CO2 generated and captured at source nodes.</p>
                  <p>• <strong>Stored / Utilized</strong>: CO2 either injected or converted into products.</p>
                  <p>• <strong>Retention Efficiency</strong>: retained share of captured CO2.</p>
                  <p>• Use Flow Charts and Efficiency tabs to inspect losses and bottlenecks by component.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Component Totals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {nodes.map(node => (
                    <div key={node.id} className="flex items-center justify-between text-sm border-b pb-1 last:border-0">
                      <div>
                        <p className="font-medium">{node.name || node.id}</p>
                        <p className="text-xs text-muted-foreground capitalize">{node.type}</p>
                      </div>
                      <span className="font-semibold">{(node.total_flow_tonnes || 0).toFixed(2)} t</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="charts" className="mt-4">
            <div className="h-[400px] w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" minTickGap={30} />
                    <YAxis label={{ value: 'Flow (kg/min)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    {nodes.map((node, i) => (
                      <Line 
                        key={node.id} 
                        type="monotone" 
                        dataKey={node.id} 
                        name={node.name || node.id}
                        stroke={`hsl(${i * 60}, 70%, 50%)`} 
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground border rounded-md">
                  No timeseries data available
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="per-component" className="mt-4">
            <div className="h-[400px] w-full">
              {barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: 'Total Flow (tonnes)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Bar 
                      dataKey="total" 
                      name="Total Processed"
                      fill="#3b82f6" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground border rounded-md">
                  No component data available
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="cumulative" className="mt-4">
            <div className="h-[400px] w-full">
              {cumulativeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" minTickGap={30} />
                    <YAxis label={{ value: 'Cumulative Flow (kg)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="cumulativeStored" 
                      name="Cumulative Stored"
                      stroke="#22c55e" 
                      strokeWidth={3}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cumulativeCaptured" 
                      name="Cumulative Captured"
                      stroke="#eab308" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground border rounded-md">
                  No timeseries data available
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="efficiency" className="mt-4">
            <div className="h-[400px] w-full">
              {hasPerformanceSeries ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" minTickGap={30} />
                    <YAxis yAxisId="left" label={{ value: 'Efficiency (%)', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Leakage (kg/hr)', angle: 90, position: 'insideRight' }} />
                    <Tooltip />
                    <Legend />
                    {nodes.filter(n => n.type === 'capture').map((node, i) => (
                      <Line 
                        key={`${node.id}-eff`}
                        yAxisId="left"
                        type="monotone" 
                        dataKey={`${node.id} Efficiency (%)`} 
                        name={`${node.name || node.id} Efficiency (%)`}
                        stroke="#eab308" 
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                    {nodes.filter(n => n.type === 'transport').map((node, i) => (
                      <Line 
                        key={`${node.id}-leak`}
                        yAxisId="right"
                        type="monotone" 
                        dataKey={`${node.id} Leakage (kg/hr)`} 
                        name={`${node.name || node.id} Leakage (kg/hr)`}
                        stroke="#ef4444" 
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground border rounded-md">
                  No efficiency/leakage series available. Add capture or transport nodes and rerun.
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="audit">
            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              <div className="space-y-4">
                {nodes.map(node => (
                  <div key={node.id} className="border-b pb-4 last:border-0">
                    <h4 className="font-semibold text-sm mb-2">{node.name || node.id} <span className="text-xs text-muted-foreground">({node.id})</span></h4>
                    <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto">
                      {JSON.stringify(node.audit, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
