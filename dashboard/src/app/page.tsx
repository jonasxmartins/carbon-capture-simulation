"use client";

import { useState } from "react";
import OperationsMap from "@/components/OperationsMap";
import SimulationResults from "@/components/SimulationResults";
import axios from "axios";

export default function Home() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  const handleSimulate = async (graphData: any, options: { durationMinutes: number }) => {
    setLoading(true);
    setError("");
    try {
      if (!apiBaseUrl) {
        throw new Error("Missing NEXT_PUBLIC_API_BASE_URL environment variable.");
      }

      const durationMinutes = options?.durationMinutes || 12;
      const readings = Math.max(1, Math.round((durationMinutes * 60) / 5));

      const response = await axios.post(`${apiBaseUrl}/simulate`, graphData, {
        params: { readings }
      });
      setResults(response.data.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Simulation failed to run.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-8 flex flex-col gap-8">
      <div className="max-w-7xl mx-auto w-full space-y-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Carbon Operations Dashboard</h1>
          <p className="text-muted-foreground">
            Design your carbon value chain, set operational parameters, and simulate gap-filling strategies across jurisdictions.
          </p>
        </header>

        <section className="bg-white rounded-xl shadow-sm border p-4">
          <h2 className="text-xl font-semibold mb-4">Operations Map Editor</h2>
          <OperationsMap onSimulate={handleSimulate} />
          {loading && <div className="mt-4 text-center text-blue-600 animate-pulse">Running simulation...</div>}
          {error && <div className="mt-4 text-center text-red-600">{error}</div>}
        </section>

        <section>
          <SimulationResults results={results} />
        </section>
      </div>
    </main>
  );
}
