from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import networkx as nx
import pandas as pd
import numpy as np
from datetime import datetime
from gap_filling import get_strategy

class Node(BaseModel):
    id: str
    type: str # 'capture', 'transport', 'storage', 'utilization'
    name: str
    params: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = {}

class Edge(BaseModel):
    source: str
    target: str

class OperationsGraph(BaseModel):
    nodes: List[Node]
    edges: List[Edge]
    jurisdiction: str = 'epa' # default
    metadata: Optional[Dict[str, Any]] = {}

def create_graph(ops_graph: OperationsGraph) -> nx.DiGraph:
    G = nx.DiGraph()
    for node in ops_graph.nodes:
        G.add_node(node.id, **node.dict())
    for edge in ops_graph.edges:
        G.add_edge(edge.source, edge.target)
    return G

def simulate_node_data(node_type: str, params: Dict[str, Any], n_readings: int, start_time: datetime) -> pd.DataFrame:
    # A simple simulation based on node type
    from sensors import simulate_sensor
    
    dfs = []
    if node_type == 'capture':
        base_flow = params.get('base_flow', 150.0)
        efficiency = params.get('efficiency', 88.5)
        dropout = params.get('dropout_rate', 0.05)
        
        dfs.append(simulate_sensor(n_readings, base_value=base_flow, noise_std=base_flow*0.05, dropout_rate=dropout, tag_name='FLOW', unit='kg/hr', start_time=start_time))
        dfs.append(simulate_sensor(n_readings, base_value=efficiency, noise_std=1.0, dropout_rate=dropout/2, tag_name='EFFICIENCY', unit='%', start_time=start_time))
    
    elif node_type == 'transport':
        leakage = params.get('base_leakage', 1.8)
        dropout = params.get('dropout_rate', 0.02)
        dfs.append(simulate_sensor(n_readings, base_value=leakage, noise_std=leakage*0.1, dropout_rate=dropout, tag_name='LEAKAGE', unit='kg/hr', start_time=start_time))

    elif node_type == 'storage':
        pressure = params.get('base_pressure', 100.0)
        dropout = params.get('dropout_rate', 0.01)
        dfs.append(simulate_sensor(n_readings, base_value=pressure, noise_std=pressure*0.02, dropout_rate=dropout, tag_name='PRESSURE', unit='bar', start_time=start_time))

    elif node_type == 'utilization':
        conversion_rate = params.get('conversion_rate', 95.0)
        dropout = params.get('dropout_rate', 0.01)
        dfs.append(simulate_sensor(n_readings, base_value=conversion_rate, noise_std=1.0, dropout_rate=dropout, tag_name='CONVERSION_RATE', unit='%', start_time=start_time))

    else:
        # Generic node
        val = params.get('value', 100)
        dfs.append(simulate_sensor(n_readings, base_value=val, noise_std=val*0.05, dropout_rate=0.05, tag_name='GENERIC', unit='unit', start_time=start_time))

    if dfs:
        return pd.concat(dfs, ignore_index=True)
    return pd.DataFrame()

