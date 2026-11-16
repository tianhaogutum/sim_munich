// A single input owner keeps modal UI from leaking movement into the world.
export function createCityFeatureHost({clearInput = () => {}, isEditing = () => false} = {}) {
  const features = [];
  const panels = new Set();
  let disposed = false;
  const active = () => features.find(feature => feature.isOpen?.()) || [...panels].find(panel => panel.isOpen());
  function sync() { if (active() || isEditing()) clearInput(); }
  return {
    registerPanel(panel) { panels.add(panel); return () => panels.delete(panel); },
    add(feature) { if (disposed) throw new Error('Feature host is disposed'); features.push(feature); return feature; },
    isInputBlocked() { return disposed || !!active() || isEditing(); },
    handleKey(key, event) {
      if (disposed) return false;
      const open = active();
      if (open) { const used=open.handleKey?.(key,event); if(!used&&key==='escape')this.closePanels(); sync(); return true; }
      if (isEditing()) { clearInput(); return true; }
      for (const feature of features) if (feature.handleKey?.(key, event)) { sync(); return true; }
      for (const panel of panels) if (panel.handleKey?.(key,event)) { sync(); return true; }
      return false;
    },
    closePanels() { for (const feature of features) feature.close?.(); for(const panel of panels)panel.close(); clearInput(); },
    update(dt) { if (disposed) return; sync(); for (const feature of features) feature.update?.(dt); },
    dispose() { if (disposed) return; disposed = true; clearInput(); for (const feature of features.slice().reverse()) feature.dispose?.(); features.length = 0; for(const panel of [...panels])panel.dispose(); panels.clear(); }
  };
}
