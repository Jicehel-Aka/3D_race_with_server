import React, { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { CPP_PATCH_FILES, type CodePatchFile } from '../data/cppPatches';

interface CppExportPanelProps {
  onDownloadMagentaSheet: () => void;
}

export const CppExportPanel: React.FC<CppExportPanelProps> = ({ onDownloadMagentaSheet }) => {
  const [selectedId, setSelectedId] = useState<string>(CPP_PATCH_FILES[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeFile: CodePatchFile =
    CPP_PATCH_FILES.find((f) => f.id === selectedId) || CPP_PATCH_FILES[0];

  const handleCopy = async (file: CodePatchFile) => {
    try {
      await navigator.clipboard.writeText(file.code);
      setCopiedId(file.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownloadFile = (file: CodePatchFile) => {
    const blob = new Blob([file.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header & Gamebuino AKA Hardware Budget Summary */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-mono text-slate-400">
            Cible ESP-IDF 5.5.1 · ESP32-S3 240 MHz · Écran 320×240 RGB565 · PSRAM 8 Mo
          </p>
          <h2 className="text-3xl font-bold font-display tracking-tight text-slate-100">
            Sources C++ & Optimisations Matérielles Gamebuino AKA
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Correctifs et briques C++ prêts pour le dépôt{' '}
            <code className="font-mono text-orange-300">Jicehel-Aka/Race3D-AKA</code> (commit{' '}
            <code className="font-mono text-slate-200">f0b651e</code>) : correction de l’animation des techniciens aux stands (<code className="font-mono text-slate-200">render.cpp</code> & <code className="font-mono text-slate-200">import_technicians.py</code>), rastériseur 3D virgule fixe{' '}
            <code className="font-mono text-slate-200">Q16.16</code> sans conversion flottante par pixel, et LUT trigonométrique{' '}
            <code className="font-mono text-slate-200">s_sin8[256]</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={onDownloadMagentaSheet}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Planche 3D Hybride (#FF00FF)
          </button>
          <button
            onClick={() => handleDownloadFile(activeFile)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Télécharger {activeFile.filename}
          </button>
        </div>
      </div>

      {/* Quantitative ESP32-S3 Audit Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121826] border border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-xs text-slate-400">Stands & HUD (f0b651e)</p>
          <p className="text-2xl font-bold font-mono text-slate-100 tabular-nums">4 Phases + Fixe</p>
          <p className="text-xs text-slate-400">Attente extérieure · Bandes fixes · Cadre HUD auto</p>
        </div>
        <div className="bg-[#121826] border border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-xs text-slate-400">Rastériseur 3D Virgule Fixe</p>
          <p className="text-2xl font-bold font-mono text-slate-100 tabular-nums">3× à 5× gain</p>
          <p className="text-xs text-slate-400">Boucle pixel Q16.16 · Zéro stall FPU→ALU LX7</p>
        </div>
        <div className="bg-[#121826] border border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-xs text-slate-400">Coût CPU Fond & Aurores</p>
          <p className="text-2xl font-bold font-mono text-slate-100 tabular-nums">-1.2 ms / frame</p>
          <p className="text-xs text-slate-400">LUT int16_t s_sin8[256] au lieu de 1280× sinf()</p>
        </div>
        <div className="bg-[#121826] border border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-xs text-slate-400">Trame Réseau AKA Wi-Fi</p>
          <p className="text-2xl font-bold font-mono text-slate-100 tabular-nums">20 octets @ 20 Hz</p>
          <p className="text-xs text-slate-400">0 allocation JSON · memcpy direct struct pack(1)</p>
        </div>
      </div>

      {/* File Selector + Source Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 space-y-2.5">
          {CPP_PATCH_FILES.map((file, idx) => {
            const isSel = file.id === activeFile.id;
            return (
              <button
                key={file.id}
                onClick={() => setSelectedId(file.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  isSel
                    ? 'bg-[#172033] border-orange-500 text-slate-100'
                    : 'bg-[#121826] border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-mono text-slate-400 mb-1">
                  0{idx + 1} · {file.filename}
                </div>
                <div className="text-sm font-semibold text-slate-100 mb-1.5">{file.titleFr}</div>
                <div className="text-xs text-orange-300/90 font-mono">{file.flashImpact}</div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-8 bg-[#121826] border border-slate-800 rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800 bg-[#0E1420]">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-slate-100">{activeFile.filename}</div>
              <div className="text-xs font-mono text-slate-400">Cible : {activeFile.targetPathInRepo}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(activeFile)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedId === activeFile.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copier le code
                  </>
                )}
              </button>
              <button
                onClick={() => handleDownloadFile(activeFile)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Télécharger
              </button>
            </div>
          </div>

          <div className="px-5 py-3 bg-slate-900/40 border-b border-slate-800/80 text-xs text-slate-300 leading-relaxed">
            {activeFile.summaryFr}
          </div>

          <pre className="p-5 text-xs font-mono text-slate-200 overflow-x-auto max-h-[540px] leading-relaxed bg-[#090D15]">
            <code>{activeFile.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
