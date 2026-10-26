import React, { useState, useEffect } from 'react';
import { X, Search, Package } from 'lucide-react';
import { AppSettings } from '../../types';

interface SettingsModalProps {
  agentStatus?: string;
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onOpenPackageManager: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings: initialSettings,
  agentStatus,
  onSaveSettings,
  onOpenPackageManager,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('canvas-grid');
  const [filterText, setFilterText] = useState('');
  const [currentSettings, setCurrentSettings] = useState<AppSettings>({
    ...initialSettings,
  });

  useEffect(() => {
    if (isOpen) {
      setCurrentSettings({ ...initialSettings });
    }
  }, [isOpen, initialSettings]);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    const defaults: AppSettings = {
      showMinimap: true,
      snapToGrid: true,
      gridDotSpacing: 24,
      showStartupModal: true,
      autoSave: true,
      precision: 6,
    };
    setCurrentSettings(defaults);
  };

  const handleApplyChanges = () => {
    onSaveSettings(currentSettings);
    onClose();
  };

  const stepGrid = (delta: number) => {
    setCurrentSettings((prev) => ({
      ...prev,
      gridDotSpacing: Math.min(48, Math.max(12, prev.gridDotSpacing + delta)),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#121214]/80 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative mathnode-modal w-[780px] max-w-[95vw] h-[520px] max-h-[90vh] flex flex-col overflow-hidden z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titlebar */}
        <div className="mathnode-modal-header shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-[24px] h-[24px] rounded-[6px] bg-[#2563EB] border border-[#60A5FA] flex items-center justify-center text-white font-bold text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              M
            </div>
            <span className="text-[13px] font-semibold text-[#EDEDED] font-sans">
              Settings
            </span>
          </div>

          <button
            onClick={onClose}
            className="btn-plastic-square w-[28px] h-[28px] text-[#8E8E96]"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation Sidebar */}
          <div className="w-[200px] bg-[#1A1A1E] border-r border-[#2A2A30] flex flex-col p-3 shrink-0">
            <div className="relative mb-3">
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter settings..."
                className="w-full h-[28px] pl-7 pr-2.5 rounded-[5px] bg-[#141416] border border-[#28282E] text-[11px] text-[#EDEDED] placeholder-[#686872] focus:outline-none focus:border-[#4B78D8] transition-colors"
              />
              <Search
                size={11}
                className="absolute left-2.5 top-[8.5px] text-[#686872]"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              <div>
                <div className="text-[9.5px] font-semibold text-[#686872] uppercase tracking-wider px-2 mb-1">
                  WORKSPACE
                </div>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setActiveCategory('canvas-grid')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-[5px] text-[11.5px] font-medium transition-colors ${
                      activeCategory === 'canvas-grid'
                        ? 'bg-[#2A2A33] border border-[#3A3A46] text-[#FFFFFF]'
                        : 'text-[#8E8E96] hover:text-[#EDEDED] hover:bg-[#222227]'
                    }`}
                  >
                    Canvas & Grid
                  </button>
                  <button
                    onClick={() => setActiveCategory('packages')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-[5px] text-[11.5px] font-medium transition-colors ${
                      activeCategory === 'packages'
                        ? 'bg-[#2A2A33] border border-[#3A3A46] text-[#FFFFFF]'
                        : 'text-[#8E8E96] hover:text-[#EDEDED] hover:bg-[#222227]'
                    }`}
                  >
                    Packages & Nodes
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[9.5px] font-semibold text-[#686872] uppercase tracking-wider px-2 mb-1">
                  GENERAL
                </div>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setActiveCategory('general')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-[5px] text-[11.5px] font-medium transition-colors ${
                      activeCategory === 'general'
                        ? 'bg-[#2A2A33] border border-[#3A3A46] text-[#FFFFFF]'
                        : 'text-[#8E8E96] hover:text-[#EDEDED] hover:bg-[#222227]'
                    }`}
                  >
                    Preferences
                  </button>
                  <button
                    onClick={() => setActiveCategory('keybindings')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-[5px] text-[11.5px] font-medium transition-colors ${
                      activeCategory === 'keybindings'
                        ? 'bg-[#2A2A33] border border-[#3A3A46] text-[#FFFFFF]'
                        : 'text-[#8E8E96] hover:text-[#EDEDED] hover:bg-[#222227]'
                    }`}
                  >
                    Keybindings
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[9.5px] font-semibold text-[#686872] uppercase tracking-wider px-2 mb-1">
                  SYSTEM
                </div>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setActiveCategory('about')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-[5px] text-[11.5px] font-medium transition-colors ${
                      activeCategory === 'about'
                        ? 'bg-[#2A2A33] border border-[#3A3A46] text-[#FFFFFF]'
                        : 'text-[#8E8E96] hover:text-[#EDEDED] hover:bg-[#222227]'
                    }`}
                  >
                    About Math Node
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content Panel */}
          <div className="flex-1 flex flex-col bg-[#1E1E22] overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {activeCategory === 'canvas-grid' && (
                <>
                  <div>
                    <h2 className="text-[14px] font-semibold text-[#EDEDED]">
                      Canvas & Grid
                    </h2>
                    <p className="text-[11.5px] text-[#8E8E96] mt-0.5">
                      Configure workspace canvas layout and navigation.
                    </p>
                  </div>

                  {/* Show Navigator Minimap */}
                  <div className="flex items-center justify-between py-2 border-b border-[#2B2B32]/60">
                    <div>
                      <div className="text-[12.5px] font-semibold text-[#EDEDED]">
                        Show Navigator Minimap
                      </div>
                      <div className="text-[11px] text-[#8E8E96] mt-0.5">
                        Floating bottom-right viewport navigator card
                      </div>
                    </div>
                    <div
                      onClick={() =>
                        setCurrentSettings((prev) => ({
                          ...prev,
                          showMinimap: !prev.showMinimap,
                        }))
                      }
                      className={`plastic-toggle shrink-0 ${
                        currentSettings.showMinimap ? 'active' : 'inactive'
                      }`}
                    >
                      <div className="plastic-toggle-knob" />
                    </div>
                  </div>

                  {/* Snap to Grid */}
                  <div className="flex items-center justify-between py-2 border-b border-[#2B2B32]/60">
                    <div>
                      <div className="text-[12.5px] font-semibold text-[#EDEDED]">
                        Snap to Grid
                      </div>
                      <div className="text-[11px] text-[#8E8E96] mt-0.5">
                        Align elements to grid increments automatically
                      </div>
                    </div>
                    <div
                      onClick={() =>
                        setCurrentSettings((prev) => ({
                          ...prev,
                          snapToGrid: !prev.snapToGrid,
                        }))
                      }
                      className={`plastic-toggle shrink-0 ${
                        currentSettings.snapToGrid ? 'active' : 'inactive'
                      }`}
                    >
                      <div className="plastic-toggle-knob" />
                    </div>
                  </div>

                  {/* Grid Dot Spacing */}
                  <div className="flex items-center justify-between py-2 border-b border-[#2B2B32]/60">
                    <div>
                      <div className="text-[12.5px] font-semibold text-[#EDEDED]">
                        Grid Dot Spacing
                      </div>
                      <div className="text-[11px] text-[#8E8E96] mt-0.5">
                        Pixel spacing between background canvas dot markers
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => stepGrid(-4)}
                        className="btn-plastic-square w-[26px] h-[26px] text-[13px] font-bold"
                      >
                        -
                      </button>
                      <div className="w-[54px] h-[26px] rounded-[5px] bg-[#141416] border border-[#2C2C34] flex items-center justify-center font-mono text-[11.5px] text-[#EDEDED]">
                        {currentSettings.gridDotSpacing}px
                      </div>
                      <button
                        onClick={() => stepGrid(4)}
                        className="btn-plastic-square w-[26px] h-[26px] text-[13px] font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Wire Thickness */}
                  <div className="flex items-center justify-between py-2 border-b border-[#2B2B32]/60">
                    <div>
                      <div className="text-[12.5px] font-semibold text-[#EDEDED]">
                        Wire Thickness
                      </div>
                      <div className="text-[11px] text-[#8E8E96] mt-0.5">
                        Stroke weight for data connection wires on canvas
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-[#141416] p-0.5 rounded-[6px] border border-[#2C2C34]">
                      {(['normal', 'bold', 'thick'] as const).map((thick) => (
                        <button
                          key={thick}
                          onClick={() =>
                            setCurrentSettings((prev) => ({
                              ...prev,
                              wireThickness: thick,
                            }))
                          }
                          className={`px-2.5 py-1 rounded-[4px] text-[11px] font-medium transition-colors capitalize ${
                            (currentSettings.wireThickness || 'bold') === thick
                              ? 'bg-[#2A2A35] text-white shadow-sm font-semibold'
                              : 'text-[#8E8E96] hover:text-[#EDEDED]'
                          }`}
                        >
                          {thick === 'normal'
                            ? 'Normal (2.5px)'
                            : thick === 'bold'
                              ? 'Bold (3.5px)'
                              : 'Thick (5px)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeCategory === 'packages' && (
                <>
                  <div>
                    <h2 className="text-[14px] font-semibold text-[#EDEDED]">
                      Packages
                    </h2>
                    <p className="text-[11.5px] text-[#8E8E96] mt-0.5">
                      Manage external mathematical node packages, definitions,
                      and extensions.
                    </p>
                  </div>

                  <div className="p-4 rounded-[8px] bg-[#161619] border border-[#2B2B34] flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <Package
                          size={16}
                          className="text-[#60A5FA] shrink-0"
                        />
                        <span className="text-[13px] font-semibold text-white">
                          Package Manager
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[#8E8E96] mt-1 leading-relaxed">
                        Install operator packages via .ZIP archives, reorder
                        category subfolders, and configure custom node
                        definitions.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        onClose();
                        onOpenPackageManager();
                      }}
                      className="btn-plastic-primary text-[11.5px] h-[32px] px-4 whitespace-nowrap shrink-0 shadow-sm"
                    >
                      Open Package Manager
                    </button>
                  </div>

                  <div className="p-3 rounded-[6px] bg-[#141416] border border-[#24242A] text-[11px] text-[#8E8E96] space-y-1">
                    <div className="font-semibold text-[#B0B0BC]">
                      Package Format & Structure:
                    </div>
                    <p>
                      Supports custom{' '}
                      <span className="font-mono text-[#D1D1D8]">.mnode</span>{' '}
                      and JSON definition schemas bundled with category
                      subdirectories.
                    </p>
                  </div>
                </>
              )}

              {activeCategory === 'general' && (
                <>
                  <div>
                    <h2 className="text-[14px] font-semibold text-[#EDEDED]">
                      Preferences
                    </h2>
                    <p className="text-[11.5px] text-[#8E8E96] mt-0.5">
                      Application startup and session behavior.
                    </p>
                  </div>

                  {/* Show Projects on startup */}
                  <div className="flex items-center justify-between py-2 border-b border-[#2B2B32]/60">
                    <div>
                      <div className="text-[12.5px] font-semibold text-[#EDEDED]">
                        Show Projects on Startup
                      </div>
                      <div className="text-[11px] text-[#8E8E96] mt-0.5">
                        Open Project Manager when no project is open or on
                        initial launch (does not interrupt ongoing projects on
                        refresh)
                      </div>
                    </div>
                    <div
                      onClick={() =>
                        setCurrentSettings((prev) => ({
                          ...prev,
                          showStartupModal: !prev.showStartupModal,
                        }))
                      }
                      className={`plastic-toggle shrink-0 ${
                        currentSettings.showStartupModal ? 'active' : 'inactive'
                      }`}
                    >
                      <div className="plastic-toggle-knob" />
                    </div>
                  </div>

                  <label className="flex items-center justify-between text-xs text-[#EDEDED]">
                    Result precision
                    <select
                      aria-label="Result precision"
                      className="bg-[#141417] border border-[#363640] rounded px-2 py-1 font-mono"
                      value={currentSettings.precision || 6}
                      onChange={(e) =>
                        setCurrentSettings((prev) => ({
                          ...prev,
                          precision: Number(e.target.value),
                        }))
                      }
                    >
                      {[3, 6, 9, 12, 15].map((p) => (
                        <option key={p} value={p}>
                          {p} significant digits
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="py-3 border-b border-[#2B2B32]/60 space-y-2">
                    <label className="flex items-center justify-between text-[12px] font-semibold">
                      Enable MCP connection
                      <input
                        aria-label="Enable MCP connection"
                        type="checkbox"
                        checked={!!currentSettings.mcpEnabled}
                        onChange={(e) =>
                          setCurrentSettings((p) => ({
                            ...p,
                            mcpEnabled: e.target.checked,
                          }))
                        }
                      />
                    </label>
                    <p className="text-[11px] text-[#8E8E96]">
                      Connect this canvas to your local MathNode agent server.
                    </p>
                    <label className="flex items-center justify-between text-[11px]">
                      Local port
                      <input
                        aria-label="MCP bridge port"
                        type="number"
                        min={1}
                        max={65535}
                        className="bg-[#141417] border border-[#2C2C34] rounded px-2 w-24"
                        value={currentSettings.mcpPort || 4319}
                        onChange={(e) =>
                          setCurrentSettings((p) => ({
                            ...p,
                            mcpPort: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                    <p
                      aria-live="polite"
                      className="text-[11px] text-[#8E8E96]"
                    >
                      {agentStatus || 'Disconnected'}
                    </p>
                  </div>
                  {/* Auto-save */}
                  <div className="flex items-center justify-between py-2 border-b border-[#2B2B32]/60">
                    <div>
                      <div className="text-[12.5px] font-semibold text-[#EDEDED]">
                        Auto-Save to Local Storage
                      </div>
                      <div className="text-[11px] text-[#8E8E96] mt-0.5">
                        Automatically persist open tabs and viewport between
                        sessions
                      </div>
                    </div>
                    <div
                      onClick={() =>
                        setCurrentSettings((prev) => ({
                          ...prev,
                          autoSave: !prev.autoSave,
                        }))
                      }
                      className={`plastic-toggle shrink-0 ${
                        currentSettings.autoSave ? 'active' : 'inactive'
                      }`}
                    >
                      <div className="plastic-toggle-knob" />
                    </div>
                  </div>
                </>
              )}

              {activeCategory === 'keybindings' && (
                <div>
                  <h2 className="text-[14px] font-semibold text-[#EDEDED] mb-1">
                    Keyboard Shortcuts
                  </h2>
                  <p className="text-[11.5px] text-[#8E8E96] mb-4">
                    Quick keyboard navigation reference.
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { key: 'Ctrl + N', desc: 'Create new graph' },
                      { key: 'Ctrl + O', desc: 'Open project file manager' },
                      { key: 'Ctrl + S', desc: 'Save current graph' },
                      { key: 'Ctrl + ,', desc: 'Open Settings' },
                      { key: 'Space + Drag', desc: 'Pan workspace canvas' },
                      { key: 'Mouse Wheel', desc: 'Zoom workspace canvas' },
                      {
                        key: 'Tab / A / Double Click',
                        desc: 'Search and add a node',
                      },
                      { key: 'F', desc: 'Frame selection or graph' },
                      {
                        key: 'Arrow Keys / Alt',
                        desc: 'Nudge selection / move freely',
                      },
                      { key: 'Ctrl + Z / Ctrl + Y', desc: 'Undo / Redo' },
                      { key: 'Ctrl + D', desc: 'Duplicate selection' },
                      {
                        key: 'Double-Click Tab',
                        desc: 'Inline rename project title',
                      },
                      { key: 'Escape', desc: 'Close open dialogs or drawers' },
                    ].map((binding) => (
                      <div
                        key={binding.key}
                        className="flex items-center justify-between p-2 rounded-[5px] bg-[#161619] border border-[#26262B]"
                      >
                        <span className="text-[12px] text-[#D1D1D8]">
                          {binding.desc}
                        </span>
                        <span className="shortcut-pill px-2">
                          {binding.key}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeCategory === 'about' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-[36px] h-[36px] rounded-[8px] bg-[#2563EB] border border-[#60A5FA] flex items-center justify-center text-white font-bold text-[18px]">
                      M
                    </div>
                    <div>
                      <h2 className="text-[15px] font-semibold text-[#EDEDED]">
                        Math Node
                      </h2>
                      <p className="text-[11.5px] text-[#8E8E96]">
                        v0.1.0 (Core Workspace Shell)
                      </p>
                    </div>
                  </div>
                  <div className="p-3 rounded-[6px] bg-[#151518] border border-[#26262B] text-[11.5px] text-[#8E8E96] space-y-1.5 leading-relaxed">
                    <p>
                      Advanced tactile mathematical calculation and manipulation
                      software.
                    </p>
                    <p className="font-mono text-[10px] text-[#686872]">
                      Built with TypeScript and React.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="h-[48px] px-6 border-t border-[#2B2B32] bg-[#1A1A1E] flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={handleResetDefaults}
                className="btn-plastic-secondary text-[12px] h-[30px] px-3.5"
              >
                Reset Defaults
              </button>
              <button
                onClick={handleApplyChanges}
                className="btn-plastic-primary text-[12px] h-[30px] px-3.5"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