def process_dynamic_graph(ops_graph: OperationsGraph, n_readings: int = 720):
    G = create_graph(ops_graph)
    start_time = datetime(2024, 1, 1)
    timestep_seconds = 5
    timestep_minutes = timestep_seconds / 60
    
    # 1. Simulate Raw Data
    raw_data_dict = {}
    for node_id, data in G.nodes(data=True):
        raw_data_dict[node_id] = simulate_node_data(data['type'], data['params'], n_readings, start_time)

    # 2. Apply Gap Filling Strategy
    strategy = get_strategy(ops_graph.jurisdiction)
    filled_data_dict = {}
    audit_logs = {}

    for node_id, df in raw_data_dict.items():
        if df.empty: continue
        
        node_metadata = G.nodes[node_id].get('metadata', {})
        node_metadata.update(ops_graph.metadata or {})
        
        # Pivot to wide format to process series individually
        # Need to handle BAD quality as NA for gap filling
        df_copy = df.copy()
        df_copy.loc[df_copy['quality'] == 'BAD', 'value'] = np.nan
        
        wide = df_copy.pivot_table(index='timestamp', columns='tag', values='value', dropna=False)
        
        filled_wide = pd.DataFrame(index=wide.index)
        for col in wide.columns:
            filled_wide[col] = strategy.fill(wide[col].copy(), node_metadata)
            
        filled_data_dict[node_id] = filled_wide
        audit_logs[node_id] = strategy.audit_log()

    # 3. Calculate Flows (Simplified Graph Traversal)
    # We'll assume a linear or tree-like flow for simplicity in this MVP
    # flow_in = sum(predecessor outputs)
    # flow_out = calc_node_output(flow_in, node_type)
    
    results = {}
    total_captured_co2 = 0
    total_stored_or_utilized_co2 = 0
    
    # Topological sort ensures we process dependencies first if it's a DAG
    try:
        nodes_order = list(nx.topological_sort(G))
    except nx.NetworkXUnfeasible:
        nodes_order = list(G.nodes()) # Fallback if cycle

    node_flows = {} # Store calculated output flow series for each node

    for node_id in nodes_order:
        data = G.nodes[node_id]
        filled_df = filled_data_dict.get(node_id)

        if filled_df is not None and not filled_df.empty:
            if 'EFFICIENCY' in filled_df.columns:
                filled_df['EFFICIENCY'] = filled_df['EFFICIENCY'].clip(lower=0, upper=100)
            if 'CONVERSION_RATE' in filled_df.columns:
                filled_df['CONVERSION_RATE'] = filled_df['CONVERSION_RATE'].clip(lower=0, upper=100)
        
        # Get inputs from predecessors
        preds = list(G.predecessors(node_id))
        
        # Base flow from inputs
        if not preds:
            # Root nodes: typically capture
            if data['type'] == 'capture' and filled_df is not None and not filled_df.empty:
                # flow = flow * efficiency
                if 'FLOW' in filled_df.columns and 'EFFICIENCY' in filled_df.columns:
                    flow = (filled_df['FLOW'] / 60) * (filled_df['EFFICIENCY'] / 100) # kg/min
                else:
                    timestamps = [start_time + pd.Timedelta(seconds=timestep_seconds*i) for i in range(n_readings)]
                    flow = pd.Series(0, index=timestamps)
            else:
                timestamps = [start_time + pd.Timedelta(seconds=timestep_seconds*i) for i in range(n_readings)]
                flow = pd.Series(0, index=timestamps)
        else:
            # Sum predecessor contributions while conserving mass across fan-out.
            # Each predecessor's outflow is split evenly across its outgoing edges.
            valid_preds = []
            for p in preds:
                pred_flow = node_flows.get(p)
                if pred_flow is None:
                    continue

                successors_count = G.out_degree(p)
                if successors_count > 1:
                    valid_preds.append(pred_flow / successors_count)
                else:
                    valid_preds.append(pred_flow)

            if valid_preds:
                flow = sum(valid_preds)
            else:
                timestamps = [start_time + pd.Timedelta(seconds=timestep_seconds*i) for i in range(n_readings)]
                flow = pd.Series(0, index=timestamps)

        # Apply node transformation if it has local data
        if filled_df is not None and not filled_df.empty:
            if data['type'] == 'transport':
                # flow_out = flow_in - leakage
                if 'LEAKAGE' in filled_df.columns:
                    leakage = filled_df['LEAKAGE'] / 60 # kg/min
                    flow = flow - leakage
                    flow[flow < 0] = 0 # Can't have negative flow
            elif data['type'] == 'utilization':
                # flow_out is what's successfully converted/utilized
                if 'CONVERSION_RATE' in filled_df.columns:
                    flow = flow * (filled_df['CONVERSION_RATE'] / 100)
        
        # Output is just passed through for storage/other
        node_flows[node_id] = flow
        
        # Aggregate system-level KPIs by physical component role.
        if data['type'] == 'capture':
            total_captured_co2 += (flow.sum() * timestep_minutes) / 1000
        if data['type'] in ['storage', 'utilization']:
            total_stored_or_utilized_co2 += (flow.sum() * timestep_minutes) / 1000
            
        # Join with filled_df to include raw params like EFFICIENCY and LEAKAGE
        if filled_df is not None and not filled_df.empty:
            flow_df = flow.to_frame(name='flow_kg_min').join(filled_df)
            flow_df = flow_df.reset_index().rename(columns={'index': 'timestamp'})
        else:
            flow_df = flow.reset_index().rename(columns={'index': 'timestamp', 0: 'flow_kg_min'})

        # Replace NaN/Infinity with None for JSON serialization
        flow_df = flow_df.replace([np.inf, -np.inf], np.nan)
        # Convert to object dtype first so None is preserved instead of cast back to NaN.
        flow_df = flow_df.astype(object).where(pd.notnull(flow_df), None)

        flow_total_tonnes = float((flow.sum() * timestep_minutes) / 1000)
        if not np.isfinite(flow_total_tonnes):
            flow_total_tonnes = 0.0
            
        results[node_id] = {
            'type': data['type'],
            'name': data.get('name', node_id),
            'timeseries': flow_df.to_dict('records'),
            'total_flow_tonnes': flow_total_tonnes,
            'audit': audit_logs.get(node_id, {})
        }

    total_net_co2 = float(max(0, total_captured_co2 - total_stored_or_utilized_co2))
    if not np.isfinite(total_net_co2):
        total_net_co2 = 0.0

    return {
        'nodes': results,
        'total_captured_co2_tonnes': float(total_captured_co2),
        'total_stored_or_utilized_co2_tonnes': float(total_stored_or_utilized_co2),
        'total_net_co2_tonnes': total_net_co2,
        'simulation_timestep_seconds': timestep_seconds,
        'simulation_readings': int(n_readings),
        'simulation_duration_minutes': float((n_readings * timestep_seconds) / 60),
        'jurisdiction_used': ops_graph.jurisdiction
    }
